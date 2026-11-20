'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Banknote,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Smartphone,
  Tag,
  Trash2,
  Upload,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { useApp } from '@/components/providers/AppProvider';
import { CATALOG_CATEGORIES, STARTER_COUPONS } from '@/lib/catalog';
import { computeBill, toPaise } from '@/lib/pricing';

const DURATIONS = [1, 2, 3, 4];
const TIME_SLOTS = ['09:00', '10:30', '12:00', '14:00', '16:00', '18:00', '19:30'];

function BookingInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user, location, setLocationModalOpen } = useApp();

  const initialCat = sp.get('category') || 'electrician';
  const [catSlug, setCatSlug] = useState(
    CATALOG_CATEGORIES.some((c) => c.slug === initialCat) ? initialCat : 'electrician',
  );
  const currentCat = useMemo(
    () => CATALOG_CATEGORIES.find((c) => c.slug === catSlug) ?? CATALOG_CATEGORIES[0],
    [catSlug],
  );

  const [serviceSlug, setServiceSlug] = useState(sp.get('service') || currentCat.services[0].slug);
  useEffect(() => {
    if (!currentCat.services.some((s) => s.slug === serviceSlug)) {
      setServiceSlug(currentCat.services[0].slug);
    }
  }, [currentCat, serviceSlug]);

  const currentService = useMemo(
    () => currentCat.services.find((s) => s.slug === serviceSlug) ?? currentCat.services[0],
    [currentCat, serviceSlug],
  );

  // Verified providers from backend
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedOwnerKind, setSelectedOwnerKind] = useState<'provider' | 'company'>(
    (sp.get('ownerKind') as 'provider' | 'company') || 'provider',
  );
  const [selectedOwnerId, setSelectedOwnerId] = useState(sp.get('ownerId') || '');

  // Problem photos & issue
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');

  // Schedule & duration
  const [bookingMode, setBookingMode] = useState<'asap' | 'scheduled'>(sp.get('emergency') ? 'asap' : 'scheduled');
  const [date, setDate] = useState(() => new Date(Date.now() + 86400_000).toISOString().slice(0, 10));
  const [timeSlot, setTimeSlot] = useState('10:30');
  const [hours, setHours] = useState<number>(1);
  const [customHours, setCustomHours] = useState('');

  // Address
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [addressLine, setAddressLine] = useState('');
  const [addressCity, setAddressCity] = useState(location.city !== 'All India' ? location.city : '');
  const [addressState, setAddressState] = useState(location.state || '');
  const [addressPin, setAddressPin] = useState(location.pinCode || '');

  // Coupon & Payment
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash');

  // Quote & submission
  const [serverQuote, setServerQuote] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

  // Sync location modal updates into address defaults
  useEffect(() => {
    if (location.city && location.city !== 'All India' && !addressCity) setAddressCity(location.city);
    if (location.state && !addressState) setAddressState(location.state);
    if (location.pinCode && !addressPin) setAddressPin(location.pinCode);
  }, [location, addressCity, addressState, addressPin]);

  // Fetch nearby verified providers & saved addresses
  useEffect(() => {
    const q = new URLSearchParams({ category: catSlug });
    if (location.lat && location.lng) {
      q.set('lat', String(location.lat));
      q.set('lng', String(location.lng));
    }
    fetch(`/api/providers?${q.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        const list = j.data?.providers ?? [];
        setProviders(list);
        if (list.length && !selectedOwnerId) {
          setSelectedOwnerKind(list[0].ownerKind);
          setSelectedOwnerId(list[0].id);
        }
      })
      .catch(() => {});
  }, [catSlug, location, selectedOwnerId]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/addresses')
      .then((r) => r.json())
      .then((j) => setSavedAddresses(j.data?.addresses ?? []))
      .catch(() => {});
  }, [user]);

  const effectiveHours = customHours ? Math.min(12, Math.max(1, Number(customHours) || 1)) : hours;

  // Deterministic estimate using the exact shared pricing engine (server re-verifies on submit)
  const localEstimate = useMemo(() => {
    const rate = {
      firstHourPrice: currentService.firstHourPrice,
      additionalHourPrice: currentService.additionalHourPrice,
      visitingCharge: currentService.visitingCharge,
    };
    const c = appliedCoupon ? STARTER_COUPONS.find((x) => x.code === appliedCoupon) : null;
    const baseAndVisit =
      rate.firstHourPrice + Math.max(0, effectiveHours - 1) * rate.additionalHourPrice + rate.visitingCharge;
    let discount = 0;
    if (c && baseAndVisit >= c.minOrderAmount) {
      discount =
        c.discountType === 'percentage'
          ? Math.min((baseAndVisit * c.discountValue) / 100, c.maxDiscountAmount ?? Infinity)
          : c.discountValue;
    }
    return computeBill({ hours: effectiveHours, rate, taxPercent: 18, discountPaise: toPaise(discount) });
  }, [currentService, effectiveHours, appliedCoupon]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError('');
    setUploadingPhoto(true);
    try {
      for (const file of files.slice(0, 6 - localPreviews.length)) {
        const preview = URL.createObjectURL(file);
        setLocalPreviews((p) => [...p, preview]);

        if (user) {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('bucket', 'booking-photos');
          const res = await fetch('/api/uploads', { method: 'POST', body: fd });
          const json = await res.json();
          if (res.ok && json.data?.url) {
            setPhotoUrls((u) => [...u, json.data.url]);
          }
        }
      }
    } catch {
      setError('Could not upload photo. You can still submit your booking description.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const applyCoupon = (codeToApply?: string) => {
    const code = (codeToApply ?? couponCode).trim().toUpperCase();
    setCouponMsg('');
    if (!code) return;
    const found = STARTER_COUPONS.find((c) => c.code === code);
    if (!found) {
      setAppliedCoupon(null);
      setCouponMsg('Coupon code not found in active offers.');
      return;
    }
    const subtotal =
      currentService.firstHourPrice +
      Math.max(0, effectiveHours - 1) * currentService.additionalHourPrice +
      currentService.visitingCharge;
    if (subtotal < found.minOrderAmount) {
      setAppliedCoupon(null);
      setCouponMsg(`Minimum booking amount ₹${found.minOrderAmount} required for ${found.code}.`);
      return;
    }
    setCouponCode(found.code);
    setAppliedCoupon(found.code);
    setCouponMsg(`${found.code} applied!`);
  };

  const handleBookService = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      router.push(`/login?next=${encodeURIComponent('/booking')}`);
      return;
    }
    if (!selectedOwnerId) {
      setError(
        'Select a verified nearby professional or company first. (Admins verify registered providers in /admin.)',
      );
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(addressPin)) {
      setError('Enter a valid 6-digit Indian PIN code.');
      return;
    }

    setSubmitting(true);
    try {
      const scheduledStart =
        bookingMode === 'scheduled' ? new Date(`${date}T${timeSlot}:00+05:30`).toISOString() : undefined;

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: currentService.id,
          ownerKind: selectedOwnerKind,
          ownerId: selectedOwnerId,
          mode: bookingMode,
          scheduledStart,
          hours: effectiveHours,
          lat: location.lat ?? 12.9716,
          lng: location.lng ?? 77.5946,
          couponCode: appliedCoupon || undefined,
          addressLine,
          addressCity,
          addressState: addressState || undefined,
          addressPin,
          issueDescription: issueDescription.trim() || undefined,
          photoUrls,
          paymentMethod,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Booking could not be placed.');
      setConfirmedBooking(json.data);
      setServerQuote(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Booking failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {confirmedBooking ? (
          <div className="max-w-xl mx-auto rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border-2 border-[#16A34A] p-8 text-center space-y-5 shadow-xl">
            <CheckCircle2 className="w-16 h-16 text-[#16A34A] mx-auto" />
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#16A34A]">Booking Confirmed</p>
              <h1 className="text-3xl font-black mt-1">{confirmedBooking.booking_code}</h1>
              <p className="text-sm text-[#737373] mt-1">
                Estimated total: <strong>₹{Number(confirmedBooking.estimated_total).toFixed(2)}</strong> ·{' '}
                {confirmedBooking.estimated_hours} hr(s) · {String(confirmedBooking.payment_method).toUpperCase()}
              </p>
            </div>
            {confirmedBooking.eta_latest_at && (
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-950 border border-orange-200 text-xs font-bold text-[#EA580C]">
                ⏱️ Expected Arrival:{' '}
                {new Date(confirmedBooking.eta_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })} · Max
                Promised:{' '}
                {new Date(confirmedBooking.eta_latest_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
              </div>
            )}
            <div className="flex flex-wrap gap-3 justify-center pt-2">
              <Link
                href={`/tracking/${confirmedBooking.id}`}
                className="px-6 h-12 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-extrabold text-sm inline-flex items-center"
              >
                Track Live Arrival
              </Link>
              <Link
                href="/orders"
                className="px-6 h-12 rounded-2xl border border-orange-200 font-bold text-sm inline-flex items-center"
              >
                View Your Orders
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleBookService} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Booking Form */}
            <div className="lg:col-span-8 space-y-6">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#F97316]">
                  Transparent Hourly Booking
                </span>
                <h1 className="text-3xl font-black mt-1">Book Your Local Service</h1>
              </div>

              {error && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-[#DC2626] font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Step 1 & 2: Category & Specific Service */}
              <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
                <h2 className="font-black text-lg">1. Select Category &amp; Service</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5">Service Category</label>
                    <select
                      value={catSlug}
                      onChange={(e) => setCatSlug(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold"
                    >
                      {CATALOG_CATEGORIES.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.emoji} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5">Specific Service</label>
                    <select
                      value={serviceSlug}
                      onChange={(e) => setServiceSlug(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold"
                    >
                      {currentCat.services.map((s) => (
                        <option key={s.slug} value={s.slug}>
                          {s.name} (₹{s.firstHourPrice}/1st hr)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step 3-5: Choose Verified Provider */}
                <div className="pt-2 space-y-2">
                  <label className="block text-xs font-bold">Select Verified Provider / Company</label>
                  {providers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {providers.map((p) => {
                        const active = selectedOwnerId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedOwnerKind(p.ownerKind);
                              setSelectedOwnerId(p.id);
                            }}
                            className={`p-3.5 rounded-2xl border text-left transition-all ${
                              active
                                ? 'border-[#F97316] bg-white dark:bg-slate-950 ring-2 ring-[#F97316]/30'
                                : 'border-orange-100 dark:border-slate-800 bg-white/70 dark:bg-slate-950/60'
                            }`}
                          >
                            <p className="font-extrabold text-sm">{p.name}</p>
                            <p className="text-xs text-[#737373]">
                              {p.avgRating.toFixed(1)}★ · {p.totalJobs} jobs · ₹{p.firstHourPrice}/hr
                              {p.distanceKm != null ? ` · ${p.distanceKm} km` : ''}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-950 border border-dashed border-orange-200 dark:border-slate-700 text-xs text-[#737373]">
                      No verified providers loaded for {currentCat.name} in {location.city} yet. Connect Supabase &amp;
                      approve a provider in <Link href="/admin" className="text-[#EA580C] font-bold underline">/admin</Link> to book live jobs.
                    </div>
                  )}
                </div>
              </div>

              {/* Step 6 & 7: Upload Problem Photos & Issue Description */}
              <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
                <h2 className="font-black text-lg flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#F97316]" /> 2. Upload Problem Photos &amp; Issue Details
                </h2>

                <label className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-orange-300 dark:border-slate-700 bg-white dark:bg-slate-950 cursor-pointer hover:border-[#F97316] transition-colors">
                  <Upload className="w-7 h-7 text-[#F97316] mb-2" />
                  <p className="text-sm font-bold">
                    {uploadingPhoto ? 'Uploading photos...' : 'Click to upload photos of the problem (up to 6)'}
                  </p>
                  <p className="text-xs text-[#737373] mt-0.5">JPG, PNG, or WEBP · Max 5 MB each</p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>

                {localPreviews.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                    {localPreviews.map((src, i) => (
                      <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-orange-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Issue ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setLocalPreviews((p) => p.filter((_, idx) => idx !== i));
                            setPhotoUrls((u) => u.filter((_, idx) => idx !== i));
                          }}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold mb-1.5">Describe the Issue</label>
                  <textarea
                    rows={3}
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="e.g. Ceiling fan regulator sparks on speed 3, living room MCB tripped twice..."
                    className="w-full p-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
              </div>

              {/* Step 8, 9, 10: Date, Time & Booked Hours */}
              <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
                <h2 className="font-black text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#F97316]" /> 3. Arrival Timing &amp; Booked Duration (Hours)
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBookingMode('asap')}
                    className={`p-3.5 rounded-2xl border text-left ${
                      bookingMode === 'asap'
                        ? 'border-[#F97316] bg-white dark:bg-slate-950 ring-2 ring-[#F97316]/30'
                        : 'border-orange-100 dark:border-slate-800'
                    }`}
                  >
                    <p className="font-extrabold text-sm">⚡ Express ASAP (Zepto-Style ETA)</p>
                    <p className="text-[11px] text-[#737373]">Calculated live from distance &amp; traffic</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingMode('scheduled')}
                    className={`p-3.5 rounded-2xl border text-left ${
                      bookingMode === 'scheduled'
                        ? 'border-[#F97316] bg-white dark:bg-slate-950 ring-2 ring-[#F97316]/30'
                        : 'border-orange-100 dark:border-slate-800'
                    }`}
                  >
                    <p className="font-extrabold text-sm">📅 Schedule Date &amp; Time</p>
                    <p className="text-[11px] text-[#737373]">Pick your exact arrival slot</p>
                  </button>
                </div>

                {bookingMode === 'scheduled' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold mb-1.5">Booking Date</label>
                      <input
                        type="date"
                        value={date}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full h-11 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1.5">Preferred Time Slot</label>
                      <div className="flex flex-wrap gap-1.5">
                        {TIME_SLOTS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTimeSlot(t)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border ${
                              timeSlot === t
                                ? 'bg-[#F97316] border-[#F97316] text-white'
                                : 'bg-white dark:bg-slate-950 border-orange-200 dark:border-slate-700'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold mb-2">How many hours do you want to book?</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {DURATIONS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          setHours(h);
                          setCustomHours('');
                        }}
                        className={`px-4 h-10 rounded-xl text-xs font-extrabold border ${
                          !customHours && hours === h
                            ? 'bg-[#F97316] border-[#F97316] text-white'
                            : 'bg-white dark:bg-slate-950 border-orange-200 dark:border-slate-700'
                        }`}
                      >
                        {h} {h === 1 ? 'Hour' : 'Hours'}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={12}
                      step={0.5}
                      value={customHours}
                      onChange={(e) => setCustomHours(e.target.value)}
                      placeholder="Custom hrs (up to 12)"
                      className="h-10 w-44 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-bold"
                    />
                  </div>
                  <p className="text-[11px] text-[#737373] mt-1.5">
                    Start &amp; End OTPs measure exact working duration. Any extra hours mid-job require your explicit
                    approval.
                  </p>
                </div>
              </div>

              {/* Step 11: Service Address */}
              <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-[#F97316]" /> 4. Service Address
                  </h2>
                  <button
                    type="button"
                    onClick={() => setLocationModalOpen(true)}
                    className="text-xs font-extrabold text-[#EA580C] hover:underline"
                  >
                    Detect via GPS / PIN
                  </button>
                </div>

                {savedAddresses.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setAddressLine(addr.line1);
                          setAddressCity(addr.city);
                          setAddressState(addr.state);
                          setAddressPin(addr.pin_code);
                        }}
                        className="px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-orange-200 text-xs font-bold hover:border-[#F97316]"
                      >
                        {addr.label}: {addr.line1.slice(0, 26)}...
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold mb-1.5">Flat / House No., Street &amp; Landmark *</label>
                    <input
                      type="text"
                      required
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="e.g. Flat 402, Sai Residency, 5th Cross, Koramangala"
                      className="w-full h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5">City *</label>
                    <input
                      type="text"
                      required
                      value={addressCity}
                      onChange={(e) => setAddressCity(e.target.value)}
                      placeholder="Bengaluru / Hyderabad / Mumbai..."
                      className="w-full h-11 px-3.5 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold mb-1.5">State</label>
                      <input
                        type="text"
                        value={addressState}
                        onChange={(e) => setAddressState(e.target.value)}
                        placeholder="State"
                        className="w-full h-11 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1.5">PIN Code *</label>
                      <input
                        type="text"
                        required
                        maxLength={6}
                        inputMode="numeric"
                        value={addressPin}
                        onChange={(e) => setAddressPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="560034"
                        className="w-full h-11 px-3 rounded-xl border border-orange-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 14: Payment Method */}
              <div className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-100 dark:border-slate-800 p-6 space-y-4">
                <h2 className="font-black text-lg">5. Payment Method</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-4 rounded-2xl border text-left flex items-center gap-3 ${
                      paymentMethod === 'cash'
                        ? 'border-[#F97316] bg-white dark:bg-slate-950 ring-2 ring-[#F97316]/30'
                        : 'border-orange-100 dark:border-slate-800'
                    }`}
                  >
                    <Banknote className="w-6 h-6 text-[#16A34A]" />
                    <div>
                      <p className="font-extrabold text-sm">Cash on Delivery</p>
                      <p className="text-[11px] text-[#737373]">Pay after service completion &amp; final invoice</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('upi')}
                    className={`p-4 rounded-2xl border text-left flex items-center gap-3 ${
                      paymentMethod === 'upi'
                        ? 'border-[#F97316] bg-white dark:bg-slate-950 ring-2 ring-[#F97316]/30'
                        : 'border-orange-100 dark:border-slate-800'
                    }`}
                  >
                    <Smartphone className="w-6 h-6 text-[#F97316]" />
                    <div>
                      <p className="font-extrabold text-sm">UPI (Razorpay)</p>
                      <p className="text-[11px] text-[#737373]">GPay, PhonePe, Paytm with server verification</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Sticky Price Summary & BOOK MY SERVICE */}
            <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
              <div className="rounded-3xl bg-white dark:bg-slate-900 border-2 border-orange-200 dark:border-slate-800 p-6 shadow-xl space-y-5">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#F97316]">
                    Estimated Charges
                  </span>
                  <h3 className="font-black text-xl mt-0.5">{currentService.name}</h3>
                  <p className="text-xs text-[#737373]">
                    {effectiveHours} hr(s) booked · {bookingMode === 'asap' ? 'Express ASAP' : `${date} at ${timeSlot}`}
                  </p>
                </div>

                {/* Coupon */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Coupon code (e.g. WELCOME50)"
                      className="flex-1 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#FFF7F2] dark:bg-slate-950 text-xs font-bold uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => applyCoupon()}
                      className="px-4 h-10 rounded-xl bg-[#0F172A] text-white text-xs font-extrabold"
                    >
                      Apply
                    </button>
                  </div>
                  {couponMsg && (
                    <p className={`text-xs font-bold ${appliedCoupon ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                      {couponMsg}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {STARTER_COUPONS.slice(0, 3).map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => applyCoupon(c.code)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFF1E8] dark:bg-orange-500/15 text-[#EA580C] text-[10px] font-extrabold"
                      >
                        <Tag className="w-3 h-3" /> {c.code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-2 text-sm border-t border-orange-100 dark:border-slate-800 pt-4">
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Labor ({effectiveHours} hr)</span>
                    <span className="font-bold">₹{localEstimate.labor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#737373]">Visiting charge</span>
                    <span className="font-bold">₹{localEstimate.visiting.toFixed(2)}</span>
                  </div>
                  {localEstimate.discount > 0 && (
                    <div className="flex justify-between text-[#16A34A]">
                      <span>Discount ({appliedCoupon})</span>
                      <span className="font-bold">-₹{localEstimate.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[#737373]">GST ({localEstimate.taxPercent}%)</span>
                    <span className="font-bold">₹{localEstimate.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-orange-200 dark:border-slate-700 text-lg font-black">
                    <span>Estimated Total</span>
                    <span className="text-[#EA580C]">₹{localEstimate.total.toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-[#737373] leading-relaxed">
                  Final bill is auto-calculated from actual OTP-verified work duration, approved extra hours, and any
                  spare parts.
                </p>

                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-3d-orange w-full h-14 rounded-2xl text-white font-black text-base tracking-wide disabled:opacity-60"
                >
                  {submitting ? 'CONFIRMING...' : user ? 'BOOK MY SERVICE' : 'SIGN IN TO BOOK MY SERVICE'}
                </button>

                <div className="flex items-center justify-center gap-2 text-[11px] text-[#737373] font-semibold">
                  <ShieldCheck className="w-4 h-4 text-[#16A34A]" /> Start &amp; End OTP Protected · No Hidden Fees
                </div>
              </div>
              {serverQuote && <div className="text-xs text-[#737373]">{JSON.stringify(serverQuote)}</div>}
            </aside>
          </form>
        )}
      </main>
      <Footer />
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm">Loading booking...</div>}>
      <BookingInner />
    </Suspense>
  );
}
