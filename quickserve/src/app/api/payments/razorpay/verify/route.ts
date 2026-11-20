import { z } from 'zod';
import { clientIp, ok, parseBody, route } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { verifyAndCaptureRazorpayPayment } from '@/lib/payments/service';

const schema = z.object({
  bookingId: z.string().uuid(),
  razorpayOrderId: z.string().min(4),
  razorpayPaymentId: z.string().min(4),
  razorpaySignature: z.string().min(10),
});

export const POST = route(async (req) => {
  const ctx = await requireAuth(['customer']);
  const input = await parseBody(req, schema);
  const res = await verifyAndCaptureRazorpayPayment(
    ctx.admin,
    { ...input, customerId: ctx.user.id },
    clientIp(req),
  );
  return ok(res);
});
