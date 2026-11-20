'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Navigation, ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useApp } from '@/components/providers/AppProvider';

export default function TrackingIndexPage() {
  const { user } = useApp();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetch('/api/bookings')
      .then((r) => r.json())
      .then((j) => {
        const active = (j.data?.bookings ?? []).filter((b: any) =>
          ['pending', 'confirmed', 'provider_assigned', 'provider_travelling', 'provider_arrived', 'in_progress'].includes(
            b.status,
          ),
        );
        setBookings(active);
      })
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div>
          <span className="text-xs font-extrabold uppercase tracking-wider text-[#F97316]">
            Zepto-Style Live Arrival &amp; OTP Console
          </span>
          <h1 className="text-3xl font-black mt-1">Track Your Active Bookings</h1>
        </div>

        {loading ? (
          <div className="h-48 rounded-3xl skeleton" />
        ) : !user ? (
          <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-200 p-8 text-center space-y-4">
            <Navigation className="w-10 h-10 text-[#F97316] mx-auto" />
            <h2 className="text-xl font-black">Sign in to Track Your Live Bookings</h2>
            <p className="text-sm text-[#737373] max-w-md mx-auto">
              View live GPS location while your professional is en route, check your max promised arrival window, and
              access your Start &amp; End Service OTPs.
            </p>
            <Link
              href="/login"
              className="inline-flex px-6 h-11 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-extrabold text-sm items-center"
            >
              Sign In with OTP
            </Link>
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-200 p-8 text-center space-y-4">
            <Clock className="w-10 h-10 text-[#F97316] mx-auto" />
            <h2 className="text-xl font-black">No Active Bookings Right Now</h2>
            <p className="text-sm text-[#737373]">
              Once you confirm a booking, live ETA tracking and Start/End OTPs will appear here automatically.
            </p>
            <Link
              href="/booking"
              className="inline-flex px-6 h-11 rounded-xl bg-[#F97316] text-white font-extrabold text-sm items-center"
            >
              Book a Service
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b) => (
              <Link
                key={b.id}
                href={`/tracking/${b.id}`}
                className="block rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-200 dark:border-slate-800 hover:border-[#F97316] p-6 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-extrabold text-[#EA580C]">{b.booking_code}</span>
                    <h2 className="text-xl font-black">{b.services?.name || 'Local Service'}</h2>
                    <p className="text-xs text-[#737373] mt-1">
                      {b.estimated_hours} hr(s) booked · {b.address_line}, {b.address_city}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F97316] text-white text-xs font-extrabold uppercase">
                      <ShieldCheck className="w-3.5 h-3.5" /> {String(b.status).replace(/_/g, ' ')}
                    </span>
                    {b.eta_latest_at && (
                      <p className="text-xs font-bold text-[#EA580C] mt-1.5">
                        Max arrival: {new Date(b.eta_latest_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
