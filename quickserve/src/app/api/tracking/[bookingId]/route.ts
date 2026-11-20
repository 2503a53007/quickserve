import { z } from 'zod';
import { badRequest, forbidden, notFound, ok, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { arrivalConfigFor, haversineKm, loadSettings } from '@/lib/booking/context';
import { isSupabaseConfigured } from '@/lib/env';
import { liveEta } from '@/lib/eta';
import { getLocalSessionUser, readLocalDb } from '@/lib/localDb';
import { getRoute } from '@/lib/maps/server';

const gpsUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speedKmph: z.number().min(0).max(150).optional(),
});

export const GET = route<{ bookingId: string }>(async (_req, { params }) => {
  const { bookingId } = await params;

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    const b = db.bookings.find((x) => x.id === bookingId);
    if (!b) throw notFound('Booking not found.');
    const trackingActive = b.status === 'provider_travelling' || b.status === 'provider_arrived';
    const locKey = b.provider_id || b.company_id || 'default-pro';
    let providerLocation = trackingActive ? db.providerLocations[locKey] ?? null : null;
    if (trackingActive && !providerLocation && b.address_lat != null && b.address_lng != null) {
      providerLocation = {
        booking_id: b.id,
        latitude: Number(b.address_lat) + 0.009,
        longitude: Number(b.address_lng) + 0.007,
        updated_at: new Date().toISOString(),
      };
    }
    return ok({
      booking: b,
      trackingActive,
      providerLocation,
      destination:
        b.address_lat != null && b.address_lng != null
          ? { lat: Number(b.address_lat), lng: Number(b.address_lng), label: `${b.address_line}, ${b.address_city}` }
          : null,
    });
  }

  const ctx = await requireAuth();

  const { data: b } = await ctx.admin
    .from('bookings')
    .select('*, provider:provider_profiles(id, display_name, avg_rating, user_id), services(name)')
    .eq('id', bookingId)
    .maybeSingle();

  if (!b) throw notFound('Booking not found.');
  const allowed =
    ctx.profile.role === 'admin' ||
    b.customer_id === ctx.user.id ||
    (b as any).provider?.user_id === ctx.user.id;
  if (!allowed) throw forbidden();

  const trackingActive = b.status === 'provider_travelling' || b.status === 'provider_arrived';
  let providerLocation: { latitude: number; longitude: number; updated_at: string } | null = null;
  if (trackingActive && b.provider_id) {
    const { data: loc } = await ctx.admin
      .from('provider_locations')
      .select('latitude, longitude, updated_at')
      .eq('provider_id', b.provider_id)
      .eq('booking_id', b.id)
      .maybeSingle();
    providerLocation = loc ?? null;
  }

  return ok({
    booking: b,
    trackingActive,
    providerLocation,
    destination:
      b.address_lat != null && b.address_lng != null
        ? { lat: Number(b.address_lat), lng: Number(b.address_lng), address: b.address_line }
        : null,
  });
});

export const POST = route<{ bookingId: string }>(async (req, { params }) => {
  const { bookingId } = await params;
  const { lat, lng, heading, speedKmph } = await parseBody(req, gpsUpdateSchema);

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const { writeLocalDb } = await import('@/lib/localDb');
    const db = readLocalDb();
    const b = db.bookings.find((x) => x.id === bookingId);
    if (!b) throw notFound('Booking not found.');
    const locKey = b.provider_id || b.company_id || 'default-pro';
    db.providerLocations[locKey] = {
      booking_id: b.id,
      latitude: lat,
      longitude: lng,
      updated_at: new Date().toISOString(),
    };
    if (b.address_lat != null && b.address_lng != null) {
      const dist = Math.round(haversineKm(lat, lng, Number(b.address_lat), Number(b.address_lng)) * 10) / 10;
      b.eta_distance_km = dist;
      const mins = Math.max(3, Math.round((dist / 22) * 60));
      b.eta_at = new Date(Date.now() + mins * 60_000).toISOString();
    }
    writeLocalDb(db);
    return ok({ updated: true, distanceKm: b.eta_distance_km, etaAt: b.eta_at });
  }

  const ctx = await requireAuth(['provider']);

  const { data: prov } = await ctx.admin.from('provider_profiles').select('id').eq('user_id', ctx.user.id).maybeSingle();
  if (!prov) throw forbidden('Provider profile required.');

  const { data: b } = await ctx.admin.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (!b || b.provider_id !== prov.id) throw forbidden();
  if (b.status !== 'provider_travelling') {
    throw badRequest('Location broadcasting is only permitted while travelling to the customer.', 'TRACKING_INACTIVE');
  }

  await ctx.admin.from('provider_locations').upsert({
    provider_id: prov.id,
    booking_id: b.id,
    latitude: lat,
    longitude: lng,
    heading: heading ?? null,
    speed_kmph: speedKmph ?? null,
    updated_at: new Date().toISOString(),
  });

  if (b.address_lat != null && b.address_lng != null) {
    const settings = await loadSettings(ctx.admin);
    const { config } = await arrivalConfigFor(ctx.admin, settings.arrival, Number(b.address_lat), Number(b.address_lng));
    const straight = haversineKm(lat, lng, Number(b.address_lat), Number(b.address_lng));
    const rt = await getRoute({ lat, lng }, { lat: Number(b.address_lat), lng: Number(b.address_lng) }, straight, config.avgSpeedKmph);
    const eta = liveEta(new Date(), rt, b.eta_latest_at ? new Date(b.eta_latest_at) : null);

    await ctx.admin.from('bookings').update({
      eta_at: eta.etaAt.toISOString(),
      eta_distance_km: rt.distanceKm,
    }).eq('id', b.id);

    return ok({ updated: true, distanceKm: rt.distanceKm, etaAt: eta.etaAt.toISOString(), delayed: eta.delayed });
  }

  return ok({ updated: true });
});
