'use client';

import React, { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Shared mutable scroll & pointer telemetry read directly inside Three.js useFrame
 * loops at 60–120fps without causing React re-renders.
 */
export const scrollStore = {
  scrollY: 0,
  progress: 0,
  velocity: 0,
  pointerX: 0,
  pointerY: 0,
};

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const updateNativeScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      scrollStore.scrollY = window.scrollY;
      scrollStore.progress = Math.min(1, Math.max(0, window.scrollY / maxScroll));
    };

    const onPointerMove = (e: MouseEvent) => {
      scrollStore.pointerX = (e.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      scrollStore.pointerY = -((e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1);
    };

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    updateNativeScroll();

    if (prefersReduced) {
      window.addEventListener('scroll', updateNativeScroll, { passive: true });
      return () => {
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('scroll', updateNativeScroll);
      };
    }

    const lenis = new Lenis({
      lerp: 0.085,
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.35,
    });

    lenis.on('scroll', (e: { scroll: number; limit: number; velocity: number; progress: number }) => {
      scrollStore.scrollY = e.scroll;
      scrollStore.progress = Number.isFinite(e.progress) ? Math.min(1, Math.max(0, e.progress)) : 0;
      scrollStore.velocity = e.velocity || 0;
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onPointerMove);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
