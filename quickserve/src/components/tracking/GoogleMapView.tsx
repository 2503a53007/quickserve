'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPin, Navigation } from 'lucide-react';
import { isMapsConfigured, publicEnv } from '@/lib/env';

interface Coordinate {
  lat: number;
  lng: number;
  label?: string;
}

interface GoogleMapViewProps {
  customerLocation?: Coordinate | null;
  providerLocation?: Coordinate | null;
  markers?: Array<Coordinate & { id: string; title: string; subtitle?: string }>;
  heightClass?: string;
}

declare global {
  interface Window {
    google?: any;
    L?: any;
  }
}

export function GoogleMapView({
  customerLocation,
  providerLocation,
  markers = [],
  heightClass = 'h-80',
}: GoogleMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapInstance = useRef<any>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);

  const hasGoogleKey = isMapsConfigured();

  // 1. Load Google Maps JS SDK if API key is configured
  useEffect(() => {
    if (!hasGoogleKey || typeof window === 'undefined') return;
    if (window.google?.maps) {
      setGoogleReady(true);
      return;
    }
    const scriptId = 'qs-google-maps-sdk';
    if (document.getElementById(scriptId)) {
      const check = setInterval(() => {
        if (window.google?.maps) {
          setGoogleReady(true);
          clearInterval(check);
        }
      }, 250);
      return () => clearInterval(check);
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(publicEnv.googleMapsKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setGoogleReady(true);
    script.onerror = () => setFallbackError(true);
    document.head.appendChild(script);
  }, [hasGoogleKey]);

  // 2. Otherwise load Leaflet + OpenStreetMap live street maps (works immediately with zero API keys!)
  useEffect(() => {
    if (hasGoogleKey && !fallbackError) return;
    if (typeof window === 'undefined') return;

    if (window.L) {
      setLeafletReady(true);
      return;
    }

    if (!document.getElementById('qs-leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'qs-leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const scriptId = 'qs-leaflet-js';
    if (document.getElementById(scriptId)) {
      const check = setInterval(() => {
        if (window.L) {
          setLeafletReady(true);
          clearInterval(check);
        }
      }, 200);
      return () => clearInterval(check);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletReady(true);
    script.onerror = () => setFallbackError(true);
    document.head.appendChild(script);
  }, [hasGoogleKey, fallbackError]);

  // Render Google Map
  useEffect(() => {
    if (!hasGoogleKey || !googleReady || !mapRef.current || !window.google?.maps) return;
    const gmaps = window.google.maps;
    const center = providerLocation ?? customerLocation ?? markers[0] ?? { lat: 17.4483, lng: 78.3915 };

    const map = new gmaps.Map(mapRef.current, {
      center: { lat: center.lat, lng: center.lng },
      zoom: customerLocation || providerLocation ? 14 : 11,
      streetViewControl: false,
      mapTypeControl: false,
    });

    const bounds = new gmaps.LatLngBounds();
    let count = 0;

    if (customerLocation) {
      new gmaps.Marker({
        position: { lat: customerLocation.lat, lng: customerLocation.lng },
        map,
        title: customerLocation.label || 'Customer Destination',
        label: 'H',
      });
      bounds.extend({ lat: customerLocation.lat, lng: customerLocation.lng });
      count++;
    }
    if (providerLocation) {
      new gmaps.Marker({
        position: { lat: providerLocation.lat, lng: providerLocation.lng },
        map,
        title: providerLocation.label || 'Live Professional',
        label: 'P',
      });
      bounds.extend({ lat: providerLocation.lat, lng: providerLocation.lng });
      count++;
    }
    if (customerLocation && providerLocation) {
      new gmaps.Polyline({
        path: [
          { lat: providerLocation.lat, lng: providerLocation.lng },
          { lat: customerLocation.lat, lng: customerLocation.lng },
        ],
        geodesic: true,
        strokeColor: '#F97316',
        strokeOpacity: 0.95,
        strokeWeight: 4,
        map,
      });
    }
    for (const m of markers) {
      new gmaps.Marker({ position: { lat: m.lat, lng: m.lng }, map, title: m.title });
      bounds.extend({ lat: m.lat, lng: m.lng });
      count++;
    }
    if (count > 1) map.fitBounds(bounds, 55);
  }, [hasGoogleKey, googleReady, customerLocation, providerLocation, markers]);

  // Render Leaflet + OpenStreetMap Live Interactive Map
  useEffect(() => {
    if ((hasGoogleKey && !fallbackError) || !leafletReady || !mapRef.current || !window.L) return;
    const L = window.L;

    if (leafletMapInstance.current) {
      leafletMapInstance.current.remove();
      leafletMapInstance.current = null;
    }

    const center = providerLocation ?? customerLocation ?? markers[0] ?? { lat: 17.4483, lng: 78.3915 };
    const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(
      [center.lat, center.lng],
      customerLocation || providerLocation ? 14 : 6,
    );
    leafletMapInstance.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const points: Array<[number, number]> = [];

    if (customerLocation) {
      const homeIcon = L.divIcon({
        className: 'qs-map-pin',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:#0F172A;color:#fff;font-weight:900;font-size:16px;border:3px solid #F97316;box-shadow:0 6px 16px rgba(15,23,42,0.4);">🏠</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([customerLocation.lat, customerLocation.lng], { icon: homeIcon })
        .addTo(map)
        .bindPopup(`<strong>Service Location</strong><br/>${customerLocation.label || 'Customer Address'}`);
      points.push([customerLocation.lat, customerLocation.lng]);
    }

    if (providerLocation) {
      const proIcon = L.divIcon({
        className: 'qs-map-pin',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:9999px;background:linear-gradient(135deg,#F97316,#EA580C);color:#fff;font-weight:900;font-size:18px;border:3px solid #fff;box-shadow:0 0 0 6px rgba(249,115,22,0.28),0 8px 18px rgba(234,88,12,0.45);">⚡</div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      L.marker([providerLocation.lat, providerLocation.lng], { icon: proIcon })
        .addTo(map)
        .bindPopup(`<strong>Live Professional</strong><br/>${providerLocation.label || 'QuickServe Pro'}<br/>GPS active`)
        .openPopup();
      points.push([providerLocation.lat, providerLocation.lng]);
    }

    if (customerLocation && providerLocation) {
      L.polyline(
        [
          [providerLocation.lat, providerLocation.lng],
          [customerLocation.lat, customerLocation.lng],
        ],
        { color: '#F97316', weight: 5, opacity: 0.9, dashArray: '10 6' },
      ).addTo(map);
    }

    for (const m of markers) {
      const mIcon = L.divIcon({
        className: 'qs-map-pin',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:#F97316;color:#fff;font-weight:900;font-size:14px;border:2px solid #fff;box-shadow:0 4px 12px rgba(249,115,22,0.4);">⚡</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([m.lat, m.lng], { icon: mIcon })
        .addTo(map)
        .bindPopup(`<strong>${m.title}</strong>${m.subtitle ? `<br/>${m.subtitle}` : ''}`);
      points.push([m.lat, m.lng]);
    }

    if (points.length > 1) {
      map.fitBounds(points, { padding: [48, 48] });
    }

    return () => {
      if (leafletMapInstance.current) {
        leafletMapInstance.current.remove();
        leafletMapInstance.current = null;
      }
    };
  }, [hasGoogleKey, fallbackError, leafletReady, customerLocation, providerLocation, markers]);

  const gmapsDirectionsUrl =
    providerLocation && customerLocation
      ? `https://www.google.com/maps/dir/?api=1&origin=${providerLocation.lat},${providerLocation.lng}&destination=${customerLocation.lat},${customerLocation.lng}&travelmode=driving`
      : customerLocation
        ? `https://www.google.com/maps/search/?api=1&query=${customerLocation.lat},${customerLocation.lng}`
        : null;

  return (
    <div className="space-y-2.5">
      <div className="relative rounded-3xl overflow-hidden border-2 border-orange-200 dark:border-slate-700 bg-[#FFF7F2] dark:bg-slate-900 shadow-lg">
        <div ref={mapRef} className={`${heightClass} w-full z-0`} />

        {/* Live Telemetry Overlay */}
        <div className="absolute bottom-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="flex flex-wrap gap-1.5 pointer-events-auto">
            {providerLocation && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F97316] text-white text-[11px] font-extrabold shadow-md">
                <Navigation className="w-3.5 h-3.5" />
                Pro Live GPS: {providerLocation.lat.toFixed(4)}, {providerLocation.lng.toFixed(4)}
              </span>
            )}
            {customerLocation && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0F172A]/90 text-white text-[11px] font-bold shadow-md">
                <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
                Destination: {customerLocation.lat.toFixed(4)}, {customerLocation.lng.toFixed(4)}
              </span>
            )}
          </div>

          {gmapsDirectionsUrl && (
            <a
              href={gmapsDirectionsUrl}
              target="_blank"
              rel="noreferrer"
              className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#171717] hover:bg-[#FFF1E8] text-[11px] font-extrabold shadow-md border border-orange-200"
            >
              Open Route in Google Maps <ExternalLink className="w-3 h-3 text-[#F97316]" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
