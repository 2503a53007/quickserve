import { z } from 'zod';
import { created, ok, parseBody, route } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { CATALOG_CATEGORIES } from '@/lib/catalog';
import { isSupabaseConfigured } from '@/lib/env';
import { createAdminSupabase } from '@/lib/supabase/server';

const categorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  icon: z.string().trim().max(40).default('Wrench'),
  gradient_from: z.string().trim().default('#F97316'),
  gradient_to: z.string().trim().default('#EA580C'),
  is_emergency: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(999).default(50),
});

export const GET = route(async (req) => {
  const includeInactive = req.nextUrl.searchParams.get('all') === '1';

  if (!isSupabaseConfigured()) {
    return ok({ source: 'catalog', categories: CATALOG_CATEGORIES });
  }

  const admin = createAdminSupabase();
  let query = admin
    .from('service_categories')
    .select('*, services(*)')
    .order('sort_order', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error || !data?.length) {
    return ok({ source: 'catalog', categories: CATALOG_CATEGORIES });
  }

  return ok({ source: 'database', categories: data });
});

export const POST = route(async (req) => {
  const ctx = await requireAuth(['admin']);
  const input = await parseBody(req, categorySchema);

  if (input.id) {
    const { id, ...patch } = input;
    const { data, error } = await ctx.admin
      .from('service_categories')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return ok(data);
  }

  const { data, error } = await ctx.admin
    .from('service_categories')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return created(data);
});
