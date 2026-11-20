import { z } from 'zod';
import { randomUUID } from 'crypto';
import { badRequest, clientIp, created, forbidden, notFound, ok, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser, readLocalDb, writeLocalDb } from '@/lib/localDb';
import { notify } from '@/lib/notifications/server';
import { processRazorpayRefund } from '@/lib/payments/service';

const requestSchema = z.object({
  bookingId: z.string().min(4),
  reason: z.string().trim().min(5).max(500),
  amount: z.number().positive().optional(),
});

const adminUpdateSchema = z.object({
  refundId: z.string().uuid(),
  status: z.enum(['under_review', 'approved', 'processing', 'completed', 'rejected']),
  adminNotes: z.string().trim().max(500).optional(),
  processViaGateway: z.boolean().default(false),
});

export const GET = route(async () => {
  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) return ok({ configured: true, refunds: [] });
    const db = readLocalDb();
    return ok({
      configured: true,
      refunds: user.role === 'admin' ? db.refunds : db.refunds.filter((r) => r.customer_id === user.id),
    });
  }
  const ctx = await requireAuth();
  let query = ctx.admin
    .from('refunds')
    .select('*, bookings(booking_code, services(name), final_total, estimated_total)')
    .order('created_at', { ascending: false });

  if (ctx.profile.role !== 'admin') {
    query = query.eq('customer_id', ctx.user.id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return ok({ configured: true, refunds: data ?? [] });
});

export const POST = route(async (req) => {
  const input = await parseBody(req, requestSchema);

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    const b = db.bookings.find((x) => x.id === input.bookingId);
    if (!b) throw notFound('Booking not found.');
    const row = {
      id: randomUUID(),
      booking_id: b.id,
      customer_id: user.id,
      amount: input.amount ?? Number(b.final_total ?? b.estimated_total ?? 0),
      reason: input.reason,
      status: 'requested',
      bookings: { booking_code: b.booking_code },
      created_at: new Date().toISOString(),
    };
    db.refunds.unshift(row);
    writeLocalDb(db);
    return created(row);
  }

  const ctx = await requireAuth(['customer']);
  const { data: b } = await ctx.admin.from('bookings').select('*').eq('id', input.bookingId).maybeSingle();
  if (!b) throw notFound('Booking not found.');
  if (b.customer_id !== ctx.user.id) throw forbidden();

  const { data: payment } = await ctx.admin
    .from('payments')
    .select('*')
    .eq('booking_id', b.id)
    .eq('status', 'paid')
    .maybeSingle();

  const maxRefundable = Number(payment?.amount ?? b.final_total ?? b.estimated_total ?? 0);
  const amount = Math.min(input.amount ?? maxRefundable, maxRefundable);
  if (amount <= 0) throw badRequest('No paid amount is eligible for refund on this booking.');

  const { data, error } = await ctx.admin
    .from('refunds')
    .insert({
      booking_id: b.id,
      payment_id: payment?.id ?? null,
      customer_id: ctx.user.id,
      amount,
      reason: input.reason,
      status: 'requested',
    })
    .select('*')
    .single();
  if (error) throw error;

  await notify(ctx.admin, {
    userIds: ctx.user.id,
    type: 'refund_update',
    title: 'Refund requested',
    body: `Your refund request for ₹${amount} on booking ${b.booking_code} is under review.`,
    data: { bookingId: b.id, url: '/orders?tab=refunds' },
  });

  return created(data);
});

export const PATCH = route(async (req) => {
  const ctx = await requireAuth(['admin']);
  const input = await parseBody(req, adminUpdateSchema);

  if (input.processViaGateway && input.status === 'completed') {
    await ctx.admin.from('refunds').update({ status: 'approved', admin_notes: input.adminNotes ?? null }).eq('id', input.refundId);
    const completed = await processRazorpayRefund(ctx.admin, input.refundId, ctx.user.id, clientIp(req));
    return ok(completed);
  }

  const { data, error } = await ctx.admin
    .from('refunds')
    .update({
      status: input.status,
      admin_notes: input.adminNotes ?? null,
      reviewed_by: ctx.user.id,
    })
    .eq('id', input.refundId)
    .select('*')
    .single();
  if (error) throw error;

  await notify(ctx.admin, {
    userIds: data.customer_id,
    type: 'refund_update',
    title: `Refund ${input.status.replace('_', ' ')}`,
    body: input.adminNotes || `Your refund of ₹${data.amount} status changed to ${input.status.replace('_', ' ')}.`,
    data: { bookingId: data.booking_id, url: '/orders?tab=refunds' },
  });

  return ok(data);
});
