'use client';

import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

const SPARKS = [
  { left: '6%', size: 5, duration: 7.4, delay: 0 },
  { left: '15%', size: 8, duration: 9.1, delay: 1.0 },
  { left: '26%', size: 5, duration: 6.7, delay: 2.1 },
  { left: '38%', size: 7, duration: 8.3, delay: 0.6 },
  { left: '51%', size: 6, duration: 7.8, delay: 1.6 },
  { left: '63%', size: 9, duration: 9.5, delay: 0.3 },
  { left: '75%', size: 5, duration: 6.9, delay: 2.4 },
  { left: '87%', size: 8, duration: 8.6, delay: 1.2 },
  { left: '94%', size: 6, duration: 7.2, delay: 1.9 },
];

const FLOATING_TILES = [
  { emoji: '⚡', top: '14%', left: '3%', dur: 6.4, delay: 0 },
  { emoji: '❄️', top: '22%', right: '3%', dur: 7.2, delay: 0.8 },
  { emoji: '🔧', bottom: '18%', left: '4%', dur: 6.9, delay: 1.4 },
  { emoji: '✨', bottom: '14%', right: '4%', dur: 6.0, delay: 0.5 },
];

/**
 * 3D Motion Anime Background for QuickServe Dashboards (Customer, Provider, Company, Admin).
 * Renders volumetric sunset-orange & deep-indigo auroras, an infinite scrolling 3D horizon grid,
 * orbiting energy rings, floating glossy 3D tiles with mouse parallax, and rising sparks.
 */
export function Dashboard3DBackground({ fixed = true }: { fixed?: boolean }) {
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const shiftX = useSpring(useTransform(mouseX, [0, 1], [-14, 14]), { stiffness: 110, damping: 22 });
  const shiftY = useSpring(useTransform(mouseY, [0, 1], [-10, 10]), { stiffness: 110, damping: 22 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX / Math.max(window.innerWidth, 1));
      mouseY.set(e.clientY / Math.max(window.innerHeight, 1));
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, [mouseX, mouseY]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none ${fixed ? 'fixed inset-0 z-0' : 'absolute inset-0'} overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#431407]`}
    >
      {/* Volumetric Aurora Orbs */}
      <motion.div
        animate={{ scale: [1, 1.2, 1], x: [0, 40, -18, 0], y: [0, -25, 18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-24 -left-24 w-[440px] h-[440px] rounded-full bg-[#F97316]/35 blur-[110px]"
      />
      <motion.div
        animate={{ scale: [1.08, 0.94, 1.14, 1.08], x: [0, -45, 22, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/3 -right-24 w-[480px] h-[480px] rounded-full bg-[#FB923C]/30 blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1, 1.22, 0.96, 1], x: [0, 28, -32, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-28 left-1/3 w-[460px] h-[460px] rounded-full bg-[#EA580C]/35 blur-[115px]"
      />

      {/* Orbiting 3D Energy Rings */}
      <motion.div
        style={{ x: shiftX, y: shiftY, perspective: '1000px' }}
        className="absolute inset-0 flex items-center justify-center opacity-70"
      >
        <motion.div
          animate={{ rotateZ: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          style={{ transform: 'rotateX(68deg)' }}
          className="w-[680px] h-[680px] rounded-full border-2 border-dashed border-orange-400/30 shadow-[0_0_55px_rgba(249,115,22,0.25)]"
        />
        <motion.div
          animate={{ rotateZ: -360 }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
          style={{ transform: 'rotateX(70deg) rotateY(14deg)' }}
          className="absolute w-[460px] h-[460px] rounded-full border border-amber-300/35"
        />
      </motion.div>

      {/* Infinite Scrolling 3D Perspective Neon Grid */}
      <div
        className="absolute inset-x-0 bottom-0 h-[38vh] overflow-hidden opacity-40"
        style={{ perspective: '420px' }}
      >
        <motion.div
          animate={{ backgroundPositionY: ['0px', '48px'] }}
          transition={{ duration: 2.0, repeat: Infinity, ease: 'linear' }}
          style={{
            transform: 'rotateX(64deg) scale(1.65)',
            transformOrigin: '50% 100%',
            backgroundImage:
              'linear-gradient(to right, rgba(249,115,22,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(251,146,60,0.45) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          className="w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-[#0F172A]/45 to-[#0F172A]" />
      </div>

      {/* Floating 3D Service Cubes */}
      <motion.div style={{ x: shiftX, y: shiftY }} className="hidden xl:block absolute inset-0">
        {FLOATING_TILES.map((s) => (
          <motion.div
            key={s.emoji}
            style={{ top: s.top, left: s.left, right: s.right, bottom: s.bottom, transformStyle: 'preserve-3d' }}
            animate={{
              y: [0, -16, 0],
              rotateX: [0, 16, -12, 0],
              rotateY: [0, 24, -20, 0],
            }}
            transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-xl shadow-[0_14px_28px_rgba(0,0,0,0.4),0_4px_0_rgba(249,115,22,0.5)]"
          >
            {s.emoji}
          </motion.div>
        ))}
      </motion.div>

      {/* Rising Anime Glowing Sparks */}
      {SPARKS.map((sp, i) => (
        <motion.span
          key={i}
          style={{ left: sp.left, width: sp.size, height: sp.size }}
          initial={{ y: '105vh', opacity: 0 }}
          animate={{ y: '-10vh', opacity: [0, 0.9, 0.8, 0], scale: [0.6, 1.2, 0.7] }}
          transition={{ duration: sp.duration, delay: sp.delay, repeat: Infinity, ease: 'easeOut' }}
          className="absolute rounded-full bg-gradient-to-tr from-[#F97316] to-[#FEF08A] shadow-[0_0_14px_3px_rgba(249,115,22,0.7)]"
        />
      ))}
    </div>
  );
}
