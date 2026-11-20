'use client';

import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sparkles } from '@react-three/drei';
import { useTheme } from 'next-themes';
import * as THREE from 'three';
import { scrollStore } from '@/components/providers/SmoothScrollProvider';

const AURORA_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AURORA_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uDark;
  uniform vec2 uMouse;
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float wave1 = sin(uv.x * 3.4 + uTime * 0.25 + uScroll * 6.28) * 0.5 + 0.5;
    float wave2 = cos(uv.y * 2.8 - uTime * 0.2 + uScroll * 4.5 + uMouse.x * 1.4) * 0.5 + 0.5;
    float glow = smoothstep(0.15, 0.95, wave1 * wave2);

    vec3 brandOrange = vec3(0.976, 0.451, 0.086);
    vec3 cyberCyan   = vec3(0.055, 0.647, 0.914);
    vec3 warmGold    = vec3(0.98, 0.78, 0.18);

    // Dark Cyber-Glass palette
    vec3 deepNavy = vec3(0.035, 0.055, 0.125);
    vec3 indigo   = vec3(0.11, 0.10, 0.28);
    vec3 accentA  = mix(brandOrange, cyberCyan, smoothstep(0.2, 0.55, uScroll));
    vec3 accent   = mix(accentA, warmGold, smoothstep(0.6, 0.95, uScroll));
    vec3 darkCol  = mix(deepNavy, indigo, uv.y * 0.75) + accent * glow * 0.26;
    float dist    = distance(uv, uMouse * 0.5 + 0.5);
    darkCol      += brandOrange * smoothstep(0.45, 0.0, dist) * 0.14;

    // Light Orange & White Gen-Z palette (luminous pearl white + warm peach silk waves)
    vec3 pearlWhite = vec3(1.0, 0.996, 0.992);
    vec3 warmPeach  = vec3(1.0, 0.945, 0.909);
    vec3 softAmber  = vec3(0.996, 0.84, 0.67);
    vec3 lightBase  = mix(pearlWhite, warmPeach, uv.y * 0.8 + wave1 * 0.2);
    vec3 lightCol   = mix(lightBase, softAmber, glow * 0.28);
    lightCol        = mix(lightCol, brandOrange, smoothstep(0.42, 0.0, dist) * 0.10);

    vec3 col = mix(lightCol, darkCol, uDark);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function ShaderBackdrop({ isDark }: { isDark: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uDark: { value: isDark ? 1 : 0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    matRef.current.uniforms.uDark.value = THREE.MathUtils.lerp(
      matRef.current.uniforms.uDark.value,
      isDark ? 1 : 0,
      0.08,
    );
    matRef.current.uniforms.uScroll.value = THREE.MathUtils.lerp(
      matRef.current.uniforms.uScroll.value,
      scrollStore.progress,
      0.08,
    );
    matRef.current.uniforms.uMouse.value.x = THREE.MathUtils.lerp(
      matRef.current.uniforms.uMouse.value.x,
      scrollStore.pointerX,
      0.06,
    );
    matRef.current.uniforms.uMouse.value.y = THREE.MathUtils.lerp(
      matRef.current.uniforms.uMouse.value.y,
      scrollStore.pointerY,
      0.06,
    );
  });

  return (
    <mesh position={[0, 0, -14]}>
      <planeGeometry args={[48, 32]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={AURORA_VERTEX}
        fragmentShader={AURORA_FRAGMENT}
        uniforms={uniforms}
        depthWrite={false}
      />
    </mesh>
  );
}

function ScrollResponsiveSculptures() {
  const clusterRef = useRef<THREE.Group>(null);
  const knotRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const satRefs = useRef<Array<THREE.Mesh | null>>([]);
  const keyLightRef = useRef<THREE.PointLight>(null);

  const smoothScroll = useRef(0);

  const satellites = useMemo(
    () => [
      { base: [-5.4, 2.3, -2.5] as [number, number, number], scale: 0.55, color: '#FB923C', speed: 1.2 },
      { base: [5.6, -1.8, -3.2] as [number, number, number], scale: 0.65, color: '#38BDF8', speed: -0.9 },
      { base: [-4.8, -2.9, -4.5] as [number, number, number], scale: 0.45, color: '#FACC15', speed: 1.4 },
      { base: [4.9, 2.8, -5.0] as [number, number, number], scale: 0.5, color: '#F97316', speed: -1.1 },
      { base: [0.4, 3.6, -6.2] as [number, number, number], scale: 0.42, color: '#4ADE80', speed: 0.8 },
    ],
    [],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    smoothScroll.current = THREE.MathUtils.lerp(smoothScroll.current, scrollStore.progress, 0.08);
    const p = smoothScroll.current;
    const mx = scrollStore.pointerX;
    const my = scrollStore.pointerY;

    // 1. Scroll-synchronized Camera Trajectory + Mouse Parallax (reverses naturally when scrolling up)
    const camX = Math.sin(p * Math.PI * 1.5) * 1.65 + mx * 0.65;
    const camY = (0.5 - p) * 1.4 + my * 0.45;
    const camZ = 8.2 - Math.sin(p * Math.PI) * 1.8;
    state.camera.position.x = THREE.MathUtils.lerp(state.camera.position.x, camX, 0.07);
    state.camera.position.y = THREE.MathUtils.lerp(state.camera.position.y, camY, 0.07);
    state.camera.position.z = THREE.MathUtils.lerp(state.camera.position.z, camZ, 0.07);
    state.camera.lookAt(0, 0, -2);

    // 2. Main Sculptural Cluster glides across depth & rotates directly with scroll
    if (clusterRef.current) {
      clusterRef.current.position.x = THREE.MathUtils.lerp(
        clusterRef.current.position.x,
        Math.cos(p * Math.PI * 2) * 2.4 + mx * 0.5,
        0.08,
      );
      clusterRef.current.position.y = THREE.MathUtils.lerp(
        clusterRef.current.position.y,
        Math.sin(p * Math.PI * 2) * 1.1 + my * 0.35,
        0.08,
      );
      clusterRef.current.position.z = -3.6 + Math.sin(p * Math.PI) * 1.4;
      clusterRef.current.rotation.y = p * Math.PI * 3.5 + mx * 0.5;
      clusterRef.current.rotation.x = p * Math.PI * 1.2 + my * 0.35;
    }

    if (knotRef.current) {
      knotRef.current.rotation.z += dt * 0.14;
      const pulse = 1 + Math.sin(p * Math.PI * 2) * 0.14;
      knotRef.current.scale.setScalar(pulse);
    }

    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = Math.PI * 0.35 + p * Math.PI * 2.2;
      ring1Ref.current.rotation.y = p * Math.PI * 1.6;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = -Math.PI * 0.25 - p * Math.PI * 1.8;
      ring2Ref.current.rotation.z = p * Math.PI * 2.6;
    }

    // 3. Staggered Parallax Satellites respond to scroll & mouse
    satRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const s = satellites[i];
      mesh.position.y = s.base[1] + (p - 0.5) * (3.2 + i * 0.7) * (i % 2 === 0 ? 1 : -1);
      mesh.position.x = s.base[0] + mx * (0.4 + i * 0.12);
      mesh.rotation.x = p * Math.PI * 3 * s.speed + state.clock.elapsedTime * 0.25;
      mesh.rotation.y = p * Math.PI * 2 * s.speed + mx * 0.8;
    });

    // 4. Dynamic Key Light Color Shift across chapters
    if (keyLightRef.current) {
      const c1 = new THREE.Color('#F97316');
      const c2 = new THREE.Color('#0EA5E9');
      const c3 = new THREE.Color('#16A34A');
      const c4 = new THREE.Color('#FACC15');
      const col = p < 0.33
        ? c1.clone().lerp(c2, p / 0.33)
        : p < 0.66
          ? c2.clone().lerp(c3, (p - 0.33) / 0.33)
          : c3.clone().lerp(c4, (p - 0.66) / 0.34);
      keyLightRef.current.color.copy(col);
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 8, 6]} intensity={1.8} color="#FFF1E8" />
      <pointLight ref={keyLightRef} position={[4, 3, 4]} intensity={28} distance={24} color="#F97316" />
      <pointLight position={[-6, -4, 3]} intensity={16} distance={20} color="#38BDF8" />

      {/* Central Scroll-Reactive Glass/Metal Sculpture */}
      <group ref={clusterRef} position={[2.2, 0.2, -3.6]}>
        <mesh ref={knotRef}>
          <torusKnotGeometry args={[1.05, 0.3, 128, 24]} />
          <meshPhysicalMaterial
            color="#F97316"
            emissive="#7C2D12"
            emissiveIntensity={0.4}
            metalness={0.55}
            roughness={0.14}
            clearcoat={1}
            clearcoatRoughness={0.08}
            iridescence={0.85}
            iridescenceIOR={1.35}
          />
        </mesh>

        <mesh ref={ring1Ref}>
          <torusGeometry args={[2.05, 0.045, 20, 96]} />
          <meshStandardMaterial color="#FB923C" emissive="#EA580C" emissiveIntensity={0.85} metalness={0.8} roughness={0.2} />
        </mesh>

        <mesh ref={ring2Ref}>
          <torusGeometry args={[2.55, 0.03, 16, 96]} />
          <meshStandardMaterial color="#FACC15" emissive="#F97316" emissiveIntensity={0.55} metalness={0.9} roughness={0.15} />
        </mesh>
      </group>

      {/* Depth Parallax Floating Polyhedra */}
      {satellites.map((s, idx) => (
        <Float key={idx} speed={1.6} rotationIntensity={0.4} floatIntensity={0.5}>
          <mesh
            ref={(el) => {
              satRefs.current[idx] = el;
            }}
            position={s.base}
            scale={s.scale}
          >
            {idx % 2 === 0 ? <octahedronGeometry args={[1, 0]} /> : <icosahedronGeometry args={[1, 0]} />}
            <meshPhysicalMaterial
              color={s.color}
              metalness={0.45}
              roughness={0.12}
              transmission={0.35}
              thickness={1.2}
              clearcoat={1}
            />
          </mesh>
        </Float>
      ))}

      {/* 3D Depth Particle Field */}
      <Sparkles count={140} scale={[20, 14, 14]} size={3.2} speed={0.35} opacity={0.75} color="#FB923C" />
      <Sparkles count={70} scale={[18, 12, 10]} size={2.2} speed={0.25} opacity={0.55} color="#FEF08A" />
    </>
  );
}

export function QuickServeScrollScene() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 8.2], fov: 46 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ShaderBackdrop isDark={isDark} />
        <ScrollResponsiveSculptures />
      </Canvas>
    </div>
  );
}

export default QuickServeScrollScene;
