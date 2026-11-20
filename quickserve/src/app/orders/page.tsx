'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Clock,
  FileText,
  RefreshCw,
  RotateCcw,
  Star,
  XCircle,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { InvoiceView } from '@/components/booking/InvoiceView';
import { useApp } from '@/components/providers/AppProvider';

type OrderTab = 'active' | 'upcoming' | 'completed' | 'cancelled' | 'refunds';

export default function OrdersPage() {
  const { user } = useApp();
  const [tab, setTab] = useState<OrderTab>('active');
  const [bookings, setBookings] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [invoiceBooking, setInvoiceBooking] = useState<any>(null);
  const [reviewBooking, setReviewBooking] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [refundBooking, setRefundBooking] = useState<any>(null);
  const [refundReason, setRefundReason] = useState('');
  const [cancelBooking, setCancelBooking] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [bRes, rRes] = await Promise.all([fetch('/api/bookings'), fetch('/api/refunds')]);
      const bJson = await bRes.json();
      const rJson = await rRes.json();
      setBookings(bJson.data?.bookings ?? []);
      setRefunds(rJson.data?.refunds ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const now = Date.now();
  const filtered = bookings.filter((b) => {
    if (tab === 'active') {
      return ['provider_travelling', 'provider_arrived', 'in_progress'].includes(b.status) ||
        (['pending', 'confirmed', 'provider_assigned'].includes(b.status) && new Date(b.scheduled_start).getTime() <= now + 3 * 3600_000);
    }
    if (tab === 'upcoming') {
      return ['pending', 'confirmed', 'provider_assigned'].includes(b.status) && new Date(b.scheduled_start).getTime() > now + 3 * 3600_000;
    }
    if (tab === 'completed') return b.status === 'completed';
    if (tab === 'cancelled') return b.status === 'cancelled' || b.status === 'rejected';
    return false;
  });

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBooking) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: reviewBooking.id, rating, comment }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Could not submit review');
      setReviewBooking(null);
      setComment('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  };

  const submitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundBooking) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: refundBooking.id, reason: refundReason }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Refund request failed');
      setRefundBooking(null);
      setRefundReason('');
      setTab('refunds');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund failed');
    } finally {
      setBusy(false);
    }
  };

  const submitCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelBooking) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/bookings/${cancelBooking.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: cancelReason }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Could not cancel booking');
      setCancelBooking(null);
      setCancelReason('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#F97316]">Order History</span>
            <h1 className="text-3xl font-black mt-1">Your Orders</h1>
          </div>
          <Link
            href="/booking"
            className="px-5 h-11 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-extrabold text-xs inline-flex items-center"
          >
            + Book New Service
          </Link>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-bold flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tabs: Active, Upcoming, Completed, Cancelled, Refunds */}
        <div className="flex flex-wrap gap-2 border-b border-orange-100 dark:border-slate-800 pb-3">
          {(
            [
              ['active', 'Active'],
              ['upcoming', 'Upcoming'],
              ['completed', 'Completed'],
              ['cancelled', 'Cancelled'],
              ['refunds', `Refunds (${refunds.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-4 h-10 rounded-xl text-xs font-extrabold transition-colors ${
                tab === key
                  ? 'bg-[#F97316] text-white shadow'
                  : 'bg-[#FFF7F2] dark:bg-slate-900 text-[#737373] hover:text-[#171717]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-48 rounded-3xl skeleton" />
        ) : !user ? (
          <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 p-8 text-center space-y-3">
            <h2 className="text-xl font-black">Sign in to view Your Orders &amp; Invoices</h2>
            <Link href="/login" className="inline-flex px-6 h-11 rounded-xl bg-[#F97316] text-white font-extrabold text-sm items-center">
              Sign In
            </Link>
          </div>
        ) : tab === 'refunds' ? (
          refunds.length === 0 ? (
            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 p-8 text-center text-sm text-[#737373]">
              No refund requests found.
            </div>
          ) : (
            <div className="space-y-3">
              {refunds.map((r) => (
                <div
                  key={r.id}
                  className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-xs font-extrabold text-[#EA580C]">
                      {r.bookings?.booking_code || r.booking_id}
                    </p>
                    <p className="font-bold text-base">Refund Amount: ₹{Number(r.amount).toFixed(2)}</p>
                    <p className="text-xs text-[#737373] mt-0.5">Reason: {r.reason}</p>
                    {r.admin_notes && <p className="text-xs text-slate-500 mt-1">Admin note: {r.admin_notes}</p>}
                  </div>
                  <span className="px-3 py-1 rounded-full bg-white dark:bg-slate-950 border border-orange-200 text-xs font-extrabold uppercase text-[#EA580C]">
                    {String(r.status).replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 p-8 text-center space-y-3">
            <Clock className="w-8 h-8 text-[#F97316] mx-auto" />
            <p className="font-bold text-sm">No {tab} bookings yet.</p>
            <Link href="/booking" className="inline-flex px-5 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-extrabold">
              Book a Service
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((b) => {
              const inv = b.invoices?.[0];
              const hasReview = Boolean(b.reviews?.length);
              return (
                <div
                  key={b.id}
                  className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <span className="text-xs font-extrabold text-[#EA580C]">{b.booking_code}</span>
                      <h2 className="text-xl font-black">{b.services?.name || 'Local Service'}</h2>
                      <p className="text-xs text-[#737373] mt-0.5">
                        Provider: {b.provider?.display_name || b.company?.company_name || 'Assigned Pro'} ·{' '}
                        {new Date(b.scheduled_start).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}{' '}
                        · <strong>{b.billed_hours ?? b.estimated_hours} hr(s)</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-[#EA580C]">
                        ₹{Number(b.final_total ?? b.estimated_total).toFixed(2)}
                      </p>
                      <p className="text-[11px] font-bold uppercase text-[#737373]">
                        {String(b.status).replace(/_/g, ' ')} · {String(b.payment_method).toUpperCase()} ({b.payment_status})
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-orange-100 dark:border-slate-800">
                    <Link
                      href={`/tracking/${b.id}`}
                      className="px-4 h-9 rounded-xl bg-[#F97316] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Track / OTP Details
                    </Link>
                    {inv && (
                      <button
                        type="button"
                        onClick={() => setInvoiceBooking(inv)}
                        className="px-4 h-9 rounded-xl bg-white dark:bg-slate-950 border border-orange-200 text-xs font-extrabold inline-flex items-center gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#F97316]" /> View / Copy Bill
                      </button>
                    )}
                    {b.status === 'completed' && !hasReview && (
                      <button
                        type="button"
                        onClick={() => setReviewBooking(b)}
                        className="px-4 h-9 rounded-xl bg-amber-100 text-amber-800 text-xs font-extrabold inline-flex items-center gap-1.5"
                      >
                        <Star className="w-3.5 h-3.5" /> Rate &amp; Review
                      </button>
                    )}
                    {b.payment_status === 'paid' && (
                      <button
                        type="button"
                        onClick={() => setRefundBooking(b)}
                        className="px-4 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Request Refund
                      </button>
                    )}
                    {['pending', 'confirmed', 'provider_assigned', 'provider_travelling'].includes(b.status) && (
                      <button
                        type="button"
                        onClick={() => setCancelBooking(b)}
                        className="px-4 h-9 rounded-xl border border-red-200 text-[#DC2626] text-xs font-bold inline-flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Cancel
                      </button>
                    )}
                    <Link
                      href={`/booking?category=${b.service_categories?.slug || 'electrician'}&service=${b.services?.slug || ''}`}
                      className="px-4 h-9 rounded-xl bg-[#FFF1E8] text-[#EA580C] text-xs font-extrabold inline-flex items-center"
                    >
                      Rebook
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Invoice Modal */}
        {invoiceBooking && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-2xl space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setInvoiceBooking(null)}
                  className="px-4 py-1.5 rounded-xl bg-white text-[#171717] text-xs font-extrabold"
                >
                  Close
                </button>
              </div>
              <InvoiceView invoice={invoiceBooking} />
            </div>
          </div>
        )}

        {/* Review Modal */}
        {reviewBooking && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form
              onSubmit={submitReview}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
            >
              <h3 className="font-black text-xl">Rate Your Completed Service</h3>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`w-10 h-10 rounded-xl font-black ${
                      n <= rating ? 'bg-[#F97316] text-white' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {n}★
                  </button>
                ))}
              </div>
              <textarea
                rows={4}
                required
                minLength={5}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your honest experience with arrival, punctuality, and service quality..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewBooking(null)}
                  className="flex-1 h-10 rounded-xl border font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 h-10 rounded-xl bg-[#F97316] text-white font-extrabold text-xs"
                >
                  {busy ? 'Submitting...' : 'Submit Verified Review'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Refund Modal */}
        {refundBooking && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form
              onSubmit={submitRefund}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
            >
              <h3 className="font-black text-xl">Request a Refund</h3>
              <p className="text-xs text-[#737373]">
                Booking {refundBooking.booking_code} · Paid ₹
                {Number(refundBooking.final_total ?? refundBooking.estimated_total).toFixed(2)}
              </p>
              <textarea
                rows={3}
                required
                minLength={5}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Explain why you are requesting a refund..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRefundBooking(null)}
                  className="flex-1 h-10 rounded-xl border font-bold text-xs"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 h-10 rounded-xl bg-[#F97316] text-white font-extrabold text-xs"
                >
                  Submit Refund Request
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cancel Modal */}
        {cancelBooking && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form
              onSubmit={submitCancel}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
            >
              <h3 className="font-black text-xl text-[#DC2626]">Cancel Booking {cancelBooking.booking_code}</h3>
              <p className="text-xs text-[#737373]">
                Free cancellation up to 60 minutes before scheduled start. Later cancellations follow policy fees.
              </p>
              <input
                type="text"
                required
                minLength={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason for cancellation"
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCancelBooking(null)}
                  className="flex-1 h-10 rounded-xl border font-bold text-xs"
                >
                  Keep Booking
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 h-10 rounded-xl bg-[#DC2626] text-white font-extrabold text-xs"
                >
                  Confirm Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
