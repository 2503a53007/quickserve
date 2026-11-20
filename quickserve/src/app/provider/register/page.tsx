'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, ShieldCheck, Upload, Wrench } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { CATALOG_CATEGORIES } from '@/lib/catalog';
import { useApp } from '@/components/providers/AppProvider';

export default function ProviderRegisterPage() {
  const router = useRouter();
  const { user, refreshSession } = useApp();

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [experienceYears, setExperienceYears] = useState(2);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(['Electrician']);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [defaultHourlyRate, setDefaultHourlyRate] = useState(199);
  const [defaultVisitingCharge, setDefaultVisitingCharge] = useState(50);
  const [govtIdType, setGovtIdType] = useState<'aadhaar' | 'pan' | 'driving_license' | 'voter_id'>('aadhaar');
  const [govtIdLast4, setGovtIdLast4] = useState('');
  const [govtIdDocUrl, setGovtIdDocUrl] = useState<string | undefined>();
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [upiId, setUpiId] = useState('');

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const toggleSkill = (name: string) => {
    setSelectedSkills((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', 'provider-docs');
      const res = await fetch('/api/uploads', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Document upload failed');
      setGovtIdDocUrl(j.data?.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!user) {
      router.push('/signup?role=provider');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/providers/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          bio,
          experienceYears: Number(experienceYears),
          skills: selectedSkills,
          address,
          city,
          state,
          pinCode,
          defaultHourlyRate: Number(defaultHourlyRate),
          defaultVisitingCharge: Number(defaultVisitingCharge),
          govtIdType,
          govtIdLast4,
          govtIdDocUrl,
          bankAccountName,
          bankAccountNumber,
          bankIfsc: bankIfsc.toUpperCase(),
          upiId: upiId || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Registration failed');
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
              <Wrench className="w-4 h-4" /> Individual Professional Onboarding
            </span>
            <h1 className="text-3xl font-black mt-1">Register as a QuickServe Professional</h1>
            <p className="text-xs text-slate-300 mt-1">
              Submit your skills, hourly pricing, Government ID KYC, and bank/payout information. Admin verification is
              required before receiving live bookings.
            </p>
          </div>
          <Link href="/provider" className="px-4 h-10 rounded-xl bg-white/10 text-xs font-bold inline-flex items-center shrink-0">
            Open Dashboard
          </Link>
        </div>

        {done ? (
          <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border-2 border-[#16A34A] p-8 text-center space-y-4">
            <CheckCircle2 className="w-14 h-14 text-[#16A34A] mx-auto" />
            <h2 className="text-2xl font-black">Application Submitted for Admin Verification</h2>
            <p className="text-sm text-[#737373] max-w-md mx-auto">
              Your KYC and bank details have been submitted. Once an administrator approves your profile, you can go
              online and accept bookings.
            </p>
            <Link href="/provider" className="inline-flex px-6 h-11 rounded-xl bg-[#F97316] text-white font-extrabold text-sm items-center">
              Go to Provider Dashboard
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 sm:p-8 space-y-6">
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-bold flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1">Display Name *</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Full name or trade name"
                  className="w-full h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Years of Experience *</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  required
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  className="w-full h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold mb-1">About / Bio</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe your specialties, certifications, and tools..."
                  className="w-full p-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
            </div>

            {/* Service Categories / Skills */}
            <div>
              <label className="block text-xs font-bold mb-2">Service Categories &amp; Skills *</label>
              <div className="flex flex-wrap gap-2">
                {CATALOG_CATEGORIES.map((c) => {
                  const active = selectedSkills.includes(c.name);
                  return (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => toggleSkill(c.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                        active
                          ? 'bg-[#F97316] border-[#F97316] text-white'
                          : 'bg-white dark:bg-slate-950 border-orange-200 dark:border-slate-700'
                      }`}
                    >
                      {c.emoji} {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location & Pricing */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold mb-1">Service Base Address *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Shop / Residential Address"
                  className="w-full h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
              </div>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City *"
                className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State *"
                className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="text"
                required
                maxLength={6}
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit PIN *"
                className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1">Default First-Hour Price (₹) *</label>
                <input
                  type="number"
                  min={99}
                  required
                  value={defaultHourlyRate}
                  onChange={(e) => setDefaultHourlyRate(Number(e.target.value))}
                  className="w-full h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Visiting Charge (₹) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={defaultVisitingCharge}
                  onChange={(e) => setDefaultVisitingCharge(Number(e.target.value))}
                  className="w-full h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold"
                />
              </div>
            </div>

            {/* Government ID Verification */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-orange-200 dark:border-slate-800 space-y-3">
              <p className="font-extrabold text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" /> Government ID Verification (KYC)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={govtIdType}
                  onChange={(e) => setGovtIdType(e.target.value as any)}
                  className="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-xs font-bold"
                >
                  <option value="aadhaar">Aadhaar Card</option>
                  <option value="pan">PAN Card</option>
                  <option value="driving_license">Driving License</option>
                  <option value="voter_id">Voter ID</option>
                </select>
                <input
                  type="text"
                  required
                  maxLength={4}
                  value={govtIdLast4}
                  onChange={(e) => setGovtIdLast4(e.target.value.replace(/\D/g, ''))}
                  placeholder="Last 4 digits *"
                  className="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-sm font-bold"
                />
                <label className="h-11 px-3 rounded-xl border border-dashed border-[#F97316] flex items-center justify-center gap-1.5 text-xs font-bold text-[#EA580C] cursor-pointer">
                  <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : govtIdDocUrl ? 'ID Uploaded ✓' : 'Upload ID Proof'}
                  <input type="file" accept="image/*,.pdf" onChange={handleDocUpload} className="hidden" />
                </label>
              </div>
            </div>

            {/* Bank / Payout Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input
                type="text"
                required
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="Bank Account Holder Name *"
                className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="text"
                required
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="Bank Account Number *"
                className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <input
                type="text"
                required
                maxLength={11}
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                placeholder="IFSC Code (e.g. HDFC0001234) *"
                className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold uppercase"
              />
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="UPI ID (Optional, e.g. name@upi)"
                className="h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
            </div>

            {error && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-bold flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-black text-sm shadow-lg"
            >
              {loading ? 'Submitting KYC...' : 'Submit Provider Application'}
            </button>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}
