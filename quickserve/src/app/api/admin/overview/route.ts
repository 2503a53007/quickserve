import { z } from 'zod';
import { audit, clientIp, ok, parseBody, route } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { readLocalDb, writeLocalDb } from '@/lib/localDb';
import { notify } from '@/lib/notifications/server';

const adminActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('verify_provider'),
    providerId: z.string().uuid(),
    status: z.enum(['verified', 'rejected', 'suspended']),
    note: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal('verify_company'),
    companyId: z.string().uuid(),
    status: z.enum(['verified', 'rejected', 'suspended']),
    note: z.string().trim().max(300).optional(),
  }),
  z.object({
    action: z.literal('update_commission'),
    commissionPercent: z.number().min(0).max(50),
  }),
  z.object({
    action: z.literal('update_arrival_sla'),
    avgSpeedKmph: z.number().min(8).max(60),
    prepMinutes: z.number().min(2).max(60),
    bufferMinutes: z.number().min(5).max(60),
    maxArrivalMinutes: z.number().min(20).max(180),
    maxRadiusKm: z.number().min(3).max(60),
  }),
  z.object({
    action: z.literal('broadcast_notification'),
    title: z.string().trim().min(3).max(100),
    body: z.string().trim().min(5).max(300),
    targetRole: z.enum(['all', 'customer', 'provider', 'company']).default('all'),
  }),
]);

export const GET = route(async () => {
  if (!isSupabaseConfigured()) {
    const db = readLocalDb();
    const bList = db.bookings;
    const completed = bList.filter((b) => b.status === 'completed');
    const active = bList.filter((b) =>
      ['pending', 'confirmed', 'provider_assigned', 'provider_travelling', 'provider_arrived', 'in_progress'].includes(b.status),
    );
    const cancelled = bList.filter((b) => b.status === 'cancelled' || b.status === 'rejected');

    return ok({
      configured: true,
      mode: 'local',
      metrics: {
        totalCustomers: db.users.filter((u) => u.role === 'customer').length,
        totalProviders: db.providers.length,
        totalCompanies: db.companies.length,
        activeBookings: active.length,
        completedBookings: completed.length,
        cancelledBookings: cancelled.length,
        totalRevenue: completed.reduce((acc, b) => acc + Number(b.final_total ?? 0), 0),
        platformCommissions: completed.reduce((acc, b) => acc + Number(b.commission_amount ?? 0), 0),
        pendingRefunds: db.refunds.filter((r) => ['requested', 'under_review', 'approved'].includes(r.status)).length,
      },
      pendingProviders: db.providers.filter((p) => p.verification_status === 'pending'),
      pendingCompanies: db.companies.filter((c) => c.verification_status === 'pending'),
      recentBookings: bList.slice(0, 30),
      refunds: db.refunds,
      tickets: db.tickets,
      commissionPercent: db.commissionPercent,
    });
  }

  const ctx = await requireAuth(['admin']);
  const admin = ctx.admin;

  const [
    { data: users },
    { data: providers },
    { data: companies },
    { data: bookings },
    { data: refunds },
    { data: tickets },
    { data: comm },
    { data: arrival },
  ] = await Promise.all([
    admin.from('users').select('id, role, full_name, email, mobile, is_active, created_at').limit(200),
    admin.from('provider_profiles').select('*, users(full_name, email, mobile)').order('created_at', { ascending: false }).limit(100),
    admin.from('company_profiles').select('*').order('created_at', { ascending: false }).limit(100),
    admin.from('bookings').select('*, services(name)').order('created_at', { ascending: false }).limit(100),
    admin.from('refunds').select('*, bookings(booking_code)').order('created_at', { ascending: false }).limit(50),
    admin.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(50),
    admin.from('platform_commissions').select('commission_percent').is('category_id', null).eq('is_active', true).maybeSingle(),
    admin.from('platform_settings').select('value').eq('key', 'arrival_defaults').maybeSingle(),
  ]);

  const bList = bookings ?? [];
  const completed = bList.filter((b) => b.status === 'completed');
  const active = bList.filter((b) =>
    ['pending', 'confirmed', 'provider_assigned', 'provider_travelling', 'provider_arrived', 'in_progress'].includes(b.status),
  );
  const cancelled = bList.filter((b) => b.status === 'cancelled' || b.status === 'rejected');

  return ok({
    configured: true,
    metrics: {
      totalCustomers: (users ?? []).filter((u) => u.role === 'customer').length,
      totalProviders: (providers ?? []).length,
      totalCompanies: (companies ?? []).length,
      activeBookings: active.length,
      completedBookings: completed.length,
      cancelledBookings: cancelled.length,
      totalRevenue: completed.reduce((acc, b) => acc + Number(b.final_total ?? 0), 0),
      platformCommissions: completed.reduce((acc, b) => acc + Number(b.commission_amount ?? 0), 0),
      pendingRefunds: (refunds ?? []).filter((r) => ['requested', 'under_review', 'approved'].includes(r.status)).length,
    },
    users: users ?? [],
    providers: providers ?? [],
    companies: companies ?? [],
    pendingProviders: (providers ?? []).filter((p) => p.verification_status === 'pending'),
    pendingCompanies: (companies ?? []).filter((c) => c.verification_status === 'pending'),
    recentBookings: bList.slice(0, 30),
    refunds: refunds ?? [],
    tickets: tickets ?? [],
    commissionPercent: Number(comm?.commission_percent ?? 15),
    arrivalDefaults: arrival?.value ?? null,
  });
});

export const PATCH = route(async (req) => {
  const input = await parseBody(req, adminActionSchema);

  if (!isSupabaseConfigured()) {
    const db = readLocalDb();
    if (input.action === 'update_commission') {
      db.commissionPercent = input.commissionPercent;
      writeLocalDb(db);
      return ok({ commissionPercent: input.commissionPercent });
    }
    if (input.action === 'verify_provider') {
      const p = db.providers.find((x) => x.id === input.providerId);
      if (p) p.verification_status = input.status;
      writeLocalDb(db);
      return ok(p ?? { updated: true });
    }
    if (input.action === 'verify_company') {
      const c = db.companies.find((x) => x.id === input.companyId);
      if (c) c.verification_status = input.status;
      writeLocalDb(db);
      return ok(c ?? { updated: true });
    }
    return ok({ sentCount: db.users.length });
  }

  const ctx = await requireAuth(['admin']);
  const ip = clientIp(req);

  if (input.action === 'verify_provider') {
    const { data, error } = await ctx.admin
      .from('provider_profiles')
      .update({ verification_status: input.status, verified_at: input.status === 'verified' ? new Date().toISOString() : null })
      .eq('id', input.providerId)
      .select('*')
      .single();
    if (error) throw error;
    await notify(ctx.admin, {
      userIds: data.user_id,
      type: 'verification',
      title: `Provider account ${input.status}`,
      body: input.note || `Your QuickServe professional account is now ${input.status}.`,
      data: { url: '/provider' },
    });
    await audit(ctx.admin, { actorId: ctx.user.id, action: `admin.provider.${input.status}`, entity: 'provider', entityId: input.providerId, ip });
    return ok(data);
  }

  if (input.action === 'verify_company') {
    const { data, error } = await ctx.admin
      .from('company_profiles')
      .update({ verification_status: input.status, verified_at: input.status === 'verified' ? new Date().toISOString() : null })
      .eq('id', input.companyId)
      .select('*')
      .single();
    if (error) throw error;
    await notify(ctx.admin, {
      userIds: data.user_id,
      type: 'verification',
      title: `Company account ${input.status}`,
      body: input.note || `Your QuickServe company account (${data.company_name}) is now ${input.status}.`,
      data: { url: '/company' },
    });
    await audit(ctx.admin, { actorId: ctx.user.id, action: `admin.company.${input.status}`, entity: 'company', entityId: input.companyId, ip });
    return ok(data);
  }

  if (input.action === 'update_commission') {
    await ctx.admin.from('platform_commissions').update({ commission_percent: input.commissionPercent }).is('category_id', null);
    await audit(ctx.admin, { actorId: ctx.user.id, action: 'admin.commission.update', entity: 'platform_commissions', metadata: { commissionPercent: input.commissionPercent }, ip });
    return ok({ commissionPercent: input.commissionPercent });
  }

  if (input.action === 'update_arrival_sla') {
    const val = {
      avg_speed_kmph: input.avgSpeedKmph,
      prep_minutes: input.prepMinutes,
      buffer_minutes: input.bufferMinutes,
      min_lead_minutes: 45,
      max_arrival_minutes: input.maxArrivalMinutes,
      provider_ack_minutes: 10,
      max_radius_km: input.maxRadiusKm,
    };
    await ctx.admin.from('platform_settings').upsert({ key: 'arrival_defaults', value: val }, { onConflict: 'key' });
    return ok({ arrivalDefaults: val });
  }

  // broadcast_notification
  let q = ctx.admin.from('users').select('id').eq('is_active', true);
  if (input.targetRole !== 'all') q = q.eq('role', input.targetRole);
  const { data: recipients } = await q;
  const ids = (recipients ?? []).map((u) => u.id);
  if (ids.length) {
    await notify(ctx.admin, { userIds: ids, type: 'new_offer', title: input.title, body: input.body, data: { url: '/offers' } });
  }
  return ok({ sentCount: ids.length });
});
