'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  KeyRound,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { GoogleMapView } from '@/components/tracking/GoogleMapView';
import { InvoiceView } from '@/components/booking/InvoiceView';

const STEPS = [
  { key: 'pending', label: 'Booking Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'provider_assigned', label: 'Pro Assigned' },
  { key: 'provider_travelling', label: 'On the Way (GPS)' },
  { key: 'provider_arrived', label: 'Arrived (Start OTP)' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed & Billed' },
];

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export default function BookingTrackingDetailPage() {
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [otps, setOtps] = useState<Array<{ purpose: string; code: string; expiresAt: string }>>([]);
  const [tracking, setTracking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [watchingGps, setWatchingGps] = useState(false);
  const [otpInput, setOtpInput] = useState('');

  const shareLiveGps = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setError('Browser GPS is not available in this window.');
      return;
    }
    setWatchingGps(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/tracking/${params.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });
          if (!res.ok) {
            const j = await res.json();
            setError(j.error?.message || 'Could not update live GPS.');
          }
          await loadAll();
        } finally {
          setWatchingGps(false);
        }
      },
      () => {
        setWatchingGps(false);
        setError('Allow browser location permission to sync your live GPS pin.');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const verifyOtpAction = async (action: 'start_service' | 'end_service') => {
    if (otpInput.length !== 6) return;
    setActionBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/bookings/${params.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, otp: otpInput }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'OTP verification failed');
      setOtpInput('');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setActionBusy(false);
    }
  };

  const loadAll = useCallback(async () => {
    try {
      const [bRes, tRes] = await Promise.all([
        fetch(`/api/bookings/${params.id}`, { cache: 'no-store' }),
        fetch(`/api/tracking/${params.id}`, { cache: 'no-store' }),
      ]);
      const bJson = await bRes.json();
      if (!bRes.ok) throw new Error(bJson.error?.message || 'Could not load booking.');
      setBooking(bJson.data.booking);
      setOtps(bJson.data.otps ?? []);
      const tJson = await tRes.json();
      if (tRes.ok) setTracking(tJson.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracking.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 15000);
    return () => clearInterval(id);
  }, [loadAll]);

  const respondExtraHours = async (approve: boolean) => {
    setActionBusy(true);
    try {
      const res = await fetch(`/api/bookings/${params.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'respond_extra_hours', approve }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Action failed');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not respond');
    } finally {
      setActionBusy(false);
    }
  };

  const payWithRazorpay = async () => {
    setActionBusy(true);
    setError('');
    try {
      const orderRes = await fetch('/api/payments/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: params.id }),
      });
      const orderJson = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderJson.error?.message || 'Could not initiate UPI payment.');

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Could not load Razorpay checkout SDK.'));
          document.body.appendChild(s);
        });
      }

      const d = orderJson.data;
      const rzp = new window.Razorpay({
        key: d.keyId,
        amount: d.amountPaise,
        currency: d.currency,
        name: 'QuickServe India',
        description: `Payment for ${booking.booking_code}`,
        order_id: d.orderId,
        theme: { color: '#F97316' },
        handler: async (resp: any) => {
          const verifyRes = await fetch('/api/payments/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId: params.id,
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
            }),
          });
          if (!verifyRes.ok) {
            const j = await verifyRes.json();
            setError(j.error?.message || 'Server payment verification failed.');
          }
          await loadAll();
        },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment error');
    } finally {
      setActionBusy(false);
    }
  };

  const currentIdx = booking ? STEPS.findIndex((s) => s.key === booking.status) : 0;
  const pendingExtra = booking?.extra_hour_requests?.find((r: any) => r.status === 'requested');
  const invoice = booking?.invoices?.[0] ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/orders" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#737373] hover:text-[#F97316]">
            <ArrowLeft className="w-4 h-4" /> Back to Your Orders
          </Link>
          <button
            type="button"
            onClick={loadAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FFF1E8] text-[#EA580C] text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Live Status
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-bold flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="h-96 rounded-3xl skeleton" />
        ) : booking ? (
          <>
            {/* Zepto-style ETA Hero */}
            <div className="rounded-3xl bg-[#0F172A] text-white p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F97316]/20 text-orange-300 text-xs font-extrabold uppercase">
                  <Navigation className="w-3.5 h-3.5" /> {String(booking.status).replace(/_/g, ' ')}
                </div>
                <h1 className="text-3xl font-black">
                  {booking.services?.name || 'Service'} · <span className="text-[#F97316]">{booking.booking_code}</span>
                </h1>
                <p className="text-xs text-slate-300">
                  Booked Hours: <strong>{booking.estimated_hours} hr</strong>
                  {Number(booking.extra_hours_approved) > 0 ? ` (+${booking.extra_hours_approved} hr approved)` : ''} ·{' '}
                  {booking.address_line}, {booking.address_city} ({booking.address_pin})
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 border border-white/15 p-4 min-w-[260px] space-y-1">
                <p className="text-[11px] uppercase font-bold text-orange-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Arrival Guarantee Window
                </p>
                <p className="text-xl font-black">
                  {booking.eta_at
                    ? `Est. ${new Date(booking.eta_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}`
                    : 'Scheduled Slot'}
                </p>
                {booking.eta_latest_at && (
                  <p className="text-xs text-slate-300">
                    Max promised arrival:{' '}
                    <strong>{new Date(booking.eta_latest_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}</strong>
                  </p>
                )}
                {booking.eta_distance_km != null && (
                  <p className="text-xs text-orange-300 font-bold">Distance remaining: {booking.eta_distance_km} km</p>
                )}
              </div>
            </div>

            {/* Active Start / End Service OTP Cards (Customer-Only) */}
            {otps.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otps.map((o) => (
                  <div
                    key={o.purpose}
                    className="rounded-3xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white p-6 flex items-center justify-between gap-4 shadow-xl"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-orange-100 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4" />
                        {o.purpose === 'start_service' ? 'Start Service OTP' : 'End Service Completion OTP'}
                      </p>
                      <p className="text-xs text-orange-100">
                        {o.purpose === 'start_service'
                          ? 'Share only when the professional has arrived and is ready to begin.'
                          : 'Share only when work is finished and you approve the bill preview.'}
                      </p>
                    </div>
                    <div className="px-4 py-3 rounded-2xl bg-white text-[#EA580C] font-black text-2xl tracking-[0.25em] shrink-0">
                      {o.code}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Extra Hours Customer Approval Banner */}
            {pendingExtra && (
              <div className="rounded-3xl bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-400 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-black text-base text-amber-900 dark:text-amber-200">
                    ⏱️ Provider Requested +{pendingExtra.hours} Extra Hour(s)
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                    Reason: &ldquo;{pendingExtra.reason}&rdquo; · Additional cost incl. GST:{' '}
                    <strong>₹{pendingExtra.extra_amount}</strong>
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => respondExtraHours(true)}
                    className="px-4 h-10 rounded-xl bg-[#16A34A] text-white font-extrabold text-xs"
                  >
                    Approve Extra Time
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => respondExtraHours(false)}
                    className="px-4 h-10 rounded-xl bg-[#DC2626] text-white font-extrabold text-xs"
                  >
                    Decline
                  </button>
                </div>
              </div>
            )}

            {/* Status Stepper */}
            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {STEPS.map((s, idx) => {
                  const done = idx <= currentIdx;
                  return (
                    <div
                      key={s.key}
                      className={`p-3 rounded-2xl border text-center ${
                        done
                          ? 'bg-white dark:bg-slate-950 border-[#F97316]'
                          : 'border-orange-100 dark:border-slate-800 opacity-50'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-5 h-5 mx-auto mb-1 ${done ? 'text-[#16A34A]' : 'text-slate-400'}`}
                      />
                      <p className="text-[11px] font-bold leading-tight">{s.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live GPS Map (stops automatically after completion/cancellation for privacy) */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-black text-lg">Live GPS Map &amp; Route</h2>
                <div className="flex items-center gap-2">
                  {tracking?.trackingActive && (
                    <button
                      type="button"
                      onClick={shareLiveGps}
                      disabled={watchingGps}
                      className="px-3.5 h-8 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      {watchingGps ? 'Syncing GPS...' : 'Sync My Live GPS'}
                    </button>
                  )}
                  <span className="text-xs font-bold text-[#737373] inline-flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                    {tracking?.trackingActive
                      ? 'Live GPS active while travelling'
                      : 'Privacy protected — GPS sharing stopped'}
                  </span>
                </div>
              </div>
              <GoogleMapView
                customerLocation={tracking?.destination ?? null}
                providerLocation={
                  tracking?.providerLocation
                    ? {
                        lat: Number(tracking.providerLocation.latitude),
                        lng: Number(tracking.providerLocation.longitude),
                        label: booking.provider?.display_name || booking.company?.company_name || 'QuickServe Professional',
                      }
                    : null
                }
                heightClass="h-96"
              />
            </div>

            {/* Quick Start / End OTP Verification Panel (to complete service & generate Copy Bill) */}
            {(booking.status === 'provider_arrived' || booking.status === 'in_progress') && (
              <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-200 dark:border-slate-800 p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-extrabold text-sm">
                    {booking.status === 'provider_arrived'
                      ? 'Verify Start Service OTP to Begin Job'
                      : 'Verify Completion OTP to End Service & Generate Copy Bill'}
                  </p>
                  <p className="text-xs text-[#737373]">
                    Enter the 6-digit OTP shown above to record exact timestamp &amp; calculate final bill.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    inputMode="numeric"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit OTP"
                    className="h-10 w-36 px-3 rounded-xl border border-orange-300 bg-white dark:bg-slate-950 text-sm font-black tracking-widest"
                  />
                  <button
                    type="button"
                    disabled={actionBusy || otpInput.length !== 6}
                    onClick={() =>
                      verifyOtpAction(booking.status === 'provider_arrived' ? 'start_service' : 'end_service')
                    }
                    className="px-4 h-10 rounded-xl bg-[#16A34A] hover:opacity-95 text-white text-xs font-extrabold disabled:opacity-50"
                  >
                    {booking.status === 'provider_arrived' ? 'Start Service' : 'End Service & Get Bill'}
                  </button>
                </div>
              </div>
            )}

            {/* Automatic Final Invoice & Payment Action */}
            {invoice && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-black text-2xl">Final Invoice &amp; Copy Bill</h2>
                  {booking.payment_status !== 'paid' && booking.payment_method === 'upi' && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={payWithRazorpay}
                      className="px-6 h-12 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-extrabold text-sm inline-flex items-center gap-2 shadow-lg"
                    >
                      <Smartphone className="w-4 h-4" /> Pay ₹{Number(invoice.total_amount).toFixed(2)} via UPI (Razorpay)
                    </button>
                  )}
                </div>
                <InvoiceView invoice={invoice} />
              </div>
            )}
          </>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}
