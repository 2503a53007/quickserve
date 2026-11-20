import 'server-only';
import fs from 'fs';
import path from 'path';
import { createHmac, randomBytes, randomInt, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { ALL_CATALOG_SERVICES, CATALOG_CATEGORIES, STARTER_COUPONS } from '@/lib/catalog';
import { computeBill, computeFinalBill, extraHoursCost, toPaise } from '@/lib/pricing';
import { haversineKm } from '@/lib/booking/context';
import type { UserRole } from '@/types/db';

function getDataFile() {
  return process.env.QUICKSERVE_LOCAL_DB_FILE
    ? path.resolve(process.env.QUICKSERVE_LOCAL_DB_FILE)
    : path.join(process.cwd(), '.quickserve-data.json');
}
const SESSION_COOKIE = 'qs_local_session';
const SESSION_SECRET = process.env.OTP_HMAC_SECRET || 'quickserve-local-dev-session-secret-change-in-prod';

export interface LocalUser {
  id: string;
  role: UserRole;
  full_name: string;
  mobile: string | null;
  email: string | null;
  password_hash: string | null;
  avatar_url: string | null;
  is_active: boolean;
  profile_completed: boolean;
  signup_intent: 'customer' | 'provider' | 'company' | null;
  created_at: string;
}

interface LocalOtp {
  key: string;
  code: string;
  expiresAt: number;
  attempts: number;
  verified: boolean;
  purpose: 'auth' | 'start_service' | 'end_service';
  bookingId?: string;
  customerId?: string;
}

export interface LocalDbSchema {
  users: LocalUser[];
  otps: LocalOtp[];
  providers: any[];
  companies: any[];
  employees: any[];
  bookings: any[];
  invoices: any[];
  reviews: any[];
  refunds: any[];
  tickets: any[];
  wishlist: any[];
  addresses: any[];
  notifications: any[];
  coupons: any[];
  providerLocations: Record<string, { booking_id: string; latitude: number; longitude: number; updated_at: string }>;
  commissionPercent: number;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, keyHex] = stored.split(':');
  const derived = scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  return derived.length === keyBuf.length && timingSafeEqual(derived, keyBuf);
}

function signSession(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const expected = createHmac('sha256', SESSION_SECRET).update(`${userId}.${ts}`).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

function seedLocalDb(): LocalDbSchema {
  const now = new Date().toISOString();
  const seedProviders = [
    {
      id: 'prov-hanumakonda-pro',
      user_id: 'usr-prov-hnk',
      ownerKind: 'provider',
      display_name: 'Sri Laxmi Electrical & Home Services (Hasanparthy)',
      bio: 'Serving Ananthasagar, Hasanparthy Mandal, Elkathurthy & Hanumakonda — electrician, plumbing, AC & appliances.',
      experience_years: 8,
      avg_rating: 4.9,
      total_reviews: 118,
      total_jobs: 365,
      is_online: true,
      verification_status: 'verified',
      city: 'Hanumakonda',
      state: 'Telangana',
      pin_code: '506371',
      base_lat: 18.0912,
      base_lng: 79.4801,
      default_hourly_rate: 199,
      default_visiting_charge: 50,
      skills: CATALOG_CATEGORIES.map((c) => c.slug),
      created_at: now,
    },
    {
      id: 'prov-ramesh-elec',
      user_id: 'usr-prov-1',
      ownerKind: 'provider',
      display_name: 'Ramesh Electrical Works',
      bio: 'Certified electrician for MCB, wiring, fan/light & inverter repairs.',
      experience_years: 7,
      avg_rating: 4.9,
      total_reviews: 142,
      total_jobs: 420,
      is_online: true,
      verification_status: 'verified',
      city: 'Hyderabad',
      state: 'Telangana',
      pin_code: '500081',
      base_lat: 17.4483,
      base_lng: 78.3915,
      default_hourly_rate: 199,
      default_visiting_charge: 50,
      skills: ['electrician', 'appliance-repair', 'ac-repair'],
      created_at: now,
    },
    {
      id: 'prov-arjun-plumb',
      user_id: 'usr-prov-2',
      ownerKind: 'provider',
      display_name: 'Arjun Plumbing & RO Care',
      bio: 'Fast leak fixes, tap/mixer fittings, drain clearing & RO service.',
      experience_years: 6,
      avg_rating: 4.8,
      total_reviews: 98,
      total_jobs: 315,
      is_online: true,
      verification_status: 'verified',
      city: 'Bengaluru',
      state: 'Karnataka',
      pin_code: '560034',
      base_lat: 12.9352,
      base_lng: 77.6245,
      default_hourly_rate: 199,
      default_visiting_charge: 50,
      skills: ['plumbing', 'ro-water-purifier-service', 'electrician'],
      created_at: now,
    },
    {
      id: 'prov-priya-clean',
      user_id: 'usr-prov-3',
      ownerKind: 'provider',
      display_name: 'Priya Sparkle Home Care',
      bio: 'Deep home cleaning, kitchen/bathroom sanitisation & sofa shampooing.',
      experience_years: 5,
      avg_rating: 4.9,
      total_reviews: 164,
      total_jobs: 390,
      is_online: true,
      verification_status: 'verified',
      city: 'Mumbai',
      state: 'Maharashtra',
      pin_code: '400050',
      base_lat: 19.0596,
      base_lng: 72.8295,
      default_hourly_rate: 349,
      default_visiting_charge: 0,
      skills: ['home-cleaning', 'deep-cleaning', 'pest-control', 'salon-at-home'],
      created_at: now,
    },
    {
      id: 'prov-vikram-ac',
      user_id: 'usr-prov-4',
      ownerKind: 'provider',
      display_name: 'Vikram CoolTech AC & Appliances',
      bio: 'Split/window AC servicing, gas refill, refrigerator, washer & TV repair.',
      experience_years: 9,
      avg_rating: 4.8,
      total_reviews: 121,
      total_jobs: 510,
      is_online: true,
      verification_status: 'verified',
      city: 'Delhi NCR',
      state: 'Delhi',
      pin_code: '110001',
      base_lat: 28.6315,
      base_lng: 77.2167,
      default_hourly_rate: 349,
      default_visiting_charge: 75,
      skills: ['ac-repair', 'ac-installation', 'refrigerator-repair', 'washing-machine-repair', 'tv-repair', 'appliance-repair'],
      created_at: now,
    },
  ];

  const seedCompanies = [
    {
      id: 'comp-voltpro-india',
      user_id: 'usr-comp-1',
      ownerKind: 'company',
      company_name: 'VoltPro Home Services Pvt Ltd',
      owner_name: 'Suresh Reddy',
      contact_phone: '+919000011111',
      email: 'ops@voltpro.in',
      description: 'Multi-city verified team of electricians, plumbers, carpenters, painters & auto mechanics.',
      business_address: 'Hitech City Main Rd, Madhapur',
      city: 'Hyderabad',
      state: 'Telangana',
      pin_code: '500081',
      registration_number: 'UDYAM-TS-02-0019283',
      gstin: '36AABCV1234F1Z5',
      team_size: 24,
      avg_rating: 4.9,
      total_reviews: 280,
      total_jobs: 1120,
      base_lat: 17.4435,
      base_lng: 78.3772,
      verification_status: 'verified',
      skills: CATALOG_CATEGORIES.map((c) => c.slug),
      created_at: now,
    },
  ];

  return {
    users: [],
    otps: [],
    providers: seedProviders,
    companies: seedCompanies,
    employees: [],
    bookings: [],
    invoices: [],
    reviews: [],
    refunds: [],
    tickets: [],
    wishlist: [],
    addresses: [],
    notifications: [],
    coupons: STARTER_COUPONS.map((c, idx) => ({
      id: `cpn-${idx + 1}`,
      code: c.code,
      title: c.title,
      description: c.description,
      coupon_type: c.couponType,
      discount_type: c.discountType,
      discount_value: c.discountValue,
      min_order_amount: c.minOrderAmount,
      max_discount_amount: c.maxDiscountAmount,
      is_active: true,
      first_booking_only: c.firstBookingOnly,
      valid_until: new Date(Date.now() + 365 * 86400_000).toISOString(),
    })),
    providerLocations: {},
    commissionPercent: 15,
  };
}

export function readLocalDb(): LocalDbSchema {
  try {
    const f = getDataFile();
    if (fs.existsSync(f)) {
      const raw = fs.readFileSync(f, 'utf8');
      return JSON.parse(raw) as LocalDbSchema;
    }
  } catch {
    // recreate if corrupted
  }
  const initial = seedLocalDb();
  writeLocalDb(initial);
  return initial;
}

export function writeLocalDb(db: LocalDbSchema): void {
  fs.writeFileSync(getDataFile(), JSON.stringify(db, null, 2), 'utf8');
}

export async function setLocalSessionCookie(userId: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearLocalSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getLocalSessionUser(): Promise<LocalUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const db = readLocalDb();
  return db.users.find((u) => u.id === userId && u.is_active) ?? null;
}

export function createLocalUser(input: {
  role: UserRole;
  full_name: string;
  mobile?: string | null;
  email?: string | null;
  password?: string | null;
}): LocalUser {
  const db = readLocalDb();
  const user: LocalUser = {
    id: randomUUID(),
    role: input.role,
    full_name: input.full_name,
    mobile: input.mobile ?? null,
    email: input.email ? input.email.toLowerCase() : null,
    password_hash: input.password ? hashPassword(input.password) : null,
    avatar_url: null,
    is_active: true,
    profile_completed: true,
    signup_intent: input.role === 'admin' ? 'customer' : input.role,
    created_at: new Date().toISOString(),
  };
  db.users.push(user);
  db.notifications.unshift({
    id: randomUUID(),
    user_id: user.id,
    type: 'general',
    title: 'Welcome to QuickServe ⚡',
    body: 'Your account is ready! Use code WELCOME50 for 50% off your first booking.',
    is_read: false,
    data: { url: '/offers' },
    created_at: new Date().toISOString(),
  });
  writeLocalDb(db);
  return user;
}

export function issueLocalOtp(opts: {
  key: string;
  purpose: 'auth' | 'start_service' | 'end_service';
  bookingId?: string;
  customerId?: string;
}): { code: string; expiresAt: string } {
  const db = readLocalDb();
  const code = String(randomInt(100000, 999999));
  const expiresAtMs = Date.now() + 5 * 60_000;
  db.otps = db.otps.filter((o) => !(o.key === opts.key && o.purpose === opts.purpose));
  db.otps.push({
    key: opts.key,
    code,
    expiresAt: expiresAtMs,
    attempts: 0,
    verified: false,
    purpose: opts.purpose,
    bookingId: opts.bookingId,
    customerId: opts.customerId,
  });
  writeLocalDb(db);
  console.info(`[QuickServe Local OTP] (${opts.purpose}) ${opts.key} => ${code}`);
  return { code, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function verifyLocalOtp(key: string, purpose: 'auth' | 'start_service' | 'end_service', code: string): { ok: boolean; error?: string } {
  const db = readLocalDb();
  const row = db.otps.find((o) => o.key === key && o.purpose === purpose && !o.verified);
  if (!row) return { ok: false, error: 'No active OTP found. Please request a new OTP.' };
  if (Date.now() > row.expiresAt) return { ok: false, error: 'This OTP has expired. Request a new one.' };
  if (row.attempts >= 5) return { ok: false, error: 'Too many wrong attempts. Request a new OTP.' };
  row.attempts += 1;
  if (row.code !== code) {
    writeLocalDb(db);
    return { ok: false, error: `Incorrect OTP. ${5 - row.attempts} attempt(s) left.` };
  }
  row.verified = true;
  writeLocalDb(db);
  return { ok: true };
}

export function createLocalBooking(user: LocalUser, input: any) {
  const db = readLocalDb();
  const svc = ALL_CATALOG_SERVICES.find((s) => s.id === input.serviceId || s.slug === input.serviceId) ?? ALL_CATALOG_SERVICES[0];
  const cat = CATALOG_CATEGORIES.find((c) => c.slug === svc.categorySlug) ?? CATALOG_CATEGORIES[0];
  const hours = Math.min(12, Math.max(1, Number(input.hours || 1)));
  const rate = {
    firstHourPrice: svc.firstHourPrice,
    additionalHourPrice: svc.additionalHourPrice,
    visitingCharge: svc.visitingCharge,
  };
  const c = input.couponCode
    ? db.coupons.find((x) => x.code.toUpperCase() === String(input.couponCode).toUpperCase() && x.is_active)
    : null;
  let discount = 0;
  const sub = rate.firstHourPrice + Math.max(0, hours - 1) * rate.additionalHourPrice + rate.visitingCharge;
  if (c && sub >= Number(c.min_order_amount ?? 0)) {
    discount =
      c.discount_type === 'percentage'
        ? Math.min((sub * Number(c.discount_value)) / 100, Number(c.max_discount_amount ?? Infinity))
        : Number(c.discount_value);
  }
  const bill = computeBill({ hours, rate, taxPercent: 18, discountPaise: toPaise(discount) });

  const now = new Date();
  const start = input.scheduledStart ? new Date(input.scheduledStart) : new Date(now.getTime() + 20 * 60_000);
  const etaAt = new Date(start.getTime());
  const etaLatest = new Date(start.getTime() + 15 * 60_000);

  const prov = db.providers.find((p) => p.id === input.ownerId) ?? db.providers[0];
  const comp = input.ownerKind === 'company' ? db.companies.find((x) => x.id === input.ownerId) : null;
  const distKm =
    input.lat && input.lng && prov?.base_lat && prov?.base_lng
      ? Math.round(haversineKm(Number(input.lat), Number(input.lng), Number(prov.base_lat), Number(prov.base_lng)) * 10) / 10
      : 2.4;

  const id = randomUUID();
  const bookingCode = `QS-${new Date().getFullYear()}-${String(randomInt(100000, 999999))}`;
  const booking = {
    id,
    booking_code: bookingCode,
    customer_id: user.id,
    provider_id: comp ? null : prov?.id ?? null,
    company_id: comp ? comp.id : null,
    service_id: svc.id,
    category_id: cat.id,
    services: { id: svc.id, name: svc.name, slug: svc.slug, description: svc.description },
    service_categories: { id: cat.id, name: cat.name, slug: cat.slug },
    provider: prov ? { id: prov.id, display_name: prov.display_name, avg_rating: prov.avg_rating, total_jobs: prov.total_jobs, user_id: prov.user_id } : null,
    company: comp ? { id: comp.id, company_name: comp.company_name, avg_rating: comp.avg_rating } : null,
    status: 'provider_arrived', // Immediately issues Start OTP so user can test full OTP -> In Progress -> End OTP -> Copy Bill flow!
    booking_mode: input.mode || 'asap',
    scheduled_start: start.toISOString(),
    scheduled_end: new Date(start.getTime() + hours * 3600_000).toISOString(),
    estimated_hours: hours,
    extra_hours_approved: 0,
    actual_hours: null,
    billed_hours: null,
    issue_description: input.issueDescription ?? null,
    address_line: input.addressLine,
    address_city: input.addressCity,
    address_state: input.addressState ?? null,
    address_pin: input.addressPin,
    address_lat: input.lat ?? 17.4483,
    address_lng: input.lng ?? 78.3915,
    first_hour_price: rate.firstHourPrice,
    additional_hour_price: rate.additionalHourPrice,
    visiting_charge: rate.visitingCharge,
    gst_percent: 18,
    commission_percent: db.commissionPercent,
    coupon_code: c?.code ?? null,
    estimated_base: bill.labor,
    estimated_discount: bill.discount,
    estimated_tax: bill.tax,
    estimated_total: bill.total,
    material_cost: 0,
    spare_parts_cost: 0,
    final_base: null,
    final_discount: null,
    final_tax: null,
    final_total: null,
    commission_amount: null,
    provider_earning: null,
    eta_at: etaAt.toISOString(),
    eta_latest_at: etaLatest.toISOString(),
    eta_distance_km: Math.min(distKm, 12),
    payment_method: input.paymentMethod || 'cash',
    payment_status: 'pending',
    started_at: null,
    completed_at: null,
    extra_hour_requests: [],
    invoices: [],
    reviews: [],
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  db.bookings.unshift(booking);
  if (prov) {
    db.providerLocations[prov.id] = {
      booking_id: id,
      latitude: Number(booking.address_lat) + 0.008,
      longitude: Number(booking.address_lng) + 0.006,
      updated_at: now.toISOString(),
    };
  }
  db.notifications.unshift({
    id: randomUUID(),
    user_id: user.id,
    type: 'booking_confirmed',
    title: `Booking ${bookingCode} Confirmed 🎉`,
    body: `${svc.name} (${hours} hr) · Est. ₹${bill.total.toFixed(2)}. Your Start Service OTP is ready on the tracking screen.`,
    is_read: false,
    data: { bookingId: id, url: `/tracking/${id}` },
    created_at: now.toISOString(),
  });
  writeLocalDb(db);

  // Issue Start Service OTP automatically so customer can view it on /tracking/[id]
  issueLocalOtp({ key: id, purpose: 'start_service', bookingId: id, customerId: user.id });

  return booking;
}

export function performLocalBookingAction(user: LocalUser, bookingId: string, input: any) {
  if (input.action === 'start_service') {
    const check = verifyLocalOtp(bookingId, 'start_service', input.otp);
    if (!check.ok) throw new Error(check.error || 'Invalid Start OTP');
  } else if (input.action === 'end_service') {
    const check = verifyLocalOtp(bookingId, 'end_service', input.otp);
    if (!check.ok) throw new Error(check.error || 'Invalid Completion OTP');
  }

  const db = readLocalDb();
  const b = db.bookings.find((x) => x.id === bookingId);
  if (!b) throw new Error('Booking not found.');

  const now = new Date();
  let shouldIssueEndOtp = false;

  if (input.action === 'cancel') {
    b.status = 'cancelled';
    b.cancellation_reason = input.reason;
    b.cancelled_at = now.toISOString();
  } else if (input.action === 'start_service') {
    b.status = 'in_progress';
    b.started_at = now.toISOString();
    shouldIssueEndOtp = true;
  } else if (input.action === 'request_end_otp') {
    b.material_cost = Number(input.materialCost ?? 0);
    b.spare_parts_cost = Number(input.sparePartsCost ?? 0);
    shouldIssueEndOtp = true;
  } else if (input.action === 'end_service') {
    const started = b.started_at ? new Date(b.started_at) : new Date(now.getTime() - b.estimated_hours * 3600_000);
    const actualMins = Math.max(60, Math.round((now.getTime() - started.getTime()) / 60_000));
    const coupon = b.coupon_code ? db.coupons.find((c) => c.code === b.coupon_code) : null;
    const final = computeFinalBill({
      actualMinutes: actualMins,
      approvedHours: Number(b.estimated_hours) + Number(b.extra_hours_approved),
      rate: {
        firstHourPrice: Number(b.first_hour_price),
        additionalHourPrice: Number(b.additional_hour_price),
        visitingCharge: Number(b.visiting_charge),
      },
      taxPercent: Number(b.gst_percent),
      commissionPercent: Number(b.commission_percent),
      coupon,
      materials: Number(b.material_cost ?? 0),
      spareParts: Number(b.spare_parts_cost ?? 0),
    });
    b.status = 'completed';
    b.completed_at = now.toISOString();
    b.actual_hours = Math.round((actualMins / 60) * 100) / 100;
    b.billed_hours = final.billedHours;
    b.final_base = final.labor;
    b.final_discount = final.discount;
    b.final_tax = final.tax;
    b.final_total = final.total;
    b.commission_amount = final.commission;
    b.provider_earning = final.providerEarning;

    const inv = {
      id: randomUUID(),
      invoice_number: `INV-${b.booking_code.replace('QS-', '')}`,
      booking_id: b.id,
      customer_name: user.full_name,
      customer_mobile: user.mobile,
      customer_email: user.email,
      customer_address: `${b.address_line}, ${b.address_city} ${b.address_pin}`,
      provider_name: b.provider?.display_name ?? null,
      company_name: b.company?.company_name ?? null,
      service_name: b.services?.name ?? 'Service',
      service_description: b.issue_description ?? b.services?.description ?? null,
      service_date: now.toISOString().slice(0, 10),
      start_time: b.started_at ?? now.toISOString(),
      end_time: now.toISOString(),
      actual_hours: b.actual_hours,
      billed_hours: final.billedHours,
      line_items: final.lines,
      base_amount: final.labor,
      material_cost: final.materials,
      spare_parts_cost: final.spareParts,
      visiting_charge: final.visiting,
      discount_amount: final.discount,
      tax_percent: final.taxPercent,
      tax_amount: final.tax,
      total_amount: final.total,
      payment_status: b.payment_status,
      payment_method: b.payment_method,
      created_at: now.toISOString(),
    };
    b.invoices = [inv];
    db.invoices.unshift(inv);
  } else if (input.action === 'request_extra_hours') {
    const amount = extraHoursCost(
      Number(input.hours),
      { firstHourPrice: b.first_hour_price, additionalHourPrice: b.additional_hour_price, visitingCharge: b.visiting_charge },
      Number(b.gst_percent),
    );
    b.extra_hour_requests = [
      ...(b.extra_hour_requests ?? []),
      { id: randomUUID(), hours: Number(input.hours), reason: input.reason, extra_amount: amount, status: 'requested' },
    ];
  } else if (input.action === 'respond_extra_hours') {
    const pending = (b.extra_hour_requests ?? []).find((r: any) => r.status === 'requested');
    if (pending) {
      pending.status = input.approve ? 'approved' : 'rejected';
      if (input.approve) b.extra_hours_approved = Number(b.extra_hours_approved) + Number(pending.hours);
    }
  } else if (input.action === 'collect_cash') {
    b.payment_status = 'paid';
    if (b.invoices?.[0]) b.invoices[0].payment_status = 'paid';
  }

  b.updated_at = now.toISOString();
  writeLocalDb(db);
  if (shouldIssueEndOtp) {
    issueLocalOtp({ key: bookingId, purpose: 'end_service', bookingId, customerId: b.customer_id });
  }
  return b;
}
