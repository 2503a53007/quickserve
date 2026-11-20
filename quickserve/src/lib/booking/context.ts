import 'server-only';
import { DEFAULT_ARRIVAL_CONFIG, type ArrivalConfig } from '@/lib/eta';
import { DEFAULT_CANCELLATION_POLICY, LIVE_STATUSES, type CancellationPolicy } from '@/lib/booking/state';
import { DEFAULT_HOURS, windowFor, type BusyInterval, type WorkingWindow } from '@/lib/slots';
import type { RateCard } from '@/lib/pricing';
import type { AdminClient } from '@/lib/supabase/server';
import { notFound } from '@/lib/api';
import type { OwnerKind } from '@/types/db';

export interface PlatformSettings {
  gstPercent: number;
  cancellation: CancellationPolicy;
  arrival: ArrivalConfig;
  providerAckMinutes: number;
}

export async function loadSettings(admin: AdminClient): Promise<PlatformSettings> {
  const { data } = await admin.from('platform_settings').select('key,value').in('key', ['gst_percent', 'cancellation_policy', 'arrival_defaults']);
  const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Record<string, any>;
  const a = m.arrival_defaults ?? {};
  return {
    gstPercent: Number(m.gst_percent ?? 18),
    cancellation: { ...DEFAULT_CANCELLATION_POLICY, ...(m.cancellation_policy ?? {}) },
    providerAckMinutes: Number(a.provider_ack_minutes ?? 10),
    arrival: {
      avgSpeedKmph: Number(a.avg_speed_kmph ?? DEFAULT_ARRIVAL_CONFIG.avgSpeedKmph),
      prepMinutes: Number(a.prep_minutes ?? DEFAULT_ARRIVAL_CONFIG.prepMinutes),
      bufferMinutes: Number(a.buffer_minutes ?? DEFAULT_ARRIVAL_CONFIG.bufferMinutes),
      minLeadMinutes: Number(a.min_lead_minutes ?? DEFAULT_ARRIVAL_CONFIG.minLeadMinutes),
      maxArrivalMinutes: Number(a.max_arrival_minutes ?? DEFAULT_ARRIVAL_CONFIG.maxArrivalMinutes),
      maxRadiusKm: Number(a.max_radius_km ?? DEFAULT_ARRIVAL_CONFIG.maxRadiusKm),
    },
  };
}

/** Admin-configured service area (nearest active area containing the point) overrides arrival defaults. */
export async function arrivalConfigFor(admin: AdminClient, base: ArrivalConfig, lat: number, lng: number): Promise<{ config: ArrivalConfig; areaName: string | null }> {
  const { data: areas } = await admin.from('service_areas').select('*').eq('is_active', true);
  let best: any = null; let bestD = Infinity;
  for (const a of areas ?? []) {
    const d = haversineKm(lat, lng, a.center_lat, a.center_lng);
    if (d <= Number(a.radius_km) && d < bestD) { best = a; bestD = d; }
  }
  if (!best) return { config: base, areaName: null };
  return {
    areaName: best.name,
    config: {
      ...base,
      avgSpeedKmph: Number(best.avg_speed_kmph), prepMinutes: best.prep_minutes, bufferMinutes: best.buffer_minutes,
      minLeadMinutes: best.min_lead_minutes, maxArrivalMinutes: best.max_arrival_minutes,
    },
  };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface Owner {
  kind: OwnerKind;
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
  isOnline: boolean;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  /** parallel workers (1 for individuals) */
  capacity: number;
  hoursRows: { day_of_week: number; start_time: string; end_time: string; is_working: boolean }[] | null;
  companyHours: { days: number[]; start: string; end: string } | null;
}

export async function loadOwner(admin: AdminClient, kind: OwnerKind, id: string): Promise<Owner> {
  if (kind === 'provider') {
    const { data: p } = await admin.from('provider_profiles').select('*, users!inner(full_name, avatar_url, is_active)').eq('id', id).maybeSingle();
    if (!p || p.company_id) throw notFound('Professional not found');
    const { data: rows } = await admin.from('provider_availability').select('day_of_week,start_time,end_time,is_working').eq('provider_id', id);
    return {
      kind, id, userId: p.user_id, name: p.display_name ?? (p as any).users.full_name ?? 'Service Professional', avatarUrl: (p as any).users.avatar_url,
      verified: p.verification_status === 'verified' && (p as any).users.is_active, isOnline: p.is_online,
      lat: p.latitude, lng: p.longitude, radiusKm: Number(p.service_radius_km), capacity: 1, hoursRows: rows ?? [], companyHours: null,
    };
  }
  const { data: c } = await admin.from('company_profiles').select('*, users!inner(is_active, avatar_url)').eq('id', id).maybeSingle();
  if (!c) throw notFound('Company not found');
  const { count } = await admin.from('company_employees').select('provider_id, provider_profiles!inner(verification_status)', { count: 'exact', head: true })
    .eq('company_id', id).eq('is_active', true).eq('provider_profiles.verification_status', 'verified');
  return {
    kind, id, userId: c.user_id, name: c.company_name, avatarUrl: c.logo_url ?? (c as any).users.avatar_url,
    verified: c.verification_status === 'verified' && (c as any).users.is_active, isOnline: c.is_online,
    lat: c.latitude, lng: c.longitude, radiusKm: Number(c.service_radius_km), capacity: count ?? 0, hoursRows: null,
    companyHours: { days: c.working_days, start: String(c.working_start).slice(0, 5), end: String(c.working_end).slice(0, 5) },
  };
}

export function ownerWindow(owner: Owner, date: string): WorkingWindow | null {
  return windowFor(date, owner.hoursRows, owner.companyHours ?? DEFAULT_HOURS);
}

export async function ownerRate(admin: AdminClient, serviceId: string, owner: Owner): Promise<RateCard | null> {
  const col = owner.kind === 'provider' ? 'provider_id' : 'company_id';
  const { data } = await admin.from('service_pricing').select('*').eq('service_id', serviceId).eq(col, owner.id).eq('is_active', true).maybeSingle();
  if (!data) return null;
  return { firstHourPrice: Number(data.first_hour_price), additionalHourPrice: Number(data.additional_hour_price), visitingCharge: Number(data.visiting_charge) };
}

/** Live bookings of this owner overlapping [from, to). */
export async function busyIntervals(admin: AdminClient, owner: Owner, from: Date, to: Date, excludeBookingId?: string): Promise<BusyInterval[]> {
  const col = owner.kind === 'provider' ? 'provider_id' : 'company_id';
  let q = admin.from('bookings').select('id,scheduled_start,scheduled_end').eq(col, owner.id).in('status', LIVE_STATUSES)
    .lt('scheduled_start', to.toISOString()).gt('scheduled_end', from.toISOString());
  if (excludeBookingId) q = q.neq('id', excludeBookingId);
  const { data } = await q;
  return (data ?? []).map((b) => ({ start: new Date(b.scheduled_start), end: new Date(b.scheduled_end) }));
}

export async function sweepExpired(admin: AdminClient) {
  const { data } = await admin.rpc('expire_stale_bookings');
  const ids = (data ?? []) as string[];
  if (!ids.length) return;
  const { notify } = await import('@/lib/notifications/server');
  const { data: rows } = await admin.from('bookings').select('id,customer_id,booking_code').in('id', ids);
  for (const b of rows ?? []) {
    await admin.from('booking_status_history').insert({ booking_id: b.id, status: 'rejected', note: 'No response from provider' });
    await notify(admin, { userIds: b.customer_id, type: 'booking_cancelled', title: 'Booking not accepted', body: `${b.booking_code}: the professional did not respond in time. Please pick another professional.`, data: { bookingId: b.id, url: `/orders` } });
  }
}
