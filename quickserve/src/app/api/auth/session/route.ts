import { ok, route } from '@/lib/api';
import { getAuth, getOwnedProfiles } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { clearLocalSessionCookie, getLocalSessionUser, readLocalDb } from '@/lib/localDb';
import { createServerSupabase } from '@/lib/supabase/server';

export const GET = route(async () => {
  const configured = isSupabaseConfigured();
  if (!configured) {
    const localUser = await getLocalSessionUser();
    if (!localUser) {
      await clearLocalSessionCookie();
      return ok({ configured: false, mode: 'local', user: null, profile: null, provider: null, company: null });
    }
    const db = readLocalDb();
    const { password_hash: _ph, ...safeProfile } = localUser;
    void _ph;
    const provider = db.providers.find((p) => p.user_id === localUser.id) ?? null;
    const company = db.companies.find((c) => c.user_id === localUser.id) ?? null;
    return ok({
      configured: true,
      mode: 'local',
      user: { id: localUser.id, email: localUser.email, phone: localUser.mobile },
      profile: safeProfile,
      provider,
      company,
    });
  }

  const auth = await getAuth();
  if (!auth) {
    return ok({ configured: true, mode: 'supabase', user: null, profile: null, provider: null, company: null });
  }
  const owned = await getOwnedProfiles(auth);
  return ok({
    configured: true,
    mode: 'supabase',
    user: auth.user,
    profile: auth.profile,
    provider: owned.provider,
    company: owned.company,
  });
});

export const DELETE = route(async () => {
  await clearLocalSessionCookie();
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  return ok({ signedOut: true });
});
