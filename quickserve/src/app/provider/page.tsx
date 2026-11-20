'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock,
  KeyRound,
  Navigation,
  Power,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Dashboard3DBackground } from '@/components/ui/Dashboard3DBackground';
import { useApp } from '@/components/providers/AppProvider';

export default function ProviderDashboardPage() {
  const { user, providerProfile, refreshSession } = useApp();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Per-booking OTP & extra inputs
  const [startOtp, setStartOtp] = useState<Record<string, string>>({});
  const [endOtp, setEndOtp] = useState<Record<string, string>>({});
  const [materialCost, setMaterialCost] = useState<Record<string, number>>({});
  const [spareCost, setSpareCost] = useState<Record<string, number>>({});
  const [extraHours, setExtraHours] = useState<Record<string, number>>({});
  const [extraReason, setExtraReason] = useState<Record<string, string>>({});

  const loadJobs = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/bookings');
      const j = await res.json();
      setBookings(j.data?.bookings ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggleOnline = async () => {
    if (!providerProfile) return;
    await fetch('/api/providers/register', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOnline: !providerProfile.is_online }),
    });
    await refreshSession();
  };

  const getCoords = () =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      if (!('geolocation' in navigator)) return reject(new Error('GPS unavailable in this browser.'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => reject(new Error('Allow browser location access to broadcast real GPS coordinates.')),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });

  const runAction = async (bookingId: string, payload: Record<string, unknown>) => {
    setBusyId(bookingId);
    setError('');
    try {
      const res = await fetch(`/api/bookings/${bookingId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Action failed');
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleTravelOrArrive = async (bookingId: string, action: 'start_travel' | 'arrived') => {
    setBusyId(bookingId);
    setError('');
    try {
      const coords = await getCoords();
      await runAction(bookingId, { action, lat: coords.lat, lng: coords.lng });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch GPS');
      setBusyId(null);
    }
  };

  const completed = bookings.filter((b) => b.status === 'completed');
  const totalEarnings = completed.reduce((acc, b) => acc + Number(b.provider_earning ?? 0), 0);
  const pendingReqs = bookings.filter((b) => b.status === 'pending');

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden text-white">
      <Dashboard3DBackground fixed />
      <div className="relative z-10 flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="rounded-3xl bg-[#0B1120]/70 backdrop-blur-2xl border border-orange-400/30 text-white p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase text-[#F97316]">
              <Wrench className="w-4 h-4" /> Individual Provider Dashboard
            </span>
            <h1 className="text-3xl font-black mt-1">
              {providerProfile?.display_name || 'QuickServe Pro Workspace'}
            </h1>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
              Verification Status:{' '}
              <strong className="uppercase text-orange-300">
                {providerProfile?.verification_status || 'not registered'}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {providerProfile && (
              <button
                type="button"
                onClick={toggleOnline}
                className={`px-5 h-11 rounded-xl font-extrabold text-xs inline-flex items-center gap-2 ${
                  providerProfile.is_online ? 'bg-[#16A34A] text-white' : 'bg-slate-700 text-slate-200'
                }`}
              >
                <Power className="w-4 h-4" /> {providerProfile.is_online ? 'Online & Accepting' : 'Offline'}
              </button>
            )}
            <Link
              href="/provider/register"
              className="px-4 h-11 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold inline-flex items-center"
            >
              Profile &amp; Pricing Settings
            </Link>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ['Pending Requests', String(pendingReqs.length)],
            ['Active Jobs', String(bookings.filter((b) => ['confirmed', 'provider_assigned', 'provider_travelling', 'provider_arrived', 'in_progress'].includes(b.status)).length)],
            ['Completed Jobs', String(completed.length)],
            ['Net Earnings', `₹${totalEarnings.toFixed(2)}`],
          ].map(([label, val]) => (
            <div key={label} className="card-3d rounded-3xl bg-[#0B1120]/65 backdrop-blur-2xl border border-orange-400/25 p-5">
              <p className="text-xs font-bold text-slate-300">{label}</p>
              <p className="text-2xl font-black text-[#FB923C] mt-1">{val}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-bold flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Booking Management */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black">Booking Requests &amp; Active Jobs</h2>
          {loading ? (
            <div className="h-44 rounded-3xl skeleton" />
          ) : !user ? (
            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 p-8 text-center space-y-3">
              <p className="font-bold">Sign in with your Provider account to manage bookings, live GPS travel, and OTPs.</p>
              <div className="flex justify-center gap-3">
                <Link href="/login" className="px-5 h-10 rounded-xl bg-[#F97316] text-white text-xs font-extrabold inline-flex items-center">
                  Sign In
                </Link>
                <Link href="/provider/register" className="px-5 h-10 rounded-xl border border-orange-200 text-xs font-bold inline-flex items-center">
                  Register as Provider
                </Link>
              </div>
            </div>
          ) : bookings.length === 0 ? (
            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 p-8 text-center text-sm text-[#737373]">
              No bookings assigned yet. Make sure your account is Verified and Online!
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-200 dark:border-slate-800 p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-extrabold text-[#EA580C]">{b.booking_code}</span>
                      <h3 className="text-xl font-black">{b.services?.name || 'Service Job'}</h3>
                      <p className="text-xs text-[#737373] mt-0.5">
                        {b.address_line}, {b.address_city} ({b.address_pin}) · {b.estimated_hours} hr(s) booked
                      </p>
                      {b.issue_description && <p className="text-xs mt-1 font-medium">Issue: {b.issue_description}</p>}
                    </div>
                    <span className="px-3 py-1 rounded-full bg-[#F97316] text-white text-xs font-extrabold uppercase">
                      {String(b.status).replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Action Controls per Lifecycle Stage */}
                  <div className="pt-3 border-t border-orange-100 dark:border-slate-800 flex flex-wrap items-center gap-3">
                    {b.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={busyId === b.id}
                          onClick={() => runAction(b.id, { action: 'accept' })}
                          className="px-4 h-10 rounded-xl bg-[#16A34A] text-white text-xs font-extrabold"
                        >
                          Accept Booking
                        </button>
                        <button
                          type="button"
                          disabled={busyId === b.id}
                          onClick={() => runAction(b.id, { action: 'reject', reason: 'Schedule conflict' })}
                          className="px-4 h-10 rounded-xl bg-[#DC2626] text-white text-xs font-extrabold"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {b.status === 'provider_assigned' && (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => handleTravelOrArrive(b.id, 'start_travel')}
                        className="px-4 h-10 rounded-xl bg-[#F97316] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                      >
                        <Navigation className="w-4 h-4" /> Start Travelling (Live GPS)
                      </button>
                    )}

                    {b.status === 'provider_travelling' && (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => handleTravelOrArrive(b.id, 'arrived')}
                        className="px-4 h-10 rounded-xl bg-[#F97316] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Mark Arrived &amp; Send Start OTP
                      </button>
                    )}

                    {b.status === 'provider_arrived' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={startOtp[b.id] || ''}
                          onChange={(e) => setStartOtp((p) => ({ ...p, [b.id]: e.target.value.replace(/\D/g, '') }))}
                          placeholder="Customer Start OTP"
                          className="h-10 w-44 px-3 rounded-xl border border-orange-300 bg-white dark:bg-slate-950 text-xs font-bold tracking-widest"
                        />
                        <button
                          type="button"
                          disabled={busyId === b.id || (startOtp[b.id]?.length ?? 0) !== 6}
                          onClick={() => runAction(b.id, { action: 'start_service', otp: startOtp[b.id] })}
                          className="px-4 h-10 rounded-xl bg-[#16A34A] text-white text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Verify &amp; Start Service
                        </button>
                      </div>
                    )}

                    {b.status === 'in_progress' && (
                      <div className="w-full space-y-3">
                        {/* Request Extra Hours */}
                        <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 flex flex-wrap items-center gap-2">
                          <Clock className="w-4 h-4 text-[#F97316]" />
                          <input
                            type="number"
                            min={0.5}
                            max={6}
                            step={0.5}
                            value={extraHours[b.id] ?? 1}
                            onChange={(e) => setExtraHours((p) => ({ ...p, [b.id]: Number(e.target.value) }))}
                            className="h-9 w-20 px-2 rounded-lg border text-xs font-bold"
                          />
                          <input
                            type="text"
                            value={extraReason[b.id] || ''}
                            onChange={(e) => setExtraReason((p) => ({ ...p, [b.id]: e.target.value }))}
                            placeholder="Reason for extra hours"
                            className="h-9 flex-1 min-w-[160px] px-3 rounded-lg border text-xs"
                          />
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() =>
                              runAction(b.id, {
                                action: 'request_extra_hours',
                                hours: extraHours[b.id] ?? 1,
                                reason: extraReason[b.id] || 'Additional work required',
                              })
                            }
                            className="px-3 h-9 rounded-lg bg-[#0F172A] text-white text-xs font-bold"
                          >
                            Request Extra Hours
                          </button>
                        </div>

                        {/* Request End OTP & Complete with Materials/Parts */}
                        <div className="p-3 rounded-2xl bg-white dark:bg-slate-950 flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            value={materialCost[b.id] ?? 0}
                            onChange={(e) => setMaterialCost((p) => ({ ...p, [b.id]: Number(e.target.value) }))}
                            placeholder="Materials ₹"
                            className="h-9 w-28 px-2 rounded-lg border text-xs font-bold"
                          />
                          <input
                            type="number"
                            min={0}
                            value={spareCost[b.id] ?? 0}
                            onChange={(e) => setSpareCost((p) => ({ ...p, [b.id]: Number(e.target.value) }))}
                            placeholder="Spare Parts ₹"
                            className="h-9 w-28 px-2 rounded-lg border text-xs font-bold"
                          />
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() =>
                              runAction(b.id, {
                                action: 'request_end_otp',
                                materialCost: materialCost[b.id] ?? 0,
                                sparePartsCost: spareCost[b.id] ?? 0,
                              })
                            }
                            className="px-3.5 h-9 rounded-lg bg-[#F97316] text-white text-xs font-extrabold"
                          >
                            Send Completion OTP
                          </button>

                          <input
                            type="text"
                            maxLength={6}
                            value={endOtp[b.id] || ''}
                            onChange={(e) => setEndOtp((p) => ({ ...p, [b.id]: e.target.value.replace(/\D/g, '') }))}
                            placeholder="End OTP"
                            className="h-9 w-28 px-2.5 rounded-lg border border-orange-300 text-xs font-bold tracking-widest"
                          />
                          <button
                            type="button"
                            disabled={busyId === b.id || (endOtp[b.id]?.length ?? 0) !== 6}
                            onClick={() => runAction(b.id, { action: 'end_service', otp: endOtp[b.id] })}
                            className="px-4 h-9 rounded-lg bg-[#16A34A] text-white text-xs font-extrabold disabled:opacity-50"
                          >
                            END SERVICE &amp; GENERATE BILL
                          </button>
                        </div>
                      </div>
                    )}

                    {b.status === 'completed' && b.payment_method === 'cash' && b.payment_status !== 'paid' && (
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => runAction(b.id, { action: 'collect_cash' })}
                        className="px-4 h-10 rounded-xl bg-[#16A34A] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                      >
                        <Banknote className="w-4 h-4" /> Mark Cash Collected (₹{Number(b.final_total).toFixed(2)})
                      </button>
                    )}

                    <Link
                      href={`/tracking/${b.id}`}
                      className="px-3.5 h-10 rounded-xl border border-orange-200 text-xs font-bold inline-flex items-center"
                    >
                      View Full Details / Invoice
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
      </div>
    </div>
  );
}
