import 'server-only';
import { z } from 'zod';
import { ApiError, audit, badRequest, conflict, forbidden, notFound, rateLimit } from '@/lib/api';
import type { AuthContext } from '@/lib/auth/session';
import { notify } from '@/lib/notifications/server';
import { issueServiceOtp, verifyServiceOtp } from '@/lib/otp';
import { canTransition, cancellationFee, LIVE_STATUSES } from '@/lib/booking/state';
import { computeFinalBill, extraHoursCost, toPaise } from '@/lib/pricing';
import { createInvoice } from '@/lib/booking/invoice';
import { getRoute } from '@/lib/maps/server';
import { arrivalConfigFor, haversineKm, loadSettings } from '@/lib/booking/context';
import { liveEta } from '@/lib/eta';
import { reservedEnd } from '@/lib/slots';
import type { BookingStatus } from '@/types/db';
import { addMinutes, minutesBetween } from '@/utils/time';

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept'), workerId: z.string().uuid().optional() }),
  z.object({ action: z.literal('reject'), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal('assign'), workerId: z.string().uuid() }),
  z.object({ action: z.literal('start_travel'), lat, lng }),
  z.object({ action: z.literal('arrived'), lat, lng }),
  z.object({ action: z.literal('resend_start_otp') }),
  z.object({ action: z.literal('start_service'), otp: z.string().regex(/^\d{6}$/) }),
  z.object({
    action: z.literal('request_end_otp'),
    materialCost: z.number().min(0).max(500000).default(0),
    sparePartsCost: z.number().min(0).max(500000).default(0),
    notes: z.string().trim().max(1000).optional(),
  }),
  z.object({ action: z.literal('end_service'), otp: z.string().regex(/^\d{6}$/) }),
  z.object({ action: z.literal('cancel'), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal('request_extra_hours'), hours: z.number().min(0.5).max(8), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal('respond_extra_hours'), approve: z.boolean() }),
  z.object({ action: z.literal('collect_cash') }),
]);
export type BookingActionInput = z.infer<typeof actionSchema>;

type BookingRow = Record<string, any>;
type Role = 'customer' | 'provider' | 'company' | 'admin';

const ARRIVAL_GEOFENCE_KM = 1;

/** Which hat is the caller wearing for THIS booking? */
async function actorRole(ctx: AuthContext, b: BookingRow): Promise<{ role: Role; entityId?: string }> {
  const { profile, user, admin } = ctx;
  if (profile.role === 'admin') return { role: 'admin' };
  if (b.customer_id === user.id) return { role: 'customer' };
  if (profile.role === 'provider') {
    const { data } = await admin.from('provider_profiles').select('id,company_id').eq('user_id', user.id).maybeSingle();
    if (data && b.provider_id === data.id) return { role: 'provider', entityId: data.id };
  }
  if (profile.role === 'company') {
    const { data } = await admin.from('company_profiles').select('id').eq('user_id', user.id).maybeSingle();
    if (data && b.company_id === data.id) return { role: 'company', entityId: data.id };
    // an individual provider booking is "provider"; company bookings are "company"
  }
  // individual provider that owns the booking directly handled above
  throw forbidden('This booking does not belong to you.');
}
const need = (cond: boolean, msg = 'You cannot do that on this booking.') => { if (!cond) throw forbidden(msg); };
const when = (d: Date) => new Intl.DateTimeFormat('en-IN', { timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(d);

/** Compare-and-set status update + history row. Guards against races and illegal jumps. */
async function transition(ctx: AuthContext, b: BookingRow, to: BookingStatus, patch: Record<string, unknown>, note?: string) {
  if (!canTransition(b.status, to)) throw conflict(`This booking is ${b.status.replace(/_/g, ' ')}; it can't move to ${to.replace(/_/g, ' ')}.`, 'INVALID_STATE');
  const { data, error } = await ctx.admin.from('bookings').update({ status: to, ...patch }).eq('id', b.id).eq('status', b.status).select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw conflict('This booking was just updated by someone else. Refresh and try again.', 'STALE');
  await ctx.admin.from('booking_status_history').insert({ booking_id: b.id, status: to, changed_by: ctx.user.id, note: note ?? null });
  return data as BookingRow;
}

async function stopTracking(ctx: AuthContext, b: BookingRow) {
  if (b.provider_id) await ctx.admin.from('provider_locations').delete().eq('provider_id', b.provider_id);
}

async function companyWorker(ctx: AuthContext, companyId: string, workerId: string) {
  const { data } = await ctx.admin.from('company_employees').select('provider_id, provider_profiles!inner(id,user_id,verification_status,display_name)')
    .eq('company_id', companyId).eq('provider_id', workerId).eq('is_active', true).maybeSingle();
  if (!data || (data as any).provider_profiles.verification_status !== 'verified') throw badRequest('Choose an active, verified worker from your team.');
  return (data as any).provider_profiles as { id: string; user_id: string; display_name: string | null };
}

export async function performBookingAction(ctx: AuthContext, bookingId: string, input: BookingActionInput, ip?: string) {
  const { admin, user } = ctx;
  const { data: b0 } = await admin.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (!b0) throw notFound('Booking not found');
  const b = b0 as BookingRow;
  const actor = await actorRole(ctx, b);
  const code = b.booking_code as string;
  const link = (path: string) => ({ bookingId: b.id, url: path });
  let result: BookingRow = b;

  switch (input.action) {
    // ------------------------------------------------------------ provider / company
    case 'accept': {
      need(actor.role === 'provider' || actor.role === 'company');
      if (b.status !== 'pending') throw conflict('This request is no longer pending.', 'INVALID_STATE');
      if (actor.role === 'company' && input.workerId) {
        const w = await companyWorker(ctx, actor.entityId!, input.workerId);
        result = await transition(ctx, b, 'provider_assigned', { provider_id: w.id, confirmed_at: new Date().toISOString(), assigned_at: new Date().toISOString() }, `Accepted and assigned to ${w.display_name ?? 'worker'}`);
        await notify(admin, { userIds: w.user_id, type: 'booking_request', title: 'New job assigned', body: `Booking ${code} has been assigned to you.`, data: link('/provider/jobs') });
      } else if (actor.role === 'company') {
        result = await transition(ctx, b, 'confirmed', { confirmed_at: new Date().toISOString() }, 'Accepted by company');
      } else {
        const now = new Date().toISOString();
        result = await transition(ctx, b, 'provider_assigned', { confirmed_at: now, assigned_at: now }, 'Accepted by professional');
      }
      await notify(admin, { userIds: b.customer_id, type: result.status === 'provider_assigned' ? 'provider_assigned' : 'provider_accepted',
        title: result.status === 'provider_assigned' ? 'Professional assigned ✅' : 'Booking accepted ✅',
        body: result.status === 'provider_assigned' ? `Your professional is confirmed for ${when(new Date(b.scheduled_start))}.` : 'Your booking was accepted. A worker will be assigned shortly.', data: link(`/tracking/${b.id}`) });
      break;
    }
    case 'reject': {
      need(actor.role === 'provider' || actor.role === 'company');
      result = await transition(ctx, b, 'rejected', { rejection_reason: input.reason, cancelled_at: new Date().toISOString() }, input.reason);
      await notify(admin, { userIds: b.customer_id, type: 'booking_cancelled', title: 'Booking declined', body: `${code} could not be accepted. Please choose another professional — no charge.`, data: link('/orders') });
      break;
    }
    case 'assign': {
      need(actor.role === 'company' || actor.role === 'admin');
      if (!b.company_id) throw badRequest('Only company bookings can be assigned to workers.');
      if (!['confirmed', 'provider_assigned'].includes(b.status)) throw conflict('Accept the booking before assigning a worker.', 'INVALID_STATE');
      const w = await companyWorker(ctx, b.company_id, input.workerId);
      const now = new Date().toISOString();
      if (b.status === 'confirmed') result = await transition(ctx, b, 'provider_assigned', { provider_id: w.id, assigned_at: now }, `Assigned to ${w.display_name ?? 'worker'}`);
      else {
        const { data, error } = await admin.from('bookings').update({ provider_id: w.id, assigned_at: now }).eq('id', b.id).eq('status', 'provider_assigned').select('*').single();
        if (error) throw error;
        result = data;
      }
      await notify(admin, { userIds: w.user_id, type: 'booking_request', title: 'New job assigned', body: `Booking ${code} has been assigned to you.`, data: link('/provider/jobs') });
      await notify(admin, { userIds: b.customer_id, type: 'provider_assigned', title: 'Professional assigned ✅', body: `${w.display_name ?? 'Your professional'} will handle your booking.`, data: link(`/tracking/${b.id}`) });
      break;
    }
    case 'start_travel': {
      need(actor.role === 'provider');
      if (b.address_lat == null || b.address_lng == null) throw badRequest('This booking has no map location.');
      const settings = await loadSettings(admin);
      const { config } = await arrivalConfigFor(admin, settings.arrival, b.address_lat, b.address_lng);
      const straight = haversineKm(input.lat, input.lng, b.address_lat, b.address_lng);
      const route = await getRoute({ lat: input.lat, lng: input.lng }, { lat: b.address_lat, lng: b.address_lng }, straight, config.avgSpeedKmph);
      const eta = liveEta(new Date(), route, b.eta_latest_at ? new Date(b.eta_latest_at) : null);
      result = await transition(ctx, b, 'provider_travelling', {
        travelling_at: new Date().toISOString(), eta_at: eta.etaAt.toISOString(), eta_distance_km: route.distanceKm,
        eta_latest_at: eta.delayed ? addMinutes(eta.etaAt, config.bufferMinutes).toISOString() : b.eta_latest_at,
      }, 'Provider started travelling');
      await admin.from('provider_locations').upsert({ provider_id: actor.entityId!, booking_id: b.id, latitude: input.lat, longitude: input.lng, updated_at: new Date().toISOString() });
      await notify(admin, { userIds: b.customer_id, type: 'provider_travelling', title: 'Your professional is on the way 🚗', body: `Estimated arrival ${when(eta.etaAt)} (latest ${when(new Date(result.eta_latest_at))}). Track live.`, data: link(`/tracking/${b.id}`) });
      break;
    }
    case 'arrived': {
      need(actor.role === 'provider');
      if (b.address_lat != null && b.address_lng != null) {
        const d = haversineKm(input.lat, input.lng, b.address_lat, b.address_lng);
        if (d > ARRIVAL_GEOFENCE_KM) throw badRequest(`You seem to be ${d.toFixed(1)} km from the customer's location. Move closer to mark arrival.`, 'TOO_FAR');
      }
      result = await transition(ctx, b, 'provider_arrived', { arrived_at: new Date().toISOString() }, 'Provider arrived');
      await issueServiceOtp(admin, { booking: b as any, purpose: 'start_service', actorId: user.id, ip });
      await notify(admin, { userIds: b.customer_id, type: 'provider_arrived', title: 'Your professional has arrived 📍', body: 'Share your start OTP with them to begin the service.', data: link(`/tracking/${b.id}`) });
      break;
    }
    case 'resend_start_otp': {
      need(actor.role === 'provider');
      if (b.status !== 'provider_arrived') throw conflict('The start OTP is available after you mark arrival.', 'INVALID_STATE');
      await issueServiceOtp(admin, { booking: b as any, purpose: 'start_service', actorId: user.id, ip });
      break;
    }
    case 'start_service': {
      need(actor.role === 'provider');
      if (b.status !== 'provider_arrived') throw conflict('Mark arrival first.', 'INVALID_STATE');
      await verifyServiceOtp(admin, { bookingId: b.id, purpose: 'start_service', code: input.otp, actorId: user.id, ip });
      const now = new Date().toISOString();
      result = await transition(ctx, b, 'in_progress', { started_at: now }, 'Service started (OTP verified)');
      await admin.from('service_sessions').upsert({ booking_id: b.id, started_at: now, start_verified_by: user.id }, { onConflict: 'booking_id' });
      await stopTracking(ctx, b); // arrived: live GPS sharing ends
      await notify(admin, { userIds: b.customer_id, type: 'service_started', title: 'Service started 🛠️', body: `Your service has started at ${when(new Date(now))}.`, data: link(`/tracking/${b.id}`) });
      break;
    }
    case 'request_end_otp': {
      need(actor.role === 'provider');
      if (b.status !== 'in_progress') throw conflict('The service is not in progress.', 'INVALID_STATE');
      const { error } = await admin.from('bookings').update({ material_cost: input.materialCost, spare_parts_cost: input.sparePartsCost }).eq('id', b.id).eq('status', 'in_progress');
      if (error) throw error;
      if (input.notes) await admin.from('service_sessions').update({ provider_notes: input.notes }).eq('booking_id', b.id);
      await issueServiceOtp(admin, { booking: b as any, purpose: 'end_service', actorId: user.id, ip });
      const preview = await finalFor(admin, { ...b, material_cost: input.materialCost, spare_parts_cost: input.sparePartsCost }, Math.max(1, Math.round(minutesBetween(new Date(b.started_at), new Date()))));
      await notify(admin, { userIds: b.customer_id, type: 'service_otp', title: 'Service finished — confirm with OTP', body: `Bill preview ₹${preview.total}${input.materialCost + input.sparePartsCost > 0 ? ` (incl. ₹${input.materialCost + input.sparePartsCost} materials/parts)` : ''}. Share the completion OTP only if you're satisfied.`, data: link(`/tracking/${b.id}`) });
      result = { ...b, material_cost: input.materialCost, spare_parts_cost: input.sparePartsCost };
      break;
    }
    case 'end_service': {
      need(actor.role === 'provider');
      if (b.status !== 'in_progress') throw conflict('The service is not in progress.', 'INVALID_STATE');
      await verifyServiceOtp(admin, { bookingId: b.id, purpose: 'end_service', code: input.otp, actorId: user.id, ip });
      const now = new Date();
      const { data: fresh } = await admin.from('bookings').select('*').eq('id', b.id).single();
      const fb = fresh as BookingRow;
      const actualMinutes = Math.max(1, Math.round(minutesBetween(new Date(fb.started_at), now)));
      const final = await finalFor(admin, fb, actualMinutes);
      result = await transition(ctx, fb, 'completed', {
        completed_at: now.toISOString(), actual_hours: Math.round((actualMinutes / 60) * 100) / 100, billed_hours: final.billedHours,
        final_base: final.labor, final_discount: final.discount, final_tax: final.tax, final_total: final.total,
        commission_amount: final.commission, provider_earning: final.providerEarning,
      }, 'Service completed (OTP verified)');
      await admin.from('service_sessions').update({ ended_at: now.toISOString(), actual_minutes: actualMinutes, end_verified_by: user.id }).eq('booking_id', b.id);
      await createInvoice(admin, b.id, final);
      await stopTracking(ctx, b);
      await bumpCounters(ctx, result);
      await notify(admin, { userIds: b.customer_id, type: 'service_completed', title: 'Service completed ✅', body: `Final amount ₹${final.total} for ${final.billedHours} h. ${b.payment_method === 'upi' ? 'Pay securely with UPI.' : 'Pay your professional in cash.'}`, data: link(`/orders/${b.id}`) });
      break;
    }
    case 'collect_cash': {
      need(actor.role === 'provider');
      if (b.status !== 'completed') throw conflict('Cash can be collected after the service is completed.', 'INVALID_STATE');
      if (b.payment_method !== 'cash') throw badRequest('This booking is paid online.', 'NOT_CASH');
      const { recordCashPayment } = await import('@/lib/payments/service');
      await recordCashPayment(admin, b, user.id);
      break;
    }
    // ------------------------------------------------------------ extra hours
    case 'request_extra_hours': {
      need(actor.role === 'provider');
      if (b.status !== 'in_progress') throw conflict('Extra time can only be requested during the service.', 'INVALID_STATE');
      await rateLimit(admin, `extra:${b.id}`, 5, 3600);
      const approved = Number(b.estimated_hours) + Number(b.extra_hours_approved);
      if (approved + input.hours > 12) throw badRequest('Total duration cannot exceed 12 hours.');
      const amount = extraHoursCost(input.hours, rateOf(b), Number(b.gst_percent));
      const { error } = await admin.from('extra_hour_requests').insert({ booking_id: b.id, requested_by: user.id, hours: input.hours, reason: input.reason, extra_amount: amount });
      if (error) throw error.code === '23505' ? conflict('There is already a pending extra-time request.', 'DUPLICATE') : error;
      await notify(admin, { userIds: b.customer_id, type: 'extra_hours', title: 'Extra time requested ⏱️', body: `Your professional needs ${input.hours} more hour(s): "${input.reason}". Extra cost ₹${amount}. Approve or decline in the app.`, data: link(`/tracking/${b.id}`) });
      break;
    }
    case 'respond_extra_hours': {
      need(actor.role === 'customer');
      const { data: req } = await admin.from('extra_hour_requests').select('*').eq('booking_id', b.id).eq('status', 'requested').maybeSingle();
      if (!req) throw notFound('There is no pending extra-time request.');
      if (b.status !== 'in_progress') throw conflict('The service is no longer in progress.', 'INVALID_STATE');
      if (!input.approve) {
        await admin.from('extra_hour_requests').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', req.id);
        await notify(admin, { userIds: await providerUserId(ctx, b), type: 'extra_hours', title: 'Extra time declined', body: `The customer declined extra time for ${code}. Please wrap up within the booked time.`, data: link('/provider/jobs') });
        break;
      }
      const newEnd = addMinutes(new Date(b.scheduled_end), Number(req.hours) * 60);
      // Extending the slot may collide with the provider's next booking — the DB constraint decides.
      const { error } = await admin.from('bookings').update({ extra_hours_approved: Number(b.extra_hours_approved) + Number(req.hours), scheduled_end: newEnd.toISOString() }).eq('id', b.id);
      if (error) {
        await admin.from('extra_hour_requests').update({ status: 'rejected', decided_at: new Date().toISOString() }).eq('id', req.id);
        if ((error as any).code === '23P01') throw conflict('Your professional has another booking right after this one, so extra time is not possible.', 'SLOT_TAKEN');
        throw error;
      }
      await admin.from('extra_hour_requests').update({ status: 'approved', decided_at: new Date().toISOString() }).eq('id', req.id);
      await notify(admin, { userIds: await providerUserId(ctx, b), type: 'extra_hours', title: 'Extra time approved ✅', body: `The customer approved ${req.hours} extra hour(s) for ${code}.`, data: link('/provider/jobs') });
      break;
    }
    // ------------------------------------------------------------ cancel
    case 'cancel': {
      const settings = await loadSettings(admin);
      let fee = 0;
      if (actor.role === 'customer') {
        const r = cancellationFee(b as any, new Date(), settings.cancellation);
        if (!r.allowed) throw conflict(r.reason ?? 'This booking cannot be cancelled.', 'CANNOT_CANCEL');
        fee = r.fee;
      } else {
        if (!LIVE_STATUSES.includes(b.status) || b.status === 'in_progress') throw conflict('This booking cannot be cancelled now.', 'CANNOT_CANCEL');
        if (actor.role === 'provider' && b.status === 'pending') throw badRequest('Use "Decline" for new requests.');
      }
      const patch: Record<string, unknown> = { cancelled_at: new Date().toISOString(), cancelled_by: user.id, cancellation_reason: input.reason, cancellation_fee: fee };
      if (fee > 0) Object.assign(patch, { final_total: fee });
      result = await transition(ctx, b, 'cancelled', patch, `Cancelled by ${actor.role}: ${input.reason}`);
      await stopTracking(ctx, b);
      if (b.coupon_id && fee === 0) await admin.from('coupon_usage').delete().eq('booking_id', b.id); // release the coupon
      const targets = [b.customer_id, ...(actor.role === 'customer' ? await ownerUserIds(ctx, b) : [])].filter((id) => id !== user.id);
      await notify(admin, { userIds: targets, type: 'booking_cancelled', title: 'Booking cancelled', body: `${code} was cancelled${actor.role === 'customer' && fee > 0 ? ` (fee ₹${fee})` : ''}. Reason: ${input.reason}`, data: link('/orders') });
      break;
    }
  }

  await audit(admin, { actorId: user.id, action: `booking.${input.action}`, entity: 'booking', entityId: b.id, ip, metadata: { from: b.status, to: result.status, role: actor.role } });
  return result;
}

function rateOf(b: BookingRow) {
  return { firstHourPrice: Number(b.first_hour_price), additionalHourPrice: Number(b.additional_hour_price), visitingCharge: Number(b.visiting_charge) };
}
/** Final bill for a booking using the locked rate card, locked coupon rule and approved hours. */
export async function finalFor(admin: AuthContext['admin'], b: BookingRow, actualMinutes: number) {
  let coupon: any = null;
  if (b.coupon_id) {
    const { data } = await admin.from('coupons').select('discount_type,discount_value,max_discount_amount').eq('id', b.coupon_id).maybeSingle();
    coupon = data;
  }
  return computeFinalBill({
    actualMinutes, approvedHours: Number(b.estimated_hours) + Number(b.extra_hours_approved), rate: rateOf(b),
    taxPercent: Number(b.gst_percent), commissionPercent: Number(b.commission_percent), coupon,
    materials: Number(b.material_cost), spareParts: Number(b.spare_parts_cost),
  });
}

async function providerUserId(ctx: AuthContext, b: BookingRow): Promise<string[]> {
  if (!b.provider_id) return [];
  const { data } = await ctx.admin.from('provider_profiles').select('user_id').eq('id', b.provider_id).maybeSingle();
  return data ? [data.user_id] : [];
}
async function ownerUserIds(ctx: AuthContext, b: BookingRow): Promise<string[]> {
  const ids = await providerUserId(ctx, b);
  if (b.company_id) {
    const { data } = await ctx.admin.from('company_profiles').select('user_id').eq('id', b.company_id).maybeSingle();
    if (data) ids.push(data.user_id);
  }
  return ids;
}

async function bumpCounters(ctx: AuthContext, b: BookingRow) {
  const { admin } = ctx;
  if (b.provider_id) {
    const { data } = await admin.from('provider_profiles').select('total_jobs').eq('id', b.provider_id).single();
    await admin.from('provider_profiles').update({ total_jobs: (data?.total_jobs ?? 0) + 1 }).eq('id', b.provider_id);
  }
  if (b.company_id) {
    const { data } = await admin.from('company_profiles').select('total_jobs').eq('id', b.company_id).single();
    await admin.from('company_profiles').update({ total_jobs: (data?.total_jobs ?? 0) + 1 }).eq('id', b.company_id);
  }
  const { data: cp } = await admin.from('customer_profiles').select('total_bookings, referred_by').eq('user_id', b.customer_id).maybeSingle();
  await admin.from('customer_profiles').update({ total_bookings: (cp?.total_bookings ?? 0) + 1 }).eq('user_id', b.customer_id);
  // Referral reward: referrer gets a one-time ₹100 coupon on the referee's FIRST completed booking
  if (cp?.referred_by && (cp.total_bookings ?? 0) === 0) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    await admin.from('coupons').insert({
      code: `REF${suffix}`, title: 'Referral reward', description: 'Thanks for referring a friend! ₹100 off your next booking.', coupon_type: 'referral',
      discount_type: 'fixed', discount_value: 100, min_order_amount: 299, per_user_limit: 1, usage_limit: 1,
      valid_until: new Date(Date.now() + 90 * 86400_000).toISOString(), restricted_user_id: cp.referred_by,
    });
    await notify(admin, { userIds: cp.referred_by, type: 'new_offer', title: 'You earned ₹100 🎁', body: 'Your friend completed their first booking. A referral coupon is waiting in Offers.', data: { url: '/offers' } });
  }
}

export { toPaise, reservedEnd };
