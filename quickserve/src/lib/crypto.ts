import 'server-only';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { serverEnv } from '@/lib/env';

/** Cryptographically secure 6-digit code (000000–999999). */
export const generateOtp = () => randomInt(0, 1_000_000).toString().padStart(6, '0');

/** Keyed hash bound to the booking and purpose so a code can't be replayed elsewhere. */
export function hashOtp(bookingId: string, purpose: string, code: string): string {
  return createHmac('sha256', serverEnv.otpSecret()).update(`${bookingId}:${purpose}:${code}`).digest('hex');
}
export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const key = () => createHash('sha256').update(serverEnv.otpEncryptionKey()).digest();

/** AES-256-GCM: lets the server show a customer their own OTP without storing it in clear text. */
export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}
export function decryptText(payload: string): string {
  const [iv, tag, enc] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
}
