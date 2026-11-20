'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Calendar, MapPin, ShieldCheck, Star } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ProviderProfilePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/providers/${params.id}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error?.message || 'Provider not found');
        setData(j.data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Link href="/services" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#737373] hover:text-[#F97316]">
          <ArrowLeft className="w-4 h-4" /> Back to Explore Services
        </Link>

        {loading ? (
          <div className="h-64 rounded-3xl skeleton" />
        ) : error || !data ? (
          <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-200 p-8 text-center space-y-3">
            <ShieldCheck className="w-10 h-10 text-[#F97316] mx-auto" />
            <h1 className="text-xl font-black">Provider Profile Unavailable</h1>
            <p className="text-sm text-[#737373]">{error}</p>
            <Link href="/services" className="inline-flex px-5 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold">
              Browse Services
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-3xl bg-[#0F172A] text-white p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-2xl font-black flex items-center justify-center">
                  {(data.profile.display_name || data.profile.company_name || 'QS').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-black">
                      {data.profile.display_name || data.profile.company_name}
                    </h1>
                    {data.profile.verification_status === 'verified' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#16A34A] text-xs font-bold">
                        <BadgeCheck className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#F97316]" /> {data.profile.city || 'India'} ({data.profile.pin_code || 'All India'})
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" /> {Number(data.profile.avg_rating ?? 0).toFixed(1)}
                    </span>
                    <span>{data.profile.total_jobs ?? 0} completed jobs</span>
                  </p>
                </div>
              </div>
              <Link
                href={`/booking?ownerKind=${data.ownerKind}&ownerId=${data.profile.id}`}
                className="px-6 h-12 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-black text-sm inline-flex items-center justify-center"
              >
                BOOK MY SERVICE
              </Link>
            </div>

            {/* Services & Pricing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-3">
                <h2 className="font-black text-lg">Services &amp; Hourly Charges</h2>
                {data.pricing.length ? (
                  data.pricing.map((p: any) => (
                    <div key={p.id} className="p-3 rounded-2xl bg-white dark:bg-slate-950 flex justify-between items-center text-sm">
                      <span className="font-bold">{p.services?.name}</span>
                      <span className="font-extrabold text-[#EA580C]">
                        ₹{p.first_hour_price}/hr (+₹{p.visiting_charge} visit)
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#737373]">
                    Standard rate: ₹{data.profile.default_hourly_rate ?? 199}/hr · Visiting: ₹
                    {data.profile.default_visiting_charge ?? 50}
                  </p>
                )}
              </div>

              <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-3">
                <h2 className="font-black text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#F97316]" /> Available Working Hours
                </h2>
                {data.availability.length ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {data.availability.map((a: any) => (
                      <div key={a.id} className="p-2.5 rounded-xl bg-white dark:bg-slate-950 flex justify-between">
                        <span className="font-bold">{DAYS[a.day_of_week]}</span>
                        <span className="text-[#737373]">
                          {a.is_available ? `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}` : 'Closed'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#737373]">Mon – Sun · 08:00 AM – 09:00 PM IST</p>
                )}
              </div>
            </div>

            {/* Verified Reviews */}
            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
              <h2 className="font-black text-lg">Verified Customer Reviews ({data.reviews.length})</h2>
              {data.reviews.length ? (
                <div className="space-y-3">
                  {data.reviews.map((r: any) => (
                    <div key={r.id} className="p-4 rounded-2xl bg-white dark:bg-slate-950 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold">{r.customer?.full_name || 'Verified Customer'}</span>
                        <span className="text-amber-500 font-bold">{'★'.repeat(r.rating)}</span>
                      </div>
                      <p className="text-sm text-[#737373]">{r.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#737373]">No completed reviews yet.</p>
              )}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
