'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, MapPin, Plus, Trash2, User } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useApp } from '@/components/providers/AppProvider';

export default function ProfilePage() {
  const { user, profile } = useApp();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [label, setLabel] = useState<'Home' | 'Office' | 'Other'>('Home');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    if (!user) return;
    fetch('/api/addresses')
      .then((r) => r.json())
      .then((j) => setAddresses(j.data?.addresses ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const addAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, line1, city, state, pin_code: pinCode, is_default: addresses.length === 0 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || 'Could not save address');
      setLine1('');
      setCity('');
      setState('');
      setPinCode('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const removeAddress = async (id: string) => {
    await fetch(`/api/addresses?id=${id}`, { method: 'DELETE' });
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="rounded-3xl bg-[#0F172A] text-white p-8 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center text-2xl font-black">
            <User className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl font-black">{profile?.full_name || 'Your QuickServe Profile'}</h1>
            <p className="text-xs text-slate-300 mt-1">
              {profile?.email || user?.email || 'Not signed in'} · {profile?.mobile || ''} · Role:{' '}
              <strong className="uppercase text-[#F97316]">{profile?.role || 'guest'}</strong>
            </p>
          </div>
        </div>

        {!user ? (
          <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 p-8 text-center space-y-3">
            <p className="font-bold">Sign in to manage your profile and saved Home / Office addresses.</p>
            <Link href="/login" className="inline-flex px-6 h-11 rounded-xl bg-[#F97316] text-white font-extrabold text-sm items-center">
              Sign In
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
              <h2 className="text-lg font-black flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#F97316]" /> Saved Home &amp; Office Addresses
              </h2>
              {addresses.length === 0 ? (
                <p className="text-xs text-[#737373]">No saved addresses yet.</p>
              ) : (
                addresses.map((a) => (
                  <div
                    key={a.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-orange-100 dark:border-slate-800 flex items-start justify-between gap-3"
                  >
                    <div>
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#EA580C]">
                        <Home className="w-3.5 h-3.5" /> {a.label}
                      </span>
                      <p className="text-sm font-semibold mt-1">{a.line1}</p>
                      <p className="text-xs text-[#737373]">
                        {a.city}, {a.state} — {a.pin_code}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAddress(a.id)}
                      className="text-[#DC2626] p-2 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={addAddress}
              className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4"
            >
              <h2 className="text-lg font-black flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#F97316]" /> Add New Address
              </h2>
              {error && <p className="text-xs text-[#DC2626] font-bold">{error}</p>}
              <div className="flex gap-2">
                {(['Home', 'Office', 'Other'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLabel(l)}
                    className={`px-4 h-9 rounded-xl text-xs font-bold border ${
                      label === l ? 'bg-[#F97316] border-[#F97316] text-white' : 'bg-white dark:bg-slate-950 border-orange-200'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <input
                type="text"
                required
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                placeholder="Flat / House No., Building, Street"
                className="w-full h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="h-11 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                <input
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="h-11 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="PIN Code"
                  className="h-11 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full h-11 rounded-xl bg-[#F97316] text-white font-extrabold text-sm"
              >
                {saving ? 'Saving...' : 'Save Address'}
              </button>
            </form>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
