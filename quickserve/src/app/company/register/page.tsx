'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useApp } from '@/components/providers/AppProvider';

export default function CompanyRegisterPage() {
  const router = useRouter();
  const { user, refreshSession } = useApp();

  const [companyName, setCompanyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [gstin, setGstin] = useState('');
  const [teamSize, setTeamSize] = useState(5);
  const [payoutAccountName, setPayoutAccountName] = useState('');
  const [payoutAccountNumber, setPayoutAccountNumber] = useState('');
  const [payoutIfsc, setPayoutIfsc] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user) {
      router.push('/signup?role=company');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/companies/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          ownerName,
          contactPhone,
          email,
          description,
          businessAddress,
          city,
          state,
          pinCode,
          registrationNumber,
          gstin: gstin || undefined,
          teamSize: Number(teamSize),
          payoutAccountName,
          payoutAccountNumber,
          payoutIfsc: payoutIfsc.toUpperCase(),
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Company registration failed');
      await refreshSession();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="rounded-3xl bg-[#0F172A] text-white p-8 flex items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase text-[#F97316]">
              <Building2 className="w-4 h-4" /> Registered Service Company Onboarding
            </span>
            <h1 className="text-3xl font-black mt-1">Register Your Service Business</h1>
            <p className="text-xs text-slate-300 mt-1">
              Manage multiple technicians under one company account, assign bookings, and track team payouts.
            </p>
          </div>
          <Link href="/company" className="px-4 h-10 rounded-xl bg-white/10 text-xs font-bold inline-flex items-center shrink-0">
            Company Dashboard
          </Link>
        </div>

        {done ? (
          <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border-2 border-[#16A34A] p-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-[#16A34A] mx-auto" />
            <h2 className="text-2xl font-black">Company Submitted for Verification</h2>
            <p className="text-sm text-[#737373]">
              An administrator will review your business registration &amp; GSTIN details shortly.
            </p>
            <Link href="/company" className="inline-flex px-6 h-11 rounded-xl bg-[#F97316] text-white font-extrabold text-sm items-center">
              Open Company Dashboard
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 sm:p-8 space-y-4">
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-bold flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company Name *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
              <input type="text" required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner / Director Name *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
              <input type="tel" required maxLength={10} value={contactPhone} onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, ''))} placeholder="Business Mobile (+91) *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Business Email *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
              <input type="text" required value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="Business Registration / Udyam / CIN *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
              <input type="text" maxLength={15} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="GSTIN (Optional, 15 chars)" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm uppercase" />
            </div>

            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Services offered, coverage areas & business overview" className="w-full p-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input type="text" required value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} placeholder="Registered Office Address *" className="sm:col-span-2 h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
              <input type="text" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="City *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
              <input type="text" required value={state} onChange={(e) => setState(e.target.value)} placeholder="State *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
              <input type="text" required maxLength={6} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))} placeholder="PIN Code *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold" />
              <input type="number" min={1} max={500} required value={teamSize} onChange={(e) => setTeamSize(Number(e.target.value))} placeholder="Team Size" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <input type="text" required value={payoutAccountName} onChange={(e) => setPayoutAccountName(e.target.value)} placeholder="Payout Account Name *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
              <input type="text" required value={payoutAccountNumber} onChange={(e) => setPayoutAccountNumber(e.target.value)} placeholder="Account Number *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm" />
              <input type="text" required maxLength={11} value={payoutIfsc} onChange={(e) => setPayoutIfsc(e.target.value.toUpperCase())} placeholder="IFSC Code *" className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm uppercase font-bold" />
            </div>

            <button type="submit" disabled={loading} className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-black text-sm shadow-lg">
              {loading ? 'Registering Company...' : 'Submit Company Registration'}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
