'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BadgeCheck,
  GitCompareArrows,
  Heart,
  Map as MapIcon,
  MapPin,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { GoogleMapView } from '@/components/tracking/GoogleMapView';
import { useApp } from '@/components/providers/AppProvider';
import { CATALOG_CATEGORIES } from '@/lib/catalog';

function ServicesInner() {
  const sp = useSearchParams();
  const { location, setLocationModalOpen, localWishlistIds, toggleLocalWishlist } = useApp();

  const [selectedCategory, setSelectedCategory] = useState(sp.get('category') || 'all');
  const [search, setSearch] = useState(sp.get('q') || '');
  const [sort, setSort] = useState('distance');
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState(2000);
  const [maxDistance, setMaxDistance] = useState(25);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const [providers, setProviders] = useState<any[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const q = new URLSearchParams();
        if (selectedCategory !== 'all') q.set('category', selectedCategory);
        if (minRating > 0) q.set('minRating', String(minRating));
        if (maxPrice < 2000) q.set('maxPrice', String(maxPrice));
        q.set('maxDistance', String(maxDistance));
        if (availableOnly) q.set('available', '1');
        q.set('sort', sort);
        if (location.lat && location.lng) {
          q.set('lat', String(location.lat));
          q.set('lng', String(location.lng));
        } else if (location.city && location.city !== 'All India') {
          q.set('city', location.city);
        }
        const res = await fetch(`/api/providers?${q.toString()}`);
        const json = await res.json();
        if (!active) return;
        setConfigured(Boolean(json.data?.configured));
        setProviders(json.data?.providers ?? []);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [selectedCategory, sort, minRating, maxPrice, maxDistance, availableOnly, location]);

  const filteredCategories = CATALOG_CATEGORIES.filter((cat) => {
    if (selectedCategory !== 'all' && cat.slug !== selectedCategory) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      cat.name.toLowerCase().includes(s) ||
      cat.description.toLowerCase().includes(s) ||
      cat.services.some((svc) => svc.name.toLowerCase().includes(s))
    );
  });

  const comparedProviders = providers.filter((p) => compareIds.includes(p.id));
  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev,
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Search & Filter Bar */}
        <div className="rounded-3xl bg-[#0F172A] text-white p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">Explore Services &amp; Nearby Pros</h1>
              <p className="text-sm text-slate-300 mt-1">
                Filter by category, rating, hourly price, availability, and distance across India.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="px-4 h-10 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <MapPin className="w-4 h-4 text-[#F97316]" /> {location.label}
              </button>
              <button
                type="button"
                onClick={() => setShowMap((v) => !v)}
                className={`px-4 h-10 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 ${
                  showMap ? 'bg-[#F97316] text-white' : 'bg-white text-[#171717]'
                }`}
              >
                <MapIcon className="w-4 h-4" /> {showMap ? 'Hide Map' : 'Map View'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search any service (wiring, AC gas, deep clean, RO...)"
                className="w-full h-11 pl-10 pr-3 rounded-xl bg-white text-[#171717] text-sm font-medium outline-none"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="md:col-span-2 h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white"
            >
              <option value="distance">Sort: Nearest</option>
              <option value="rating">Sort: Top Rated</option>
              <option value="price">Sort: Lowest Price</option>
              <option value="jobs">Sort: Most Jobs</option>
            </select>
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="md:col-span-2 h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white"
            >
              <option value={0}>Any Rating</option>
              <option value={4.5}>4.5★ &amp; above</option>
              <option value={4}>4.0★ &amp; above</option>
            </select>
            <select
              value={maxDistance}
              onChange={(e) => setMaxDistance(Number(e.target.value))}
              className="md:col-span-2 h-11 px-3 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white"
            >
              <option value={5}>Within 5 km</option>
              <option value={10}>Within 10 km</option>
              <option value={25}>Within 25 km</option>
              <option value={50}>Within 50 km</option>
            </select>
            <button
              type="button"
              onClick={() => setAvailableOnly((v) => !v)}
              className={`md:col-span-1 h-11 rounded-xl text-xs font-extrabold border ${
                availableOnly
                  ? 'bg-[#16A34A] border-[#16A34A] text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              Online
            </button>
          </div>
        </div>

        {/* Interactive Map */}
        {showMap && (
          <GoogleMapView
            customerLocation={
              location.lat && location.lng ? { lat: location.lat, lng: location.lng, label: location.label } : null
            }
            markers={providers
              .filter((p) => p.lat != null && p.lng != null)
              .map((p) => ({ id: p.id, lat: Number(p.lat), lng: Number(p.lng), title: p.name }))}
            heightClass="h-80"
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Categories */}
          <aside className="lg:col-span-3 space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#737373]">
              <SlidersHorizontal className="w-3.5 h-3.5" /> Categories (19)
            </div>
            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-3 space-y-1 max-h-[600px] overflow-y-auto">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-[#F97316] text-white'
                    : 'hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                All Categories (19)
              </button>
              {CATALOG_CATEGORIES.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => setSelectedCategory(c.slug)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                    selectedCategory === c.slug
                      ? 'bg-[#F97316] text-white'
                      : 'hover:bg-white dark:hover:bg-slate-800'
                  }`}
                >
                  <span>
                    {c.emoji} {c.name}
                  </span>
                  <span className="opacity-70">{c.services.length}</span>
                </button>
              ))}
            </div>

            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-4 space-y-2">
              <label className="text-xs font-bold flex justify-between">
                <span>Max First-Hour Rate</span>
                <span className="text-[#EA580C]">₹{maxPrice}</span>
              </label>
              <input
                type="range"
                min={199}
                max={2000}
                step={50}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#F97316]"
              />
            </div>
          </aside>

          {/* Main Catalogue + Verified Nearby Providers */}
          <div className="lg:col-span-9 space-y-8">
            {/* Verified Providers Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black">Verified Professionals &amp; Companies</h2>
                {compareIds.length > 0 && (
                  <span className="text-xs font-bold text-[#EA580C]">
                    Comparing {compareIds.length}/3 providers
                  </span>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-44 rounded-3xl skeleton" />
                  ))}
                </div>
              ) : providers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {providers.map((pro) => (
                    <div
                      key={pro.id}
                      className="rounded-3xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-5 shadow-sm hover:border-[#F97316] transition-all space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white font-black flex items-center justify-center">
                            {pro.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-extrabold text-base">{pro.name}</h3>
                              <BadgeCheck className="w-4 h-4 text-[#16A34A]" />
                            </div>
                            <p className="text-xs text-[#737373]">
                              {pro.ownerKind === 'company' ? `Registered Company · Team ${pro.teamSize}` : `${pro.experienceYears} yrs exp`}
                              {pro.distanceKm != null ? ` · ${pro.distanceKm} km away` : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCompare(pro.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border ${
                            compareIds.includes(pro.id)
                              ? 'bg-[#F97316] border-[#F97316] text-white'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <GitCompareArrows className="w-3.5 h-3.5" /> Compare
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-amber-500" /> {pro.avgRating.toFixed(1)} ({pro.totalReviews})
                        </span>
                        <span className="text-[#737373]">{pro.totalJobs} completed jobs</span>
                        <span className="text-[#EA580C]">₹{pro.firstHourPrice}/hr</span>
                        <span className="text-[#737373]">Visiting: ₹{pro.visitingCharge}</span>
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/providers/${pro.id}`}
                          className="flex-1 h-10 rounded-xl border border-orange-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center hover:border-[#F97316]"
                        >
                          View Profile
                        </Link>
                        <Link
                          href={`/booking?ownerKind=${pro.ownerKind}&ownerId=${pro.id}${
                            selectedCategory !== 'all' ? `&category=${selectedCategory}` : ''
                          }`}
                          className="flex-1 h-10 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-xs font-extrabold flex items-center justify-center"
                        >
                          Book Now
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-5 text-xs text-[#737373]">
                  {configured
                    ? 'No verified professionals match your current filter/location yet. Select any service below to request a booking or adjust filters.'
                    : 'Connect Supabase in .env.local and verify provider accounts in /admin to list live nearby professionals with real distances.'}
                </div>
              )}

              {/* Provider Comparison Drawer */}
              {comparedProviders.length >= 2 && (
                <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border-2 border-[#F97316] p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-sm text-[#EA580C]">Side-by-Side Provider Comparison</h3>
                    <button
                      type="button"
                      onClick={() => setCompareIds([])}
                      className="text-xs font-bold text-[#737373] inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Clear
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left border-b border-orange-200 dark:border-slate-700">
                          <th className="py-2">Metric</th>
                          {comparedProviders.map((p) => (
                            <th key={p.id} className="py-2 font-extrabold">
                              {p.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100 dark:divide-slate-800">
                        <tr>
                          <td className="py-2 text-[#737373]">First Hour Rate</td>
                          {comparedProviders.map((p) => (
                            <td key={p.id} className="py-2 font-bold text-[#EA580C]">
                              ₹{p.firstHourPrice}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 text-[#737373]">Visiting Charge</td>
                          {comparedProviders.map((p) => (
                            <td key={p.id} className="py-2">
                              ₹{p.visitingCharge}
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 text-[#737373]">Rating / Jobs</td>
                          {comparedProviders.map((p) => (
                            <td key={p.id} className="py-2">
                              {p.avgRating.toFixed(1)}★ ({p.totalJobs} jobs)
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="py-2 text-[#737373]">Distance</td>
                          {comparedProviders.map((p) => (
                            <td key={p.id} className="py-2">
                              {p.distanceKm != null ? `${p.distanceKm} km` : 'Area match'}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {/* Services Catalogue by Category */}
            <section className="space-y-6">
              <h2 className="text-xl font-black">Service Rate Cards</h2>
              {filteredCategories.map((cat) => (
                <div
                  key={cat.slug}
                  className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{cat.emoji}</span>
                      <div>
                        <Link href={`/services/${cat.slug}`} className="font-black text-lg hover:text-[#EA580C]">
                          {cat.name}
                        </Link>
                        <p className="text-xs text-[#737373]">{cat.description}</p>
                      </div>
                    </div>
                    <Link href={`/services/${cat.slug}`} className="text-xs font-extrabold text-[#EA580C] shrink-0">
                      Open Category →
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {cat.services.map((svc) => {
                      const saved = localWishlistIds.includes(svc.slug);
                      return (
                        <div
                          key={svc.id}
                          className="rounded-2xl bg-white dark:bg-slate-950 border border-orange-100 dark:border-slate-800 p-4 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{svc.name}</p>
                            <p className="text-xs text-[#737373] line-clamp-1">{svc.description}</p>
                            <p className="text-xs font-extrabold text-[#EA580C] mt-1">
                              ₹{svc.firstHourPrice} 1st hr · ₹{svc.additionalHourPrice} extra hr · ₹{svc.visitingCharge} visit
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleLocalWishlist(svc.slug)}
                              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center"
                              aria-label="Save service"
                            >
                              <Heart className={`w-4 h-4 ${saved ? 'fill-[#F97316] text-[#F97316]' : 'text-slate-400'}`} />
                            </button>
                            <Link
                              href={`/booking?category=${cat.slug}&service=${svc.slug}`}
                              className="px-3.5 h-9 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-extrabold inline-flex items-center"
                            >
                              Book
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm">Loading services...</div>}>
      <ServicesInner />
    </Suspense>
  );
}
