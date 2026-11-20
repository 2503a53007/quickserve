import 'server-only';
import { serverEnv } from '@/lib/env';
import { estimateRoute, type RouteInfo } from '@/lib/eta';

export interface LatLng { lat: number; lng: number }

/**
 * Traffic-aware route via the Google Routes API when GOOGLE_MAPS_SERVER_API_KEY is set.
 * Falls back to a clearly-labelled distance estimate (source: 'estimate') — callers surface that label.
 */
export async function getRoute(origin: LatLng, dest: LatLng, straightLineKm: number, avgSpeedKmph: number): Promise<RouteInfo> {
  const key = serverEnv.googleMapsServerKey();
  if (!key) return estimateRoute(straightLineKm, avgSpeedKmph);
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: dest.lat, longitude: dest.lng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`routes ${res.status}`);
    const json = (await res.json()) as { routes?: { duration?: string; distanceMeters?: number }[] };
    const r = json.routes?.[0];
    if (!r?.duration || r.distanceMeters == null) throw new Error('no route');
    return {
      distanceKm: Math.round(r.distanceMeters / 100) / 10,
      durationMinutes: Math.max(1, Math.ceil(parseInt(r.duration, 10) / 60)),
      source: 'google_traffic',
    };
  } catch (e) {
    console.warn('[maps] route lookup failed, using estimate:', (e as Error).message);
    return estimateRoute(straightLineKm, avgSpeedKmph);
  }
}

export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number; formatted: string; city?: string; state?: string; pin?: string } | null> {
  const key = serverEnv.googleMapsServerKey();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=country:IN&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const json = await res.json();
  return parseGeocode(json.results?.[0]);
}

export async function reverseGeocode(lat: number, lng: number) {
  const key = serverEnv.googleMapsServerKey();
  if (!key) return null;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const json = await res.json();
  return parseGeocode(json.results?.[0]);
}

function parseGeocode(r: any) {
  if (!r) return null;
  const comp = (type: string) => r.address_components?.find((c: any) => c.types.includes(type))?.long_name as string | undefined;
  return {
    lat: r.geometry.location.lat as number, lng: r.geometry.location.lng as number, formatted: r.formatted_address as string,
    city: comp('locality') ?? comp('administrative_area_level_2'), state: comp('administrative_area_level_1'), pin: comp('postal_code'),
  };
}
