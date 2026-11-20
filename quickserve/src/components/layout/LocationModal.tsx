'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import { useApp } from '@/components/providers/AppProvider';
import { INDIA_CITIES } from '@/lib/catalog';

export function LocationModal() {
  const { locationModalOpen, setLocationModalOpen, location, setLocation, detectGpsLocation, detectingGps, locationNotice } = useApp();
  const [query, setQuery] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState('');

  const filteredCities = INDIA_CITIES.filter(
    (c) =>
      c.city.toLowerCase().includes(query.toLowerCase()) ||
      c.state.toLowerCase().includes(query.toLowerCase()) ||
      c.areas.some((a) => a.toLowerCase().includes(query.toLowerCase())),
  );

  const lookupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (!/^[1-9][0-9]{5}$/.test(pinInput.trim())) {
      setPinError('Enter a valid 6-digit Indian PIN code.');
      return;
    }
    setPinLoading(true);
    try {
      const res = await fetch(`/api/location/geocode?pin=${encodeURIComponent(pinInput.trim())}`);
      const json = await res.json();
      const d = json?.data;
      setLocation({
        label: `${d?.city || 'India'} (${pinInput.trim()})`,
        city: d?.city || 'India',
        state: d?.state || 'India',
        pinCode: pinInput.trim(),
        lat: d?.lat ?? null,
        lng: d?.lng ?? null,
        source: 'pin',
      });
      setLocationModalOpen(false);
    } catch {
      setPinError('Could not look up PIN code. Try selecting a city below.');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLocationModalOpen(false)}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="bg-gradient-to-r from-[#F97316] to-[#EA580C] p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MapPin className="w-5 h-5" />
                <div>
                  <h3 className="font-extrabold text-lg leading-tight">Select Service Location</h3>
                  <p className="text-xs text-orange-100">All India coverage — find nearby verified professionals</p>
                </div>
              </div>
              <button
                onClick={() => setLocationModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
                aria-label="Close location modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* GPS Button */}
              <button
                type="button"
                onClick={async () => {
                  const ok = await detectGpsLocation();
                  if (ok) setTimeout(() => setLocationModalOpen(false), 900);
                }}
                disabled={detectingGps}
                className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#FFF1E8] dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 text-left hover:border-[#F97316] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-[#F97316] text-white flex items-center justify-center">
                    {detectingGps ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crosshair className="w-5 h-5" />}
                  </span>
                  <div>
                    <p className="font-bold text-sm text-[#171717] dark:text-white">
                      {detectingGps ? 'Detecting Live Location...' : 'Use Current Live Location'}
                    </p>
                    <p className="text-xs text-[#737373] dark:text-slate-400">
                      {location.source === 'gps' ? `Active: ${location.label}` : 'Detects GPS coordinates or network city automatically'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#EA580C]">{detectingGps ? '...' : 'Detect'}</span>
              </button>

              {locationNotice && (
                <p className="text-xs font-semibold text-[#16A34A] dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl px-3 py-2">
                  {locationNotice}
                </p>
              )}

              {/* Search by 6-digit Indian PIN code */}
              <form onSubmit={lookupPin} className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#737373]">Search by PIN Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 560034, 500081, 400050"
                    className="flex-1 h-11 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:border-[#F97316] outline-none"
                  />
                  <button
                    type="submit"
                    disabled={pinLoading}
                    className="px-4 h-11 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-sm transition-colors disabled:opacity-60"
                  >
                    {pinLoading ? '...' : 'Apply PIN'}
                  </button>
                </div>
                {pinError && <p className="text-xs text-[#DC2626] font-medium">{pinError}</p>}
              </form>

              {/* Search by City / Area */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search Indian city or neighbourhood..."
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:border-[#F97316] outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {filteredCities.map((c) => (
                    <button
                      key={c.city}
                      type="button"
                      onClick={() => {
                        setLocation({
                          label: `${c.city}, ${c.state}`,
                          city: c.city,
                          state: c.state,
                          pinCode: c.samplePin,
                          lat: c.lat,
                          lng: c.lng,
                          source: 'manual',
                        });
                        setLocationModalOpen(false);
                      }}
                      className="p-3 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-[#F97316] hover:bg-[#FFF7F2] dark:hover:bg-orange-500/10 text-left transition-all"
                    >
                      <p className="font-bold text-sm text-[#171717] dark:text-white">{c.city}</p>
                      <p className="text-xs text-[#737373] dark:text-slate-400 truncate">{c.areas.slice(0, 2).join(', ')}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
