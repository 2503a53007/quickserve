'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Copy,
  Check,
  Crosshair,
  Heart,
  MapPin,
  Search,
  ShieldCheck,
  Siren,
  Sparkles,
  Star,
  Zap,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Hero3DStage } from '@/components/home/Hero3DStage';
import { Tilt3DCard } from '@/components/ui/Tilt3DCard';
import { useApp } from '@/components/providers/AppProvider';
import { ALL_CATALOG_SERVICES, CATALOG_CATEGORIES, STARTER_COUPONS } from '@/lib/catalog';

const QuickServeScrollScene = dynamic(() => import('@/components/three/QuickServeScrollScene'), {
  ssr: false,
});
const ScrollytellingShowcase = dynamic(() => import('@/components/home/ScrollytellingShowcase'), {
  ssr: false,
});

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Choose Service & Hours',
    desc: 'Pick from 19 categories, upload problem photos, select hours (1h–12h) and see itemized pricing upfront.',
  },
  {
    step: '02',
    title: 'Fixed Arrival Window',
    desc: 'Get a realistic Zepto-style arrival ETA calculated from live distance and provider availability.',
  },
  {
    step: '03',
    title: 'Track & Verify with OTP',
    desc: 'Watch live GPS arrival on Google Maps, then share your Start OTP & End OTP to lock exact work duration.',
  },
  {
    step: '04',
    title: 'Auto Invoice & Cash/UPI',
    desc: 'Receive an instant itemized tax invoice with Copy Bill & PDF download. Pay via Cash or Razorpay UPI.',
  },
];

export default function HomePage() {
  const router = useRouter();
  const { location, setLocationModalOpen, detectGpsLocation, detectingGps, locationNotice, localWishlistIds, toggleLocalWishlist } =
    useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [nearbyProviders, setNearbyProviders] = useState<any[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providersConfigured, setProvidersConfigured] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    async function loadLive() {
      setLoadingProviders(true);
      try {
        const params = new URLSearchParams();
        if (location.lat && location.lng) {
          params.set('lat', String(location.lat));
          params.set('lng', String(location.lng));
        } else if (location.city && location.city !== 'All India') {
          params.set('city', location.city);
        }
        const [pRes, rRes] = await Promise.all([
          fetch(`/api/providers?${params.toString()}`),
          fetch('/api/reviews'),
        ]);
        const pJson = await pRes.json();
        const rJson = await rRes.json();
        if (!active) return;
        setProvidersConfigured(Boolean(pJson.data?.configured));
        setNearbyProviders(pJson.data?.providers ?? []);
        setReviews(rJson.data?.reviews ?? []);
      } catch {
        // graceful fallback
      } finally {
        if (active) setLoadingProviders(false);
      }
    }
    loadLive();
    return () => {
      active = false;
    };
  }, [location]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/services${searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : ''}`);
  };

  const copyCoupon = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const popularServices = ALL_CATALOG_SERVICES.slice(0, 6);
  const emergencyCategories = CATALOG_CATEGORIES.filter((c) => c.isEmergency);
  const frequentlyBooked = ALL_CATALOG_SERVICES.filter((s) =>
    ['fan-light-repair', 'ac-service', 'tap-mixer-repair', 'full-home-deep-cleaning'].includes(s.slug),
  );
  const savedServices = ALL_CATALOG_SERVICES.filter((s) => localWishlistIds.includes(s.slug));

  return (
    <div className="relative min-h-screen flex flex-col text-[#171717] dark:text-white overflow-x-clip">
      {/* Live WebGL Three.js + React Three Fiber Scroll-Driven 3D Scene (White & Orange in Light Mode, Cyber-Glass in Dark Mode) */}
      <QuickServeScrollScene />
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <main className="flex-1">
          {/* 1. HERO SECTION */}
          <section className="relative overflow-hidden text-[#171717] dark:text-white">
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="lg:col-span-7 space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFF1E8] dark:bg-orange-500/15 border border-orange-300 dark:border-orange-400/30 text-[#EA580C] dark:text-orange-300 text-xs font-extrabold uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 fill-[#F97316] text-[#F97316]" />
                QuickServe India · Your Services. Your Vibe.
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-[#171717] dark:text-white">
                Your everyday services,{' '}
                <span className="bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#F59E0B] bg-clip-text text-transparent">
                  just one click away.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-[#525252] dark:text-slate-300 max-w-2xl leading-relaxed">
                Find trusted professionals near you. Book instantly, track their arrival and get your work done.
              </p>

              {/* 2 & 3. Search Services + Current Location Bar */}
              <form
                onSubmit={handleSearch}
                className="bg-white/90 dark:bg-[#0B1120]/70 backdrop-blur-2xl border border-orange-200 dark:border-orange-400/35 p-2 rounded-2xl shadow-[0_20px_50px_rgba(249,115,22,0.16)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.45)] flex flex-col sm:flex-row gap-2 max-w-2xl"
              >
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 h-12 rounded-xl bg-[#FFF1E8] dark:bg-[#F97316]/20 border border-orange-200 dark:border-orange-400/30 text-[#EA580C] dark:text-orange-200 text-sm font-bold shrink-0 hover:bg-orange-100 dark:hover:bg-[#F97316]/30 transition-colors"
                >
                  <MapPin className="w-4 h-4 shrink-0 text-[#F97316]" />
                  <span className="max-w-[140px] truncate">{location.label}</span>
                </button>
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 dark:text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search electrician, AC repair, plumber, cleaning..."
                    className="w-full h-12 pl-10 pr-3 rounded-xl bg-transparent text-[#171717] dark:text-white placeholder:text-slate-400 text-sm font-medium outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-3d-orange h-12 px-6 rounded-xl text-white font-extrabold text-sm shrink-0"
                >
                  Search
                </button>
              </form>

              {/* Hero CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/booking"
                  className="btn-3d-orange inline-flex items-center gap-2 px-6 h-12 rounded-2xl text-white font-extrabold text-sm"
                >
                  Book a Service <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/signup?role=provider"
                  className="inline-flex items-center gap-2 px-6 h-12 rounded-2xl border border-orange-300 dark:border-white/20 bg-white/80 dark:bg-white/5 hover:bg-[#FFF1E8] dark:hover:bg-white/10 text-[#171717] dark:text-white font-bold text-sm transition-colors"
                >
                  Become a Provider
                </Link>
                <button
                  type="button"
                  onClick={detectGpsLocation}
                  disabled={detectingGps}
                  className="inline-flex items-center gap-1.5 px-4 h-12 rounded-2xl text-xs font-bold text-[#EA580C] dark:text-orange-300 hover:underline transition-colors"
                >
                  <Crosshair className="w-4 h-4" />
                  {detectingGps ? 'Detecting Location...' : 'Detect My Location'}
                </button>
              </div>
              {locationNotice && (
                <p className="text-xs font-semibold text-[#EA580C] dark:text-orange-200 bg-[#FFF1E8] dark:bg-white/10 border border-orange-200 dark:border-white/15 rounded-xl px-3.5 py-2 max-w-2xl">
                  📍 {locationNotice}
                </p>
              )}

              {/* Trust Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-orange-200/70 dark:border-white/10">
                {[
                  ['All India', 'City & PIN Search'],
                  ['19 Categories', '44+ Services'],
                  ['Start & End OTP', 'Verified Billing'],
                  ['Cash & UPI', 'Razorpay Secured'],
                ].map(([title, sub]) => (
                  <div key={title} className="rounded-xl bg-white/80 dark:bg-white/5 border border-orange-200/70 dark:border-white/10 px-3.5 py-2.5 shadow-sm">
                    <p className="font-extrabold text-sm text-[#EA580C] dark:text-[#F97316]">{title}</p>
                    <p className="text-[11px] text-[#737373] dark:text-slate-300">{sub}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right Visual Showcase — Interactive 3D Floating Stage */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="lg:col-span-5"
            >
              <Hero3DStage />
            </motion.div>
          </div>
        </section>

        {/* PINNED 3D SCROLLYTELLING SECTION (haoqi.design inspired — forward & reverse scroll controlled) */}
        <ScrollytellingShowcase />

        {/* 7. ALL 19 SERVICE CATEGORIES */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-[2rem] bg-white/88 dark:bg-[#0B1120]/60 backdrop-blur-2xl border border-orange-200/80 dark:border-orange-400/25 p-6 sm:p-8 shadow-[0_24px_60px_-14px_rgba(249,115,22,0.16)] dark:shadow-[0_28px_70px_-14px_rgba(0,0,0,0.65)]">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#F97316]">
                19 Service Categories
              </span>
              <h2 className="text-3xl font-black mt-1 text-[#171717] dark:text-white">Explore Services Near You</h2>
            </div>
            <Link
              href="/services"
              className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#EA580C] dark:text-orange-300 hover:underline"
            >
              Browse All Services <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {CATALOG_CATEGORIES.map((cat) => (
              <Tilt3DCard key={cat.slug} maxTilt={13}>
                <Link
                  href={`/services/${cat.slug}`}
                  className="card-3d group relative h-full rounded-3xl p-4 bg-[#FFF7F2]/90 dark:bg-white/[0.08] backdrop-blur-md border border-orange-200/80 dark:border-white/15 hover:border-[#F97316] hover:bg-white dark:hover:bg-white/[0.14] flex flex-col justify-between gap-3"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className="flex items-start justify-between" style={{ transform: 'translateZ(24px)' }}>
                    <span
                      className="icon-3d w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                      style={{
                        background: `linear-gradient(135deg, ${cat.gradientFrom}55, ${cat.gradientTo}70)`,
                      }}
                    >
                      {cat.emoji}
                    </span>
                    {cat.isEmergency && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/25 border border-red-300 dark:border-red-400/40 text-[#DC2626] dark:text-red-200 text-[10px] font-extrabold uppercase">
                        SOS
                      </span>
                    )}
                  </div>
                  <div style={{ transform: 'translateZ(16px)' }}>
                    <h3 className="font-extrabold text-sm text-[#171717] dark:text-white group-hover:text-[#EA580C] dark:group-hover:text-orange-300 transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-[#737373] dark:text-slate-300 mt-0.5">
                      From ₹{Math.min(...cat.services.map((s) => s.firstHourPrice))}/hr
                    </p>
                  </div>
                </Link>
              </Tilt3DCard>
            ))}
          </div>
          </div>
        </section>

        {/* 4. POPULAR SERVICES WITH ONE-CLICK WISHLIST & BOOKING */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] bg-white/88 dark:bg-[#0B1120]/60 backdrop-blur-2xl border border-orange-200/80 dark:border-orange-400/25 p-6 sm:p-8 shadow-[0_24px_60px_-14px_rgba(249,115,22,0.16)] dark:shadow-[0_28px_70px_-14px_rgba(0,0,0,0.65)]">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#F97316]">Most Requested</span>
                <h2 className="text-3xl font-black mt-1 text-[#171717] dark:text-white">Popular Services &amp; Transparent Hourly Rates</h2>
              </div>
              <Link href="/booking" className="text-sm font-extrabold text-[#EA580C] dark:text-orange-300 hover:underline">
                Custom Duration Booking →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {popularServices.map((svc) => {
                const wishlisted = localWishlistIds.includes(svc.slug);
                return (
                  <Tilt3DCard key={svc.id} maxTilt={8}>
                    <div
                      className="card-3d h-full rounded-3xl bg-[#FFF7F2]/90 dark:bg-white/[0.08] backdrop-blur-md border border-orange-200/80 dark:border-white/15 p-5 hover:border-[#F97316] flex flex-col justify-between gap-4"
                      style={{ transformStyle: 'preserve-3d' }}
                    >
                      <div className="space-y-2" style={{ transform: 'translateZ(18px)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2.5 py-1 rounded-full bg-[#FFF1E8] dark:bg-[#F97316]/25 border border-orange-200 dark:border-orange-400/30 text-[#EA580C] dark:text-orange-200 text-[11px] font-extrabold uppercase">
                            {svc.categorySlug.replace(/-/g, ' ')}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleLocalWishlist(svc.slug)}
                            aria-label="Toggle wishlist"
                            className="w-8 h-8 rounded-full hover:bg-orange-100 dark:hover:bg-white/15 flex items-center justify-center"
                          >
                            <Heart
                              className={`w-4 h-4 ${wishlisted ? 'fill-[#F97316] text-[#F97316]' : 'text-[#737373] dark:text-slate-300'}`}
                            />
                          </button>
                        </div>
                        <h3 className="font-extrabold text-lg text-[#171717] dark:text-white">{svc.name}</h3>
                        <p className="text-xs text-[#737373] dark:text-slate-300">{svc.description}</p>
                      </div>

                      <div
                        className="pt-3 border-t border-orange-200/60 dark:border-white/10 flex items-center justify-between gap-3"
                        style={{ transform: 'translateZ(24px)' }}
                      >
                        <div>
                          <p className="text-lg font-black text-[#EA580C] dark:text-[#FB923C]">
                            ₹{svc.firstHourPrice}
                            <span className="text-xs font-semibold text-[#737373] dark:text-slate-300"> / 1st hr</span>
                          </p>
                          <p className="text-[11px] text-[#737373] dark:text-slate-400">
                            +₹{svc.additionalHourPrice}/hr · ₹{svc.visitingCharge} visiting
                          </p>
                        </div>
                        <Link
                          href={`/booking?category=${svc.categorySlug}&service=${svc.slug}`}
                          className="btn-3d-orange px-4 h-10 rounded-xl text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                        >
                          Book Now
                        </Link>
                      </div>
                    </div>
                  </Tilt3DCard>
                );
              })}
            </div>
            </div>
          </div>
        </section>

        {/* 5 & 6. NEARBY PROFESSIONALS & TOP-RATED PROVIDERS (REAL DATA — ZERO FAKE LOCATIONS) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-[2rem] bg-white/88 dark:bg-[#0B1120]/60 backdrop-blur-2xl border border-orange-200/80 dark:border-orange-400/25 p-6 sm:p-8 shadow-[0_24px_60px_-14px_rgba(249,115,22,0.16)] dark:shadow-[0_28px_70px_-14px_rgba(0,0,0,0.65)]">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#F97316]">
                Verified Near {location.city}
              </span>
              <h2 className="text-3xl font-black mt-1 text-[#171717] dark:text-white">Nearby &amp; Top-Rated Professionals</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="px-4 h-10 rounded-xl border border-orange-200 dark:border-white/20 bg-white dark:bg-white/10 text-xs font-bold text-[#171717] dark:text-white hover:border-[#F97316]"
              >
                Change Area
              </button>
              <Link
                href="/services"
                className="px-4 h-10 rounded-xl bg-[#FFF1E8] dark:bg-[#F97316]/25 border border-orange-200 dark:border-orange-400/35 text-[#EA580C] dark:text-orange-200 text-xs font-extrabold inline-flex items-center"
              >
                Compare All Pros
              </Link>
            </div>
          </div>

          {loadingProviders ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-52 rounded-3xl skeleton" />
              ))}
            </div>
          ) : nearbyProviders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {nearbyProviders.slice(0, 6).map((pro) => (
                <Tilt3DCard key={pro.id} maxTilt={8}>
                <div
                  className="card-3d h-full rounded-3xl bg-[#FFF7F2]/90 dark:bg-white/[0.08] backdrop-blur-md border border-orange-200/80 dark:border-white/15 p-5 flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="icon-3d w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white font-black flex items-center justify-center shrink-0">
                      {pro.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-extrabold text-base text-[#171717] dark:text-white truncate">{pro.name}</h3>
                        <BadgeCheck className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80] shrink-0" />
                      </div>
                      <p className="text-xs text-[#737373] dark:text-slate-300 capitalize">
                        {pro.ownerKind} · {pro.city || 'India'}
                        {pro.distanceKm != null ? ` · ${pro.distanceKm} km away` : ''}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs font-bold">
                        <span className="inline-flex items-center gap-1 text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-amber-400" /> {pro.avgRating.toFixed(1)}
                        </span>
                        <span className="text-[#737373] dark:text-slate-300">{pro.totalJobs} jobs</span>
                        <span className="text-[#EA580C] dark:text-[#FB923C]">₹{pro.firstHourPrice}/hr</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/providers/${pro.id}`}
                      className="flex-1 h-10 rounded-xl border border-orange-200 dark:border-white/20 bg-white dark:bg-white/5 text-[#171717] dark:text-white text-xs font-bold flex items-center justify-center hover:border-[#F97316]"
                    >
                      View Profile
                    </Link>
                    <Link
                      href={`/booking?ownerKind=${pro.ownerKind}&ownerId=${pro.id}`}
                      className="btn-3d-orange flex-1 h-10 rounded-xl text-white text-xs font-extrabold flex items-center justify-center"
                    >
                      Book Now
                    </Link>
                  </div>
                </div>
                </Tilt3DCard>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-orange-300 dark:border-orange-400/40 bg-[#FFF7F2] dark:bg-white/5 p-8 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-[#F97316] mx-auto" />
              <h3 className="font-extrabold text-lg text-[#171717] dark:text-white">
                {providersConfigured
                  ? `No verified providers found in ${location.city} yet`
                  : 'Real Nearby Provider Discovery'}
              </h3>
              <p className="text-sm text-[#737373] dark:text-slate-300 max-w-xl mx-auto">
                Try expanding your city/PIN selection, or register as an individual professional or service company to serve this area.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Link
                  href="/provider/register"
                  className="btn-3d-orange px-5 h-10 rounded-xl text-white text-xs font-extrabold inline-flex items-center"
                >
                  Register as Individual Provider
                </Link>
                <Link
                  href="/company/register"
                  className="px-5 h-10 rounded-xl border border-orange-200 dark:border-white/25 text-[#171717] dark:text-white text-xs font-extrabold inline-flex items-center"
                >
                  Register a Service Company
                </Link>
              </div>
            </div>
          )}
          </div>
        </section>

        {/* 8. EXCLUSIVE OFFERS & COUPONS */}
        <section className="bg-white/85 dark:bg-[#0F172A]/75 backdrop-blur-md text-[#171717] dark:text-white py-16 border-y border-orange-200/80 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#F97316]">
                  Save on Every Booking
                </span>
                <h2 className="text-3xl font-black mt-1">Exclusive Offers &amp; Promo Codes</h2>
              </div>
              <Link href="/offers" className="text-sm font-extrabold text-[#EA580C] dark:text-orange-400 hover:underline">
                View All Offers →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {STARTER_COUPONS.slice(0, 4).map((c) => (
                <div
                  key={c.code}
                  className="rounded-3xl bg-[#FFF7F2] dark:bg-white/5 border border-orange-200 dark:border-white/10 p-5 flex flex-col justify-between gap-4 hover:border-[#F97316] transition-colors shadow-sm"
                >
                  <div className="space-y-2">
                    <span className="inline-block px-2.5 py-1 rounded-full bg-[#FFF1E8] dark:bg-[#F97316]/20 text-[#EA580C] dark:text-orange-300 text-[10px] font-extrabold uppercase">
                      {c.couponType.replace('_', ' ')}
                    </span>
                    <h3 className="font-black text-xl text-[#171717] dark:text-white">{c.title}</h3>
                    <p className="text-xs text-[#737373] dark:text-slate-300">{c.description}</p>
                    <p className="text-[11px] text-[#737373] dark:text-slate-400">Min booking: ₹{c.minOrderAmount}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-orange-200/70 dark:border-white/10">
                    <code className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-dashed border-orange-400/70 text-[#EA580C] dark:text-orange-300 font-black text-xs tracking-widest">
                      {c.code}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyCoupon(c.code)}
                      className="px-3 py-1.5 rounded-lg bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold inline-flex items-center gap-1"
                    >
                      {copiedCode === c.code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedCode === c.code ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9 & 10. FREQUENTLY BOOKED & RECENTLY SAVED / WISHLIST */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-[2rem] bg-white/88 dark:bg-[#0B1120]/60 backdrop-blur-2xl border border-orange-200/80 dark:border-orange-400/25 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#171717] dark:text-white">Frequently Booked Services</h2>
              <Link href="/services" className="text-xs font-extrabold text-[#EA580C] dark:text-orange-300">
                See all
              </Link>
            </div>
            <div className="space-y-3">
              {frequentlyBooked.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#FFF7F2] dark:bg-white/[0.08] border border-orange-200/80 dark:border-white/15"
                >
                  <div>
                    <p className="font-bold text-sm text-[#171717] dark:text-white">{s.name}</p>
                    <p className="text-xs text-[#737373] dark:text-slate-300">
                      ₹{s.firstHourPrice}/hr · +{s.additionalHourPrice}/hr
                    </p>
                  </div>
                  <Link
                    href={`/booking?category=${s.categorySlug}&service=${s.slug}`}
                    className="btn-3d-orange px-3.5 py-2 rounded-xl text-white text-xs font-extrabold"
                  >
                    Rebook
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white/88 dark:bg-[#0B1120]/60 backdrop-blur-2xl border border-orange-200/80 dark:border-orange-400/25 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#171717] dark:text-white">Your Wishlist &amp; Quick Rebook</h2>
              <Link href="/wishlist" className="text-xs font-extrabold text-[#EA580C] dark:text-orange-300">
                Open Wishlist →
              </Link>
            </div>
            {savedServices.length > 0 ? (
              <div className="space-y-3">
                {savedServices.slice(0, 4).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#FFF7F2] dark:bg-white/[0.08] border border-orange-200/80 dark:border-white/15"
                  >
                    <div>
                      <p className="font-bold text-sm text-[#171717] dark:text-white">{s.name}</p>
                      <p className="text-xs text-[#737373] dark:text-slate-300">₹{s.firstHourPrice} first hour</p>
                    </div>
                    <Link
                      href={`/booking?category=${s.categorySlug}&service=${s.slug}`}
                      className="px-3.5 py-2 rounded-xl bg-[#FFF1E8] dark:bg-[#F97316]/25 border border-orange-200 dark:border-orange-400/30 text-[#EA580C] dark:text-orange-200 text-xs font-extrabold"
                    >
                      Book Again
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-[#FFF7F2] dark:bg-white/5 border border-dashed border-orange-300 dark:border-orange-400/35 text-center space-y-2">
                <Heart className="w-8 h-8 text-[#F97316] mx-auto" />
                <p className="font-bold text-sm text-[#171717] dark:text-white">Save your go-to services for 1-click rebooking</p>
                <p className="text-xs text-[#737373] dark:text-slate-300">
                  Tap the heart icon on any service above to keep it in Your Wishlist.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 11. EMERGENCY SERVICES BANNER */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="rounded-3xl bg-gradient-to-r from-[#F97316] to-[#EA580C] p-8 sm:p-10 text-white shadow-xl shadow-orange-500/25 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-extrabold uppercase">
                <Siren className="w-4 h-4" /> Priority Emergency Dispatch
              </div>
              <h2 className="text-2xl sm:text-3xl font-black">
                Power trip, burst pipe, AC failure, or vehicle breakdown?
              </h2>
              <p className="text-sm text-orange-100">
                Book priority emergency help with live GPS arrival tracking and verified technicians.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {emergencyCategories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/services/${c.slug}`}
                    className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold transition-colors"
                  >
                    {c.emoji} {c.name}
                  </Link>
                ))}
              </div>
            </div>
            <Link
              href="/booking?emergency=1"
              className="px-6 h-12 rounded-2xl bg-white text-[#EA580C] hover:bg-[#FFF1E8] font-black text-sm inline-flex items-center gap-2 shrink-0 shadow-lg"
            >
              BOOK EMERGENCY SERVICE <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* 12. HOW QUICKSERVE WORKS */}
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-[2rem] bg-white/88 dark:bg-[#0B1120]/60 backdrop-blur-2xl border border-orange-200/80 dark:border-orange-400/25 p-6 sm:p-10 shadow-xl">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#F97316]">Simple &amp; Secure</span>
              <h2 className="text-3xl font-black mt-1 text-[#171717] dark:text-white">How QuickServe Works</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {HOW_IT_WORKS.map((item) => (
                <Tilt3DCard key={item.step} maxTilt={10}>
                  <div
                    className="card-3d h-full rounded-3xl bg-[#FFF7F2]/90 dark:bg-white/[0.08] backdrop-blur-md border border-orange-200/80 dark:border-white/15 p-6 space-y-3"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <span
                      style={{ transform: 'translateZ(26px)' }}
                      className="icon-3d inline-flex w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FB923C] via-[#F97316] to-[#EA580C] text-white font-black text-sm items-center justify-center"
                    >
                      {item.step}
                    </span>
                    <h3 style={{ transform: 'translateZ(18px)' }} className="font-extrabold text-lg text-[#171717] dark:text-white">
                      {item.title}
                    </h3>
                    <p style={{ transform: 'translateZ(12px)' }} className="text-xs text-[#737373] dark:text-slate-300 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </Tilt3DCard>
              ))}
            </div>
            </div>
          </div>
        </section>

        {/* 13. VERIFIED CUSTOMER REVIEWS */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-[2rem] bg-white/88 dark:bg-[#0B1120]/60 backdrop-blur-2xl border border-orange-200/80 dark:border-orange-400/25 p-6 sm:p-8 shadow-xl">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#F97316]">100% Verified Jobs</span>
              <h2 className="text-3xl font-black mt-1 text-[#171717] dark:text-white">Customer Reviews</h2>
            </div>
            <Link href="/orders" className="text-xs font-extrabold text-[#EA580C] dark:text-orange-300 hover:underline">
              Rate a completed booking →
            </Link>
          </div>

          {reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {reviews.slice(0, 6).map((rev) => (
                <div
                  key={rev.id}
                  className="rounded-3xl bg-[#FFF7F2] dark:bg-white/[0.08] border border-orange-200/80 dark:border-white/15 p-6 space-y-3"
                >
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: rev.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-[#171717] dark:text-slate-100">&ldquo;{rev.comment}&rdquo;</p>
                  <div className="pt-2 border-t border-orange-200/60 dark:border-white/10 flex items-center justify-between text-xs text-[#737373] dark:text-slate-300">
                    <span className="font-bold text-[#171717] dark:text-white">
                      {rev.customer?.full_name || 'Verified Customer'}
                    </span>
                    <span>{rev.bookings?.services?.name || 'Completed Service'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-white/5 border border-orange-200/80 dark:border-white/15 p-8 text-center space-y-2">
              <Sparkles className="w-8 h-8 text-[#F97316] mx-auto" />
              <p className="font-bold text-base text-[#171717] dark:text-white">Verified Reviews Appear Automatically After Completed Bookings</p>
              <p className="text-xs text-[#737373] dark:text-slate-300 max-w-lg mx-auto">
                QuickServe only accepts ratings and reviews linked to OTP-completed orders — keeping provider scores
                authentic and trustworthy.
              </p>
            </div>
          )}
          </div>
        </section>

        {/* 14. BECOME A SERVICE PROVIDER / COMPANY CTA */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="rounded-3xl bg-[#0F172A] text-white p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F97316]/20 text-orange-300 text-xs font-extrabold">
                <Bell className="w-3.5 h-3.5" /> Grow Your Business Across India
              </span>
              <h2 className="text-3xl sm:text-4xl font-black leading-tight">
                Join QuickServe as an Individual Pro or Registered Service Company
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Set your hourly rates &amp; visiting charges, manage bookings in real time, assign workers under your
                company account, verify jobs with OTP, and receive transparent payouts.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/provider/register"
                  className="px-6 h-12 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-extrabold text-sm inline-flex items-center gap-2"
                >
                  Join as Individual Pro <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/company/register"
                  className="px-6 h-12 rounded-2xl border border-white/20 hover:bg-white/10 text-white font-bold text-sm inline-flex items-center"
                >
                  Register Service Company
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Individual Pros', 'Manage availability, live GPS travel, OTP start/end, and earnings.'],
                ['Service Companies', 'Onboard employees, assign technicians, track team revenue & reviews.'],
                ['Verified Badge', 'Admin KYC & business verification builds instant customer trust.'],
                ['Instant Billing', 'Automatic GST invoices + Cash & Razorpay UPI settlement.'],
              ].map(([t, d]) => (
                <div key={t} className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-1.5">
                  <p className="font-extrabold text-sm text-[#F97316]">{t}</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* 15. FOOTER */}
      <Footer />
      </div>
    </div>
  );
}
