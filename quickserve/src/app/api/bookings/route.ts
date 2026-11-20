import { clientIp, created, ok, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { createBooking, createBookingSchema } from '@/lib/booking/create';
import { createLocalBooking, getLocalSessionUser, readLocalDb } from '@/lib/localDb';

export const GET = route(async (req) => {
  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) return ok({ configured: true, bookings: [] });
    const db = readLocalDb();
    const list = user.role === 'admin' ? db.bookings : db.bookings.filter((b) => b.customer_id === user.id || b.provider?.user_id === user.id);
    return ok({ configured: true, bookings: list });
  }

  const ctx = await requireAuth();
  const scope = req.nextUrl.searchParams.get('scope') ?? ctx.profile.role;

  let query = ctx.admin
    .from('bookings')
    .select(
      '*, services(id, name, slug), service_categories(id, name, slug), provider:provider_profiles(id, display_name, avg_rating, user_id), company:company_profiles(id, company_name, avg_rating), invoices(*), reviews(*)',
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (scope === 'admin' && ctx.profile.role === 'admin') {
    // all bookings
  } else if (ctx.profile.role === 'provider') {
    const { data: prov } = await ctx.admin.from('provider_profiles').select('id').eq('user_id', ctx.user.id).maybeSingle();
    if (!prov) return ok({ configured: true, bookings: [] });
    query = query.eq('provider_id', prov.id);
  } else if (ctx.profile.role === 'company') {
    const { data: comp } = await ctx.admin.from('company_profiles').select('id').eq('user_id', ctx.user.id).maybeSingle();
    if (!comp) return ok({ configured: true, bookings: [] });
    query = query.eq('company_id', comp.id);
  } else {
    query = query.eq('customer_id', ctx.user.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ok({ configured: true, bookings: data ?? [] });
});

export const POST = route(async (req) => {
  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const body = await req.json();
    const booking = createLocalBooking(user, body);
    return created(booking);
  }

  const ctx = await requireAuth(['customer']);
  const input = await parseBody(req, createBookingSchema);
  const booking = await createBooking(ctx, input, clientIp(req));
  return created(booking);
});
