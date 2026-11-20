'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  CheckCircle2,
  Percent,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Tag,
  Ticket,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Dashboard3DBackground } from '@/components/ui/Dashboard3DBackground';

type AdminTab = 'overview' | 'verifications' | 'refunds' | 'tickets' | 'offers' | 'settings';

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Settings forms
  const [commission, setCommission] = useState(15);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');

  // Offer creator
  const [offerCode, setOfferCode] = useState('');
  const [offerTitle, setOfferTitle] = useState('');
  const [offerValue, setOfferValue] = useState(100);
  const [offerType, setOfferType] = useState<'percentage' | 'fixed'>('fixed');

  // Ticket replies
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/overview', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Admin access required.');
      setData(j.data);
      if (j.data?.commissionPercent != null) setCommission(j.data.commissionPercent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load admin dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const adminPatch = async (payload: Record<string, unknown>, successMsg: string) => {
    setError('');
    setNotice('');
    const res = await fetch('/api/admin/overview', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error?.message || 'Action failed');
    else {
      setNotice(successMsg);
      await load();
    }
  };

  const handleRefundAction = async (refundId: string, status: string, processViaGateway = false) => {
    setError('');
    setNotice('');
    const res = await fetch('/api/refunds', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refundId, status, processViaGateway }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error?.message || 'Refund update failed');
    else {
      setNotice(`Refund marked ${status}.`);
      await load();
    }
  };

  const handleTicketReply = async (ticketId: string) => {
    const adminResponse = replyText[ticketId];
    if (!adminResponse) return;
    const res = await fetch('/api/support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticketId, status: 'resolved', adminResponse }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error?.message || 'Could not update ticket');
    else {
      setNotice('Ticket resolved and customer notified.');
      await load();
    }
  };

  const createOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: offerCode,
        title: offerTitle,
        discount_type: offerType,
        discount_value: Number(offerValue),
        min_order_amount: 199,
        valid_until: new Date(Date.now() + 90 * 86400_000).toISOString(),
      }),
    });
    const j = await res.json();
    if (!res.ok) setError(j.error?.message || 'Could not create coupon');
    else {
      setOfferCode('');
      setOfferTitle('');
      setNotice('Coupon created!');
    }
  };

  const m = data?.metrics;

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden text-white">
      <Dashboard3DBackground fixed />
      <div className="relative z-10 flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="rounded-3xl bg-[#0B1120]/70 backdrop-blur-2xl border border-orange-400/30 text-white p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 shadow-2xl">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase text-[#F97316]">
              <ShieldCheck className="w-4 h-4" /> QuickServe Admin Control Panel
            </span>
            <h1 className="text-3xl font-black mt-1">Marketplace Operations &amp; Analytics</h1>
            <p className="text-xs text-slate-300 mt-1">
              Verify providers &amp; companies, configure commissions &amp; arrival SLAs, manage refunds, coupons, and support.
            </p>
          </div>
          <code className="text-[11px] bg-white/10 px-3 py-2 rounded-xl text-orange-300">
            npm run admin:create &lt;email&gt; &lt;pass&gt;
          </code>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-bold flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div className="p-4 rounded-2xl bg-green-50 border border-green-200 text-xs text-[#16A34A] font-bold flex gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-orange-100 dark:border-slate-800 pb-3">
          {(
            [
              ['overview', 'Analytics Overview'],
              ['verifications', `Verifications (${(data?.pendingProviders?.length ?? 0) + (data?.pendingCompanies?.length ?? 0)})`],
              ['refunds', `Refunds (${data?.refunds?.length ?? 0})`],
              ['tickets', `Support Tickets (${data?.tickets?.length ?? 0})`],
              ['offers', 'Offers & Coupons'],
              ['settings', 'Commissions & Push'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`px-4 h-10 rounded-xl text-xs font-extrabold ${
                tab === k ? 'bg-[#F97316] text-white' : 'bg-[#FFF7F2] dark:bg-slate-900 text-[#737373]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="h-64 rounded-3xl skeleton" />
        ) : (
          <>
            {tab === 'overview' && m && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[
                    ['Customers', m.totalCustomers],
                    ['Individual Pros', m.totalProviders],
                    ['Service Companies', m.totalCompanies],
                    ['Active Bookings', m.activeBookings],
                    ['Completed Jobs', m.completedBookings],
                    ['Cancelled Jobs', m.cancelledBookings],
                    ['Total Revenue', `₹${Number(m.totalRevenue).toFixed(0)}`],
                    ['Platform Commission', `₹${Number(m.platformCommissions).toFixed(0)}`],
                    ['Pending Refunds', m.pendingRefunds],
                    ['Commission Rate', `${commission}%`],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="card-3d rounded-3xl bg-[#0B1120]/65 backdrop-blur-2xl border border-orange-400/25 p-4">
                      <p className="text-[11px] font-bold text-slate-300">{k}</p>
                      <p className="text-2xl font-black text-[#FB923C] mt-1">{v}</p>
                    </div>
                  ))}
                </div>

                {!data?.configured && (
                  <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-dashed border-orange-300 p-6 text-xs text-[#737373]">
                    Connect Supabase in <code>.env.local</code> and create your Admin account via{' '}
                    <code>npm run admin:create</code> to manage live customers, providers, bookings, and Razorpay refunds.
                  </div>
                )}
              </div>
            )}

            {tab === 'verifications' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-3">
                  <h2 className="font-black text-lg flex items-center gap-2">
                    <BadgeCheck className="w-5 h-5 text-[#F97316]" /> Pending Individual Providers
                  </h2>
                  {(data?.pendingProviders ?? []).length === 0 ? (
                    <p className="text-xs text-[#737373]">No pending individual provider applications.</p>
                  ) : (
                    data.pendingProviders.map((p: any) => (
                      <div key={p.id} className="p-4 rounded-2xl bg-white dark:bg-slate-950 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-sm">{p.display_name}</p>
                          <p className="text-xs text-[#737373]">
                            {p.city} ({p.pin_code}) · ₹{p.default_hourly_rate}/hr
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => adminPatch({ action: 'verify_provider', providerId: p.id, status: 'verified' }, 'Provider verified!')}
                            className="px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-bold"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => adminPatch({ action: 'verify_provider', providerId: p.id, status: 'rejected' }, 'Provider rejected.')}
                            className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-bold"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-3">
                  <h2 className="font-black text-lg">Pending Service Companies</h2>
                  {(data?.pendingCompanies ?? []).length === 0 ? (
                    <p className="text-xs text-[#737373]">No pending company registrations.</p>
                  ) : (
                    data.pendingCompanies.map((c: any) => (
                      <div key={c.id} className="p-4 rounded-2xl bg-white dark:bg-slate-950 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-bold text-sm">{c.company_name}</p>
                          <p className="text-xs text-[#737373]">
                            Owner: {c.owner_name} · Reg: {c.registration_number}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => adminPatch({ action: 'verify_company', companyId: c.id, status: 'verified' }, 'Company verified!')}
                            className="px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-bold"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => adminPatch({ action: 'verify_company', companyId: c.id, status: 'rejected' }, 'Company rejected.')}
                            className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-bold"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'refunds' && (
              <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-3">
                <h2 className="font-black text-lg flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-[#F97316]" /> Refund Requests
                </h2>
                {(data?.refunds ?? []).length === 0 ? (
                  <p className="text-xs text-[#737373]">No refund requests.</p>
                ) : (
                  data.refunds.map((r: any) => (
                    <div key={r.id} className="p-4 rounded-2xl bg-white dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-sm">
                          {r.bookings?.booking_code || r.booking_id} · ₹{Number(r.amount).toFixed(2)}
                        </p>
                        <p className="text-xs text-[#737373]">Reason: {r.reason} · Status: {r.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleRefundAction(r.id, 'completed', true)} className="px-3 py-1.5 rounded-lg bg-[#16A34A] text-white text-xs font-bold">
                          Approve &amp; Refund via Razorpay
                        </button>
                        <button type="button" onClick={() => handleRefundAction(r.id, 'rejected')} className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-bold">
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'tickets' && (
              <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-3">
                <h2 className="font-black text-lg flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-[#F97316]" /> Customer Support Tickets
                </h2>
                {(data?.tickets ?? []).length === 0 ? (
                  <p className="text-xs text-[#737373]">No support tickets yet.</p>
                ) : (
                  data.tickets.map((t: any) => (
                    <div key={t.id} className="p-4 rounded-2xl bg-white dark:bg-slate-950 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-extrabold text-[#EA580C]">{t.ticket_code} · {t.category}</span>
                        <span className="uppercase font-bold">{t.status}</span>
                      </div>
                      <p className="font-bold text-sm">{t.subject}</p>
                      <p className="text-xs text-[#737373]">{t.description}</p>
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={replyText[t.id] || ''}
                          onChange={(e) => setReplyText((p) => ({ ...p, [t.id]: e.target.value }))}
                          placeholder="Write admin response..."
                          className="flex-1 h-9 px-3 rounded-lg border text-xs"
                        />
                        <button type="button" onClick={() => handleTicketReply(t.id)} className="px-4 h-9 rounded-lg bg-[#F97316] text-white text-xs font-bold">
                          Reply &amp; Resolve
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'offers' && (
              <form onSubmit={createOffer} className="max-w-lg rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
                <h2 className="font-black text-lg flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#F97316]" /> Create Coupon / Offer
                </h2>
                <input type="text" required value={offerCode} onChange={(e) => setOfferCode(e.target.value.toUpperCase())} placeholder="Coupon Code (e.g. DIWALI25)" className="w-full h-11 px-3 rounded-xl border bg-white dark:bg-slate-950 text-sm font-bold uppercase" />
                <input type="text" required value={offerTitle} onChange={(e) => setOfferTitle(e.target.value)} placeholder="Offer Title" className="w-full h-11 px-3 rounded-xl border bg-white dark:bg-slate-950 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={offerType} onChange={(e) => setOfferType(e.target.value as any)} className="h-11 px-3 rounded-xl border bg-white dark:bg-slate-950 text-xs font-bold">
                    <option value="fixed">Fixed Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                  <input type="number" required min={1} value={offerValue} onChange={(e) => setOfferValue(Number(e.target.value))} className="h-11 px-3 rounded-xl border bg-white dark:bg-slate-950 text-sm font-bold" />
                </div>
                <button type="submit" className="w-full h-11 rounded-xl bg-[#F97316] text-white font-extrabold text-sm">
                  Publish Coupon
                </button>
              </form>
            )}

            {tab === 'settings' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
                  <h2 className="font-black text-lg flex items-center gap-2">
                    <Percent className="w-5 h-5 text-[#F97316]" /> Platform Commission Rate
                  </h2>
                  <div className="flex gap-2">
                    <input type="number" min={0} max={50} value={commission} onChange={(e) => setCommission(Number(e.target.value))} className="flex-1 h-11 px-3 rounded-xl border bg-white dark:bg-slate-950 text-sm font-bold" />
                    <button
                      type="button"
                      onClick={() => adminPatch({ action: 'update_commission', commissionPercent: Number(commission) }, 'Commission updated!')}
                      className="px-5 h-11 rounded-xl bg-[#F97316] text-white font-extrabold text-xs"
                    >
                      Save %
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
                  <h2 className="font-black text-lg flex items-center gap-2">
                    <Bell className="w-5 h-5 text-[#F97316]" /> Broadcast Push Notification
                  </h2>
                  <input type="text" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="Notification Title" className="w-full h-10 px-3 rounded-xl border bg-white dark:bg-slate-950 text-sm" />
                  <textarea rows={2} value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} placeholder="Announcement or festival offer message..." className="w-full p-3 rounded-xl border bg-white dark:bg-slate-950 text-sm" />
                  <button
                    type="button"
                    onClick={() =>
                      adminPatch(
                        { action: 'broadcast_notification', title: broadcastTitle, body: broadcastBody, targetRole: 'all' },
                        'Broadcast sent to users!',
                      )
                    }
                    className="w-full h-11 rounded-xl bg-[#0F172A] text-white font-extrabold text-xs inline-flex items-center justify-center gap-2"
                  >
                    <Sliders className="w-4 h-4" /> Send Broadcast Notification
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
      </div>
    </div>
  );
}
