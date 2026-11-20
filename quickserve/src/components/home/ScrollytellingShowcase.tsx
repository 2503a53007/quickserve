'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import * as THREE from 'three';
import { ArrowRight, Clock, FileText, KeyRound, MapPin, ShieldCheck, Sparkles as SparklesIcon, Zap } from 'lucide-react';
import { scrollStore } from '@/components/providers/SmoothScrollProvider';

interface Chapter {
  num: string;
  tag: string;
  title: string;
  highlight: string;
  desc: string;
  metric: string;
  ctaLabel: string;
  ctaHref: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CHAPTERS: Chapter[] = [
  {
    num: '01',
    tag: 'INSTANT HOURLY DISPATCH',
    title: 'Choose Any Service.',
    highlight: 'Lock Your Exact Rate.',
    desc: 'Browse 19 categories from Electricians to AC Repair, upload photos of the issue, pick your hours (1h–12h), and apply offers with zero hidden fees.',
    metric: '19 Categories · From ₹199/hr',
    ctaLabel: 'Book a Service Now',
    ctaHref: '/booking',
    accent: '#F97316',
    icon: Zap,
  },
  {
    num: '02',
    tag: 'ZEPTO-STYLE LIVE GPS ROUTE',
    title: 'Watch Them Arrive.',
    highlight: 'Down to the Minute.',
    desc: 'Predictable arrival windows backed by live OpenStreetMap & Google Maps GPS telemetry across All India — including Hanumakonda, Hyderabad, Bengaluru & Mumbai.',
    metric: 'Live Route · Max Arrival Guarantee',
    ctaLabel: 'Open Live Tracking',
    ctaHref: '/tracking',
    accent: '#0EA5E9',
    icon: MapPin,
  },
  {
    num: '03',
    tag: 'DUAL 6-DIGIT OTP VAULT',
    title: 'Start OTP. End OTP.',
    highlight: 'Zero Overbilling.',
    desc: 'Separate cryptographically verified Start and Completion OTPs lock your exact service timestamps — and extra hours mid-job always require your explicit approval.',
    metric: 'HMAC-Verified · Customer-Controlled',
    ctaLabel: 'Explore Verified Pros',
    ctaHref: '/services',
    accent: '#16A34A',
    icon: KeyRound,
  },
  {
    num: '04',
    tag: 'AUTO GST INVOICE & CASH / UPI',
    title: 'Instant Copy Bill.',
    highlight: 'Pay Your Way.',
    desc: 'The moment the End OTP is verified, QuickServe generates an itemized GST invoice with 1-click Copy Bill, PDF download, and Cash on Delivery or Razorpay UPI.',
    metric: 'PDF + Copy Bill · Cash or UPI',
    ctaLabel: 'View Your Orders',
    ctaHref: '/orders',
    accent: '#FACC15',
    icon: FileText,
  },
];

/**
 * Scroll-synchronized 3D Pinned Stage Scene (driven directly by sectionProgress 0..1).
 * Scrolling forward advances transformations; scrolling backward reverses smoothly.
 */
function PinnedStoryStage({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const rootRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const cageRef = useRef<THREE.Mesh>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const ringCRef = useRef<THREE.Mesh>(null);
  const shardRefs = useRef<Array<THREE.Mesh | null>>([]);
  const coreMatRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);

  const smoothP = useRef(0);

  const shardAngles = useMemo(
    () => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2),
    [],
  );

  const colors = useMemo(
    () => [
      new THREE.Color('#F97316'),
      new THREE.Color('#0EA5E9'),
      new THREE.Color('#16A34A'),
      new THREE.Color('#FACC15'),
    ],
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    smoothP.current = THREE.MathUtils.lerp(smoothP.current, progressRef.current, 0.1);
    const p = smoothP.current;
    const mx = scrollStore.pointerX;
    const my = scrollStore.pointerY;

    const scaled = p * 3;
    const idx = Math.min(2, Math.floor(scaled));
    const localT = scaled - idx;
    const activeColor = colors[idx].clone().lerp(colors[idx + 1], localT);

    if (coreMatRef.current) {
      coreMatRef.current.color.copy(activeColor);
      coreMatRef.current.emissive.copy(activeColor).multiplyScalar(0.35);
    }
    if (pointLightRef.current) {
      pointLightRef.current.color.copy(activeColor);
    }

    const angle = p * Math.PI * 1.1;
    const targetCamX = Math.sin(angle) * 2.1 + mx * 0.65;
    const targetCamY = Math.cos(p * Math.PI * 2) * 0.55 + my * 0.45;
    const targetCamZ = 6.2 - Math.sin(p * Math.PI) * 1.15;
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, targetCamX, 0.08);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, targetCamY, 0.08);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, targetCamZ, 0.08);
    state.camera.lookAt(0, 0, 0);

    if (rootRef.current) {
      rootRef.current.rotation.y = p * Math.PI * 4 + mx * 0.55;
      rootRef.current.rotation.x = Math.sin(p * Math.PI * 2) * 0.45 - my * 0.35;
    }

    if (coreRef.current) {
      coreRef.current.rotation.z += dt * 0.25;
      const coreScale = 0.85 + Math.sin(p * Math.PI * 3) * 0.18;
      coreRef.current.scale.setScalar(coreScale);
    }

    if (cageRef.current) {
      const gpsPeak = Math.exp(-Math.pow((p - 0.38) / 0.22, 2));
      const cageScale = 1.25 + gpsPeak * 0.65;
      cageRef.current.scale.setScalar(cageScale);
      cageRef.current.rotation.y = -p * Math.PI * 3;
      cageRef.current.rotation.z = p * Math.PI * 1.5;
    }

    const lockFactor = Math.exp(-Math.pow((p - 0.65) / 0.18, 2));
    if (ringARef.current) {
      ringARef.current.rotation.x = Math.PI * 0.5 * (1 - lockFactor * 0.7) + p * Math.PI * 2;
      ringARef.current.scale.setScalar(1.0 + (1 - lockFactor) * 0.22);
    }
    if (ringBRef.current) {
      ringBRef.current.rotation.y = Math.PI * 0.5 * (1 - lockFactor * 0.7) - p * Math.PI * 2.4;
      ringBRef.current.scale.setScalar(1.18 - lockFactor * 0.2);
    }
    if (ringCRef.current) {
      ringCRef.current.rotation.x = -Math.PI * 0.35 + p * Math.PI * 3;
      ringCRef.current.rotation.z = p * Math.PI * 1.8;
    }

    const burst = THREE.MathUtils.smoothstep(p, 0.55, 1.0);
    shardRefs.current.forEach((m, i) => {
      if (!m) return;
      const a = shardAngles[i] + p * Math.PI * 2.5;
      const radius = 1.75 + burst * 1.35 + Math.sin(p * Math.PI * 4 + i) * 0.18;
      m.position.x = Math.cos(a) * radius;
      m.position.y = Math.sin(a * 2) * (0.45 + burst * 0.85);
      m.position.z = Math.sin(a) * radius;
      m.rotation.x = p * Math.PI * 4 + i;
      m.rotation.y = p * Math.PI * 3;
      m.scale.setScalar(0.16 + burst * 0.14);
    });
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 6, 5]} intensity={2.2} color="#FFFFFF" />
      <pointLight ref={pointLightRef} position={[3, 2, 4]} intensity={35} distance={18} color="#F97316" />
      <pointLight position={[-4, -3, 3]} intensity={16} distance={16} color="#38BDF8" />

      <group ref={rootRef}>
        <Float speed={1.8} rotationIntensity={0.2} floatIntensity={0.35}>
          <mesh ref={coreRef}>
            <icosahedronGeometry args={[0.92, 1]} />
            <meshPhysicalMaterial
              ref={coreMatRef}
              color="#F97316"
              emissive="#EA580C"
              emissiveIntensity={0.35}
              metalness={0.5}
              roughness={0.12}
              clearcoat={1}
              clearcoatRoughness={0.06}
              iridescence={1}
              iridescenceIOR={1.4}
            />
          </mesh>

          <mesh ref={cageRef}>
            <icosahedronGeometry args={[1.15, 2]} />
            <meshBasicMaterial color="#FED7AA" wireframe transparent opacity={0.28} />
          </mesh>

          <mesh ref={ringARef}>
            <torusGeometry args={[1.62, 0.045, 20, 96]} />
            <meshStandardMaterial color="#FB923C" emissive="#F97316" emissiveIntensity={0.8} metalness={0.85} roughness={0.18} />
          </mesh>
          <mesh ref={ringBRef}>
            <torusGeometry args={[1.95, 0.032, 16, 96]} />
            <meshStandardMaterial color="#38BDF8" emissive="#0EA5E9" emissiveIntensity={0.55} metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh ref={ringCRef}>
            <torusGeometry args={[2.28, 0.025, 16, 96]} />
            <meshStandardMaterial color="#FEF08A" emissive="#FACC15" emissiveIntensity={0.6} metalness={0.9} roughness={0.15} />
          </mesh>

          {shardAngles.map((_, i) => (
            <mesh
              key={i}
              ref={(el) => {
                shardRefs.current[i] = el;
              }}
            >
              <octahedronGeometry args={[1, 0]} />
              <meshPhysicalMaterial
                color={i % 2 === 0 ? '#FB923C' : '#FEF08A'}
                emissive={i % 2 === 0 ? '#EA580C' : '#F59E0B'}
                emissiveIntensity={0.45}
                metalness={0.65}
                roughness={0.1}
                clearcoat={1}
              />
            </mesh>
          ))}
        </Float>
      </group>

      <Sparkles count={90} scale={[8, 6, 6]} size={3} speed={0.4} opacity={0.75} color="#FB923C" />
    </>
  );
}

export function ScrollytellingShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let rafId = 0;
    let lastIdx = -1;
    let lastPct = -1;

    const tick = () => {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const scrollable = Math.max(1, el.offsetHeight - window.innerHeight);
        const raw = Math.min(1, Math.max(0, -rect.top / scrollable));
        progressRef.current = raw;

        const idx = Math.min(CHAPTERS.length - 1, Math.floor(raw * CHAPTERS.length));
        const nextPct = Math.round(raw * 100);
        if (idx !== lastIdx) {
          lastIdx = idx;
          setActiveIndex(idx);
        }
        if (Math.abs(nextPct - lastPct) >= 2) {
          lastPct = nextPct;
          setPct(nextPct);
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const chapter = CHAPTERS[activeIndex];
  const Icon = chapter.icon;

  return (
    <section ref={containerRef} className="relative h-[320vh] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="sticky top-20 h-[calc(100vh-6rem)] min-h-[540px] max-h-[760px] rounded-[2.25rem] bg-white/85 dark:bg-[#0B1120]/70 backdrop-blur-2xl border border-orange-200 dark:border-orange-400/30 shadow-[0_32px_90px_-16px_rgba(249,115,22,0.18)] dark:shadow-[0_32px_90px_-16px_rgba(0,0,0,0.75),inset_0_1px_1px_rgba(255,255,255,0.18)] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        <div className="absolute top-0 inset-x-0 h-1 bg-orange-100 dark:bg-white/10 z-20">
          <motion.div
            className="h-full bg-gradient-to-r from-[#F97316] via-[#0EA5E9] to-[#FACC15]"
            style={{ width: `${Math.max(4, pct)}%` }}
          />
        </div>

        <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-between relative z-10">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF1E8] dark:bg-white/10 border border-orange-200 dark:border-white/15 text-[11px] font-extrabold uppercase tracking-widest text-[#EA580C] dark:text-orange-300">
              <SparklesIcon className="w-3.5 h-3.5 text-[#F97316]" /> Scroll-Driven 3D Experience
            </span>
            <span className="text-xs font-black tracking-widest text-[#737373] dark:text-slate-300 font-mono">
              {chapter.num} / 04 · {pct}%
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={chapter.num}
              initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(6px)' }}
              transition={{ duration: 0.38, ease: 'easeOut' }}
              className="space-y-4 my-auto py-4"
            >
              <div className="inline-flex items-center gap-2 text-xs font-black tracking-[0.2em] uppercase" style={{ color: chapter.accent }}>
                <Icon className="w-4 h-4" />
                {chapter.tag}
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#171717] dark:text-white leading-[1.06] tracking-tight">
                {chapter.title}
                <br />
                <span style={{ color: chapter.accent }}>{chapter.highlight}</span>
              </h2>

              <p className="text-sm sm:text-base text-[#525252] dark:text-slate-300 max-w-lg leading-relaxed">{chapter.desc}</p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href={chapter.ctaHref}
                  className="btn-3d-orange px-5 h-11 rounded-2xl text-white font-extrabold text-xs sm:text-sm inline-flex items-center gap-2"
                >
                  {chapter.ctaLabel} <ArrowRight className="w-4 h-4" />
                </Link>
                <span className="px-3.5 py-2 rounded-xl bg-[#FFF7F2] dark:bg-white/10 border border-orange-200 dark:border-white/15 text-xs font-bold text-[#171717] dark:text-slate-200 inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#16A34A] dark:text-[#4ADE80]" /> {chapter.metric}
                </span>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between gap-2 pt-4 border-t border-orange-100 dark:border-white/10">
            <div className="flex items-center gap-2">
              {CHAPTERS.map((c, idx) => (
                <div
                  key={c.num}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === activeIndex ? 'w-10 bg-[#F97316]' : idx < activeIndex ? 'w-4 bg-orange-300' : 'w-3 bg-orange-200/70 dark:bg-white/20'
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-bold text-[#737373] dark:text-slate-400 inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#F97316]" /> Scroll down or up to scrub 3D
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 relative h-64 sm:h-80 lg:h-full">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-6 rounded-full blur-3xl opacity-35 transition-colors duration-500"
            style={{ background: `radial-gradient(circle, ${chapter.accent}, transparent 70%)` }}
          />
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 6.2], fov: 44 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            className="w-full h-full"
          >
            <PinnedStoryStage progressRef={progressRef} />
          </Canvas>
        </div>
      </div>
    </section>
  );
}

export default ScrollytellingShowcase;
