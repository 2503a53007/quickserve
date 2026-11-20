import { z } from 'zod';
import { badRequest, ok, parseBody, route } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/env';
import { roleHome } from '@/lib/auth/session';
import { createLocalUser, readLocalDb, setLocalSessionCookie, verifyLocalOtp, writeLocalDb } from '@/lib/localDb';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import type { UserRole } from '@/types/db';

const verifySchema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP.'),
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().optional(),
  accountType: z.enum(['customer', 'provider', 'company']).optional(),
});

export const POST = route(async (req) => {
  const input = await parseBody(req, verifySchema);
  const e164 = `+91${input.mobile}`;

  if (!isSupabaseConfigured()) {
    const check = verifyLocalOtp(e164, 'auth', input.otp);
    if (!check.ok) throw badRequest(check.error || 'Invalid or expired OTP.', 'OTP_INVALID');

    const db = readLocalDb();
    let user = db.users.find((u) => u.mobile === e164);
    const desiredRole: UserRole = input.accountType ?? user?.role ?? 'customer';

    if (!user) {
      user = createLocalUser({
        role: desiredRole,
        full_name: input.fullName || `QuickServe User ${input.mobile.slice(-4)}`,
        mobile: e164,
        email: input.email ?? null,
      });
    } else if (input.accountType && user.role !== input.accountType) {
      user.role = input.accountType;
      writeLocalDb(db);
    }

    await setLocalSessionCookie(user.id);
    return ok({ verified: true, userId: user.id, role: user.role, redirectTo: roleHome[user.role] });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    phone: e164,
    token: input.otp,
    type: 'sms',
  });

  if (error || !data.user) {
    throw badRequest(error?.message || 'Invalid or expired OTP. Please try again.', 'OTP_INVALID');
  }

  const admin = createAdminSupabase();
  const { data: existing } = await admin.from('users').select('*').eq('id', data.user.id).maybeSingle();

  let role: UserRole = (existing?.role as UserRole) ?? 'customer';
  if (!existing) {
    const requestedRole = input.accountType ?? 'customer';
    role = requestedRole;
    await admin.from('users').insert({
      id: data.user.id,
      role: requestedRole,
      full_name: input.fullName ?? null,
      mobile: e164,
      email: input.email ?? null,
      signup_intent: requestedRole,
      profile_completed: requestedRole === 'customer' && Boolean(input.fullName),
    });
    if (requestedRole === 'customer') {
      await admin.from('customer_profiles').upsert({ user_id: data.user.id }, { onConflict: 'user_id' });
    }
  } else if (input.fullName && !existing.full_name) {
    await admin.from('users').update({ full_name: input.fullName, email: input.email ?? existing.email }).eq('id', data.user.id);
  }

  const redirectTo =
    role === 'provider' && !existing?.profile_completed
      ? '/provider/register'
      : role === 'company' && !existing?.profile_completed
        ? '/company/register'
        : roleHome[role];

  return ok({ verified: true, userId: data.user.id, role, redirectTo });
});
