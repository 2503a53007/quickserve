import { ok, route } from '@/lib/api';
import { haversineKm } from '@/lib/booking/context';
import { isSupabaseConfigured } from '@/lib/env';
import { readLocalDb } from '@/lib/localDb';
import { createAdminSupabase } from '@/lib/supabase/server';

export const GET = route(async (req) => {
  const sp = req.nextUrl.searchParams;
  const categorySlug = sp.get('category') || undefined;
  const serviceId = sp.get('serviceId') || undefined;
  const city = sp.get('city') || undefined;
  const pin = sp.get('pin') || undefined;
  const minRating = Number(sp.get('minRating') || 0);
  const maxPrice = Number(sp.get('maxPrice') || 0);
  const maxDistance = Number(sp.get('maxDistance') || 50);
  const availableOnly = sp.get('available') === '1';
  const sortBy = sp.get('sort') || 'distance';
  const lat = sp.get('lat') ? Number(sp.get('lat')) : null;
  const lng = sp.get('lng') ? Number(sp.get('lng')) : null;

  if (!isSupabaseConfigured()) {
    const db = readLocalDb();
    const list: any[] = [];

    for (const p of db.providers.filter((x) => x.verification_status === 'verified')) {
      if (availableOnly && !p.is_online) continue;
      if (minRating && Number(p.avg_rating ?? 0) < minRating) continue;
      if (maxPrice > 0 && Number(p.default_hourly_rate ?? 199) > maxPrice) continue;
      if (categorySlug && p.skills?.length && !p.skills.includes(categorySlug)) continue;

      const dist =
        lat != null && lng != null && p.base_lat != null && p.base_lng != null
          ? Math.round(haversineKm(lat, lng, Number(p.base_lat), Number(p.base_lng)) * 10) / 10
          : null;

      list.push({
        id: p.id,
        ownerKind: 'provider',
        name: p.display_name,
        avatarUrl: null,
        verified: true,
        experienceYears: Number(p.experience_years ?? 3),
        avgRating: Number(p.avg_rating ?? 4.8),
        totalReviews: Number(p.total_reviews ?? 0),
        totalJobs: Number(p.total_jobs ?? 0),
        isOnline: Boolean(p.is_online),
        city: p.city,
        pinCode: p.pin_code,
        lat: p.base_lat,
        lng: p.base_lng,
        distanceKm: dist,
        firstHourPrice: Number(p.default_hourly_rate ?? 199),
        additionalHourPrice: Math.round(Number(p.default_hourly_rate ?? 199) * 0.75),
        visitingCharge: Number(p.default_visiting_charge ?? 50),
        bio: p.bio,
        skills: p.skills ?? [],
        services: [],
      });
    }

    for (const c of db.companies.filter((x) => x.verification_status === 'verified')) {
      if (minRating && Number(c.avg_rating ?? 0) < minRating) continue;
      const dist =
        lat != null && lng != null && c.base_lat != null && c.base_lng != null
          ? Math.round(haversineKm(lat, lng, Number(c.base_lat), Number(c.base_lng)) * 10) / 10
          : null;
      list.push({
        id: c.id,
        ownerKind: 'company',
        name: c.company_name,
        avatarUrl: null,
        verified: true,
        experienceYears: Number(c.team_size ?? 10),
        teamSize: Number(c.team_size ?? 10),
        avgRating: Number(c.avg_rating ?? 4.9),
        totalReviews: Number(c.total_reviews ?? 0),
        totalJobs: Number(c.total_jobs ?? 0),
        isOnline: true,
        city: c.city,
        pinCode: c.pin_code,
        lat: c.base_lat,
        lng: c.base_lng,
        distanceKm: dist,
        firstHourPrice: 249,
        additionalHourPrice: 179,
        visitingCharge: 50,
        bio: c.description,
        skills: c.skills ?? [],
        services: [],
      });
    }

    list.sort((a, b) => {
      if (sortBy === 'rating') return b.avgRating - a.avgRating;
      if (sortBy === 'price') return a.firstHourPrice - b.firstHourPrice;
      if (sortBy === 'jobs') return b.totalJobs - a.totalJobs;
      return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
    });

    return ok({ configured: true, mode: 'local', providers: list });
  }

  const admin = createAdminSupabase();

  let catId: string | null = null;
  if (categorySlug) {
    const { data: cat } = await admin.from('service_categories').select('id').eq('slug', categorySlug).maybeSingle();
    catId = cat?.id ?? null;
  }

  const [{ data: indRows }, { data: compRows }, { data: pricingRows }] = await Promise.all([
    admin
      .from('provider_profiles')
      .select('*, users(full_name, avatar_url, mobile)')
      .eq('verification_status', 'verified')
      .is('company_id', null),
    admin.from('company_profiles').select('*').eq('verification_status', 'verified'),
    admin.from('service_pricing').select('*, services(id, name, slug, category_id)').eq('is_active', true),
  ]);

  const results: any[] = [];

  for (const p of indRows ?? []) {
    if (availableOnly && !p.is_online) continue;
    if (city && p.city && !p.city.toLowerCase().includes(city.toLowerCase())) continue;
    if (pin && p.pin_code && p.pin_code !== pin) continue;
    if (minRating && Number(p.avg_rating ?? 0) < minRating) continue;

    const pRates = (pricingRows ?? []).filter((r: any) => r.provider_id === p.id);
    if (catId && pRates.length && !pRates.some((r: any) => r.services?.category_id === catId)) continue;
    if (serviceId && pRates.length && !pRates.some((r: any) => r.service_id === serviceId)) continue;

    const firstHour = pRates.length
      ? Math.min(...pRates.map((r: any) => Number(r.first_hour_price)))
      : Number(p.default_hourly_rate ?? 199);
    if (maxPrice > 0 && firstHour > maxPrice) continue;

    const dist =
      lat != null && lng != null && p.base_lat != null && p.base_lng != null
        ? Math.round(haversineKm(lat, lng, Number(p.base_lat), Number(p.base_lng)) * 10) / 10
        : null;
    if (dist != null && dist > maxDistance) continue;

    results.push({
      id: p.id,
      ownerKind: 'provider',
      name: p.display_name || (p as any).users?.full_name || 'Verified Pro',
      avatarUrl: (p as any).users?.avatar_url ?? null,
      verified: true,
      experienceYears: Number(p.experience_years ?? 1),
      avgRating: Number(p.avg_rating ?? 0),
      totalReviews: Number(p.total_reviews ?? 0),
      totalJobs: Number(p.total_jobs ?? 0),
      isOnline: Boolean(p.is_online),
      city: p.city,
      pinCode: p.pin_code,
      lat: p.base_lat,
      lng: p.base_lng,
      distanceKm: dist,
      firstHourPrice: firstHour,
      additionalHourPrice: pRates[0]?.additional_hour_price ?? Math.round(firstHour * 0.75),
      visitingCharge: pRates[0]?.visiting_charge ?? Number(p.default_visiting_charge ?? 50),
      bio: p.bio,
      skills: p.skills ?? [],
      services: pRates.map((r: any) => ({
        serviceId: r.service_id,
        name: r.services?.name,
        firstHourPrice: Number(r.first_hour_price),
        additionalHourPrice: Number(r.additional_hour_price),
        visitingCharge: Number(r.visiting_charge),
      })),
    });
  }

  for (const c of compRows ?? []) {
    if (city && c.city && !c.city.toLowerCase().includes(city.toLowerCase())) continue;
    if (pin && c.pin_code && c.pin_code !== pin) continue;
    if (minRating && Number(c.avg_rating ?? 0) < minRating) continue;

    const cRates = (pricingRows ?? []).filter((r: any) => r.company_id === c.id);
    if (catId && cRates.length && !cRates.some((r: any) => r.services?.category_id === catId)) continue;
    if (serviceId && cRates.length && !cRates.some((r: any) => r.service_id === serviceId)) continue;

    const firstHour = cRates.length ? Math.min(...cRates.map((r: any) => Number(r.first_hour_price))) : 249;
    if (maxPrice > 0 && firstHour > maxPrice) continue;

    const dist =
      lat != null && lng != null && c.base_lat != null && c.base_lng != null
        ? Math.round(haversineKm(lat, lng, Number(c.base_lat), Number(c.base_lng)) * 10) / 10
        : null;
    if (dist != null && dist > maxDistance) continue;

    results.push({
      id: c.id,
      ownerKind: 'company',
      name: c.company_name,
      avatarUrl: c.logo_url ?? null,
      verified: true,
      experienceYears: Number(c.team_size ?? 5),
      teamSize: Number(c.team_size ?? 1),
      avgRating: Number(c.avg_rating ?? 0),
      totalReviews: Number(c.total_reviews ?? 0),
      totalJobs: Number(c.total_jobs ?? 0),
      isOnline: true,
      city: c.city,
      pinCode: c.pin_code,
      lat: c.base_lat,
      lng: c.base_lng,
      distanceKm: dist,
      firstHourPrice: firstHour,
      additionalHourPrice: cRates[0]?.additional_hour_price ?? Math.round(firstHour * 0.75),
      visitingCharge: cRates[0]?.visiting_charge ?? 50,
      bio: c.description,
      skills: [],
      services: cRates.map((r: any) => ({
        serviceId: r.service_id,
        name: r.services?.name,
        firstHourPrice: Number(r.first_hour_price),
        additionalHourPrice: Number(r.additional_hour_price),
        visitingCharge: Number(r.visiting_charge),
      })),
    });
  }

  results.sort((a, b) => {
    if (sortBy === 'rating') return b.avgRating - a.avgRating;
    if (sortBy === 'price') return a.firstHourPrice - b.firstHourPrice;
    if (sortBy === 'jobs') return b.totalJobs - a.totalJobs;
    return (a.distanceKm ?? 999) - (b.distanceKm ?? 999);
  });

  return ok({ configured: true, mode: 'supabase', providers: results });
});
