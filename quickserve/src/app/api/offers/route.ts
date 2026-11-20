import { z } from 'zod';
import { created, ok, parseBody, route } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { STARTER_COUPONS } from '@/lib/catalog';
import { isSupabaseConfigured } from '@/lib/env';
import { createAdminSupabase } from '@/lib/supabase/server';

const couponSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(3).max(24).transform((s) => s.toUpperCase()),
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(300).optional(),
  coupon_type: z.enum(['general', 'first_booking', 'festival', 'seasonal', 'referral']).default('general'),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().positive(),
  min_order_amount: z.number().min(0).default(0),
  max_discount_amount: z.number().positive().nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().positive().default(1),
  valid_until: z.string().datetime(),
  is_active: z.boolean().default(true),
  first_booking_only: z.boolean().default(false),
});

export const GET = route(async () => {
  if (!isSupabaseConfigured()) {
    return ok({ source: 'catalog', coupons: STARTER_COUPONS });
  }
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from('coupons')
    .select('*')
    .eq('is_active', true)
    .is('restricted_user_id', null)
    .gte('valid_until', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error || !data?.length) {
    return ok({ source: 'catalog', coupons: STARTER_COUPONS });
  }
  return ok({ source: 'database', coupons: data });
});

export const POST = route(async (req) => {
  const ctx = await requireAuth(['admin']);
  const input = await parseBody(req, couponSchema);

  if (input.id) {
    const { id, ...patch } = input;
    const { data, error } = await ctx.admin.from('coupons').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return ok(data);
  }

  const { data, error } = await ctx.admin
    .from('coupons')
    .insert({ ...input, valid_from: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw error;
  return created(data);
});
