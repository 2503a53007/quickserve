import 'server-only';
import { ApiError, audit, badRequest, rateLimit } from '@/lib/api';
import { decryptText, encryptText, generateOtp, hashOtp, safeEqualHex } from '@/lib/crypto';
import { isProduction } from '@/lib/env';
import { notify } from '@/lib/notifications/server';
import { sendOtpSms } from '@/lib/sms';
import type { AdminClient } from '@/lib/supabase/server';

export type ServiceOtpPurpose = 'start_service' | 'end_service';
export interface OtpPolicy { ttl_minutes: number; max_attempts: number; max_resends: number }
export const DEFAULT_OTP_POLICY: OtpPolicy = { ttl_minutes: 10, max_attempts: 5, max_resends: 3 };
const RESEND_COOLDOWN_SECONDS = 30;

async function policy(admin: AdminClient): Promise<OtpPolicy> {
  const { data } = await admin.from('platform_settings').select('value').eq('key', 'otp_policy').maybeSingle();
  return { ...DEFAULT_OTP_POLICY, ...((data?.value as Partial<OtpPolicy>) ?? {}) };
}

/**
 * Issues (or re-issues) a service OTP for a booking and delivers it to the CUSTOMER by
 * in-app notification, push and SMS. The code is never returned to the caller (the provider).
 */
export async function issueServiceOtp(admin: AdminClient, opts: {
  booking: { id: string; booking_code: string; customer_id: string };
  purpose: ServiceOtpPurpose;
  actorId: string;
  ip?: string;
}): Promise<{ expiresAt: string }> {
  const { booking, purpose } = opts;
  const pol = await policy(admin);
  await rateLimit(admin, `otp:issue:${booking.id}:${purpose}`, pol.max_resends + 1, 3600, 'Too many OTP requests for this booking. Please contact support.');

  const { data: existing } = await admin.from('otp_verifications').select('*').eq('booking_id', booking.id).eq('purpose', purpose).maybeSingle();
  if (existing?.verified_at) throw badRequest('This OTP has already been verified.', 'OTP_USED');
  if (existing && Date.now() - new Date(existing.created_at).getTime() < RESEND_COOLDOWN_SECONDS * 1000 && existing.resend_count > 0) {
    throw new ApiError(429, `Please wait ${RESEND_COOLDOWN_SECONDS} seconds before requesting another OTP.`, 'OTP_COOLDOWN');
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + pol.ttl_minutes * 60_000).toISOString();
  const row = {
    booking_id: booking.id, purpose, customer_id: booking.customer_id,
    code_hash: hashOtp(booking.id, purpose, code), code_enc: encryptText(code),
    expires_at: expiresAt, attempts: 0, max_attempts: pol.max_attempts,
    resend_count: (existing?.resend_count ?? -1) + 1, verified_at: null, verified_by: null, created_at: new Date().toISOString(),
  };
  const { error } = await admin.from('otp_verifications').upsert(row, { onConflict: 'booking_id,purpose' });
  if (error) throw error;

  const label = purpose === 'start_service' ? 'start' : 'completion';
  const { data: customer } = await admin.from('users').select('mobile').eq('id', booking.customer_id).maybeSingle();
  // The in-app notification deliberately does NOT contain the code; the customer opens the
  // booking page (authenticated) to view it. The push body/SMS contain it as is standard for OTPs.
  await notify(admin, {
    userIds: booking.customer_id,
    type: 'service_otp',
    title: `Your ${label} OTP for ${booking.booking_code}`,
    body: `Share your ${label} OTP with your professional only when you are ready. Open the booking to view it.`,
    data: { bookingId: booking.id, purpose, url: `/tracking/${booking.id}` },
  });
  if (customer?.mobile) await sendOtpSms(customer.mobile, code);
  if (!isProduction()) console.info(`[otp:dev] ${purpose} OTP for ${booking.booking_code}: ${code} (development only)`);

  await audit(admin, { actorId: opts.actorId, action: `otp.issue.${purpose}`, entity: 'booking', entityId: booking.id, ip: opts.ip, metadata: { resend: row.resend_count } });
  return { expiresAt };
}

/** Backend-only verification with attempt limits, expiry, constant-time compare and audit trail. */
export async function verifyServiceOtp(admin: AdminClient, opts: {
  bookingId: string; purpose: ServiceOtpPurpose; code: string; actorId: string; ip?: string;
}): Promise<void> {
  const { bookingId, purpose, code, actorId } = opts;
  if (!/^\d{6}$/.test(code)) throw badRequest('Enter the 6-digit OTP.', 'OTP_FORMAT');
  await rateLimit(admin, `otp:verify:${actorId}:${bookingId}`, 12, 900, 'Too many OTP attempts. Please wait 15 minutes.');

  const { data: row } = await admin.from('otp_verifications').select('*').eq('booking_id', bookingId).eq('purpose', purpose).maybeSingle();
  if (!row) throw badRequest('No OTP has been issued yet. Ask the customer to request one.', 'OTP_MISSING');
  if (row.verified_at) throw badRequest('This OTP was already used.', 'OTP_USED');
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await audit(admin, { actorId, action: `otp.expired.${purpose}`, entity: 'booking', entityId: bookingId, ip: opts.ip });
    throw badRequest('This OTP has expired. Request a new one.', 'OTP_EXPIRED');
  }
  if (row.attempts >= row.max_attempts) {
    throw new ApiError(429, 'Too many wrong attempts. Request a new OTP.', 'OTP_LOCKED');
  }

  // Count the attempt first (atomic compare-and-set) so parallel guesses can't bypass the limit.
  const { data: bumped } = await admin.from('otp_verifications')
    .update({ attempts: row.attempts + 1 })
    .eq('id', row.id).eq('attempts', row.attempts).select('id').maybeSingle();
  if (!bumped) throw new ApiError(429, 'Please try again.', 'OTP_RETRY');

  if (!safeEqualHex(row.code_hash, hashOtp(bookingId, purpose, code))) {
    await audit(admin, { actorId, action: `otp.failed.${purpose}`, entity: 'booking', entityId: bookingId, ip: opts.ip, metadata: { attempt: row.attempts + 1 } });
    const left = row.max_attempts - (row.attempts + 1);
    throw badRequest(left > 0 ? `Incorrect OTP. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Incorrect OTP. No attempts left — request a new OTP.', 'OTP_INVALID');
  }

  const { data: done } = await admin.from('otp_verifications')
    .update({ verified_at: new Date().toISOString(), verified_by: actorId })
    .eq('id', row.id).is('verified_at', null).select('id').maybeSingle();
  if (!done) throw badRequest('This OTP was already used.', 'OTP_USED');
  await audit(admin, { actorId, action: `otp.verified.${purpose}`, entity: 'booking', entityId: bookingId, ip: opts.ip });
}

/** The customer (only) reads their own active OTP. */
export async function getCustomerOtp(admin: AdminClient, bookingId: string, customerId: string) {
  const { data: rows } = await admin.from('otp_verifications').select('*').eq('booking_id', bookingId).eq('customer_id', customerId).is('verified_at', null);
  const now = Date.now();
  return (rows ?? [])
    .filter((r) => new Date(r.expires_at).getTime() > now && r.attempts < r.max_attempts)
    .map((r) => ({ purpose: r.purpose as ServiceOtpPurpose, code: decryptText(r.code_enc), expiresAt: r.expires_at as string }));
}
