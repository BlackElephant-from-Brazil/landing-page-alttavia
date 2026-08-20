"use client";

import { useEffect, useMemo, useState } from "react";

type GoldParticlesProps = {
  count?: number;
  className?: string;
};

type Particle = {
  id: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  drift: number;
};

// Deterministic pseudo-random so particles stay stable across re-renders.
function seeded(seed: number) {
  return (n: number) => {
    const x = Math.sin(seed + n * 9301) * 10000;
    return x - Math.floor(x);
  };
}

// Round to a fixed precision so every render serializes the value identically.
const round = (n: number, d = 3) => Number(n.toFixed(d));

function buildParticles(count: number): Particle[] {
  const rand = seeded(7);
  return Array.from({ length: count }).map((_, i) => {
    const r = (k: number) => rand(i * 7 + k);
    const size = round(6 + r(1) * 20);              // 6–26 px
    const opacity = round(0.15 + r(2) * 0.35);      // 0.15–0.5
    const duration = round(14 + r(3) * 14);         // 14–28 s
    const delay = round(-r(4) * duration);          // negative so they appear mid-animation
    const left = round(r(5) * 100);                 // 0–100 %
    const drift = round((r(6) - 0.5) * 120);        // -60–60 px horizontal drift
    return { id: i, left, size, delay, duration, opacity, drift };
  });
}

export function GoldParticles({ count = 22, className = "" }: GoldParticlesProps) {
  const particles = useMemo(() => buildParticles(count), [count]);
  // Defer rendering until after hydration: the animated style strings are
  // browser-normalized in ways the SSR HTML can't predict (animation shorthand
  // exploded into longhands, decimal precision trimmed), so we sidestep the
  // mismatch by mounting the decorative layer client-side only.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute bottom-0 rounded-full bg-gold blur-[6px] will-change-transform"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animation: `float-up ${p.duration}s linear ${p.delay}s infinite`,
            ["--particle-opacity" as string]: String(p.opacity),
            ["--particle-drift" as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
