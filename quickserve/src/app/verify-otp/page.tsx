'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { OtpInput } from '@/components/ui/OtpInput';
import { useApp } from '@/components/providers/AppProvider';

function VerifyOtpInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { refreshSession } = useApp();

  const [mobile, setMobile] = useState(sp.get('mobile') ?? '');
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Verification failed');
      setVerified(true);
      await refreshSession();
      setTimeout(() => router.push(json.data?.redirectTo || '/'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobile }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error?.message || 'Could not resend OTP');
    else setTimer(30);
  };

  return (
    <div className="min-h-screen bg-[#FFF7F2] dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white inline-flex items-center justify-center shadow-lg">
            {verified ? <CheckCircle2 className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </span>
          <h1 className="text-2xl font-black">{verified ? 'Phone Verified!' : 'Verify 6-Digit OTP'}</h1>
          <p className="text-xs text-[#737373]">
            {verified ? 'Redirecting to your QuickServe dashboard...' : 'Enter your mobile number and 6-digit SMS code.'}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-semibold flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!verified && (
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1">Mobile Number (+91)</label>
              <input
                type="tel"
                maxLength={10}
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                placeholder="10-digit mobile number"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold"
              />
            </div>

            <OtpInput value={otp} onChange={setOtp} error={Boolean(error)} />

            <button
              type="submit"
              disabled={loading || otp.length !== 6 || mobile.length !== 10}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-extrabold text-sm disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <div className="flex items-center justify-between text-xs text-[#737373]">
              <Link href="/login" className="font-bold hover:text-[#F97316]">
                Back to Login
              </Link>
              {timer > 0 ? (
                <span>Resend in {timer}s</span>
              ) : (
                <button type="button" onClick={resend} className="font-bold text-[#EA580C] hover:underline">
                  Resend OTP
                </button>
              )}
            </div>
          </form>
        )}

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 text-xs text-[#737373]">
          <Zap className="w-3.5 h-3.5 text-[#F97316]" /> Protected by server-side rate limiting &amp; HMAC
        </div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm">Loading...</div>}>
      <VerifyOtpInner />
    </Suspense>
  );
}
