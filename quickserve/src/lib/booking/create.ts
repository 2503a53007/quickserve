import 'server-only';
import { z } from 'zod';
import { audit, badRequest, conflict, rateLimit } from '@/lib/api';
import { notify } from '@/lib/notifications/server';
import { reservedEnd } from '@/lib/slots';
import { buildQuote, quoteSchema } from '@/lib/booking/quote';
import { sweepExpired } from '@/lib/booking/context';
import { isOwnUploadUrl } from '@/lib/uploads';
import { toPaise } from '@/lib/pricing';
import { addMinutes } from '@/utils/time';
import type { AuthContext } from '@/lib/auth/session';

export const createBookingSchema = quoteSchema.extend({
  addressId: z.string().uuid().optional(),
  addressLine: z.string().trim().min(5).max(250),
  addressCity: z.string().trim().min(2).max(80),
  addressState: z.string().trim().max(80).optional(),
  addressPin: z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit PIN code'),
  issueDescription: z.string().trim().max(2000).optional(),
  photoUrls: z.array(z.string().url()).max(6).default([]),
  paymentMethod: z.enum(['cash', 'upi']),
  /** the ETA the customer saw — if it changed materially we ask them to confirm again */
  expectedStartsAt: z.string().datetime().optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export async function createBooking(ctx: AuthContext, input: CreateBookingInput, ip?: string) {
  const { admin, user } = ctx;
  if (ctx.profile.role !== 'customer') throw badRequest('Only customer accounts can book services. Please use a customer account.', 'ROLE_NOT_ALLOWED');
  await rateLimit(admin, `book:${user.id}`, 10, 3600, 'You are booking too fast. Please try again later.');
  await sweepExpired(admin);

  if (input.paymentMethod === 'upi' && !process.env.RAZORPAY_KEY_SECRET) {
    // Still allowed: UPI is collected after the job; but warn early if the gateway isn't configured.
    throw badRequest('UPI payments are not configured on this server. Choose cash or contact support.', 'PAYMENTS_NOT_CONFIGURED');
  }
  for (const u of input.photoUrls) if (!isOwnUploadUrl(u, user.id)) throw badRequest('One of the photos was not uploaded through QuickServe.');

  // Never trust the client's numbers: rebuild the quote on the server, right now.
  const q = await buildQuote(admin, user.id, input);
  if (!q._plan.ok) throw conflict(q._plan.message, `ARRIVAL_${q._plan.reason}`);
  const plan = q._plan;
  if (input.expectedStartsAt && input.mode === 'asap' && Math.abs(new Date(input.expectedStartsAt).getTime() - plan.startsAt.getTime()) > 20 * 60_000) {
    throw conflict('The arrival time changed. Please review the updated time and confirm again.', 'ETA_CHANGED');
  }
  if (q.coupon && 'error' in q.coupon) throw badRequest(q.coupon.error, 'COUPON_INVALID');

  const start = plan.startsAt;
  const end = reservedEnd(start, input.hours);
  const ack = input.mode === 'asap'
    ? addMinutes(new Date(), q._settings.providerAckMinutes)
    : new Date(Math.max(Date.now() + 15 * 60_000, Math.min(Date.now() + 2 * 3600_000, start.getTime() - 30 * 60_000)));

  const { data: commission } = await admin.from('platform_commissions').select('commission_percent,category_id').eq('is_active', true)
    .or(`category_id.eq.${q._categoryId},category_id.is.null`);
  const commissionPercent = Number((commission?.find((c) => c.category_id) ?? commission?.find((c) => !c.category_id))?.commission_percent ?? 15);

  const bill = q.bill;
  const row = {
    customer_id: user.id,
    provider_id: input.ownerKind === 'provider' ? input.ownerId : null,
    company_id: input.ownerKind === 'company' ? input.ownerId : null,
    service_id: input.serviceId, category_id: q._categoryId, status: 'pending' as const, booking_mode: input.mode,
    scheduled_start: start.toISOString(), scheduled_end: end.toISOString(), estimated_hours: input.hours,
    issue_description: input.issueDescription ?? null,
    address_id: input.addressId ?? null, address_line: input.addressLine, address_city: input.addressCity, address_state: input.addressState ?? null,
    address_pin: input.addressPin, address_lat: input.lat, address_lng: input.lng,
    first_hour_price: q.rate.firstHourPrice, additional_hour_price: q.rate.additionalHourPrice, visiting_charge: q.rate.visitingCharge,
    gst_percent: q._settings.gstPercent, commission_percent: commissionPercent,
    coupon_id: q._couponRow?.id ?? null, coupon_code: q._couponRow?.code ?? null,
    estimated_base: bill.labor, estimated_discount: bill.discount, estimated_tax: bill.tax, estimated_total: bill.total,
    eta_at: plan.etaAt.toISOString(), eta_latest_at: plan.latestAt.toISOString(), eta_distance_km: plan.distanceKm,
    payment_method: input.paymentMethod, provider_ack_deadline: ack.toISOString(),
  };

  // The DB exclusion constraint / capacity trigger is the final arbiter against double booking.
  const { data: booking, error } = await admin.from('bookings').insert(row).select('*').single();
  if (error) throw error;

  if (q._couponRow) {
    const { error: cuErr } = await admin.from('coupon_usage').insert({ coupon_id: q._couponRow.id, user_id: user.id, booking_id: booking.id, discount_applied: bill.discount });
    if (cuErr) { await admin.from('bookings').delete().eq('id', booking.id); throw cuErr; }
  }
  if (input.photoUrls.length) {
    await admin.from('booking_photos').insert(input.photoUrls.map((url) => ({ booking_id: booking.id, uploaded_by: user.id, url, kind: 'issue' })));
  }
  await admin.from('booking_status_history').insert({ booking_id: booking.id, status: 'pending', changed_by: user.id, note: 'Booking placed' });

  const when = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(start);
  await notify(admin, { userIds: user.id, type: 'booking_confirmed', title: 'Booking placed 🎉', body: `${q.service.name} · ${when}. Waiting for ${q.owner.name} to accept. Booking ID ${booking.booking_code}.`, data: { bookingId: booking.id, url: `/tracking/${booking.id}` } });
  await notify(admin, { userIds: q._ownerFull.userId, type: 'booking_request', title: 'New booking request', body: `${q.service.name} · ${when} · ₹${bill.total}. Accept within ${q._settings.providerAckMinutes} minutes.`, data: { bookingId: booking.id, url: input.ownerKind === 'company' ? '/company/bookings' : '/provider/bookings' } });
  await audit(admin, { actorId: user.id, action: 'booking.create', entity: 'booking', entityId: booking.id, ip, metadata: { total: bill.total, owner: `${input.ownerKind}:${input.ownerId}`, paise: toPaise(bill.total) } });
  return booking;
}
