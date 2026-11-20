'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, HelpCircle, LifeBuoy, MessageSquarePlus, ShieldCheck } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { SUPPORT_FAQS } from '@/lib/catalog';
import { useApp } from '@/components/providers/AppProvider';

export default function SupportPage() {
  const { user } = useApp();
  const [category, setCategory] = useState<'booking' | 'payment' | 'refund' | 'provider' | 'account' | 'other'>('booking');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [tickets, setTickets] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadTickets = () => {
    if (!user) return;
    fetch('/api/support')
      .then((r) => r.json())
      .then((j) => setTickets(j.data?.tickets ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, subject, description, priority }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Could not create ticket');
      setSubject('');
      setDescription('');
      setSuccess(`Support ticket ${j.data?.ticket_code || ''} submitted! Our team will reply shortly.`);
      loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        <div className="rounded-3xl bg-[#0F172A] text-white p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase text-[#F97316]">
              <LifeBuoy className="w-4 h-4" /> QuickServe Help Desk
            </span>
            <h1 className="text-3xl sm:text-4xl font-black mt-1">Help &amp; Support</h1>
            <p className="text-sm text-slate-300 mt-1">
              Booking complaints, payment issues, refund tracking, provider complaints &amp; FAQs.
            </p>
          </div>
          <div className="text-xs text-slate-300 space-y-1 bg-white/5 border border-white/10 rounded-2xl p-4">
            <p className="font-bold text-white">Customer Support Hours</p>
            <p>8:00 AM – 10:00 PM IST (All India)</p>
            <p className="text-[#F97316] font-bold">support@quickserve.in</p>
          </div>
        </div>

        {/* Ticket Form + My Tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-6 rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4"
          >
            <h2 className="text-xl font-black flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5 text-[#F97316]" /> Raise a Support Ticket
            </h2>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-bold flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-[#16A34A] font-bold flex gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">Issue Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full h-11 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                >
                  <option value="booking">Booking Complaint</option>
                  <option value="payment">Payment Issue</option>
                  <option value="refund">Refund Problem</option>
                  <option value="provider">Provider Complaint</option>
                  <option value="account">Account / OTP Help</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full h-11 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Subject *</label>
              <input
                type="text"
                required
                minLength={4}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                className="w-full h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Description *</label>
              <textarea
                rows={4}
                required
                minLength={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Include booking ID, transaction ID, or details so we can resolve this quickly..."
                className="w-full p-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-extrabold text-sm disabled:opacity-60"
            >
              {submitting ? 'Submitting Ticket...' : 'Submit Support Ticket'}
            </button>
          </form>

          {/* Ticket History */}
          <div className="lg:col-span-6 rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-xl font-black">Your Support Tickets ({tickets.length})</h2>
            {tickets.length === 0 ? (
              <p className="text-xs text-[#737373]">
                {user
                  ? 'You have no open support tickets. Submit the form on the left if you need assistance.'
                  : 'Sign in to view and track your support tickets and admin replies.'}
              </p>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <div key={t.id} className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-orange-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[#EA580C]">{t.ticket_code}</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FFF1E8] text-[#EA580C] text-[10px] font-extrabold uppercase">
                        {t.status}
                      </span>
                    </div>
                    <p className="font-bold text-sm">{t.subject}</p>
                    <p className="text-xs text-[#737373]">{t.description}</p>
                    {t.admin_response && (
                      <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 text-xs text-[#16A34A] font-semibold">
                        Admin Reply: {t.admin_response}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FAQs */}
        <section className="space-y-4">
          <h2 className="text-2xl font-black flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-[#F97316]" /> Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SUPPORT_FAQS.map((f) => (
              <div
                key={f.q}
                className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-5 space-y-2"
              >
                <h3 className="font-extrabold text-sm">{f.q}</h3>
                <p className="text-xs text-[#737373] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Policies */}
        <section id="policies" className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-3">
          <h2 id="cancellation" className="text-lg font-black flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#16A34A]" /> Cancellation, Privacy &amp; Refund Policy
          </h2>
          <p className="text-xs text-[#737373] leading-relaxed">
            • Free cancellation up to 60 minutes prior to the scheduled service slot. Late cancellations incur a ₹50
            policy fee (or the visiting charge once a professional starts travelling).
            <br />• Location privacy: Provider GPS coordinates are shared solely while travelling to your address and
            deleted automatically once service begins, completes, or cancels.
            <br />• All online UPI payments are verified server-side via Razorpay HMAC-SHA256 signatures and webhooks.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
