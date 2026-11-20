'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Sparkles, Tag } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { STARTER_COUPONS } from '@/lib/catalog';

export default function OffersPage() {
  const [coupons, setCoupons] = useState<any[]>(STARTER_COUPONS);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/offers')
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.coupons?.length) setCoupons(j.data.coupons);
      })
      .catch(() => {});
  }, []);

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-950">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="rounded-3xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-orange-100">
              <Sparkles className="w-4 h-4" /> Exclusive QuickServe Deals
            </span>
            <h1 className="text-3xl sm:text-4xl font-black mt-1">Offers, Festival Discounts &amp; Referrals</h1>
            <p className="text-sm text-orange-100 mt-1">
              Copy any promo code below and apply it during checkout to save instantly.
            </p>
          </div>
          <Link
            href="/booking"
            className="px-6 h-12 rounded-2xl bg-white text-[#EA580C] font-black text-sm inline-flex items-center justify-center shrink-0"
          >
            Book &amp; Apply Coupon
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {coupons.map((c) => {
            const code = c.code;
            const minOrder = c.min_order_amount ?? c.minOrderAmount ?? 0;
            const type = c.coupon_type ?? c.couponType ?? 'general';
            return (
              <div
                key={code}
                className="rounded-3xl bg-[#FFF7F2] dark:bg-slate-900 border border-orange-200 dark:border-slate-800 p-6 flex flex-col justify-between gap-5"
              >
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF1E8] dark:bg-orange-500/15 text-[#EA580C] text-[10px] font-extrabold uppercase">
                    <Tag className="w-3 h-3" /> {String(type).replace('_', ' ')}
                  </span>
                  <h2 className="text-xl font-black">{c.title}</h2>
                  <p className="text-xs text-[#737373] leading-relaxed">{c.description}</p>
                  <p className="text-xs font-bold text-[#171717] dark:text-slate-300">
                    Minimum booking: ₹{minOrder}
                  </p>
                </div>

                <div className="pt-4 border-t border-orange-100 dark:border-slate-800 flex items-center justify-between gap-3">
                  <code className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-950 border border-dashed border-[#F97316] text-[#EA580C] font-black text-sm tracking-widest">
                    {code}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyCode(code)}
                    className="px-4 h-10 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                  >
                    {copied === code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied === code ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
}
