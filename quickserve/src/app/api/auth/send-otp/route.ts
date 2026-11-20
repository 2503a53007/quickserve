import { z } from 'zod';
import { ApiError, badRequest, clientIp, ok, parseBody, route } from '@/lib/api';
import { isProduction, isSupabaseConfigured } from '@/lib/env';
import { issueLocalOtp } from '@/lib/localDb';
import { sendOtpSms } from '@/lib/sms';
import { createServerSupabase } from '@/lib/supabase/server';

const sendOtpSchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
});

const attempts = new Map<string, number[]>();

function checkPhoneRateLimit(key: string) {
  const now = Date.now();
  const windowMs = 15 * 60_000;
  const recent = (attempts.get(key) ?? []).filter((ts) => now - ts < windowMs);
  if (recent.length >= 8) {
    throw new ApiError(429, 'Too many OTP requests for this number. Please wait 15 minutes.', 'RATE_LIMITED');
  }
  recent.push(now);
  attempts.set(key, recent);
}

export const POST = route(async (req) => {
  const { mobile } = await parseBody(req, sendOtpSchema);
  const ip = clientIp(req);
  checkPhoneRateLimit(`${mobile}:${ip}`);

  const e164 = `+91${mobile}`;

  if (!isSupabaseConfigured()) {
    const issued = issueLocalOtp({ key: e164, purpose: 'auth' });
    const smsSent = await sendOtpSms(e164, issued.code);
    return ok({
      sent: true,
      smsSent,
      mode: smsSent ? 'sms_gateway' : 'local_dev',
      phone: e164,
      resendCooldownSeconds: 30,
      expiresInSeconds: 300,
      // Only surfaced in non-production when no real SMS gateway is configured yet
      ...(!isProduction() && !smsSent ? { devOtp: issued.code } : {}),
    });
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    phone: e164,
    options: { shouldCreateUser: true },
  });

  if (error) {
    throw badRequest(error.message || 'Could not send OTP SMS. Check Supabase Phone Auth / SMS provider settings.', 'OTP_SEND_FAILED');
  }

  return ok({ sent: true, mode: 'supabase', phone: e164, resendCooldownSeconds: 30, expiresInSeconds: 300 });
});
