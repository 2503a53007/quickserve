import 'server-only';
import { isProduction, isSmsConfigured } from '@/lib/env';

export const isTwilioConfigured = () =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);

/**
 * Sends a real 6-digit OTP SMS to an Indian mobile number (+91...).
 * Supports:
 *  1. MSG91 (recommended for production India DLT delivery)
 *  2. Twilio (fastest free-trial setup for testing real SMS to your own mobile number)
 * Returns true if an SMS gateway accepted the message; never throws.
 */
export async function sendOtpSms(mobileE164: string, otp: string): Promise<boolean> {
  // 1. MSG91 (India DLT transactional SMS)
  if (isSmsConfigured()) {
    try {
      const res = await fetch('https://control.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: { authkey: process.env.MSG91_AUTH_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID,
          short_url: '0',
          recipients: [{ mobiles: mobileE164.replace('+', ''), otp }],
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return true;
    } catch (e) {
      console.error('[sms:msg91] delivery failed', (e as Error).message);
    }
  }

  // 2. Twilio SMS (instant test SMS to verified numbers)
  if (isTwilioConfigured()) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const token = process.env.TWILIO_AUTH_TOKEN!;
      const from = process.env.TWILIO_PHONE_NUMBER!;
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const body = new URLSearchParams({
        To: mobileE164,
        From: from,
        Body: `Your QuickServe OTP is ${otp}. Valid for 5 minutes. Do not share this code.`,
      });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) return true;
      const errText = await res.text();
      console.error('[sms:twilio] error response', errText);
    } catch (e) {
      console.error('[sms:twilio] delivery failed', (e as Error).message);
    }
  }

  if (!isProduction()) {
    console.info(`[sms:dev] No SMS gateway configured. OTP for ${mobileE164}: ${otp} (dev only)`);
  }
  return false;
}
