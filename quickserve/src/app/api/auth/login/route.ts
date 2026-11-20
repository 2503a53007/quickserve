import { z } from 'zod';
import { badRequest, ok, parseBody, route } from '@/lib/api';
import { roleHome } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { createLocalUser, readLocalDb, setLocalSessionCookie, verifyPassword } from '@/lib/localDb';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import type { UserRole } from '@/types/db';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
  accountType: z.enum(['customer', 'provider', 'company']).optional(),
});

export const POST = route(async (req) => {
  const { email, password, accountType } = await parseBody(req, loginSchema);

  if (!isSupabaseConfigured()) {
    const db = readLocalDb();
    const low = email.toLowerCase();
    let user = db.users.find((u) => u.email === low);

    if (!user) {
      // First-time local dev login: register locally with scrypt-hashed password so user can sign in smoothly
      const role: UserRole = accountType ?? 'customer';
      user = createLocalUser({
        role,
        full_name: low.split('@')[0].replace(/[._-]+/g, ' '),
        email: low,
        password,
      });
    } else if (!verifyPassword(password, user.password_hash)) {
      throw badRequest('Incorrect password for this account.', 'INVALID_CREDENTIALS');
    }

    await setLocalSessionCookie(user.id);
    const { password_hash: _ph, ...safeProfile } = user;
    void _ph;
    return ok({ userId: user.id, role: user.role, profile: safeProfile, redirectTo: roleHome[user.role] });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw badRequest(error?.message || 'Invalid email or password.', 'INVALID_CREDENTIALS');
  }

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from('users').select('*').eq('id', data.user.id).maybeSingle();
  const role: UserRole = (profile?.role as UserRole) ?? 'customer';
  return ok({ userId: data.user.id, role, profile, redirectTo: roleHome[role] });
});
