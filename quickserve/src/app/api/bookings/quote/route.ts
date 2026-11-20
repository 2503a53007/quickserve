import { ok, parseBody, route } from '@/lib/api';
import { getAuth } from '@/lib/auth/session';
import { buildQuote, quoteSchema } from '@/lib/booking/quote';
import { isSupabaseConfigured } from '@/lib/env';
import { computeBill, toPaise } from '@/lib/pricing';
import { ALL_CATALOG_SERVICES, STARTER_COUPONS } from '@/lib/catalog';
import { createAdminSupabase } from '@/lib/supabase/server';

export const POST = route(async (req) => {
  if (!isSupabaseConfigured()) {
    const body = await req.json().catch(() => ({}));
    const svc = ALL_CATALOG_SERVICES.find((s) => s.id === body.serviceId || s.slug === body.serviceId) ?? ALL_CATALOG_SERVICES[0];
    const hours = Math.min(12, Math.max(1, Number(body.hours ?? 1)));
    const rate = {
      firstHourPrice: svc.firstHourPrice,
      additionalHourPrice: svc.additionalHourPrice,
      visitingCharge: svc.visitingCharge,
    };
    const coupon = body.couponCode
      ? STARTER_COUPONS.find((c) => c.code.toUpperCase() === String(body.couponCode).toUpperCase())
      : null;

    let discount = 0;
    const baseAndVisit = svc.firstHourPrice + Math.max(0, hours - 1) * svc.additionalHourPrice + svc.visitingCharge;
    if (coupon && baseAndVisit >= coupon.minOrderAmount) {
      discount =
        coupon.discountType === 'percentage'
          ? Math.min((baseAndVisit * coupon.discountValue) / 100, coupon.maxDiscountAmount ?? Infinity)
          : coupon.discountValue;
    }

    const bill = computeBill({
      hours,
      rate,
      taxPercent: 18,
      discountPaise: toPaise(discount),
    });

    return ok({
      configured: false,
      service: svc,
      rate,
      bill,
      coupon: coupon ? { code: coupon.code, discount } : null,
      arrival: null,
      note: 'Estimated pricing shown from QuickServe catalogue. Connect Supabase & Google Maps for live provider ETA.',
    });
  }

  const input = await parseBody(req, quoteSchema);
  const auth = await getAuth();
  const admin = auth?.admin ?? createAdminSupabase();
  const quote = await buildQuote(admin, auth?.user.id ?? '00000000-0000-0000-0000-000000000000', input);
  return ok({ configured: true, ...quote });
});
