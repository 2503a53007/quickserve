import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Runs the REAL migrations against an in-process Postgres (PGlite) with a stub of
 * Supabase's `auth` schema + roles. Verifies schema validity, constraints, the
 * double-booking guarantee and Row Level Security behaviour.
 */
const db = new PGlite({ extensions: { btree_gist } });
const A = '00000000-0000-0000-0000-00000000000a'; // customer A
const B = '00000000-0000-0000-0000-00000000000b'; // customer B
const P = '00000000-0000-0000-0000-0000000000f1'; // provider
const ADM = '00000000-0000-0000-0000-0000000000ad'; // admin

async function asUser(uid: string | null, fn: () => Promise<void>) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
  try { await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, phone text, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  const dir = join(process.cwd(), 'supabase/migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(dir, f), 'utf8'));
  }
  await db.exec(`
    insert into auth.users (id, phone, email, raw_user_meta_data) values
      ('${A}', '919900000001', 'a@example.com', '{"full_name":"Asha Rao","role":"admin","signup_intent":"customer"}'),
      ('${B}', '919900000002', 'b@example.com', '{"full_name":"Bala K"}'),
      ('${P}', '919900000003', 'p@example.com', '{"full_name":"Pavan Electric","signup_intent":"provider"}'),
      ('${ADM}', '919900000004', 'admin@example.com', '{}');
    update users set role = 'admin' where id = '${ADM}';
    update users set role = 'provider' where id = '${P}';
    insert into provider_profiles (user_id, display_name, verification_status, latitude, longitude, is_online, city, pin_code)
      values ('${P}', 'Pavan Electric', 'verified', 12.9716, 77.5946, true, 'Bengaluru', '560001');
    insert into service_pricing (service_id, provider_id, first_hour_price, additional_hour_price, visiting_charge)
      select s.id, pp.id, 199, 149, 50 from services s, provider_profiles pp where s.slug = 'fan-light-repair';
  `);
});

const insertBooking = (customer: string, start: string, end: string) => `
  insert into bookings (customer_id, provider_id, service_id, category_id, scheduled_start, scheduled_end, estimated_hours,
     address_line, address_city, address_pin, first_hour_price, additional_hour_price, estimated_base, estimated_tax, estimated_total)
  select '${customer}', pp.id, s.id, s.category_id, '${start}', '${end}', 1, '12 MG Road', 'Bengaluru', '560001', 199, 149, 199, 35.82, 234.82
  from services s, provider_profiles pp where s.slug = 'fan-light-repair' and pp.user_id = '${P}'`;

describe('schema bootstrap', () => {
  it('creates public.users rows and never trusts role from metadata', async () => {
    const r = await db.query<{ id: string; role: string; mobile: string; full_name: string }>(`select id, role, mobile, full_name from users order by mobile`);
    const a = r.rows.find((x) => x.id === A)!;
    expect(a.role).toBe('customer'); // metadata asked for admin -> ignored
    expect(a.mobile).toBe('+919900000001');
    expect(a.full_name).toBe('Asha Rao');
  });

  it('seeds 19 categories, services, commission and coupons', async () => {
    expect((await db.query<{ c: number }>(`select count(*)::int c from service_categories`)).rows[0].c).toBe(19);
    expect((await db.query<{ c: number }>(`select count(*)::int c from services`)).rows[0].c).toBeGreaterThan(40);
    expect((await db.query<{ c: number }>(`select count(*)::int c from platform_commissions where category_id is null`)).rows[0].c).toBe(1);
    expect((await db.query<{ c: number }>(`select count(*)::int c from coupons`)).rows[0].c).toBe(5);
  });

  it('nearby_owners returns distance and only approximate coordinates', async () => {
    const r = await db.query<{ distance_km: number; approx_lat: number; owner_kind: string }>(
      `select * from nearby_owners((select id from services where slug='fan-light-repair'), 12.98, 77.60, 15, 0)`);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].owner_kind).toBe('provider');
    expect(r.rows[0].distance_km).toBeGreaterThan(0.5);
    expect(r.rows[0].distance_km).toBeLessThan(2);
    expect(r.rows[0].approx_lat).toBe(12.97);
    // out of range customer (Delhi) sees nothing
    const far = await db.query(`select * from nearby_owners((select id from services where slug='fan-light-repair'), 28.61, 77.20, 15, 0)`);
    expect(far.rows).toHaveLength(0);
  });
});

describe('booking integrity', () => {
  it('generates unique booking codes', async () => {
    await db.exec(insertBooking(A, '2030-01-01T10:00:00Z', '2030-01-01T11:00:00Z'));
    const r = await db.query<{ booking_code: string }>(`select booking_code from bookings`);
    expect(r.rows[0].booking_code).toMatch(/^QS\d{6}\d{5}$/);
  });

  it('rejects overlapping bookings for the same provider (double-booking guard)', async () => {
    await expect(db.exec(insertBooking(B, '2030-01-01T10:30:00Z', '2030-01-01T11:30:00Z'))).rejects.toThrow(/no_provider_double_booking|conflicting key/i);
  });

  it('allows back-to-back bookings and re-use after cancellation', async () => {
    await db.exec(insertBooking(B, '2030-01-01T11:00:00Z', '2030-01-01T12:00:00Z'));
    await db.exec(`update bookings set status='cancelled' where scheduled_start='2030-01-01T10:00:00Z'`);
    await db.exec(insertBooking(B, '2030-01-01T10:15:00Z', '2030-01-01T10:45:00Z'));
  });

  it('enforces the status state machine', async () => {
    await expect(db.exec(`update bookings set status='completed' where status='pending'`)).rejects.toThrow(/INVALID_TRANSITION/);
    await db.exec(`update bookings set status='confirmed' where status='pending' and scheduled_start='2030-01-01T11:00:00Z'`);
  });

  it('allows one paid payment per booking only', async () => {
    const { rows } = await db.query<{ id: string }>(`select id from bookings limit 1`);
    const ins = `insert into payments (booking_id, customer_id, method, status, amount) values ('${rows[0].id}', '${A}', 'upi', 'paid', 100)`;
    await db.exec(ins);
    await expect(db.exec(ins)).rejects.toThrow(/uq_payments_one_paid|duplicate/i);
  });
});

describe('row level security', () => {
  it('customers cannot escalate their role or edit others', async () => {
    await asUser(A, async () => {
      await expect(db.exec(`update users set role = 'admin' where id = '${A}'`)).rejects.toThrow(/permission denied/i);
      const own = await db.query(`select id from users`);
      expect(own.rows).toHaveLength(1); // only own row
    });
  });

  it('customers only see their own bookings and cannot write them', async () => {
    await asUser(B, async () => {
      const r = await db.query<{ customer_id: string }>(`select customer_id from bookings`);
      expect(r.rows.length).toBeGreaterThan(0);
      expect(r.rows.every((x) => x.customer_id === B)).toBe(true);
      await expect(db.exec(`update bookings set estimated_total = 1`)).rejects.toThrow(/permission denied/i);
      await expect(db.exec(`insert into payments (booking_id, customer_id, method, status, amount) select id, '${B}', 'upi', 'paid', 1 from bookings limit 1`)).rejects.toThrow(/permission denied/i);
    });
  });

  it('provider sees assigned bookings; admin sees all', async () => {
    await asUser(P, async () => {
      expect((await db.query(`select 1 from bookings`)).rows.length).toBeGreaterThan(0);
    });
    await asUser(ADM, async () => {
      expect((await db.query(`select 1 from users`)).rows).toHaveLength(4);
    });
  });

  it('OTP, rate-limit and webhook tables are inaccessible to clients', async () => {
    await asUser(A, async () => {
      await expect(db.query(`select * from otp_verifications`)).rejects.toThrow(/permission denied/i);
      await expect(db.query(`select * from rate_limits`)).rejects.toThrow(/permission denied/i);
      await expect(db.query(`select * from webhook_events`)).rejects.toThrow(/permission denied/i);
      await expect(db.query(`select check_rate_limit('x', 1, 60)`)).rejects.toThrow(/permission denied/i);
    });
  });

  it('bank details are not readable by other customers; provider location hidden without active job', async () => {
    await db.exec(`insert into provider_locations (provider_id, latitude, longitude) select id, 12.97, 77.59 from provider_profiles`);
    await asUser(B, async () => {
      expect((await db.query(`select 1 from provider_locations`)).rows).toHaveLength(0);
      expect((await db.query(`select 1 from provider_profiles`)).rows).toHaveLength(0);
    });
  });

  it('users can manage only their own wishlist and addresses', async () => {
    await asUser(A, async () => {
      await db.exec(`insert into wishlist (user_id, service_id) select '${A}', id from services limit 1`);
      await expect(db.exec(`insert into wishlist (user_id, service_id) select '${B}', id from services limit 1`)).rejects.toThrow(/row-level security/i);
    });
    await asUser(B, async () => {
      expect((await db.query(`select 1 from wishlist`)).rows).toHaveLength(0);
    });
  });

  it('anonymous visitors can read catalogue but not users', async () => {
    await db.exec(`set role anon`);
    try {
      expect((await db.query(`select 1 from service_categories`)).rows.length).toBe(19);
      await expect(db.query(`select 1 from users`)).rejects.toThrow(/permission denied/i);
      await expect(db.query(`select 1 from bookings`)).rejects.toThrow(/permission denied/i);
    } finally { await db.exec(`reset role`); }
  });
});

describe('rate limiter', () => {
  it('blocks after the max within the window', async () => {
    const r: boolean[] = [];
    for (let i = 0; i < 4; i++) r.push((await db.query<{ ok: boolean }>(`select check_rate_limit('t:1', 3, 60) ok`)).rows[0].ok);
    expect(r).toEqual([true, true, true, false]);
  });
});

describe('reviews aggregate', () => {
  it('recalculates provider rating automatically', async () => {
    const { rows } = await db.query<{ id: string; provider_id: string }>(`select id, provider_id from bookings limit 1`);
    await db.exec(`insert into reviews (booking_id, customer_id, provider_id, rating) values ('${rows[0].id}', '${A}', '${rows[0].provider_id}', 4)`);
    const p = await db.query<{ average_rating: string; total_reviews: number }>(`select average_rating, total_reviews from provider_profiles where id='${rows[0].provider_id}'`);
    expect(Number(p.rows[0].average_rating)).toBe(4);
    expect(p.rows[0].total_reviews).toBe(1);
  });
});
