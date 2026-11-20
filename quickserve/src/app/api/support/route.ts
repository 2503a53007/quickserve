import { z } from 'zod';
import { randomInt, randomUUID } from 'crypto';
import { created, ok, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser, readLocalDb, writeLocalDb } from '@/lib/localDb';
import { notify } from '@/lib/notifications/server';

const createTicketSchema = z.object({
  category: z.enum(['booking', 'payment', 'refund', 'provider', 'account', 'other']),
  subject: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(2000),
  bookingId: z.string().uuid().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
});

const adminReplySchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
  adminResponse: z.string().trim().min(2).max(2000),
});

export const GET = route(async () => {
  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) return ok({ configured: true, tickets: [] });
    const db = readLocalDb();
    return ok({
      configured: true,
      tickets: user.role === 'admin' ? db.tickets : db.tickets.filter((t) => t.user_id === user.id),
    });
  }
  const ctx = await requireAuth();

  let query = ctx.admin
    .from('support_tickets')
    .select('*, users!support_tickets_user_id_fkey(full_name, email, mobile)')
    .order('created_at', { ascending: false });

  if (ctx.profile.role !== 'admin') {
    query = query.eq('user_id', ctx.user.id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return ok({ configured: true, tickets: data ?? [] });
});

export const POST = route(async (req) => {
  const input = await parseBody(req, createTicketSchema);

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    const row = {
      id: randomUUID(),
      ticket_code: `SUP-${randomInt(10000, 99999)}`,
      user_id: user.id,
      category: input.category,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      status: 'open',
      created_at: new Date().toISOString(),
    };
    db.tickets.unshift(row);
    writeLocalDb(db);
    return created(row);
  }

  const ctx = await requireAuth();
  const { data, error } = await ctx.admin
    .from('support_tickets')
    .insert({
      user_id: ctx.user.id,
      booking_id: input.bookingId ?? null,
      category: input.category,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
    })
    .select('*')
    .single();
  if (error) throw error;
  return created(data);
});

export const PATCH = route(async (req) => {
  const ctx = await requireAuth(['admin']);
  const input = await parseBody(req, adminReplySchema);
  const { data, error } = await ctx.admin
    .from('support_tickets')
    .update({
      status: input.status,
      admin_response: input.adminResponse,
      resolved_by: ctx.user.id,
      resolved_at: ['resolved', 'closed'].includes(input.status) ? new Date().toISOString() : null,
    })
    .eq('id', input.ticketId)
    .select('*')
    .single();
  if (error) throw error;

  await notify(ctx.admin, {
    userIds: data.user_id,
    type: 'ticket_update',
    title: `Support Ticket ${data.ticket_code} updated`,
    body: input.adminResponse,
    data: { url: '/support' },
  });

  return ok(data);
});
