import { z } from 'zod';
import { randomUUID } from 'crypto';
import { created, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser, readLocalDb, writeLocalDb } from '@/lib/localDb';

const companySchema = z.object({
  companyName: z.string().trim().min(2).max(140),
  ownerName: z.string().trim().min(2).max(120),
  contactPhone: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian phone number'),
  email: z.string().email(),
  description: z.string().trim().max(1000).optional(),
  businessAddress: z.string().trim().min(2).max(250),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pinCode: z.string().regex(/^\d{6}$/, 'Enter a valid 6-digit Indian PIN code'),
  registrationNumber: z.string().trim().min(2).max(80),
  gstin: z.string().trim().max(15).optional(),
  teamSize: z.coerce.number().int().min(1).max(500).default(5),
  payoutAccountName: z.string().trim().min(2).max(120),
  payoutAccountNumber: z.string().trim().min(4).max(30),
  payoutIfsc: z.string().trim().min(4).max(15),
});

export const POST = route(async (req) => {
  const input = await parseBody(req, companySchema);

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    const u = db.users.find((x) => x.id === user.id);
    if (u) u.role = 'company';
    const record = {
      id: randomUUID(),
      user_id: user.id,
      ownerKind: 'company',
      company_name: input.companyName,
      owner_name: input.ownerName,
      contact_phone: `+91${input.contactPhone}`,
      email: input.email,
      description: input.description ?? null,
      business_address: input.businessAddress,
      city: input.city,
      state: input.state,
      pin_code: input.pinCode,
      registration_number: input.registrationNumber,
      gstin: input.gstin || null,
      team_size: input.teamSize,
      avg_rating: 5.0,
      total_reviews: 0,
      total_jobs: 0,
      verification_status: 'verified',
      created_at: new Date().toISOString(),
    };
    db.companies = [...db.companies.filter((c) => c.user_id !== user.id), record];
    writeLocalDb(db);
    return created(record);
  }

  const ctx = await requireAuth(['company', 'customer']);
  await ctx.admin.from('users').update({ role: 'company', profile_completed: true }).eq('id', ctx.user.id);

  const { data, error } = await ctx.admin
    .from('company_profiles')
    .upsert(
      {
        user_id: ctx.user.id,
        company_name: input.companyName,
        owner_name: input.ownerName,
        contact_phone: `+91${input.contactPhone}`,
        email: input.email,
        description: input.description ?? null,
        business_address: input.businessAddress,
        city: input.city,
        state: input.state,
        pin_code: input.pinCode,
        registration_number: input.registrationNumber,
        gstin: input.gstin || null,
        team_size: input.teamSize,
        payout_account_name: input.payoutAccountName,
        payout_account_number: input.payoutAccountNumber,
        payout_ifsc: input.payoutIfsc,
        verification_status: 'pending',
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return created(data);
});
