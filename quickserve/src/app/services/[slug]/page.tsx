'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Clock, Heart, Star } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CATALOG_CATEGORIES } from '@/lib/catalog';
import { useApp } from '@/components/providers/AppProvider';

export default function CategoryDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug || 'electrician';
  const category = CATALOG_CATEGORIES.find((c) => c.slug === slug) ?? CATALOG_CATEGORIES[0];
  const { location, localWishlistIds, toggleLocalWishlist } = useApp();

  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = new URLSearchParams({ category: category.slug });
    if (location.lat && location.lng) {
      q.set('lat', String(location.lat));
      q.set('lng', String(location.lng));
    }
    fetch(`/api/providers?${q.toString()}`)
      .then((r) => r.json())
      .then((j) => setProviders(j.data?.providers ?? []))
      .finally(() => setLoading(false));
  }, [category.slug, location]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Link href="/services" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#737373] hover:text-[#F97316]">
          <ArrowLeft className="w-4 h-4" /> All 19 Categories
        </Link>

        {/* Category Hero */}
        <div
          className="rounded-3xl p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6"
          style={{ background: `linear-gradient(135deg, #0F172A 0%, ${category.gradientFrom} 100%)` }}
        >
          <div className="space-y-2">
            <span className="text-4xl">{category.emoji}</span>
            <h1 className="text-3xl sm:text-4xl font-black">{category.name}</h1>
            <p className="text-sm text-white/85 max-w-xl">{category.description}</p>
          </div>
          <Link
            href={`/booking?category=${category.slug}`}
            className="px-6 h-12 rounded-2xl bg-white text-[#EA580C] hover:bg-[#FFF1E8] font-black text-sm inline-flex items-center justify-center shrink-0"
          >
            BOOK MY SERVICE
          </Link>
        </div>

        {/* Individual Services & Pricing */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black">Services &amp; Transparent Hourly Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {category.services.map((svc) => {
              const saved = localWishlistIds.includes(svc.slug);
              return (
                <div
                  key={svc.id}
                  className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="font-extrabold text-lg">{svc.name}</h3>
                      <button type="button" onClick={() => toggleLocalWishlist(svc.slug)} aria-label="Wishlist">
                        <Heart className={`w-4 h-4 ${saved ? 'fill-[#F97316] text-[#F97316]' : 'text-slate-400'}`} />
                      </button>
                    </div>
                    <p className="text-xs text-[#737373]">{svc.description}</p>
                  </div>
                  <div className="space-y-3 pt-3 border-t border-orange-100 dark:border-slate-800">
                    <div className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-[#737373]">First hour</span>
                        <span className="font-extrabold text-[#EA580C]">₹{svc.firstHourPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#737373]">Additional hour</span>
                        <span className="font-bold">₹{svc.additionalHourPrice}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#737373]">Visiting charge</span>
                        <span className="font-bold">₹{svc.visitingCharge}</span>
                      </div>
                    </div>
                    <Link
                      href={`/booking?category=${category.slug}&service=${svc.slug}`}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-extrabold text-xs flex items-center justify-center"
                    >
                      Book {svc.name}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Verified Professionals in this Category */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black">Verified {category.name} Professionals Near You</h2>
          {loading ? (
            <div className="h-36 rounded-3xl skeleton" />
          ) : providers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {providers.map((pro) => (
                <div
                  key={pro.id}
                  className="rounded-3xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-5 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold">{pro.name}</h3>
                    <BadgeCheck className="w-4 h-4 text-[#16A34A]" />
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold">
                    <span className="inline-flex items-center gap-1 text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-amber-500" /> {pro.avgRating.toFixed(1)}
                    </span>
                    <span className="text-[#737373]">{pro.totalJobs} jobs</span>
                    <span className="text-[#EA580C]">₹{pro.firstHourPrice}/hr</span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/providers/${pro.id}`}
                      className="flex-1 h-10 rounded-xl border border-orange-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center"
                    >
                      Profile
                    </Link>
                    <Link
                      href={`/booking?category=${category.slug}&ownerKind=${pro.ownerKind}&ownerId=${pro.id}`}
                      className="flex-1 h-10 rounded-xl bg-[#F97316] text-white text-xs font-extrabold flex items-center justify-center"
                    >
                      Select Pro
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 flex items-center gap-3 text-sm text-[#737373]">
              <Clock className="w-5 h-5 text-[#F97316] shrink-0" />
              No verified {category.name.toLowerCase()} providers registered in this area yet. Connect Supabase &amp;
              approve providers in /admin.
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
