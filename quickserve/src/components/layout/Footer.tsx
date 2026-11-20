'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, MapPin, Mail, ShieldCheck, Clock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#0F172A] text-slate-300 border-t-4 border-[#F97316]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Zap size={20} className="fill-white text-white" />
              </span>
              <div>
                <p className="font-black text-2xl text-white tracking-tight leading-none">
                  Quick<span className="text-[#F97316]">Serve</span>
                </p>
                <p className="text-xs text-orange-300 font-semibold mt-0.5">Your Services. Your Vibe.</p>
              </div>
            </Link>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Book it. Track it. Done. QuickServe connects households across India with verified individual
              professionals and registered service companies — with predictable arrival ETAs, OTP-verified service
              sessions, and transparent billing.
            </p>
            <div className="flex flex-wrap gap-3 pt-1 text-xs font-semibold text-slate-300">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <MapPin className="w-3.5 h-3.5 text-[#F97316]" /> All India
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A]" /> OTP Verified Jobs
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <Clock className="w-3.5 h-3.5 text-[#F97316]" /> 8 AM – 10 PM IST
              </span>
            </div>
          </div>

          {/* Popular Services */}
          <div>
            <h4 className="text-white font-extrabold text-sm uppercase tracking-wider mb-4">Top Services</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                ['Electrician', '/services/electrician'],
                ['Plumbing', '/services/plumbing'],
                ['AC Repair', '/services/ac-repair'],
                ['Home & Deep Cleaning', '/services/deep-cleaning'],
                ['Appliance Repair', '/services/appliance-repair'],
                ['Salon at Home', '/services/salon-at-home'],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-[#F97316] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Portals */}
          <div>
            <h4 className="text-white font-extrabold text-sm uppercase tracking-wider mb-4">Portals</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                ['Book a Service', '/booking'],
                ['Track Live Booking', '/tracking'],
                ['Individual Provider Portal', '/provider'],
                ['Register as Provider', '/provider/register'],
                ['Service Company Portal', '/company'],
                ['Register a Company', '/company/register'],
                ['Admin Control Panel', '/admin'],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-[#F97316] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support & Policies */}
          <div>
            <h4 className="text-white font-extrabold text-sm uppercase tracking-wider mb-4">Support & Legal</h4>
            <ul className="space-y-2.5 text-sm">
              {[
                ['Help & Support', '/support'],
                ['Offers & Coupons', '/offers'],
                ['Your Orders & Refunds', '/orders'],
                ['Your Wishlist', '/wishlist'],
                ['Cancellation Policy', '/support#cancellation'],
                ['Privacy & Terms', '/support#policies'],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-[#F97316] transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-400 flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#F97316]" />
              support@quickserve.in
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} QuickServe Marketplace India. All rights reserved.</p>
          <p>Orange &amp; White Gen-Z Edition · Cash on Delivery &amp; Razorpay UPI Supported</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
