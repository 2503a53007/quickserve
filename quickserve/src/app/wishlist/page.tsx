'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Heart, Repeat, Trash2 } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useApp } from '@/components/providers/AppProvider';
import { ALL_CATALOG_SERVICES } from '@/lib/catalog';

export default function WishlistPage() {
  const { user, localWishlistIds, toggleLocalWishlist } = useApp();
  const [serverSaved, setServerSaved] = useState<any[]>([]);
  const [frequent, setFrequent] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/wishlist')
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setServerSaved(j.data.saved ?? []);
          setFrequent(j.data.frequent ?? []);
          setRecent(j.data.recent ?? []);
        }
      })
      .catch(() => {});
  }, [user]);

  const savedCatalog = ALL_CATALOG_SERVICES.filter((s) => localWishlistIds.includes(s.slug));

  const removeServerItem = async (id: string) => {
    await fetch(`/api/wishlist?id=${id}`, { method: 'DELETE' });
    setServerSaved((prev) => prev.filter((x) => x.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#F97316]">One-Click Rebooking</span>
          <h1 className="text-3xl font-black mt-1">YOUR WISHLIST</h1>
          <p className="text-sm text-[#737373] mt-1">
            Favourite services, favourite providers, frequently used services, and recently completed bookings.
          </p>
        </div>

        {/* Favourite Services */}
        <section className="space-y-4">
          <h2 className="text-xl font-black flex items-center gap-2">
            <Heart className="w-5 h-5 text-[#F97316] fill-[#F97316]" /> Favourite Services &amp; Providers
          </h2>
          {savedCatalog.length === 0 && serverSaved.length === 0 ? (
            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-dashed border-orange-200 p-8 text-center space-y-3">
              <p className="font-bold text-sm">You haven&apos;t saved any favourite services yet.</p>
              <Link href="/services" className="inline-flex px-5 h-10 rounded-xl bg-[#F97316] text-white text-xs font-extrabold items-center">
                Explore Services
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedCatalog.map((s) => (
                <div
                  key={s.id}
                  className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <p className="text-[11px] font-extrabold uppercase text-[#EA580C]">{s.categorySlug.replace(/-/g, ' ')}</p>
                    <h3 className="font-extrabold text-base mt-1">{s.name}</h3>
                    <p className="text-xs text-[#737373] mt-1">₹{s.firstHourPrice} / 1st hr · +₹{s.additionalHourPrice}/hr</p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/booking?category=${s.categorySlug}&service=${s.slug}`}
                      className="flex-1 h-10 rounded-xl bg-[#F97316] text-white text-xs font-extrabold flex items-center justify-center gap-1.5"
                    >
                      <Repeat className="w-3.5 h-3.5" /> Rebook Now
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleLocalWishlist(s.slug)}
                      className="w-10 h-10 rounded-xl border border-red-200 text-[#DC2626] flex items-center justify-center"
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {serverSaved.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <h3 className="font-extrabold text-base">
                      {item.services?.name || item.provider?.display_name || item.company?.company_name}
                    </h3>
                    <p className="text-xs text-[#737373] mt-1">
                      {item.services ? `₹${item.services.default_first_hour_price}/hr` : 'Saved Professional'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={item.services ? `/booking?service=${item.services.slug}` : `/booking`}
                      className="flex-1 h-10 rounded-xl bg-[#F97316] text-white text-xs font-extrabold flex items-center justify-center"
                    >
                      1-Click Rebook
                    </Link>
                    <button
                      type="button"
                      onClick={() => removeServerItem(item.id)}
                      className="w-10 h-10 rounded-xl border border-red-200 text-[#DC2626] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Frequently & Recently Used Services */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-black flex items-center gap-2">
              <Repeat className="w-5 h-5 text-[#F97316]" /> Frequently Used Services
            </h2>
            {frequent.length > 0 ? (
              frequent.map((f: any, idx: number) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-white dark:bg-slate-950 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm">{f.service?.name}</p>
                    <p className="text-xs text-[#737373]">Booked {f.count} time(s)</p>
                  </div>
                  <Link
                    href={`/booking?service=${f.service?.slug || ''}`}
                    className="px-3.5 py-2 rounded-xl bg-[#F97316] text-white text-xs font-extrabold"
                  >
                    Rebook
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#737373]">
                Your most frequently booked services will appear here automatically after completed jobs for 1-click rebooking.
              </p>
            )}
          </div>

          <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-black flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#F97316]" /> Recently Used Services
            </h2>
            {recent.length > 0 ? (
              recent.map((r: any) => (
                <div key={r.id} className="p-3.5 rounded-2xl bg-white dark:bg-slate-950 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm">{r.services?.name}</p>
                    <p className="text-xs text-[#737373]">
                      {new Date(r.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <Link
                    href={`/booking?service=${r.services?.slug || ''}`}
                    className="px-3.5 py-2 rounded-xl bg-[#FFF1E8] text-[#EA580C] text-xs font-extrabold"
                  >
                    Book Again
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#737373]">
                Completed bookings appear here so you can rebook the same service in one click.
              </p>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
