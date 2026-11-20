import { z } from 'zod';
import { randomUUID } from 'crypto';
import { created, ok, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser, readLocalDb, writeLocalDb } from '@/lib/localDb';

const registerProviderSchema = z.object({
  displayName: z.string().trim().min(2, 'Enter your display name (min 2 chars)').max(100),
  bio: z.string().trim().max(1000).optional(),
  experienceYears: z.coerce.number().int().min(0).max(60).default(1),
  skills: z.array(z.string().trim().min(1)).max(20).default([]),
  address: z.string().trim().min(2, 'Enter your service address').max(250),
  city: z.string().trim().min(2, 'Enter your city').max(80),
  state: z.string().trim().min(2, 'Enter your state').max(80),
  pinCode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit Indian PIN code'),
  baseLat: z.number().min(-90).max(90).optional(),
  baseLng: z.number().min(-180).max(180).optional(),
  defaultHourlyRate: z.coerce.number().min(50).max(10000).default(199),
  defaultVisitingCharge: z.coerce.number().min(0).max(2000).default(50),
  govtIdType: z.enum(['aadhaar', 'pan', 'driving_license', 'voter_id']).default('aadhaar'),
  govtIdLast4: z.string().trim().regex(/^[A-Za-z0-9]{4}$/, 'Enter the last 4 characters/digits of your Govt ID'),
  govtIdDocUrl: z.string().url().optional().or(z.literal('')),
  bankAccountName: z.string().trim().min(2, 'Enter account holder name').max(120),
  bankAccountNumber: z.string().trim().min(4, 'Enter bank account number').max(30),
  bankIfsc: z.string().trim().min(4, 'Enter your bank IFSC code').max(15),
  upiId: z.string().trim().max(80).optional(),
});

const statusToggleSchema = z.object({
  isOnline: z.boolean().optional(),
  defaultHourlyRate: z.number().min(99).max(10000).optional(),
  defaultVisitingCharge: z.number().min(0).max(2000).optional(),
});

export const POST = route(async (req) => {
  const input = await parseBody(req, registerProviderSchema);

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    const u = db.users.find((x) => x.id === user.id);
    if (u) u.role = 'provider';
    const existing = db.providers.find((p) => p.user_id === user.id);
    const record = {
      id: existing?.id ?? randomUUID(),
      user_id: user.id,
      ownerKind: 'provider',
      display_name: input.displayName,
      bio: input.bio ?? null,
      experience_years: input.experienceYears,
      skills: input.skills,
      address: input.address,
      city: input.city,
      state: input.state,
      pin_code: input.pinCode,
      base_lat: input.baseLat ?? 17.4483,
      base_lng: input.baseLng ?? 78.3915,
      default_hourly_rate: input.defaultHourlyRate,
      default_visiting_charge: input.defaultVisitingCharge,
      verification_status: 'verified',
      is_online: true,
      avg_rating: existing?.avg_rating ?? 5.0,
      total_reviews: existing?.total_reviews ?? 0,
      total_jobs: existing?.total_jobs ?? 0,
      created_at: new Date().toISOString(),
    };
    db.providers = [...db.providers.filter((p) => p.user_id !== user.id), record];
    writeLocalDb(db);
    return created(record);
  }

  const ctx = await requireAuth(['provider', 'customer']);
  await ctx.admin.from('users').update({ role: 'provider', profile_completed: true }).eq('id', ctx.user.id);

  const { data: profile, error } = await ctx.admin
    .from('provider_profiles')
    .upsert(
      {
        user_id: ctx.user.id,
        display_name: input.displayName,
        bio: input.bio ?? null,
        experience_years: input.experienceYears,
        skills: input.skills,
        address: input.address,
        city: input.city,
        state: input.state,
        pin_code: input.pinCode,
        base_lat: input.baseLat ?? null,
        base_lng: input.baseLng ?? null,
        default_hourly_rate: input.defaultHourlyRate,
        default_visiting_charge: input.defaultVisitingCharge,
        payout_account_name: input.bankAccountName,
        payout_account_number: input.bankAccountNumber,
        payout_ifsc: input.bankIfsc,
        payout_upi_id: input.upiId ?? null,
        verification_status: 'pending',
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();
  if (error) throw error;

  if (input.govtIdDocUrl) {
    await ctx.admin.from('provider_documents').insert({
      provider_id: profile.id,
      doc_type: input.govtIdType,
      doc_number_masked: `XXXX-${input.govtIdLast4}`,
      file_url: input.govtIdDocUrl,
    });
  }

  return created(profile);
});

export const PATCH = route(async (req) => {
  const input = await parseBody(req, statusToggleSchema);

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    const p = db.providers.find((x) => x.user_id === user.id);
    if (p) {
      if (input.isOnline !== undefined) p.is_online = input.isOnline;
      if (input.defaultHourlyRate !== undefined) p.default_hourly_rate = input.defaultHourlyRate;
      if (input.defaultVisitingCharge !== undefined) p.default_visiting_charge = input.defaultVisitingCharge;
      writeLocalDb(db);
    }
    return ok(p ?? null);
  }

  const ctx = await requireAuth(['provider']);
  const patch: Record<string, unknown> = {};
  if (input.isOnline !== undefined) patch.is_online = input.isOnline;
  if (input.defaultHourlyRate !== undefined) patch.default_hourly_rate = input.defaultHourlyRate;
  if (input.defaultVisitingCharge !== undefined) patch.default_visiting_charge = input.defaultVisitingCharge;

  const { data, error } = await ctx.admin
    .from('provider_profiles')
    .update(patch)
    .eq('user_id', ctx.user.id)
    .select('*')
    .single();
  if (error) throw error;
  return ok(data);
});
