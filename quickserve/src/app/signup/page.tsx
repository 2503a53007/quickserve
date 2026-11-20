'use client';

import React, { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, Building2, CheckCircle2, User, Wrench, Zap } from 'lucide-react';
import { useApp } from '@/components/providers/AppProvider';

const QuickServeScrollScene = dynamic(() => import('@/components/three/QuickServeScrollScene'), {
  ssr: false,
});

type AccountType = 'customer' | 'provider' | 'company';

function SignupInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshSession } = useApp();

  const initialRole = (params.get('role') as AccountType) || 'customer';
  const [accountType, setAccountType] = useState<AccountType>(
    ['customer', 'provider', 'company'].includes(initialRole) ? initialRole : 'customer',
  );

  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doneMsg, setDoneMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDoneMsg('');

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms & Conditions and Privacy Policy.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          mobile,
          email,
          password,
          accountType,
          referralCode: referralCode.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Registration failed');

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('qs_login_verified_this_tab', '1');
      }
      await refreshSession();
      if (json.data?.needsEmailVerification) {
        setDoneMsg('Account created! Please verify your email link, then sign in.');
      } else {
        router.push(json.data?.redirectTo || '/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen py-10 px-4 overflow-hidden">
      <QuickServeScrollScene />
      <div className="relative z-10 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between text-white">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-200 hover:text-white">
            <ArrowLeft className="w-4 h-4" /> Back to Login
          </Link>
          <Link href="/login" className="inline-flex items-center gap-2 font-black text-xl text-white">
            <span className="icon-3d w-8 h-8 rounded-xl bg-[#F97316] flex items-center justify-center text-white">
              <Zap className="w-4 h-4 fill-white" />
            </span>
            Quick<span className="text-[#F97316]">Serve</span>
          </Link>
        </div>

        <div className="rounded-[2rem] bg-white/92 dark:bg-slate-900/88 backdrop-blur-2xl border border-white/60 dark:border-orange-500/30 p-6 sm:p-8 shadow-[0_30px_70px_-12px_rgba(0,0,0,0.6),0_6px_0_rgba(249,115,22,0.65)] space-y-6">
          <div>
            <h1 className="text-3xl font-black">Create Your QuickServe Account</h1>
            <p className="text-sm text-[#737373] mt-1">
              Choose your account type below. Admin accounts are provisioned exclusively via secure CLI.
            </p>
          </div>

          {/* Account Type Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(
              [
                ['customer', 'Customer', 'Book & track home services', User],
                ['provider', 'Individual Provider', 'Offer skills & earn per hour', Wrench],
                ['company', 'Registered Company', 'Manage workers & team jobs', Building2],
              ] as const
            ).map(([key, title, sub, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAccountType(key)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  accountType === key
                    ? 'border-[#F97316] bg-[#FFF1E8] dark:bg-orange-500/15 shadow-sm'
                    : 'border-slate-200 dark:border-slate-800 hover:border-orange-300'
                }`}
              >
                <Icon className={`w-5 h-5 mb-2 ${accountType === key ? 'text-[#EA580C]' : 'text-[#737373]'}`} />
                <p className="font-extrabold text-sm">{title}</p>
                <p className="text-[11px] text-[#737373] mt-0.5">{sub}</p>
              </button>
            ))}
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-[#DC2626] font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {doneMsg && (
            <div className="p-4 rounded-2xl bg-green-50 dark:bg-green-950/40 border border-green-200 text-sm text-[#16A34A] font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{doneMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:border-[#F97316]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5">Mobile Number (+91) *</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  placeholder="10-digit Indian mobile"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:border-[#F97316]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:border-[#F97316]"
                />
              </div>
              {accountType === 'customer' && (
                <div>
                  <label className="block text-xs font-bold mb-1.5">Referral Code (Optional)</label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. QSAB12CD"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1.5">Password (min 8 chars) *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:border-[#F97316]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1.5">Confirm Password *</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:border-[#F97316]"
                />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-[#737373] cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 accent-[#F97316]"
              />
              <span>
                I agree to QuickServe&apos;s Terms &amp; Conditions, Cancellation Policy, and Privacy Policy.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 disabled:opacity-60"
            >
              {loading
                ? 'Creating account...'
                : accountType === 'provider'
                  ? 'Continue to Provider KYC & Onboarding'
                  : accountType === 'company'
                    ? 'Continue to Company Registration'
                    : 'Create Customer Account'}
            </button>
          </form>

          <p className="text-center text-sm text-[#737373]">
            Already have an account?{' '}
            <Link href="/login" className="font-extrabold text-[#EA580C] hover:underline">
              Sign in with OTP
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm">Loading...</div>}>
      <SignupInner />
    </Suspense>
  );
}
