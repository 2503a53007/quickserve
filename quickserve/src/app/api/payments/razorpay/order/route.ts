import { z } from 'zod';
import { ok, parseBody, route } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { createRazorpayOrderForBooking } from '@/lib/payments/service';
import { publicEnv } from '@/lib/env';

const schema = z.object({ bookingId: z.string().uuid() });

export const POST = route(async (req) => {
  const ctx = await requireAuth(['customer']);
  const { bookingId } = await parseBody(req, schema);
  const res = await createRazorpayOrderForBooking(ctx.admin, bookingId, ctx.user.id);
  return ok({
    keyId: publicEnv.razorpayKeyId,
    orderId: res.order.id,
    amountPaise: res.amountPaise,
    amountRupees: res.amountRupees,
    currency: 'INR',
  });
});
