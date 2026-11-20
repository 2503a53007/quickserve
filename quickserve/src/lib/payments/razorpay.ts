import 'server-only';
import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'crypto';
import { isRazorpayConfigured, publicEnv, serverEnv } from '@/lib/env';
import { ApiError } from '@/lib/api';

let client: Razorpay | null = null;
export function razorpay(): Razorpay {
  if (!isRazorpayConfigured()) throw new ApiError(503, 'Online payments are not configured yet. Please pay in cash or contact support.', 'PAYMENTS_NOT_CONFIGURED');
  if (!client) client = new Razorpay({ key_id: publicEnv.razorpayKeyId, key_secret: serverEnv.razorpaySecret() });
  return client;
}

const hmac = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex');
const eq = (a: string, b: string) => {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Checkout success callback signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export const verifyCheckoutSignature = (orderId: string, paymentId: string, signature: string) =>
  eq(hmac(serverEnv.razorpaySecret(), `${orderId}|${paymentId}`), signature);

/** Webhook signature: HMAC_SHA256(raw body, webhook_secret). MUST be computed over the raw body. */
export const verifyWebhookSignature = (rawBody: string, signature: string) =>
  eq(hmac(serverEnv.razorpayWebhookSecret(), rawBody), signature);

export const paise = (rupees: number) => Math.round(rupees * 100);
