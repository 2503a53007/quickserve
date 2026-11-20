import { z } from 'zod';
import { randomUUID } from 'crypto';
import { badRequest, created, forbidden, notFound, ok, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser, readLocalDb, writeLocalDb } from '@/lib/localDb';
import { createAdminSupabase } from '@/lib/supabase/server';

const createReviewSchema = z.object({
  bookingId: z.string().min(4),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(5).max(1500),
  photoUrls: z.array(z.string().url()).max(4).default([]),
});

const reportSchema = z.object({
  reviewId: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
});

export const GET = route(async (req) => {
  if (!isSupabaseConfigured()) {
    const db = readLocalDb();
    return ok({ reviews: db.reviews });
  }
  const admin = createAdminSupabase();
  const providerId = req.nextUrl.searchParams.get('providerId');
  const companyId = req.nextUrl.searchParams.get('companyId');

  let query = admin
    .from('reviews')
    .select('*, customer:users!reviews_customer_id_fkey(full_name, avatar_url), bookings(booking_code, services(name))')
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(50);

  if (providerId) query = query.eq('provider_id', providerId);
  if (companyId) query = query.eq('company_id', companyId);

  const { data, error } = await query;
  if (error) throw error;
  return ok({ reviews: data ?? [] });
});

export const POST = route(async (req) => {
  const input = await parseBody(req, createReviewSchema);

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    const b = db.bookings.find((x) => x.id === input.bookingId);
    if (!b) throw notFound('Booking not found.');
    const rev = {
      id: randomUUID(),
      booking_id: b.id,
      customer_id: user.id,
      provider_id: b.provider_id,
      company_id: b.company_id,
      rating: input.rating,
      comment: input.comment,
      customer: { full_name: user.full_name },
      bookings: { booking_code: b.booking_code, services: b.services },
      created_at: new Date().toISOString(),
    };
    db.reviews.unshift(rev);
    b.reviews = [rev];
    writeLocalDb(db);
    return created(rev);
  }

  const ctx = await requireAuth(['customer']);
  const { data: b } = await ctx.admin.from('bookings').select('*').eq('id', input.bookingId).maybeSingle();
  if (!b) throw notFound('Booking not found.');
  if (b.customer_id !== ctx.user.id) throw forbidden();
  if (b.status !== 'completed') throw badRequest('You can only review completed bookings.');

  const { data, error } = await ctx.admin
    .from('reviews')
    .insert({
      booking_id: b.id,
      customer_id: ctx.user.id,
      provider_id: b.provider_id,
      company_id: b.company_id,
      rating: input.rating,
      comment: input.comment,
      photo_urls: input.photoUrls,
    })
    .select('*')
    .single();
  if (error) throw error;
  return created(data);
});

export const PATCH = route(async (req) => {
  const ctx = await requireAuth();
  const input = await parseBody(req, reportSchema);
  const { data, error } = await ctx.admin
    .from('reviews')
    .update({ is_reported: true, report_reason: input.reason })
    .eq('id', input.reviewId)
    .select('*')
    .single();
  if (error) throw error;
  return ok(data);
});
