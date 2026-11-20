import { z } from 'zod';
import { randomUUID } from 'crypto';
import { badRequest, created, ok, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser, readLocalDb, writeLocalDb } from '@/lib/localDb';

const addWorkerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  roleTitle: z.string().trim().min(2).max(80),
  skills: z.array(z.string()).default([]),
});

export const GET = route(async () => {
  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) return ok({ employees: [] });
    const db = readLocalDb();
    const comp = db.companies.find((c) => c.user_id === user.id);
    if (!comp) return ok({ employees: [] });
    const emps = db.employees.filter((e) => e.company_id === comp.id);
    return ok({ employees: emps });
  }

  const ctx = await requireAuth(['company']);
  const { data: comp } = await ctx.admin.from('company_profiles').select('id').eq('user_id', ctx.user.id).maybeSingle();
  if (!comp) return ok({ employees: [] });

  const { data, error } = await ctx.admin
    .from('company_employees')
    .select('*, provider_profiles(*)')
    .eq('company_id', comp.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ok({ employees: data ?? [] });
});

export const POST = route(async (req) => {
  const input = await parseBody(req, addWorkerSchema);

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    const comp = db.companies.find((c) => c.user_id === user.id);
    if (!comp) throw badRequest('Complete company registration first.');

    const provId = randomUUID();
    const prov = {
      id: provId,
      user_id: randomUUID(),
      company_id: comp.id,
      display_name: input.fullName,
      mobile: `+91${input.mobile}`,
      skills: input.skills,
      city: comp.city,
      state: comp.state,
      pin_code: comp.pin_code,
      verification_status: 'verified',
      is_online: true,
    };
    const emp = {
      id: randomUUID(),
      company_id: comp.id,
      provider_id: provId,
      role_title: input.roleTitle,
      is_active: true,
      provider_profiles: prov,
      created_at: new Date().toISOString(),
    };
    db.employees.unshift(emp);
    writeLocalDb(db);
    return created({ employee: emp, provider: prov });
  }

  const ctx = await requireAuth(['company']);
  const { data: comp } = await ctx.admin.from('company_profiles').select('*').eq('user_id', ctx.user.id).maybeSingle();
  if (!comp) throw badRequest('Complete company registration first.');

  const { data: createdAuth, error: authErr } = await ctx.admin.auth.admin.createUser({
    phone: `+91${input.mobile}`,
    phone_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (authErr || !createdAuth.user) throw badRequest(authErr?.message || 'Could not register employee phone.');

  await ctx.admin.from('users').upsert({
    id: createdAuth.user.id,
    role: 'provider',
    full_name: input.fullName,
    mobile: `+91${input.mobile}`,
    profile_completed: true,
  });

  const { data: prov, error: pErr } = await ctx.admin
    .from('provider_profiles')
    .insert({
      user_id: createdAuth.user.id,
      company_id: comp.id,
      display_name: input.fullName,
      skills: input.skills,
      city: comp.city,
      state: comp.state,
      pin_code: comp.pin_code,
      verification_status: comp.verification_status,
      is_online: true,
    })
    .select('*')
    .single();
  if (pErr) throw pErr;

  const { data: emp, error: eErr } = await ctx.admin
    .from('company_employees')
    .insert({
      company_id: comp.id,
      provider_id: prov.id,
      role_title: input.roleTitle,
      is_active: true,
    })
    .select('*')
    .single();
  if (eErr) throw eErr;

  return created({ employee: emp, provider: prov });
});
