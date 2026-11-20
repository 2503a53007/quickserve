import { z } from 'zod';
import { badRequest, created, ok, parseBody, route } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';

const addSchema = z.object({
  serviceId: z.string().uuid().optional(),
  providerId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
});

export const GET = route(async () => {
  if (!isSupabaseConfigured()) {
    return ok({ configured: false, saved: [], frequent: [], recent: [] });
  }
  const ctx = await requireAuth(['customer']);

  const [{ data: saved }, { data: bookings }] = await Promise.all([
    ctx.admin
      .from('wishlist')
      .select('*, services(id, name, slug, default_first_hour_price, default_visiting_charge), provider:provider_profiles(id, display_name, avg_rating, total_jobs), company:company_profiles(id, company_name, avg_rating)')
      .eq('user_id', ctx.user.id)
      .order('created_at', { ascending: false }),
    ctx.admin
      .from('bookings')
      .select('id, service_id, provider_id, company_id, created_at, services(id, name, slug, default_first_hour_price, default_visiting_charge)')
      .eq('customer_id', ctx.user.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  // Compute frequently used services from completed bookings
  const freqMap = new Map<string, { service: any; count: number; lastBookedAt: string }>();
  for (const b of bookings ?? []) {
    if (!b.service_id || !(b as any).services) continue;
    const cur = freqMap.get(b.service_id);
    if (cur) cur.count += 1;
    else freqMap.set(b.service_id, { service: (b as any).services, count: 1, lastBookedAt: b.created_at });
  }
  const frequent = Array.from(freqMap.values()).sort((a, b) => b.count - a.count).slice(0, 6);

  return ok({
    configured: true,
    saved: saved ?? [],
    frequent,
    recent: (bookings ?? []).slice(0, 6),
  });
});

export const POST = route(async (req) => {
  const ctx = await requireAuth(['customer']);
  const input = await parseBody(req, addSchema);
  if (!input.serviceId && !input.providerId && !input.companyId) {
    throw badRequest('Specify a service, provider, or company to save.');
  }
  const { data, error } = await ctx.admin
    .from('wishlist')
    .insert({
      user_id: ctx.user.id,
      service_id: input.serviceId ?? null,
      provider_id: input.providerId ?? null,
      company_id: input.companyId ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return created(data);
});

export const DELETE = route(async (req) => {
  const ctx = await requireAuth(['customer']);
  const id = req.nextUrl.searchParams.get('id');
  if (!id) throw badRequest('Missing wishlist item id.');
  await ctx.admin.from('wishlist').delete().eq('id', id).eq('user_id', ctx.user.id);
  return ok({ deleted: true });
});
