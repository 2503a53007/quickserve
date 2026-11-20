'use client';

import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

const SPARKS = [
  { left: '8%', size: 6, duration: 7.5, delay: 0 },
  { left: '16%', size: 10, duration: 9.2, delay: 1.1 },
  { left: '25%', size: 5, duration: 6.8, delay: 2.3 },
  { left: '34%', size: 8, duration: 8.4, delay: 0.7 },
  { left: '46%', size: 6, duration: 7.9, delay: 1.8 },
  { left: '58%', size: 11, duration: 9.8, delay: 0.4 },
  { left: '67%', size: 5, duration: 6.4, delay: 2.9 },
  { left: '76%', size: 9, duration: 8.7, delay: 1.4 },
  { left: '85%', size: 7, duration: 7.2, delay: 2.1 },
  { left: '93%', size: 6, duration: 8.1, delay: 0.9 },
];

const FLOATING_3D_SHAPES = [
  { emoji: '⚡', top: '10%', left: '7%', size: 'w-14 h-14', dur: 6.2, delay: 0 },
  { emoji: '❄️', top: '16%', right: '8%', size: 'w-14 h-14', dur: 7.1, delay: 0.8 },
  { emoji: '🔧', bottom: '18%', left: '6%', size: 'w-12 h-12', dur: 6.8, delay: 1.4 },
  { emoji: '✨', bottom: '12%', right: '7%', size: 'w-14 h-14', dur: 5.9, delay: 0.5 },
  { emoji: '🏠', top: '48%', right: '4%', size: 'w-12 h-12', dur: 7.5, delay: 1.9 },
];

/**
 * Anime-inspired 3D Motion Background for QuickServe Auth pages:
 * - Animated sunset-orange & deep-indigo volumetric aurora orbs
 * - Infinite scrolling 3D perspective neon horizon grid
 * - Orbiting 3D energy rings + floating glossy 3D service cubes with cursor parallax
 * - Rising anime energy sparks
 */
export function Login3DBackground() {
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const shiftX = useSpring(useTransform(mouseX, [0, 1], [-18, 18]), { stiffness: 120, damping: 20 });
  const shiftY = useSpring(useTransform(mouseY, [0, 1], [-14, 14]), { stiffness: 120, damping: 20 });

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
      className="pointer-events-none fixed inset-0 overflow-hidden bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#431407]"
    >
      {/* Animated Anime Sunset-Orange & Violet Aurora Blobs */}
      <motion.div
        animate={{ scale: [1, 1.22, 1], x: [0, 45, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-28 -left-24 w-[460px] h-[460px] rounded-full bg-[#F97316]/45 blur-[110px]"
      />
      <motion.div
        animate={{ scale: [1.1, 0.92, 1.15, 1.1], x: [0, -50, 25, 0], y: [0, 40, -25, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/4 -right-28 w-[500px] h-[500px] rounded-full bg-[#FB923C]/35 blur-[120px]"
      />
      <motion.div
        animate={{ scale: [1, 1.25, 0.95, 1], x: [0, 30, -35, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -bottom-32 left-1/3 w-[480px] h-[480px] rounded-full bg-[#EA580C]/40 blur-[115px]"
      />

      {/* 3D Orbiting Energy Rings (Anime Portal Vibe) */}
      <motion.div
        style={{ x: shiftX, y: shiftY, perspective: '1000px' }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <motion.div
          animate={{ rotateZ: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          style={{ transform: 'rotateX(66deg)' }}
          className="w-[620px] h-[620px] rounded-full border-2 border-dashed border-orange-400/35 shadow-[0_0_60px_rgba(249,115,22,0.3)]"
        />
        <motion.div
          animate={{ rotateZ: -360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          style={{ transform: 'rotateX(70deg) rotateY(16deg)' }}
          className="absolute w-[440px] h-[440px] rounded-full border border-amber-300/40 shadow-[0_0_45px_rgba(251,146,60,0.35)]"
        />
      </motion.div>

      {/* Infinite Scrolling 3D Perspective Neon Horizon Grid */}
      <div
        className="absolute inset-x-0 bottom-0 h-[44vh] overflow-hidden opacity-45"
        style={{ perspective: '420px' }}
      >
        <motion.div
          animate={{ backgroundPositionY: ['0px', '48px'] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
          style={{
            transform: 'rotateX(64deg) scale(1.65)',
            transformOrigin: '50% 100%',
            backgroundImage:
              'linear-gradient(to right, rgba(249,115,22,0.45) 1px, transparent 1px), linear-gradient(to bottom, rgba(251,146,60,0.45) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
          className="w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-[#0F172A]/40 to-[#0F172A]" />
      </div>

      {/* Floating 3D Glossy Service Cubes with Mouse Parallax */}
      <motion.div style={{ x: shiftX, y: shiftY }} className="absolute inset-0">
        {FLOATING_3D_SHAPES.map((s) => (
          <motion.div
            key={s.emoji}
            style={{
              top: s.top,
              left: s.left,
              right: s.right,
              bottom: s.bottom,
              transformStyle: 'preserve-3d',
            }}
            animate={{
              y: [0, -18, 0],
              rotateX: [0, 18, -14, 0],
              rotateY: [0, 26, -22, 0],
              rotateZ: [0, 8, -8, 0],
            }}
            transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
            className={`absolute ${s.size} rounded-2xl bg-gradient-to-br from-white/25 via-orange-400/20 to-orange-600/30 backdrop-blur-md border border-white/30 flex items-center justify-center text-2xl shadow-[0_18px_36px_rgba(0,0,0,0.45),0_5px_0_rgba(249,115,22,0.55),inset_0_2px_3px_rgba(255,255,255,0.45)]`}
          >
            {s.emoji}
          </motion.div>
        ))}
      </motion.div>

      {/* Rising Anime Glowing Energy Sparks */}
      {SPARKS.map((sp, i) => (
        <motion.span
          key={i}
          style={{ left: sp.left, width: sp.size, height: sp.size }}
          initial={{ y: '105vh', opacity: 0 }}
          animate={{ y: '-10vh', opacity: [0, 0.95, 0.85, 0], scale: [0.6, 1.25, 0.7] }}
          transition={{ duration: sp.duration, delay: sp.delay, repeat: Infinity, ease: 'easeOut' }}
          className="absolute rounded-full bg-gradient-to-tr from-[#F97316] to-[#FEF08A] shadow-[0_0_16px_4px_rgba(249,115,22,0.75)]"
        />
      ))}
    </div>
  );
}
