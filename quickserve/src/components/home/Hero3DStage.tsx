'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, Clock, MapPin, ShieldCheck, Sparkles, Zap } from 'lucide-react';

const FLOATING_BADGES = [
  { emoji: '⚡', label: 'Electrician', price: '₹199/hr', pos: '-top-6 -left-4 sm:-left-7', delay: 0, z: 75 },
  { emoji: '❄️', label: 'AC Repair', price: '₹349/hr', pos: '-top-5 -right-3 sm:-right-6', delay: 0.6, z: 68 },
  { emoji: '🔧', label: 'Plumbing', price: '₹199/hr', pos: 'bottom-14 -left-4 sm:-left-8', delay: 1.1, z: 62 },
  { emoji: '✨', label: 'Deep Clean', price: '₹499/hr', pos: '-bottom-5 right-4 sm:right-6', delay: 1.6, z: 72 },
];

/**
 * Interactive 3D Floating Stage for the QuickServe Hero section.
 * Uses true CSS 3D preserve-3d depth layers (translateZ) + Framer Motion cursor tracking.
 */
export function Hero3DStage() {
  const stageRef = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(my, [0, 1], [12, -12]), { stiffness: 180, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [0, 1], [-14, 14]), { stiffness: 180, damping: 20 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };

  const onLeave = () => {
    mx.set(0.5);
    my.set(0.5);
  };

  return (
    <div
      ref={stageRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ perspective: '1200px' }}
      className="relative py-6 px-2 sm:px-6 select-none"
    >
      {/* Ambient 3D neon orange backplate glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-[#F97316]/35 via-[#FB923C]/15 to-[#FACC15]/25 blur-3xl opacity-80"
      />

      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className="relative"
      >
        {/* Depth Shadow Slab (true 3D card thickness behind main card) */}
        <div
          aria-hidden
          style={{ transform: 'translateZ(-24px) translateY(14px)' }}
          className="absolute inset-2 rounded-[2rem] bg-gradient-to-br from-[#EA580C]/50 to-[#020617]/90 border border-orange-500/30 blur-[1px]"
        />

        {/* Main 3D Glassmorphic Command Card */}
        <div
          style={{ transform: 'translateZ(20px)', transformStyle: 'preserve-3d' }}
          className="relative rounded-[2rem] bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-[#1E293B]/95 backdrop-blur-xl border border-white/20 p-6 sm:p-7 space-y-5 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.25)]"
        >
          {/* Floating Header Row */}
          <div style={{ transform: 'translateZ(35px)' }} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-orange-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F97316]" /> 3D Live Dispatch View
              </p>
              <h3 className="font-black text-xl sm:text-2xl text-white mt-0.5">Book it. Track it. Done.</h3>
            </div>
            {/* 3D Glossy Isometric Badge */}
            <motion.div
              animate={{ rotateY: [0, 18, -18, 0], y: [0, -4, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-13 h-13 p-3 rounded-2xl bg-gradient-to-br from-[#FB923C] via-[#F97316] to-[#C2410C] flex items-center justify-center shadow-[0_10px_24px_rgba(249,115,22,0.55),inset_0_2px_2px_rgba(255,255,255,0.45)] border border-orange-300/40"
            >
              <Zap className="w-6 h-6 fill-white text-white" />
            </motion.div>
          </div>

          {/* 3D Layered Timeline Items */}
          <div style={{ transform: 'translateZ(28px)' }} className="space-y-2.5">
            {[
              ['Booking Confirmed', 'Instant ID & locked hourly rate card', '7:00 PM', Clock],
              ['Verified Pro Assigned', 'Individual specialist or registered company', '7:02 PM', ShieldCheck],
              ['Live GPS Map Tracking', 'Real-time route & max promised arrival', '7:05 PM', MapPin],
              ['Start & End Service OTP', 'Exact duration billing + Copy Bill PDF', '7:20 PM', Zap],
            ].map(([title, desc, time, Icon]: any, idx) => (
              <motion.div
                key={title}
                whileHover={{ x: 6, scale: 1.015 }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 transition-colors shadow-[0_6px_16px_rgba(0,0,0,0.22)]"
              >
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(249,115,22,0.45)]">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-white leading-tight">{title}</p>
                  <p className="text-[11px] text-slate-300 truncate">{desc}</p>
                </div>
                <span className="text-[11px] font-extrabold text-orange-300 px-2 py-0.5 rounded-lg bg-orange-500/15 shrink-0">
                  {idx === 2 ? 'LIVE' : time}
                </span>
              </motion.div>
            ))}
          </div>

          {/* 3D Action Button */}
          <div style={{ transform: 'translateZ(42px)' }}>
            <Link
              href="/tracking"
              className="btn-3d-orange w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 text-white"
            >
              Open Live 3D Tracking Console <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 4 Floating 3D Service Chips at elevated Z-depth */}
        {FLOATING_BADGES.map((b) => (
          <motion.div
            key={b.label}
            style={{ transform: `translateZ(${b.z}px)` }}
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3.6, delay: b.delay, repeat: Infinity, ease: 'easeInOut' }}
            className={`hidden sm:flex absolute ${b.pos} items-center gap-2 px-3 py-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 text-[#171717] dark:text-white border border-orange-200 dark:border-orange-500/40 shadow-[0_14px_30px_-6px_rgba(0,0,0,0.45),0_4px_0_rgba(249,115,22,0.85)] backdrop-blur-md`}
          >
            <span className="text-lg leading-none">{b.emoji}</span>
            <div className="leading-tight">
              <p className="text-[11px] font-black">{b.label}</p>
              <p className="text-[10px] font-extrabold text-[#EA580C]">{b.price}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
