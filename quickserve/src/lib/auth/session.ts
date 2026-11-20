import 'server-only';
import type { NextRequest } from 'next/server';
import { createAdminSupabase, createServerSupabase, type AdminClient } from '@/lib/supabase/server';
import { forbidden, unauthorized, ApiError } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/env';
import type { UserRole, UserRow } from '@/types/db';

export interface AuthContext {
  user: { id: string; email?: string | null; phone?: string | null };
  profile: UserRow;
  /** service-role client: bypasses RLS. Only use after the role checks below. */
  admin: AdminClient;
}

/** Roles live in public.users (never in JWT metadata, which users can edit). */
export async function getAuth(): Promise<AuthContext | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminSupabase();
  const { data: profile } = await admin.from('users').select('*').eq('id', user.id).maybeSingle();
  if (!profile || !profile.is_active) return null;
  return { user, profile: profile as UserRow, admin };
}

/** For API routes: throws 401/403. Pass roles to restrict. */
export async function requireAuth(roles?: UserRole[]): Promise<AuthContext> {
  if (!isSupabaseConfigured()) throw new ApiError(503, 'The server is not configured yet (Supabase keys missing).', 'NOT_CONFIGURED');
  const ctx = await getAuth();
  if (!ctx) throw unauthorized();
  if (roles && !roles.includes(ctx.profile.role)) throw forbidden();
  return ctx;
}

/** Resolve the provider/company entity owned by the signed-in user. */
export async function getOwnedProfiles(ctx: AuthContext) {
  const [{ data: provider }, { data: company }] = await Promise.all([
    ctx.admin.from('provider_profiles').select('*').eq('user_id', ctx.user.id).maybeSingle(),
    ctx.admin.from('company_profiles').select('*').eq('user_id', ctx.user.id).maybeSingle(),
  ]);
  return { provider, company };
}

export const roleHome: Record<UserRole, string> = {
  customer: '/',
  provider: '/provider',
  company: '/company',
  admin: '/admin',
};

/** Only same-site relative paths are allowed as post-login redirects (open-redirect protection). */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}
export type { NextRequest };
