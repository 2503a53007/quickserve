import { describe, expect, it } from 'vitest';
import { billedHours, computeBill, computeFinalBill, evaluateCoupon, extraHoursCost, normaliseHours, type CouponRule } from '@/lib/pricing';
import { DEFAULT_ARRIVAL_CONFIG, estimateRoute, liveEta, planArrival } from '@/lib/eta';
import { cancellationFee, canTransition, DEFAULT_CANCELLATION_POLICY } from '@/lib/booking/state';
import { availableSlots, reservedEnd, windowFor } from '@/lib/slots';
import { decryptText, encryptText, generateOtp, hashOtp, safeEqualHex } from '@/lib/crypto';
import { istDayOfWeek, istToDate, toIstDateString, toIstTimeString } from '@/utils/time';

const rate = { firstHourPrice: 199, additionalHourPrice: 149, visitingCharge: 50 };

describe('pricing (spec example: ₹199 first hour, ₹149 extra hour, ₹50 visiting, ₹30 discount)', () => {
  it('1 hour', () => {
    const b = computeBill({ hours: 1, rate, taxPercent: 18, discountPaise: 3000 });
    expect(b.labor).toBe(199);
    expect(b.subtotal).toBe(249);
    expect(b.discount).toBe(30);
    expect(b.taxable).toBe(219);
    expect(b.tax).toBe(39.42);
    expect(b.total).toBe(258.42);
  });
  it('3 hours', () => {
    const b = computeBill({ hours: 3, rate, taxPercent: 18 });
    expect(b.labor).toBe(199 + 2 * 149);
    expect(b.total).toBe(Math.round((497 + 50) * 1.18 * 100) / 100);
  });
  it('custom 2.5 hours bills half-hours proportionally', () => {
    expect(computeBill({ hours: 2.5, rate, taxPercent: 0 }).labor).toBe(199 + 1.5 * 149);
  });
  it('discount can never exceed the bill, and total is never negative', () => {
    const b = computeBill({ hours: 1, rate, taxPercent: 18, discountPaise: 99_999_00 });
    expect(b.total).toBe(0);
    expect(b.discount).toBe(249);
  });
  it('includes materials and spare parts in the taxable value', () => {
    const b = computeBill({ hours: 1, rate, taxPercent: 18, materials: 100, spareParts: 200 });
    expect(b.subtotal).toBe(549);
    expect(b.tax).toBe(98.82);
  });
  it('normalises durations', () => {
    expect(normaliseHours(0.2)).toBe(1);
    expect(normaliseHours(2.74)).toBe(2.5);
    expect(normaliseHours(99)).toBe(12);
  });
  it('extra hours cost includes tax', () => expect(extraHoursCost(1, rate, 18)).toBe(175.82));
});

describe('final billing', () => {
  const base = { rate, taxPercent: 18, commissionPercent: 15, materials: 0, spareParts: 0 };
  it('bills actual time with grace, rounded up to half hours, min 1h, capped at approved', () => {
    expect(billedHours(20, 2)).toBe(1);   // min 1h
    expect(billedHours(68, 1)).toBe(1);   // grace + cap
    expect(billedHours(75, 3)).toBe(1.5); // (75-10)=65 → 1.5h
    expect(billedHours(300, 2)).toBe(2);  // cannot exceed approved without approval
    expect(billedHours(130, 3)).toBe(2);  // 120 → 2h
  });
  it('splits commission and provider earning; discount is platform-funded', () => {
    const f = computeFinalBill({ ...base, actualMinutes: 60, approvedHours: 1, coupon: { discount_type: 'fixed', discount_value: 30, max_discount_amount: null } });
    expect(f.commission).toBe(37.35); // 15% of (199+50)
    expect(f.providerEarning).toBe(249 - 37.35);
    expect(f.discount).toBe(30);
    expect(f.total).toBe(258.42);
  });
});

describe('coupons', () => {
  const c: CouponRule = { code: 'WELCOME50', discount_type: 'percentage', discount_value: 50, min_order_amount: 199, max_discount_amount: 150, usage_limit: 10, usage_count: 0, per_user_limit: 1,
    valid_from: '2020-01-01T00:00:00Z', valid_until: '2099-01-01T00:00:00Z', is_active: true, first_booking_only: true, applicable_category_ids: null, restricted_user_id: null };
  const ctx = { userId: 'u', categoryId: 'c', orderAmount: 249, userUsageCount: 0, userCompletedOrActiveBookings: 0 };
  it('applies percentage with cap', () => expect(evaluateCoupon(c, ctx)).toEqual({ valid: true, discount: 124.5 }));
  it('caps at max discount', () => expect(evaluateCoupon(c, { ...ctx, orderAmount: 999 })).toEqual({ valid: true, discount: 150 }));
  it('rejects non-first bookings', () => expect(evaluateCoupon(c, { ...ctx, userCompletedOrActiveBookings: 1 }).valid).toBe(false));
  it('rejects below minimum', () => expect(evaluateCoupon(c, { ...ctx, orderAmount: 100 }).valid).toBe(false));
  it('rejects expired / exhausted / reused / restricted', () => {
    expect(evaluateCoupon({ ...c, valid_until: '2020-02-01T00:00:00Z' }, ctx).valid).toBe(false);
    expect(evaluateCoupon({ ...c, usage_count: 10 }, ctx).valid).toBe(false);
    expect(evaluateCoupon(c, { ...ctx, userUsageCount: 1 }).valid).toBe(false);
    expect(evaluateCoupon({ ...c, restricted_user_id: 'other' }, ctx).valid).toBe(false);
  });
});

describe('ETA engine — never promises without data', () => {
  const now = new Date('2030-01-01T10:00:00Z');
  const cfg = DEFAULT_ARRIVAL_CONFIG;
  const base = { now, mode: 'asap' as const, providerOnline: true, providerHasLocation: true, straightLineKm: 3, serviceRadiusKm: 15, slotFree: true, config: cfg, route: estimateRoute(3, cfg.avgSpeedKmph) };

  it('plans an ASAP arrival with estimated and latest-promised time', () => {
    const p = planArrival(base);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.latestAt.getTime() - p.etaAt.getTime()).toBe(10 * 60_000);
      expect(p.etaAt.getTime()).toBeGreaterThan(now.getTime());
      expect(p.source).toBe('estimate');
    }
  });
  it('refuses with no location', () => expect(planArrival({ ...base, providerHasLocation: false, straightLineKm: null })).toMatchObject({ ok: false, reason: 'NO_LOCATION' }));
  it('refuses when offline for ASAP', () => expect(planArrival({ ...base, providerOnline: false })).toMatchObject({ ok: false, reason: 'OFFLINE' }));
  it('refuses out of range', () => expect(planArrival({ ...base, straightLineKm: 40 })).toMatchObject({ ok: false, reason: 'OUT_OF_RANGE' }));
  it('refuses when slot not free', () => expect(planArrival({ ...base, slotFree: false })).toMatchObject({ ok: false, reason: 'SLOT_UNAVAILABLE' }));
  it('refuses ASAP beyond the max promised arrival', () => {
    expect(planArrival({ ...base, straightLineKm: 14, route: { distanceKm: 18, durationMinutes: 120, source: 'google' } })).toMatchObject({ ok: false, reason: 'TOO_FAR_FOR_ASAP' });
  });
  it('refuses scheduled times inside the lead window', () => {
    expect(planArrival({ ...base, mode: 'scheduled', scheduledStart: new Date(now.getTime() + 10 * 60_000) })).toMatchObject({ ok: false, reason: 'TOO_SOON' });
    expect(planArrival({ ...base, mode: 'scheduled', scheduledStart: new Date(now.getTime() + 120 * 60_000) }).ok).toBe(true);
  });
  it('flags delay when live ETA passes the promise', () => {
    const late = liveEta(now, { distanceKm: 5, durationMinutes: 30, source: 'google_traffic' }, new Date(now.getTime() + 20 * 60_000));
    expect(late.delayed).toBe(true);
  });
});

describe('booking state machine & cancellation policy', () => {
  it('only allows legal transitions', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('pending', 'in_progress')).toBe(false);
    expect(canTransition('in_progress', 'cancelled')).toBe(false);
    expect(canTransition('completed', 'cancelled')).toBe(false);
  });
  const now = new Date('2030-01-01T10:00:00Z');
  const mk = (status: any, minsAhead: number) => ({ status, scheduled_start: new Date(now.getTime() + minsAhead * 60_000).toISOString(), visiting_charge: 50 });
  it('free when early, late fee when close, visiting charge once travelling, blocked in progress', () => {
    expect(cancellationFee(mk('provider_assigned', 180), now, DEFAULT_CANCELLATION_POLICY)).toEqual({ allowed: true, fee: 0 });
    expect(cancellationFee(mk('provider_assigned', 20), now, DEFAULT_CANCELLATION_POLICY)).toEqual({ allowed: true, fee: 50 });
    expect(cancellationFee(mk('provider_travelling', 5), now, { ...DEFAULT_CANCELLATION_POLICY, late_fee: 99 })).toEqual({ allowed: true, fee: 50 });
    expect(cancellationFee(mk('in_progress', 0), now, DEFAULT_CANCELLATION_POLICY).allowed).toBe(false);
    expect(cancellationFee(mk('pending', 5), now, DEFAULT_CANCELLATION_POLICY)).toEqual({ allowed: true, fee: 0 });
  });
});

describe('slots & IST helpers', () => {
  it('IST conversions', () => {
    expect(istToDate('2030-01-01', '09:00').toISOString()).toBe('2030-01-01T03:30:00.000Z');
    expect(toIstDateString(new Date('2030-01-01T20:00:00Z'))).toBe('2030-01-02');
    expect(toIstTimeString(new Date('2030-01-01T03:30:00Z'))).toBe('09:00');
    expect(istDayOfWeek('2030-01-01')).toBe(2); // Tuesday
  });
  const now = new Date('2029-12-31T00:00:00Z');
  const window = { start: '09:00', end: '13:00' };
  it('lists a 30-minute grid inside working hours', () => {
    const s = availableSlots({ date: '2030-01-01', hours: 1, window, busy: [], capacity: 1, now, minLeadMinutes: 45 });
    expect(s.map((x) => x.time)).toEqual(['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00']);
  });
  it('removes slots that clash with existing bookings incl. buffer', () => {
    const start = istToDate('2030-01-01', '10:00');
    const busy = [{ start, end: reservedEnd(start, 1) }]; // 10:00–11:30
    const s = availableSlots({ date: '2030-01-01', hours: 1, window, busy, capacity: 1, now, minLeadMinutes: 45 }).map((x) => x.time);
    expect(s).toEqual(['11:30', '12:00']); // 09:00 job + 30 min buffer would run into the 10:00 booking
  });
  it('companies keep slots while a worker is free', () => {
    const start = istToDate('2030-01-01', '10:00');
    const busy = [{ start, end: reservedEnd(start, 1) }];
    const s = availableSlots({ date: '2030-01-01', hours: 1, window, busy, capacity: 2, now, minLeadMinutes: 45 }).map((x) => x.time);
    expect(s).toContain('10:00');
  });
  it('respects lead time and non-working days', () => {
    const near = istToDate('2030-01-01', '09:10');
    expect(availableSlots({ date: '2030-01-01', hours: 1, window, busy: [], capacity: 1, now: near, minLeadMinutes: 45 })[0].time).toBe('10:00');
    expect(windowFor('2030-01-06', null)).toBeNull(); // Sunday default off
    expect(windowFor('2030-01-01', [{ day_of_week: 2, start_time: '08:00:00', end_time: '12:00:00', is_working: true }])).toEqual({ start: '08:00', end: '12:00' });
  });
});

describe('otp crypto', () => {
  it('generates 6-digit codes', () => { for (let i = 0; i < 50; i++) expect(generateOtp()).toMatch(/^\d{6}$/); });
  it('hash binds booking + purpose and compares safely', () => {
    const h = hashOtp('b1', 'start_service', '123456');
    expect(safeEqualHex(h, hashOtp('b1', 'start_service', '123456'))).toBe(true);
    expect(safeEqualHex(h, hashOtp('b1', 'end_service', '123456'))).toBe(false);
    expect(safeEqualHex(h, hashOtp('b2', 'start_service', '123456'))).toBe(false);
    expect(safeEqualHex(h, hashOtp('b1', 'start_service', '654321'))).toBe(false);
  });
  it('encrypts and decrypts round-trip', () => {
    const e = encryptText('987654');
    expect(e).not.toContain('987654');
    expect(decryptText(e)).toBe('987654');
  });
});
