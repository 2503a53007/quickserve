'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  Eye,
  EyeOff,
  Phone,
  Mail,
  ArrowLeft,
  Wrench,
  Building2,
  User,
  ShieldCheck,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { OtpInput } from '@/components/ui/OtpInput';
import { Tilt3DCard } from '@/components/ui/Tilt3DCard';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useApp } from '@/components/providers/AppProvider';
import { createClient as createBrowserSupabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/env';

const QuickServeScrollScene = dynamic(() => import('@/components/three/QuickServeScrollScene'), {
  ssr: false,
});

type Tab = 'otp' | 'email';
type Role = 'customer' | 'provider' | 'company';

export default function LoginPage() {
  const router = useRouter();
  const { user, refreshSession } = useApp();

  const [tab, setTab] = useState<Tab>('otp');
  const [role, setRole] = useState<Role>('customer');

  // Mobile OTP state
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Email & Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setInfo('');
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: phone }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to send OTP');
      setOtpSent(true);
      setTimer(30);
      setInfo(
        json.data?.devOtp
          ? `Local dev OTP for +91 ${phone}: ${json.data.devOtp} (also logged in terminal). Valid for 5 minutes.`
          : `6-digit OTP sent to +91 ${phone}. Valid for 5 minutes.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: phone, otp, accountType: role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Invalid OTP');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('qs_login_verified_this_tab', '1');
      }
      await refreshSession();
      const nextParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      const safeTarget =
        nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : json.data?.redirectTo || '/';
      router.push(safeTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, accountType: role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Invalid credentials');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('qs_login_verified_this_tab', '1');
      }
      await refreshSession();
      const nextParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
      const safeTarget =
        nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : json.data?.redirectTo || '/';
      router.push(safeTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    if (!isSupabaseConfigured()) {
      setError('Configure Supabase Auth + Google OAuth in .env.local to sign in with Google.');
      return;
    }
    try {
      const supabase = createBrowserSupabase();
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (oauthErr) setError(oauthErr.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    if (!email) {
      setError('Enter your email address first to receive a password reset link.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('Configure Supabase in .env.local to send password reset emails.');
      return;
    }
    const supabase = createBrowserSupabase();
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (resetErr) setError(resetErr.message);
    else setInfo('Password reset link sent to your email.');
    setForgotOpen(false);
  };

  return (
    <div className="relative min-h-screen flex overflow-hidden text-[#171717] dark:text-white">
      {/* Live WebGL Three.js + GLSL Shader 3D Background (switches White & Orange <-> Dark Neon with Theme Toggle!) */}
      <QuickServeScrollScene />

      {/* Left Brand Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 text-[#171717] dark:text-white flex-col justify-between p-12 relative z-10">
        <Link href="/" className="relative inline-flex items-center gap-2.5 w-fit">
          <span className="icon-3d w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FB923C] via-[#F97316] to-[#EA580C] flex items-center justify-center">
            <Zap className="w-5 h-5 fill-white text-white" />
          </span>
          <span className="font-black text-2xl drop-shadow-sm">
            Quick<span className="text-[#F97316]">Serve</span>
          </span>
        </Link>

        <div className="relative space-y-6 max-w-md">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/15 dark:bg-orange-500/20 border border-orange-400/40 backdrop-blur-md text-[#EA580C] dark:text-orange-200 text-xs font-extrabold uppercase">
            <ShieldCheck className="w-4 h-4" /> Server-Verified Authentication
          </span>
          <h1 className="text-4xl xl:text-5xl font-black leading-tight">
            Welcome back to{' '}
            <span className="bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#F59E0B] bg-clip-text text-transparent">
              QuickServe
            </span>
            .
          </h1>
          <p className="text-[#525252] dark:text-slate-200/90 text-sm leading-relaxed">
            Book verified electricians, plumbers, AC technicians, and home professionals across India. Track live
            arrivals, verify with Start/End OTPs, and pay seamlessly via Cash or UPI.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2" style={{ perspective: '900px' }}>
            {[
              ['⚡', 'Electrician'],
              ['❄️', 'AC Repair'],
              ['🔧', 'Plumbing'],
              ['✨', 'Cleaning'],
              ['🚗', 'Car Care'],
              ['💇', 'Salon'],
            ].map(([emoji, label], idx) => (
              <motion.div
                key={label}
                whileHover={{ rotateX: -12, rotateY: 14, scale: 1.08, y: -6 }}
                animate={{ y: [0, idx % 2 === 0 ? -6 : 6, 0] }}
                transition={{ y: { duration: 3.8 + idx * 0.3, repeat: Infinity, ease: 'easeInOut' } }}
                className="rounded-2xl bg-white/80 dark:bg-white/12 border border-orange-200 dark:border-white/25 p-3.5 text-center shadow-[0_14px_28px_rgba(249,115,22,0.16),0_4px_0_rgba(249,115,22,0.35)] dark:shadow-[0_16px_30px_rgba(0,0,0,0.45),0_4px_0_rgba(249,115,22,0.5)] backdrop-blur-md cursor-default"
              >
                <span className="text-2xl block drop-shadow">{emoji}</span>
                <span className="text-[11px] font-extrabold text-[#171717] dark:text-white mt-1.5 block">{label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-[#737373] dark:text-orange-200/80 font-semibold">
          Your Services. Your Vibe. · Book it. Track it. Done.
        </p>
      </div>

      {/* Right Interactive 3D Translucent Glass Login Card (White & Orange in Light Mode, Cyber-Glass in Dark Mode) */}
      <div className="relative z-10 flex-1 flex flex-col justify-center px-4 py-8 sm:px-10 lg:px-14">
        <div className="w-full max-w-md mx-auto">
          <Tilt3DCard maxTilt={5} glare={false}>
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="relative rounded-[2rem] bg-white/85 dark:bg-[#0B1120]/65 backdrop-blur-2xl border border-orange-200/90 dark:border-orange-400/35 p-6 sm:p-8 shadow-[0_28px_70px_-14px_rgba(249,115,22,0.22),0_6px_0_rgba(249,115,22,0.65)] dark:shadow-[0_32px_80px_-14px_rgba(0,0,0,0.75),0_6px_0_rgba(249,115,22,0.75)] space-y-5 overflow-hidden"
            >
              {/* Subtle Animated Top Energy Beam */}
              <motion.div
                aria-hidden
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-[#F97316] to-transparent"
              />

              {/* Top Row + Theme Toggle (White / Dark) + Animated 3D Logo */}
              <div className="flex items-center justify-between gap-2">
                {user ? (
                  <button
                    type="button"
                    onClick={() => {
                      window.sessionStorage.setItem('qs_login_verified_this_tab', '1');
                      router.push('/');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF1E8] dark:bg-orange-500/25 border border-orange-300 dark:border-orange-400/40 text-xs font-extrabold text-[#EA580C] dark:text-orange-200 hover:bg-orange-100 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Enter Dashboard ({user.email?.split('@')[0] || user.phone || 'Active'})
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFF1E8] dark:bg-orange-500/20 border border-orange-200 dark:border-orange-400/30 text-[#EA580C] dark:text-orange-300 text-[10px] font-extrabold uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" /> QuickServe 3D
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <ThemeToggle size="sm" />
                  <motion.div
                    animate={{ rotateY: [0, 22, -22, 0], y: [0, -3, 0] }}
                    transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex items-center gap-1.5"
                  >
                    <span className="icon-3d w-8 h-8 rounded-xl bg-gradient-to-br from-[#FB923C] via-[#F97316] to-[#C2410C] flex items-center justify-center">
                      <Zap className="w-4 h-4 fill-white text-white" />
                    </span>
                    <span className="font-black text-base text-[#171717] dark:text-white">
                      Quick<span className="text-[#F97316]">Serve</span>
                    </span>
                  </motion.div>
                </div>
              </div>

              {/* Animated Floating 3D Service Strip */}
              <div className="flex items-center justify-between gap-2 py-1" style={{ perspective: '700px' }}>
                {[
                  ['⚡', 'Electric'],
                  ['❄️', 'AC'],
                  ['🔧', 'Plumb'],
                  ['✨', 'Clean'],
                  ['🚗', 'Auto'],
                ].map(([emoji, lbl], i) => (
                  <motion.div
                    key={lbl}
                    animate={{
                      y: [0, i % 2 === 0 ? -5 : 4, 0],
                      rotateY: [0, i % 2 === 0 ? 15 : -15, 0],
                    }}
                    transition={{ duration: 3.4 + i * 0.25, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex-1 rounded-2xl bg-[#FFF7F2] dark:bg-white/10 border border-orange-200 dark:border-white/15 py-2 text-center shadow-[0_6px_14px_rgba(249,115,22,0.14),0_3px_0_rgba(249,115,22,0.35)]"
                  >
                    <span className="text-lg block leading-none">{emoji}</span>
                    <span className="text-[9px] font-extrabold text-[#EA580C] dark:text-orange-200 mt-1 block uppercase">{lbl}</span>
                  </motion.div>
                ))}
              </div>

              <div>
                <h2 className="text-3xl font-black text-[#171717] dark:text-white tracking-tight">
                  Welcome{' '}
                  <span className="bg-gradient-to-r from-[#F97316] to-[#EA580C] dark:from-[#FB923C] dark:to-[#FACC15] bg-clip-text text-transparent">
                    Back
                  </span>
                </h2>
                <p className="text-xs text-[#737373] dark:text-slate-300 mt-1">
                  Sign in with Mobile OTP, Email &amp; Password, or Google to enter your dashboard.
                </p>
              </div>

              {/* Account Type Role Pills */}
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['customer', 'Customer', User],
                    ['provider', 'Provider', Wrench],
                    ['company', 'Company', Building2],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setRole(key)}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                      role === key
                        ? 'border-[#F97316] bg-[#FFF1E8] text-[#EA580C] dark:bg-[#F97316]/25 dark:text-orange-200 shadow-[0_4px_14px_rgba(249,115,22,0.22)]'
                        : 'border-orange-100 bg-white/70 text-[#737373] hover:border-orange-300 dark:border-white/15 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>

              {/* Auth Method Tabs */}
              <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#FFF7F2] dark:bg-white/10 border border-orange-200 dark:border-white/15">
                <button
                  type="button"
                  onClick={() => {
                    setTab('otp');
                    setError('');
                  }}
                  className={`h-10 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                    tab === 'otp'
                      ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow-lg'
                      : 'text-[#737373] hover:text-[#171717] dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5" /> Mobile OTP
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('email');
                    setError('');
                  }}
                  className={`h-10 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                    tab === 'email'
                      ? 'bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white shadow-lg'
                      : 'text-[#737373] hover:text-[#171717] dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email &amp; Password
                </button>
              </div>

              {error && (
                <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-400/40 text-xs text-[#DC2626] dark:text-red-200 font-semibold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {info && (
                <div className="p-3.5 rounded-2xl bg-green-50 dark:bg-emerald-500/20 border border-green-200 dark:border-emerald-400/40 text-xs text-[#16A34A] dark:text-emerald-200 font-semibold">
                  {info}
                </div>
              )}

              <AnimatePresence mode="wait">
                {tab === 'otp' ? (
                  <motion.div
                    key="otp"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    {!otpSent ? (
                      <form onSubmit={handleSendOtp} className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-[#171717] dark:text-orange-200 mb-1.5">
                            Mobile Number (India)
                          </label>
                          <div className="flex">
                            <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-orange-200 dark:border-white/20 bg-[#FFF1E8] dark:bg-orange-500/20 text-sm font-black text-[#EA580C] dark:text-orange-300">
                              +91
                            </span>
                            <input
                              type="tel"
                              inputMode="numeric"
                              maxLength={10}
                              required
                              value={phone}
                              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                              placeholder="9876543210"
                              className="flex-1 h-12 px-3.5 rounded-r-xl border border-orange-200 dark:border-white/20 bg-white dark:bg-white/10 text-[#171717] dark:text-white placeholder:text-slate-400 text-sm font-semibold focus:border-[#F97316] outline-none"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="btn-3d-orange w-full h-12 rounded-xl text-white font-black text-sm disabled:opacity-60"
                        >
                          {loading ? 'Sending OTP...' : 'Continue with OTP'}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#737373] dark:text-slate-300">
                            Enter 6-digit OTP sent to <strong className="text-[#171717] dark:text-white">+91 {phone}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setOtpSent(false);
                              setOtp('');
                              setError('');
                            }}
                            className="font-bold text-[#EA580C] dark:text-orange-300 hover:underline"
                          >
                            Change Number
                          </button>
                        </div>

                        <div className="p-2 rounded-2xl bg-[#FFF7F2] dark:bg-white/90">
                          <OtpInput value={otp} onChange={setOtp} error={Boolean(error)} />
                        </div>

                        <button
                          type="submit"
                          disabled={loading || otp.length !== 6}
                          className="btn-3d-orange w-full h-12 rounded-xl text-white font-black text-sm disabled:opacity-60"
                        >
                          {loading ? 'Verifying...' : 'Verify & Login'}
                        </button>

                        <div className="text-center text-xs text-[#737373] dark:text-slate-300">
                          {timer > 0 ? (
                            <span>Resend OTP in {timer}s</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendOtp()}
                              className="font-bold text-[#EA580C] dark:text-orange-300 hover:underline"
                            >
                              Resend 6-digit OTP
                            </button>
                          )}
                        </div>
                      </form>
                    )}
                  </motion.div>
                ) : (
                  <motion.form
                    key="email"
                    onSubmit={handleEmailLogin}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-bold text-[#171717] dark:text-orange-200 mb-1.5">Email Address</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-12 px-3.5 rounded-xl border border-orange-200 dark:border-white/20 bg-white dark:bg-white/10 text-[#171717] dark:text-white placeholder:text-slate-400 text-sm focus:border-[#F97316] outline-none"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-[#171717] dark:text-orange-200">Password</label>
                        <button
                          type="button"
                          onClick={() => setForgotOpen((v) => !v)}
                          className="text-xs font-bold text-[#EA580C] dark:text-orange-300 hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full h-12 pl-3.5 pr-11 rounded-xl border border-orange-200 dark:border-white/20 bg-white dark:bg-white/10 text-[#171717] dark:text-white placeholder:text-slate-400 text-sm focus:border-[#F97316] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#171717] dark:text-slate-300 dark:hover:text-white"
                        >
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {forgotOpen && (
                      <div className="p-3 rounded-xl bg-[#FFF7F2] dark:bg-white/10 border border-orange-200 dark:border-orange-400/30 flex items-center justify-between gap-2 text-xs text-[#171717] dark:text-slate-200">
                        <span>Send reset email to {email || 'your email'}?</span>
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          className="px-3 py-1 rounded-lg bg-[#F97316] text-white font-bold"
                        >
                          Send Link
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-3d-orange w-full h-12 rounded-xl text-white font-black text-sm disabled:opacity-60"
                    >
                      {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-orange-200 dark:border-white/15" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-white dark:bg-[#0B1120] px-3 text-[#737373] dark:text-slate-300 font-bold rounded-full">Or continue with</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full h-11 rounded-xl border border-orange-200 dark:border-white/20 bg-white dark:bg-white/10 hover:bg-[#FFF7F2] dark:hover:bg-white/15 text-[#171717] dark:text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-colors"
              >
                <span className="font-black text-base text-[#F97316]">G</span> Continue with Google
              </button>

              <p className="text-center text-sm text-[#737373] dark:text-slate-300">
                New to QuickServe?{' '}
                <Link href="/signup" className="font-extrabold text-[#EA580C] dark:text-[#FB923C] hover:underline">
                  Create an account
                </Link>
              </p>

              <p className="text-center text-[11px] text-[#737373] dark:text-slate-400">
                By continuing, you agree to QuickServe&apos;s{' '}
                <Link href="/support#policies" className="underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/support#policies" className="underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </motion.div>
          </Tilt3DCard>
        </div>
      </div>
    </div>
  );
}
