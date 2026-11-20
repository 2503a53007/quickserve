import { z } from 'zod';
import { ok, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser, readLocalDb, writeLocalDb } from '@/lib/localDb';

const tokenSchema = z.object({
  token: z.string().min(10).max(500),
  deviceLabel: z.string().max(120).optional(),
});

const readSchema = z.object({
  notificationId: z.string().uuid().optional(),
  markAll: z.boolean().optional(),
});

export const GET = route(async () => {
  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) return ok({ configured: true, notifications: [] });
    const db = readLocalDb();
    return ok({ configured: true, notifications: db.notifications.filter((n) => n.user_id === user.id) });
  }
  const ctx = await requireAuth();
  const { data, error } = await ctx.admin
    .from('notifications')
    .select('*')
    .eq('user_id', ctx.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ok({ configured: true, notifications: data ?? [] });
});

export const POST = route(async (req) => {
  if (!isSupabaseConfigured()) {
    return ok({ registered: true, mode: 'local' });
  }
  const ctx = await requireAuth();
  const { token, deviceLabel } = await parseBody(req, tokenSchema);
  await ctx.admin.from('push_tokens').upsert(
    {
      user_id: ctx.user.id,
      token,
      device_label: deviceLabel ?? 'web-browser',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );
  return ok({ registered: true });
});

export const PATCH = route(async (req) => {
  const input = await parseBody(req, readSchema);
  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    for (const n of db.notifications) {
      if (n.user_id === user.id && (input.markAll || n.id === input.notificationId)) n.is_read = true;
    }
    writeLocalDb(db);
    return ok({ updated: true });
  }
  const ctx = await requireAuth();
  if (input.markAll) {
    await ctx.admin.from('notifications').update({ is_read: true }).eq('user_id', ctx.user.id).eq('is_read', false);
  } else if (input.notificationId) {
    await ctx.admin.from('notifications').update({ is_read: true }).eq('id', input.notificationId).eq('user_id', ctx.user.id);
  }
  return ok({ updated: true });
});
