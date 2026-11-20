import { z } from 'zod';
import { badRequest, created, parseBody, route } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/env';
import { createLocalUser, readLocalDb, setLocalSessionCookie } from '@/lib/localDb';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';

const signupSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  accountType: z.enum(['customer', 'provider', 'company']).default('customer'),
  referralCode: z.string().trim().max(24).optional(),
});

export const POST = route(async (req) => {
  const input = await parseBody(req, signupSchema);

  if (!isSupabaseConfigured()) {
    const db = readLocalDb();
    const low = input.email.toLowerCase();
    if (db.users.some((u) => u.email === low)) {
      throw badRequest('An account with this email already exists. Please sign in instead.', 'DUPLICATE_EMAIL');
    }
    const user = createLocalUser({
      role: input.accountType,
      full_name: input.fullName,
      mobile: `+91${input.mobile}`,
      email: low,
      password: input.password,
    });
    await setLocalSessionCookie(user.id);
    const redirectTo =
      input.accountType === 'provider'
        ? '/provider/register'
        : input.accountType === 'company'
          ? '/company/register'
          : '/';
    return created({ userId: user.id, role: user.role, needsEmailVerification: false, redirectTo });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.fullName,
        mobile: `+91${input.mobile}`,
        signup_intent: input.accountType,
      },
    },
  });

  if (error || !data.user) {
    throw badRequest(error?.message || 'Could not create account.', 'SIGNUP_FAILED');
  }

  const admin = createAdminSupabase();
  await admin.from('users').upsert({
    id: data.user.id,
    role: input.accountType,
    full_name: input.fullName,
    mobile: `+91${input.mobile}`,
    email: input.email,
    signup_intent: input.accountType,
    profile_completed: input.accountType === 'customer',
  });

  if (input.accountType === 'customer') {
    let referredBy: string | null = null;
    if (input.referralCode) {
      const { data: ref } = await admin.from('customer_profiles').select('user_id').eq('referral_code', input.referralCode.toUpperCase()).maybeSingle();
      referredBy = ref?.user_id ?? null;
    }
    const myCode = `QS${data.user.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    await admin.from('customer_profiles').upsert({
      user_id: data.user.id,
      referral_code: myCode,
      referred_by: referredBy,
    }, { onConflict: 'user_id' });
  }

  const redirectTo =
    input.accountType === 'provider'
      ? '/provider/register'
      : input.accountType === 'company'
        ? '/company/register'
        : '/';

  return created({
    userId: data.user.id,
    role: input.accountType,
    needsEmailVerification: !data.session,
    redirectTo,
  });
});
