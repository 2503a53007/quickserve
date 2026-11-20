import { notFound, ok, route } from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/env';
import { readLocalDb } from '@/lib/localDb';
import { createAdminSupabase } from '@/lib/supabase/server';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    const db = readLocalDb();
    const prov = db.providers.find((p) => p.id === id);
    if (prov) {
      return ok({
        ownerKind: 'provider',
        profile: prov,
        pricing: [],
        availability: [],
        reviews: db.reviews.filter((r) => r.provider_id === id),
      });
    }
    const comp = db.companies.find((c) => c.id === id);
    if (comp) {
      return ok({
        ownerKind: 'company',
        profile: comp,
        pricing: [],
        availability: [],
        reviews: db.reviews.filter((r) => r.company_id === id),
      });
    }
    throw notFound('Provider or company not found.');
  }

  const admin = createAdminSupabase();
  const { data: provider } = await admin
    .from('provider_profiles')
    .select('*, users(full_name, avatar_url)')
    .eq('id', id)
    .maybeSingle();

  if (provider) {
    const [{ data: pricing }, { data: availability }, { data: reviews }] = await Promise.all([
      admin.from('service_pricing').select('*, services(id, name, slug, description)').eq('provider_id', id).eq('is_active', true),
      admin.from('provider_availability').select('*').eq('provider_id', id).order('day_of_week'),
      admin
        .from('reviews')
        .select('*, customer:users!reviews_customer_id_fkey(full_name, avatar_url)')
        .eq('provider_id', id)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    return ok({ ownerKind: 'provider', profile: provider, pricing: pricing ?? [], availability: availability ?? [], reviews: reviews ?? [] });
  }

  const { data: company } = await admin.from('company_profiles').select('*').eq('id', id).maybeSingle();
  if (!company) throw notFound('Provider or company not found.');

  const [{ data: pricing }, { data: reviews }] = await Promise.all([
    admin.from('service_pricing').select('*, services(id, name, slug, description)').eq('company_id', id).eq('is_active', true),
    admin
      .from('reviews')
      .select('*, customer:users!reviews_customer_id_fkey(full_name, avatar_url)')
      .eq('company_id', id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return ok({ ownerKind: 'company', profile: company, pricing: pricing ?? [], availability: [], reviews: reviews ?? [] });
});
