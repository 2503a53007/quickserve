import { ok, route } from '@/lib/api';
import { INDIA_CITIES } from '@/lib/catalog';
import { serverEnv } from '@/lib/env';

async function fetchJsonWithTimeout(url: string, headers: Record<string, string> = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

export const GET = route(async (req) => {
  const pin = req.nextUrl.searchParams.get('pin')?.trim();
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const lat = req.nextUrl.searchParams.get('lat');
  const lng = req.nextUrl.searchParams.get('lng');
  const ipLookup = req.nextUrl.searchParams.get('ip') === '1';

  const key = serverEnv.googleMapsServerKey();

  // 1. Live IP-based location fallback (essential for VS Code Simple Browser / restricted webviews)
  if (ipLookup) {
    const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const isLocalIp = !forwarded || forwarded === '::1' || forwarded.startsWith('127.') || forwarded.startsWith('192.168.') || forwarded.startsWith('10.');
    const ipPath = isLocalIp ? '' : `/${encodeURIComponent(forwarded)}`;

    const who = await fetchJsonWithTimeout(`https://ipwho.is${ipPath}`);
    if (who && who.success !== false && who.city) {
      return ok({
        source: 'ip_geolocation',
        formattedAddress: [who.city, who.region, who.postal, who.country].filter(Boolean).join(', '),
        area: who.city,
        city: who.city,
        state: who.region || 'India',
        pinCode: who.postal || '',
        lat: typeof who.latitude === 'number' ? who.latitude : null,
        lng: typeof who.longitude === 'number' ? who.longitude : null,
      });
    }

    const ipapi = await fetchJsonWithTimeout(`https://ipapi.co${ipPath}/json/`);
    if (ipapi && ipapi.city) {
      return ok({
        source: 'ip_geolocation',
        formattedAddress: [ipapi.city, ipapi.region, ipapi.postal, ipapi.country_name].filter(Boolean).join(', '),
        area: ipapi.city,
        city: ipapi.city,
        state: ipapi.region || 'India',
        pinCode: ipapi.postal || '',
        lat: typeof ipapi.latitude === 'number' ? ipapi.latitude : null,
        lng: typeof ipapi.longitude === 'number' ? ipapi.longitude : null,
      });
    }

    const ipApiCom = await fetchJsonWithTimeout(`http://ip-api.com/json${ipPath}?fields=status,city,regionName,zip,lat,lon,country`);
    if (ipApiCom && ipApiCom.status === 'success' && ipApiCom.city) {
      return ok({
        source: 'ip_geolocation',
        formattedAddress: [ipApiCom.city, ipApiCom.regionName, ipApiCom.zip, ipApiCom.country].filter(Boolean).join(', '),
        area: ipApiCom.city,
        city: ipApiCom.city,
        state: ipApiCom.regionName || 'India',
        pinCode: ipApiCom.zip || '',
        lat: typeof ipApiCom.lat === 'number' ? ipApiCom.lat : null,
        lng: typeof ipApiCom.lon === 'number' ? ipApiCom.lon : null,
      });
    }

    return ok({
      source: 'fallback_default',
      formattedAddress: 'Ananthasagar, Hasanparthy Mandal, Hanumakonda District, Telangana 506371',
      area: 'Ananthasagar, Hasanparthy Mandal (Elkathurthy)',
      city: 'Hanumakonda',
      state: 'Telangana',
      pinCode: '506371',
      lat: 18.0829,
      lng: 79.4718,
    });
  }

  // 2. Reverse geocode exact GPS coordinates (Google Maps -> OpenStreetMap Nominatim)
  if (lat && lng) {
    if (key) {
      const data = await fetchJsonWithTimeout(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&key=${encodeURIComponent(key)}`,
      );
      const first = data?.results?.[0];
      if (first) {
        const comps = first.address_components ?? [];
        const find = (type: string) => comps.find((c: any) => c.types?.includes(type))?.long_name ?? '';
        const area = find('sublocality_level_1') || find('sublocality') || find('neighborhood');
        const city = find('locality') || find('administrative_area_level_2');
        return ok({
          source: 'google_maps',
          formattedAddress: first.formatted_address,
          area,
          city: city || area || 'Current Location',
          state: find('administrative_area_level_1'),
          pinCode: find('postal_code'),
          lat: Number(lat),
          lng: Number(lng),
        });
      }
    }

    // OpenStreetMap Nominatim free real reverse geocoding
    const nom = await fetchJsonWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`,
      { 'User-Agent': 'QuickServeIndia/1.0 (support@quickserve.in)' },
    );
    if (nom && nom.address) {
      const a = nom.address;
      const area = a.suburb || a.neighbourhood || a.residential || a.road || '';
      const city = a.city || a.town || a.village || a.state_district || a.county || 'Current Location';
      const state = a.state || 'India';
      const pinCode = a.postcode || '';
      return ok({
        source: 'openstreetmap',
        formattedAddress: nom.display_name || [area, city, state, pinCode].filter(Boolean).join(', '),
        area,
        city,
        state,
        pinCode,
        lat: Number(lat),
        lng: Number(lng),
      });
    }

    return ok({
      source: 'coordinates',
      formattedAddress: `GPS (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`,
      area: '',
      city: 'Current Location',
      state: 'India',
      pinCode: '',
      lat: Number(lat),
      lng: Number(lng),
    });
  }

  // 3. Forward geocode 6-digit Indian PIN code (exact local match -> Google Maps -> India Post API -> City fallback)
  if (pin) {
    if (pin === '506371' || pin === '505476') {
      return ok({
        source: 'pin_lookup',
        formattedAddress: 'Ananthasagar, Hasanparthy Mandal, Hanumakonda District, Telangana 506371',
        area: 'Ananthasagar, Hasanparthy Mandal (Elkathurthy)',
        city: 'Hanumakonda',
        state: 'Telangana',
        pinCode: pin,
        lat: 18.0829,
        lng: 79.4718,
      });
    }
    if (key) {
      const data = await fetchJsonWithTimeout(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(pin)},India&components=country:IN&key=${encodeURIComponent(key)}`,
      );
      const first = data?.results?.[0];
      if (first) {
        const comps = first.address_components ?? [];
        const find = (type: string) => comps.find((c: any) => c.types?.includes(type))?.long_name ?? '';
        return ok({
          source: 'google_maps',
          formattedAddress: first.formatted_address,
          area: find('sublocality') || '',
          city: find('locality') || find('administrative_area_level_2') || '',
          state: find('administrative_area_level_1'),
          pinCode: pin,
          lat: first.geometry?.location?.lat ?? null,
          lng: first.geometry?.location?.lng ?? null,
        });
      }
    }

    // Real India Post PIN code lookup
    const post = await fetchJsonWithTimeout(`https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`);
    const po = post?.[0]?.PostOffice?.[0];
    if (po) {
      const nom = await fetchJsonWithTimeout(
        `https://nominatim.openstreetmap.org/search?format=json&postalcode=${encodeURIComponent(pin)}&country=India&limit=1`,
        { 'User-Agent': 'QuickServeIndia/1.0 (support@quickserve.in)' },
      );
      const coords = nom?.[0];
      return ok({
        source: 'india_post',
        formattedAddress: `${po.Name}, ${po.District}, ${po.State} ${pin}`,
        area: po.Name || '',
        city: po.District || po.Block || po.Name,
        state: po.State || 'India',
        pinCode: pin,
        lat: coords?.lat ? Number(coords.lat) : null,
        lng: coords?.lon ? Number(coords.lon) : null,
      });
    }

    const matched = INDIA_CITIES.find((c) => c.samplePin.slice(0, 2) === pin.slice(0, 2));
    return ok({
      source: 'pin_lookup',
      formattedAddress: matched ? `${matched.city}, ${matched.state} ${pin}` : `India — PIN ${pin}`,
      area: '',
      city: matched?.city ?? 'India',
      state: matched?.state ?? '',
      pinCode: pin,
      lat: matched?.lat ?? null,
      lng: matched?.lng ?? null,
    });
  }

  // 4. City / area text search
  if (q) {
    const low = q.toLowerCase();
    const matched = INDIA_CITIES.find(
      (c) =>
        c.city.toLowerCase().includes(low) ||
        c.state.toLowerCase().includes(low) ||
        c.areas.some((a) => a.toLowerCase().includes(low)),
    );
    return ok({
      source: 'city_directory',
      formattedAddress: matched ? `${matched.city}, ${matched.state}` : q,
      area: '',
      city: matched?.city ?? q,
      state: matched?.state ?? 'India',
      pinCode: matched?.samplePin ?? '',
      lat: matched?.lat ?? null,
      lng: matched?.lng ?? null,
    });
  }

  return ok({
    source: 'default',
    formattedAddress: 'All India',
    area: '',
    city: 'All India',
    state: 'India',
    pinCode: '',
    lat: null,
    lng: null,
  });
});
