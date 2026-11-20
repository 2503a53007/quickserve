/**
 * Arrival-time (ETA) engine.
 *
 * Principle: NEVER promise an arrival time without real inputs. `planArrival` returns
 * `{ ok: false, reason }` whenever the provider has no known location, is offline, is outside the
 * service radius, or the slot isn't free — instead of inventing a number.
 *
 * Travel time uses Google Directions (with live traffic) when a server key is configured
 * (see lib/maps/server.ts); otherwise a distance-based estimate (clearly labelled "estimate").
 */
export interface ArrivalConfig {
  avgSpeedKmph: number;      // used when no traffic-aware route is available
  prepMinutes: number;       // provider acceptance / getting ready
  bufferMinutes: number;     // gap between estimated and "latest promised" arrival
  minLeadMinutes: number;    // earliest bookable time from now
  maxArrivalMinutes: number; // longest ASAP arrival we are willing to promise
  maxRadiusKm: number;
}
export const DEFAULT_ARRIVAL_CONFIG: ArrivalConfig = {
  avgSpeedKmph: 22, prepMinutes: 5, bufferMinutes: 10, minLeadMinutes: 45, maxArrivalMinutes: 90, maxRadiusKm: 25,
};
/** Road distance is longer than the straight line. */
export const ROAD_FACTOR = 1.3;

export interface RouteInfo {
  distanceKm: number;
  durationMinutes: number;
  source: 'google_traffic' | 'google' | 'estimate';
}

export function estimateRoute(straightLineKm: number, avgSpeedKmph: number): RouteInfo {
  const road = straightLineKm * ROAD_FACTOR;
  return { distanceKm: round1(road), durationMinutes: Math.max(1, Math.ceil((road / avgSpeedKmph) * 60)), source: 'estimate' };
}
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface PlanArrivalInput {
  now: Date;
  mode: 'asap' | 'scheduled';
  scheduledStart?: Date;       // required for scheduled
  providerOnline: boolean;
  providerHasLocation: boolean;
  straightLineKm: number | null;
  serviceRadiusKm: number;
  route: RouteInfo | null;     // from maps, or estimate
  slotFree: boolean;
  config: ArrivalConfig;
}
export type ArrivalPlan =
  | { ok: true; etaAt: Date; latestAt: Date; distanceKm: number; travelMinutes: number; source: RouteInfo['source']; startsAt: Date }
  | { ok: false; reason: ArrivalRefusal; message: string };
export type ArrivalRefusal =
  | 'NO_LOCATION' | 'OFFLINE' | 'OUT_OF_RANGE' | 'SLOT_UNAVAILABLE' | 'TOO_SOON' | 'TOO_FAR_FOR_ASAP' | 'NO_ROUTE';

const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const ceilTo5 = (d: Date) => new Date(Math.ceil(d.getTime() / 300_000) * 300_000);

export function planArrival(i: PlanArrivalInput): ArrivalPlan {
  const fail = (reason: ArrivalRefusal, message: string): ArrivalPlan => ({ ok: false, reason, message });
  if (!i.providerHasLocation || i.straightLineKm == null) return fail('NO_LOCATION', 'We can\'t confirm this professional\'s location yet, so we can\'t promise an arrival time.');
  const maxKm = Math.min(i.serviceRadiusKm, i.config.maxRadiusKm);
  if (i.straightLineKm > maxKm) return fail('OUT_OF_RANGE', `This professional serves up to ${maxKm} km; you are ${round1(i.straightLineKm)} km away.`);
  if (!i.route) return fail('NO_ROUTE', 'Travel time could not be determined right now. Please try again.');
  if (!i.slotFree) return fail('SLOT_UNAVAILABLE', 'This professional is not free at that time.');

  const travel = i.route.durationMinutes;
  if (i.mode === 'asap') {
    if (!i.providerOnline) return fail('OFFLINE', 'This professional is offline right now. Pick a scheduled time instead.');
    const total = i.config.prepMinutes + travel;
    if (total > i.config.maxArrivalMinutes) return fail('TOO_FAR_FOR_ASAP', `Arrival would take about ${total} min, longer than our ${i.config.maxArrivalMinutes} min promise. Try scheduling.`);
    const eta = ceilTo5(addMin(i.now, total));
    return { ok: true, etaAt: eta, latestAt: addMin(eta, i.config.bufferMinutes), startsAt: eta, distanceKm: i.route.distanceKm, travelMinutes: travel, source: i.route.source };
  }
  const start = i.scheduledStart!;
  if (start.getTime() < addMin(i.now, i.config.minLeadMinutes).getTime()) {
    return fail('TOO_SOON', `Please choose a time at least ${i.config.minLeadMinutes} minutes from now.`);
  }
  // Scheduled: the professional departs early enough to arrive at the start time.
  return { ok: true, etaAt: start, latestAt: addMin(start, i.config.bufferMinutes), startsAt: start, distanceKm: i.route.distanceKm, travelMinutes: travel, source: i.route.source };
}

/** Live recalculation while travelling. Returns whether the provider is running late. */
export function liveEta(now: Date, route: RouteInfo, latestPromised: Date | null) {
  const eta = addMin(now, route.durationMinutes);
  return { etaAt: eta, remainingKm: route.distanceKm, remainingMinutes: route.durationMinutes, delayed: latestPromised ? eta.getTime() > latestPromised.getTime() : false };
}
