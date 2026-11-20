import 'server-only';
import { z } from 'zod';
import { badRequest, conflict } from '@/lib/api';
import { evaluateCoupon, computeBill, isValidHours, toPaise, type Bill, type RateCard } from '@/lib/pricing';
import { planArrival, type ArrivalPlan } from '@/lib/eta';
import { getRoute } from '@/lib/maps/server';
import { reservedEnd } from '@/lib/slots';
import { LIVE_STATUSES } from '@/lib/booking/state';
import { arrivalConfigFor, busyIntervals, haversineKm, loadOwner, loadSettings, ownerRate, ownerWindow, type Owner } from '@/lib/booking/context';
import type { AdminClient } from '@/lib/supabase/server';
import { addMinutes, toIstDateString, toIstTimeString } from '@/utils/time';
import { istToDate } from '@/utils/time';

export const quoteSchema = z.object({
  serviceId: z.string().uuid(),
  ownerKind: z.enum(['provider', 'company']),
  ownerId: z.string().uuid(),
  hours: z.number().min(1).max(12),
  couponCode: z.string().trim().toUpperCase().max(20).optional().or(z.literal('').transform(() => undefined)),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  mode: z.enum(['asap', 'scheduled']).default('scheduled'),
  /** ISO time (UTC) of the desired arrival for scheduled bookings */
  startAt: z.string().datetime().optional(),
});
export type QuoteInput = z.infer<typeof quoteSchema>;

export interface SerializedArrival {
  ok: boolean;
  reason?: string;
  message?: string;
  etaAt?: string; latestAt?: string; startsAt?: string; distanceKm?: number; travelMinutes?: number; source?: string;
}
export interface Quote {
  service: { id: string; name: string; categoryId: string; categoryName: string };
  owner: { kind: string; id: string; name: string; avatarUrl: string | null; isOnline: boolean };
  rate: RateCard;
  hours: number;
  bill: Bill;
  coupon: { code: string; discount: number } | { code: string; error: string } | null;
  arrival: SerializedArrival;
  /** internal, used by createBooking */
  _plan: ArrivalPlan;
  _ownerFull: Owner;
  _couponRow: any | null;
  _settings: Awaited<ReturnType<typeof loadSettings>>;
  _categoryId: string;
}

export async function buildQuote(admin: AdminClient, userId: string, input: QuoteInput, now = new Date()): Promise<Quote> {
  if (!isValidHours(input.hours)) throw badRequest('Duration must be between 1 and 12 hours in half-hour steps.');
  if (input.mode === 'scheduled' && !input.startAt) throw badRequest('Choose a date and time for your booking.');

  const { data: service } = await admin.from('services').select('id,name,category_id,is_active, service_categories!inner(name,is_active)').eq('id', input.serviceId).maybeSingle();
  if (!service || !service.is_active || !(service as any).service_categories.is_active) throw badRequest('This service is currently unavailable.', 'SERVICE_UNAVAILABLE');

  const owner = await loadOwner(admin, input.ownerKind, input.ownerId);
  if (!owner.verified) throw badRequest('This professional is not available for bookings.', 'OWNER_UNAVAILABLE');
  const rate = await ownerRate(admin, input.serviceId, owner);
  if (!rate) throw badRequest('This professional does not offer that service.', 'NOT_OFFERED');

  const settings = await loadSettings(admin);

  // ---- coupon -------------------------------------------------------------
  let couponRow: any = null;
  let discountPaise = 0;
  let coupon: Quote['coupon'] = null;
  if (input.couponCode) {
    const { data: c } = await admin.from('coupons').select('*').eq('code', input.couponCode).maybeSingle();
    if (!c) coupon = { code: input.couponCode, error: 'Invalid coupon code.' };
    else {
      const [{ count: used }, { count: bookingsCount }] = await Promise.all([
        admin.from('coupon_usage').select('id', { count: 'exact', head: true }).eq('coupon_id', c.id).eq('user_id', userId),
        admin.from('bookings').select('id', { count: 'exact', head: true }).eq('customer_id', userId).not('status', 'in', '(cancelled,rejected)'),
      ]);
      const pre = computeBill({ hours: input.hours, rate, taxPercent: settings.gstPercent });
      const r = evaluateCoupon(c, {
        userId, categoryId: service.category_id, orderAmount: pre.labor + pre.visiting,
        userUsageCount: used ?? 0, userCompletedOrActiveBookings: bookingsCount ?? 0, now,
      });
      if (r.valid) { couponRow = c; discountPaise = toPaise(r.discount); coupon = { code: c.code, discount: r.discount }; }
      else coupon = { code: c.code, error: r.reason };
    }
  }
  const bill = computeBill({ hours: input.hours, rate, taxPercent: settings.gstPercent, discountPaise });

  // ---- arrival ------------------------------------------------------------
  const straight = owner.lat != null && owner.lng != null ? haversineKm(input.lat, input.lng, owner.lat, owner.lng) : null;
  const { config } = await arrivalConfigFor(admin, settings.arrival, input.lat, input.lng);
  const route = straight != null && owner.lat != null && owner.lng != null
    ? await getRoute({ lat: owner.lat, lng: owner.lng }, { lat: input.lat, lng: input.lng }, straight, config.avgSpeedKmph) : null;

  // The slot that would be reserved, to test availability
  const tentativeStart = input.mode === 'scheduled' ? new Date(input.startAt!) : addMinutes(now, config.prepMinutes + (route?.durationMinutes ?? 0));
  const slotEnd = reservedEnd(tentativeStart, input.hours);
  const busy = await busyIntervals(admin, owner, addMinutes(tentativeStart, -1), slotEnd);
  const concurrent = busy.filter((b) => b.start < slotEnd && tentativeStart < b.end).length;
  let slotFree = concurrent < owner.capacity;

  // scheduled bookings must fall inside the working window
  if (slotFree && input.mode === 'scheduled') {
    const date = toIstDateString(tentativeStart);
    const win = ownerWindow(owner, date);
    const startHM = toIstTimeString(tentativeStart);
    const endHM = toIstTimeString(addMinutes(tentativeStart, input.hours * 60));
    const sameDay = toIstDateString(addMinutes(tentativeStart, input.hours * 60)) === date;
    if (!win || startHM < win.start || !sameDay || endHM > win.end || istToDate(date, win.start) > tentativeStart) slotFree = false;
  }

  const plan = planArrival({
    now, mode: input.mode, scheduledStart: input.mode === 'scheduled' ? tentativeStart : undefined,
    providerOnline: owner.isOnline, providerHasLocation: straight != null, straightLineKm: straight, serviceRadiusKm: owner.radiusKm,
    route, slotFree, config,
  });

  const arrival: SerializedArrival = plan.ok
    ? { ok: true, etaAt: plan.etaAt.toISOString(), latestAt: plan.latestAt.toISOString(), startsAt: plan.startsAt.toISOString(), distanceKm: plan.distanceKm, travelMinutes: plan.travelMinutes, source: plan.source }
    : { ok: false, reason: plan.reason, message: plan.message };

  return {
    service: { id: service.id, name: service.name, categoryId: service.category_id, categoryName: (service as any).service_categories.name },
    owner: { kind: owner.kind, id: owner.id, name: owner.name, avatarUrl: owner.avatarUrl, isOnline: owner.isOnline },
    rate, hours: input.hours, bill, coupon, arrival, _plan: plan, _ownerFull: owner, _couponRow: couponRow, _settings: settings, _categoryId: service.category_id,
  };
}

export const publicQuote = ({ _plan, _ownerFull, _couponRow, _settings, _categoryId, ...q }: Quote) => q;

export { conflict, LIVE_STATUSES };
