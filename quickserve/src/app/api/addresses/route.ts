import { z } from 'zod';
import { randomUUID } from 'crypto';
import { badRequest, created, ok, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser, readLocalDb, writeLocalDb } from '@/lib/localDb';

const addressSchema = z.object({
  label: z.enum(['Home', 'Office', 'Other']).default('Home'),
  line1: z.string().trim().min(4).max(200),
  line2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pin_code: z.string().regex(/^[1-9][0-9]{5}$/, 'Enter a valid 6-digit Indian PIN code.'),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  is_default: z.boolean().default(false),
});

export const GET = route(async () => {
  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) return ok({ configured: true, addresses: [] });
    const db = readLocalDb();
    return ok({ configured: true, addresses: db.addresses.filter((a) => a.user_id === user.id) });
  }
  const ctx = await requireAuth();
  const { data, error } = await ctx.admin
    .from('addresses')
    .select('*')
    .eq('user_id', ctx.user.id)
    .order('is_default', { ascending: false });
  if (error) throw error;
  return ok({ configured: true, addresses: data ?? [] });
});

export const POST = route(async (req) => {
  const input = await parseBody(req, addressSchema);
  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    const row = { id: randomUUID(), user_id: user.id, ...input };
    db.addresses.push(row);
    writeLocalDb(db);
    return created(row);
  }

  const ctx = await requireAuth();
  if (input.is_default) {
    await ctx.admin.from('addresses').update({ is_default: false }).eq('user_id', ctx.user.id);
  }
  const { data, error } = await ctx.admin
    .from('addresses')
    .insert({ ...input, user_id: ctx.user.id })
    .select('*')
    .single();
  if (error) throw error;
  return created(data);
});

export const DELETE = route(async (req) => {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) throw badRequest('Missing address id.');
  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    db.addresses = db.addresses.filter((a) => !(a.id === id && a.user_id === user.id));
    writeLocalDb(db);
    return ok({ deleted: true });
  }
  const ctx = await requireAuth();
  await ctx.admin.from('addresses').delete().eq('id', id).eq('user_id', ctx.user.id);
  return ok({ deleted: true });
});
