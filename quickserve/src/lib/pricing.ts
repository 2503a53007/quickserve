/**
 * Pricing engine — the ONLY place money is calculated. Runs on the server for every
 * quote, booking, extra-hours request and final bill; clients just display the result.
 * All arithmetic is done in integer paise to avoid floating point drift.
 */
export const MIN_HOURS = 1;
export const MAX_HOURS = 12;
export const GRACE_MINUTES = 10; // overrun grace before the next half-hour is billed

export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => paise / 100;

export interface RateCard {
  firstHourPrice: number;
  additionalHourPrice: number;
  visitingCharge: number;
}
export interface LineItem { label: string; quantity: number; rate: number; amount: number }
export interface Bill {
  hours: number;
  labor: number;          // first hour + additional hours
  visiting: number;
  materials: number;
  spareParts: number;
  subtotal: number;       // before discount
  discount: number;
  taxable: number;
  taxPercent: number;
  tax: number;
  total: number;
  lines: LineItem[];
}

/** Hours must be in 0.5 steps within [1, 12]. */
export function normaliseHours(h: number): number {
  if (!Number.isFinite(h)) throw new Error('Invalid duration');
  const r = Math.round(h * 2) / 2;
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, r));
}
export const isValidHours = (h: number) => Number.isFinite(h) && h >= MIN_HOURS && h <= MAX_HOURS && Math.abs(h * 2 - Math.round(h * 2)) < 1e-9;

export function laborPaise(hours: number, rate: RateCard): number {
  const extra = Math.max(0, hours - 1);
  return toPaise(rate.firstHourPrice) + Math.round(toPaise(rate.additionalHourPrice) * extra);
}

export interface BillInput {
  hours: number;
  rate: RateCard;
  taxPercent: number;
  discountPaise?: number;
  materials?: number;
  spareParts?: number;
}

export function computeBill(i: BillInput): Bill {
  const hours = i.hours;
  const labor = laborPaise(hours, i.rate);
  const visiting = toPaise(i.rate.visitingCharge);
  const materials = toPaise(i.materials ?? 0);
  const spare = toPaise(i.spareParts ?? 0);
  const subtotal = labor + visiting + materials + spare;
  const discount = Math.min(Math.max(0, Math.round(i.discountPaise ?? 0)), subtotal);
  const taxable = subtotal - discount;
  const tax = Math.round((taxable * i.taxPercent) / 100);
  const total = taxable + tax;

  const extraHours = Math.max(0, hours - 1);
  const lines: LineItem[] = [{ label: 'First hour', quantity: 1, rate: i.rate.firstHourPrice, amount: i.rate.firstHourPrice }];
  if (extraHours > 0) {
    lines.push({ label: 'Additional time', quantity: extraHours, rate: i.rate.additionalHourPrice, amount: toRupees(Math.round(toPaise(i.rate.additionalHourPrice) * extraHours)) });
  }
  if (visiting > 0) lines.push({ label: 'Visiting charge', quantity: 1, rate: i.rate.visitingCharge, amount: toRupees(visiting) });
  if (materials > 0) lines.push({ label: 'Materials', quantity: 1, rate: toRupees(materials), amount: toRupees(materials) });
  if (spare > 0) lines.push({ label: 'Spare parts', quantity: 1, rate: toRupees(spare), amount: toRupees(spare) });

  return {
    hours, labor: toRupees(labor), visiting: toRupees(visiting), materials: toRupees(materials), spareParts: toRupees(spare),
    subtotal: toRupees(subtotal), discount: toRupees(discount), taxable: toRupees(taxable), taxPercent: i.taxPercent,
    tax: toRupees(tax), total: toRupees(total), lines,
  };
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
export interface CouponRule {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  valid_from: string;
  valid_until: string;
  is_active: boolean;
  first_booking_only: boolean;
  applicable_category_ids: string[] | null;
  restricted_user_id: string | null;
}
export interface CouponContext {
  userId: string;
  categoryId: string;
  /** labor + visiting before discount (₹) */
  orderAmount: number;
  userUsageCount: number;
  userCompletedOrActiveBookings: number;
  now?: Date;
}
export type CouponResult = { valid: true; discount: number } | { valid: false; reason: string };

export function evaluateCoupon(c: CouponRule, x: CouponContext): CouponResult {
  const now = x.now ?? new Date();
  if (!c.is_active) return { valid: false, reason: 'This coupon is no longer active.' };
  if (now < new Date(c.valid_from)) return { valid: false, reason: 'This coupon is not active yet.' };
  if (now > new Date(c.valid_until)) return { valid: false, reason: 'This coupon has expired.' };
  if (c.restricted_user_id && c.restricted_user_id !== x.userId) return { valid: false, reason: 'This coupon is not available for your account.' };
  if (c.usage_limit != null && c.usage_count >= c.usage_limit) return { valid: false, reason: 'This coupon has reached its usage limit.' };
  if (x.userUsageCount >= c.per_user_limit) return { valid: false, reason: 'You have already used this coupon.' };
  if (c.first_booking_only && x.userCompletedOrActiveBookings > 0) return { valid: false, reason: 'This coupon is only valid on your first booking.' };
  if (c.applicable_category_ids?.length && !c.applicable_category_ids.includes(x.categoryId)) return { valid: false, reason: 'This coupon does not apply to this service.' };
  if (x.orderAmount < c.min_order_amount) return { valid: false, reason: `Add ₹${(c.min_order_amount - x.orderAmount).toFixed(0)} more to use this coupon (minimum ₹${c.min_order_amount}).` };

  let d = c.discount_type === 'percentage' ? (x.orderAmount * c.discount_value) / 100 : c.discount_value;
  if (c.max_discount_amount != null) d = Math.min(d, c.max_discount_amount);
  d = Math.min(d, x.orderAmount);
  return { valid: true, discount: Math.round(d * 100) / 100 };
}

/** Re-derive the discount on the FINAL bill with the rule locked at booking time. */
export function discountForAmount(c: Pick<CouponRule, 'discount_type' | 'discount_value' | 'max_discount_amount'>, amount: number): number {
  let d = c.discount_type === 'percentage' ? (amount * c.discount_value) / 100 : c.discount_value;
  if (c.max_discount_amount != null) d = Math.min(d, c.max_discount_amount);
  return Math.round(Math.min(d, amount) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Final billing after service
// ---------------------------------------------------------------------------
/**
 * Billed hours = actual time (10-min grace, rounded up to ½ hour), never less than the
 * 1-hour minimum and never more than the hours the customer approved (booked + approved extras).
 * Time beyond the approved hours cannot be billed unless the customer approved extra time.
 */
export function billedHours(actualMinutes: number, approvedHours: number): number {
  const effective = Math.max(0, actualMinutes - GRACE_MINUTES);
  const rounded = Math.ceil(effective / 30) / 2;
  return Math.min(approvedHours, Math.max(MIN_HOURS, rounded));
}

export function commissionFor(servicePaise: { labor: number; visiting: number }, commissionPercent: number): number {
  return Math.round(((servicePaise.labor + servicePaise.visiting) * commissionPercent) / 100);
}

export interface FinalBillInput {
  actualMinutes: number;
  approvedHours: number;
  rate: RateCard;
  taxPercent: number;
  commissionPercent: number;
  coupon?: Pick<CouponRule, 'discount_type' | 'discount_value' | 'max_discount_amount'> | null;
  materials: number;
  spareParts: number;
}
export interface FinalBill extends Bill {
  billedHours: number;
  commission: number;
  providerEarning: number;
}
export function computeFinalBill(i: FinalBillInput): FinalBill {
  const hours = billedHours(i.actualMinutes, i.approvedHours);
  const labor = toRupees(laborPaise(hours, i.rate));
  const discount = i.coupon ? discountForAmount(i.coupon, labor + i.rate.visitingCharge) : 0;
  const bill = computeBill({ hours, rate: i.rate, taxPercent: i.taxPercent, discountPaise: toPaise(discount), materials: i.materials, spareParts: i.spareParts });
  const commission = commissionFor({ labor: toPaise(bill.labor), visiting: toPaise(bill.visiting) }, i.commissionPercent);
  // Discounts are platform-funded: provider earns service value + materials − commission.
  const earning = toPaise(bill.labor) + toPaise(bill.visiting) + toPaise(bill.materials) + toPaise(bill.spareParts) - commission;
  return { ...bill, billedHours: hours, commission: toRupees(commission), providerEarning: toRupees(earning) };
}

/** Extra time requested mid-job: incremental cost (incl. tax) shown to the customer for approval. */
export function extraHoursCost(extraHours: number, rate: RateCard, taxPercent: number): number {
  const base = Math.round(toPaise(rate.additionalHourPrice) * extraHours);
  return toRupees(base + Math.round((base * taxPercent) / 100));
}
