# Liquid Glass Island Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the entire Alttavia landing page to a full "island" aesthetic using the existing `LiquidGlassShell` component with a new `lightVariant` prop, animated hero blobs, scroll-driven stat counters, and a rotating sticker badge on the services section.

**Architecture:** Add `lightVariant` to `LiquidGlassShell` for light-bg glass; render `LiquidGlassDefs` once in the root layout; create three new primitives (`HeroBlobs`, `useCountUp`, `SpinningBadge`); then refactor each section in dependency order — foundation components first, sections after.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Framer Motion 12, Lucide React, SVG `animateTransform`, CSS `@keyframes`, `IntersectionObserver`, `requestAnimationFrame`.

---

## File Map

| File | Action |
|---|---|
| `src/components/ui/LiquidGlass.tsx` | Modify — add `lightVariant`, `style` props |
| `src/app/layout.tsx` | Modify — render `LiquidGlassDefs` once at root |
| `src/app/globals.css` | Modify — blob `@keyframes`, `--road-color-hero` var |
| `src/components/road/road-overlay.tsx` | Modify — hero segment uses `--road-color-hero` |
| `src/hooks/useCountUp.ts` | Create — `IntersectionObserver` counter hook |
| `src/components/ui/hero-blobs.tsx` | Create — 3 CSS-animated orbital blobs |
| `src/components/ui/spinning-badge.tsx` | Create — rotating SVG sticker with circular text |
| `src/components/sections/navbar.tsx` | Modify — floating island pill |
| `src/components/sections/hero.tsx` | Modify — blobs, counters, glass CTAs, glass card |
| `src/components/sections/services.tsx` | Modify — glass cards, alignment, sticker, transparent bg |
| `src/components/sections/why-us.tsx` | Modify — replace `.glass-card` with `LiquidGlassShell` |
| `src/components/sections/about.tsx` | Modify — glass text block, photo shadow |
| `src/components/sections/principles.tsx` | Modify — glass quote cards |
| `src/components/sections/faq.tsx` | Modify — glass accordion items |
| `src/components/sections/cta-banner.tsx` | Modify — glass content container + glass button |
| `src/components/sections/contact.tsx` | Modify — glass form container, glass inputs |
| `src/components/sections/location.tsx` | Modify — glass address card |
| `src/components/sections/footer.tsx` | Modify — glass bottom block |

---

## Task 1: Extend LiquidGlassShell + wire LiquidGlassDefs into root layout

**Files:**
- Modify: `src/components/ui/LiquidGlass.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add `lightVariant` and `style` props to `LiquidGlassShellProps`**

Replace the existing `LiquidGlassShellProps` interface and `LiquidGlassShell` function in `src/components/ui/LiquidGlass.tsx` with:

```tsx
interface LiquidGlassShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  tintOpacity?: number;
  blur?: number;
  filter?: "glass-distortion" | "glass-distortion-soft" | "none";
  enableHover?: boolean;
  borderRadius?: string;
  /** Light variant: white tint + navy text. Default false = dark charcoal tint + white text. */
  lightVariant?: boolean;
  /** Passed straight to the outer motion.div. Use for scroll-driven opacity/scale overrides. */
  style?: React.CSSProperties;
}

export function LiquidGlassShell({
  children,
  className = "",
  contentClassName = "",
  tintOpacity = 0.55,
  blur = 20,
  filter = "glass-distortion",
  enableHover = false,
  borderRadius,
  lightVariant = false,
  style,
}: LiquidGlassShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springCfg = { damping: 25, stiffness: 150 };
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [2, -2]), springCfg);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-2, 2]), springCfg);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    mouseX.set((e.clientX - r.left) / r.width - 0.5);
    mouseY.set((e.clientY - r.top) / r.height - 0.5);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const radiusStyle = borderRadius ? { borderRadius } : undefined;

  const tintColor = lightVariant
    ? `rgba(255, 255, 255, ${tintOpacity})`
    : `rgba(18, 18, 18, ${tintOpacity})`;

  const borderColor = lightVariant
    ? "rgba(255, 255, 255, 0.50)"
    : "rgba(255, 255, 255, 0.12)";

  const outerShadow = lightVariant
    ? "0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(208,161,43,0.08)"
    : "0 4px 24px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.1)";

  const shineGradient = lightVariant
    ? "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 40%, rgba(255,255,255,0.10) 100%)"
    : "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.04) 100%)";

  return (
    <motion.div
      ref={containerRef}
      className={`relative flex ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...radiusStyle,
        rotateX: 0,
        rotateY: 0,
        boxShadow: outerShadow,
        ...style,
      }}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      whileHover={
        enableHover
          ? {
              scale: 1.01,
              transition: { duration: 0.4, ease: [0.175, 0.885, 0.32, 2.2] },
            }
          : {}
      }
    >
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ borderRadius: "inherit" }}
      >
        <div
          className="absolute inset-0 z-0"
          style={{
            backdropFilter: `blur(${blur}px) saturate(140%)`,
            WebkitBackdropFilter: `blur(${blur}px) saturate(140%)`,
            ...(filter !== "none"
              ? { filter: `url(#${filter})`, isolation: "isolate" }
              : {}),
          }}
        />
        <div
          className="absolute inset-0 z-[1]"
          style={{ background: tintColor }}
        />
        <div
          className="absolute inset-0 z-[2]"
          style={{
            boxShadow:
              "inset 1px 1px 0 0 rgba(255, 255, 255, 0.12), inset -1px -1px 0 0 rgba(255, 255, 255, 0.06)",
            background: shineGradient,
          }}
        />
      </div>

      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{
          borderRadius: "inherit",
          border: `1px solid ${borderColor}`,
        }}
      />

      <div
        className={`relative z-[3] w-full ${lightVariant ? "" : "text-white"} ${contentClassName}`}
        style={lightVariant ? undefined : { textShadow: "0 1px 2px rgba(0,0,0,0.14)" }}
      >
        {children}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Add `LiquidGlassDefs` to root layout body**

In `src/app/layout.tsx`, import `LiquidGlassDefs` and render it inside `<body>`:

```tsx
import type { Metadata } from "next";
import { Spectral, Inter } from "next/font/google";
import "./globals.css";
import { LiquidGlassDefs } from "@/components/ui/LiquidGlass";

const spectral = Spectral({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default:
      "Alttavia Relocation. NIF and Portuguese bank account, handled by licensed lawyers.",
    template: "%s · Alttavia Relocation",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${spectral.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <LiquidGlassDefs />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify build passes**

```bash
cd C:\Users\v27me\Videos\landing-page-alttavia && npm run build
```

Expected: build completes without TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/LiquidGlass.tsx src/app/layout.tsx
git commit -m "feat(glass): add lightVariant prop to LiquidGlassShell, wire LiquidGlassDefs to root layout"
```

---

## Task 2: CSS keyframes for orbital blobs + road hero color

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/road/road-overlay.tsx`

- [ ] **Step 1: Add blob keyframes and road hero variable to `globals.css`**

Append after the last `@utility` block (after `animate-pulse-soft`) in `src/app/globals.css`:

```css
/* ------ Road hero segment color ------ */
/* In @theme block, add: */
```

Inside the `@theme { }` block, add after `--road-opacity: 0.6;`:

```css
  --road-color-hero: #D0A12B;
```

Then after the last `@utility animate-pulse-soft { ... }` block, append:

```css
/* Hero orbital blob animations */
@keyframes blob-orbit-1 {
  0%   { transform: translate(0px, 0px) scale(1); }
  25%  { transform: translate(-60px, 40px) scale(1.05); }
  50%  { transform: translate(-30px, 80px) scale(0.97); }
  75%  { transform: translate(40px, 30px) scale(1.03); }
  100% { transform: translate(0px, 0px) scale(1); }
}

@keyframes blob-orbit-2 {
  0%   { transform: translate(0px, 0px) scale(1); }
  33%  { transform: translate(50px, -40px) scale(1.06); }
  66%  { transform: translate(-40px, -60px) scale(0.96); }
  100% { transform: translate(0px, 0px) scale(1); }
}

@keyframes blob-orbit-3 {
  0%   { transform: translate(0px, 0px) scale(1); }
  40%  { transform: translate(30px, 50px) scale(1.04); }
  80%  { transform: translate(-50px, 20px) scale(0.98); }
  100% { transform: translate(0px, 0px) scale(1); }
}
```

- [ ] **Step 2: Update road-overlay.tsx to use gold for hero segment**

In `src/components/road/road-overlay.tsx`, find the `stroke` expression inside the `sectionRects.map()` and replace it:

Old:
```tsx
stroke={
  NAVY_SECTIONS.has(s.id)
    ? "var(--road-color-dark)"
    : "var(--road-color-light)"
}
```

New:
```tsx
stroke={
  s.id === "hero"
    ? "var(--road-color-hero)"
    : NAVY_SECTIONS.has(s.id)
    ? "var(--road-color-dark)"
    : "var(--road-color-light)"
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/road/road-overlay.tsx
git commit -m "feat(hero): add orbital blob keyframes, paint road hero segment gold"
```

---

## Task 3: Create HeroBlobs component

**Files:**
- Create: `src/components/ui/hero-blobs.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

export function HeroBlobs() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Blob 1 — large, top-right, 18s orbit */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 600,
          height: 600,
          top: "-15%",
          right: "-10%",
          background:
            "radial-gradient(circle at center, rgba(224,207,159,0.55) 0%, rgba(208,161,43,0.35) 40%, transparent 70%)",
          mixBlendMode: "multiply",
          animation: "blob-orbit-1 18s ease-in-out infinite",
          willChange: "transform",
        }}
      />
      {/* Blob 2 — medium, bottom-left, 14s orbit reversed */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 400,
          height: 400,
          bottom: "-5%",
          left: "-8%",
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.50) 0%, rgba(230,185,74,0.25) 40%, transparent 70%)",
          mixBlendMode: "multiply",
          animation: "blob-orbit-2 14s ease-in-out infinite reverse",
          willChange: "transform",
        }}
      />
      {/* Blob 3 — small, center-right, 22s orbit with delay */}
      <div
        className="absolute rounded-full blur-3xl"
        style={{
          width: 280,
          height: 280,
          top: "30%",
          right: "15%",
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.30) 0%, transparent 70%)",
          mixBlendMode: "multiply",
          animation: "blob-orbit-3 22s ease-in-out infinite",
          animationDelay: "-7s",
          willChange: "transform",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/hero-blobs.tsx
git commit -m "feat(hero): create HeroBlobs component with 3 CSS-animated orbital blobs"
```

---

## Task 4: Create useCountUp hook

**Files:**
- Create: `src/hooks/useCountUp.ts`

- [ ] **Step 1: Create the hooks directory and file**

```ts
"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from 0 to `target` once the returned `ref` element
 * enters the viewport (IntersectionObserver, fires once, threshold 0.5).
 * Returns `{ count, ref }` — attach `ref` to any HTMLElement.
 */
export function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const triggered = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || triggered.current) return;
        triggered.current = true;

        const start = performance.now();
        function tick(now: number) {
          const elapsed = now - start;
          const t = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
          setCount(Math.round(eased * target));
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCountUp.ts
git commit -m "feat(hero): create useCountUp hook for viewport-triggered stat counters"
```

---

## Task 5: Create SpinningBadge component

**Files:**
- Create: `src/components/ui/spinning-badge.tsx`

- [ ] **Step 1: Create the file**

The badge is 128×128px, radius 48px, circumference ≈ 301px.
`textLength="301"` forces the text to fit exactly one revolution; repeating it twice fills the circle.

```tsx
import { Scale } from "lucide-react";
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";

const TEXT = "CERTIFIED LAWYERS · ZERO MIDDLEMEN · ";
const FULL_TEXT = TEXT + TEXT;

export function SpinningBadge() {
  return (
    <LiquidGlassShell
      lightVariant
      tintOpacity={0.45}
      filter="glass-distortion-soft"
      borderRadius="9999px"
      className="w-[128px] h-[128px] items-center justify-center shrink-0"
    >
      <svg
        viewBox="0 0 128 128"
        width="128"
        height="128"
        className="absolute inset-0"
        aria-hidden
      >
        <defs>
          <path
            id="spinning-badge-path"
            d="M 64,64 m -48,0 a 48,48 0 1,1 96,0 a 48,48 0 1,1 -96,0"
          />
        </defs>

        {/* Rotating group: text orbits, icon counter-rotates to stay upright */}
        <g>
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 64 64"
            to="360 64 64"
            dur="12s"
            repeatCount="indefinite"
          />
          <text
            fontSize="7"
            fill="var(--color-navy-muted)"
            letterSpacing="0.12em"
            fontFamily="var(--font-sans)"
            fontWeight="500"
          >
            <textPath href="#spinning-badge-path" textLength="301" lengthAdjust="spacing">
              {FULL_TEXT}
            </textPath>
          </text>
        </g>

        {/* Icon group: counter-rotates to stay upright */}
        <g transform="translate(52, 52)">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 12 12"
            to="-360 12 12"
            dur="12s"
            repeatCount="indefinite"
            additive="sum"
          />
          {/* Scale icon rendered as SVG path, 24×24, centered */}
          <svg
            x="0"
            y="0"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-navy)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="M7 21h10" />
            <path d="M12 3v18" />
            <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
          </svg>
        </g>
      </svg>
    </LiquidGlassShell>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/spinning-badge.tsx
git commit -m "feat(services): create SpinningBadge component with circular SVG text and Scale icon"
```

---

## Task 6: Redesign Navbar as floating island pill

**Files:**
- Modify: `src/components/sections/navbar.tsx`

- [ ] **Step 1: Rewrite navbar.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
import { useContent } from "@/components/providers/content-provider";

export function Navbar() {
  const { t, brand } = useContent();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(780px,90vw)]">
      <motion.div
        animate={{
          opacity: scrolled ? 1 : 0.93,
          scale: scrolled ? 1 : 0.992,
          boxShadow: scrolled
            ? "0 8px 32px rgba(0,0,0,0.10)"
            : "0 2px 12px rgba(0,0,0,0.04)",
        }}
        transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
        style={{ borderRadius: 9999 }}
      >
        <LiquidGlassShell
          lightVariant
          tintOpacity={0.55}
          blur={24}
          filter="glass-distortion-soft"
          borderRadius="9999px"
          className="w-full"
        >
          <nav className="flex h-16 items-center justify-between px-5 sm:px-7 w-full">
            <a href="#top" className="flex items-center gap-2 shrink-0" aria-label={brand.name}>
              <Logo />
            </a>

            <ul className="hidden lg:flex items-center gap-7">
              {t.nav.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="relative text-sm text-navy-soft hover:text-navy transition-colors duration-300 group"
                  >
                    {item.label}
                    <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
                  </a>
                </li>
              ))}
            </ul>

            <div className="hidden lg:flex items-center gap-4">
              <LanguageSwitcher />
              <LiquidGlassShell
                lightVariant
                tintOpacity={0.65}
                blur={20}
                filter="glass-distortion-soft"
                borderRadius="9999px"
                className="shrink-0"
              >
                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 px-5 h-10 text-sm font-medium text-navy hover:text-gold-dark transition-colors whitespace-nowrap"
                >
                  {t.navCtaLabel}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </LiquidGlassShell>
            </div>

            <div className="lg:hidden flex items-center gap-3">
              <LanguageSwitcher />
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-navy/10 text-navy hover:border-gold/40 transition-colors"
                aria-label={open ? t.closeMenuLabel : t.openMenuLabel}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </div>
          </nav>
        </LiquidGlassShell>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="mobile-nav"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mt-2 lg:hidden"
          >
            <LiquidGlassShell
              lightVariant
              tintOpacity={0.80}
              blur={24}
              filter="glass-distortion-soft"
              borderRadius="1.5rem"
              className="w-full"
            >
              <div className="px-5 py-4">
                <ul className="flex flex-col">
                  {t.nav.map((item) => (
                    <li key={item.href}>
                      <a
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="block py-3 text-base text-navy border-b border-navy/10 last:border-b-0 hover:text-gold-dark transition-colors"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                  <li className="pt-5 pb-3">
                    <a
                      href="#contact"
                      onClick={() => setOpen(false)}
                      className="inline-flex items-center gap-2 w-full justify-center h-12 rounded-full bg-navy text-white text-sm font-medium hover:bg-gold hover:text-navy transition-colors"
                    >
                      {t.navCtaLabel}
                      <ArrowUpRight className="size-4" aria-hidden />
                    </a>
                  </li>
                </ul>
              </div>
            </LiquidGlassShell>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
```

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
```

Open `http://localhost:3000/en`. The navbar should appear as a floating pill, not a full-width bar. Scroll past 12px — pill should gain a slightly more opaque shadow. Mobile hamburger should open a glass sheet below the pill.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/navbar.tsx
git commit -m "feat(navbar): redesign as floating island pill with light glass"
```

---

## Task 7: Redesign Hero section

**Files:**
- Modify: `src/components/sections/hero.tsx`

- [ ] **Step 1: Rewrite hero.tsx**

```tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ConcentricRings } from "@/components/ui/concentric-rings";
import { HeroBlobs } from "@/components/ui/hero-blobs";
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
import { useCountUp } from "@/hooks/useCountUp";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

function StatCounter({ number, label }: { number: string; label: string }) {
  const isPercentage = number.endsWith("%");
  const hasPlus = number.endsWith("+");
  const raw = parseInt(number.replace(/[^0-9]/g, ""), 10);
  const { count, ref } = useCountUp(raw);

  return (
    <li className="border-l border-gold/30 pl-4 sm:pl-5">
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="font-serif text-3xl sm:text-4xl text-navy leading-none"
      >
        {count}
        {hasPlus && "+"}
        {isPercentage && "%"}
      </div>
      <div className="mt-1.5 text-xs sm:text-sm text-navy-muted uppercase tracking-wider">
        {label}
      </div>
    </li>
  );
}

export function Hero() {
  const { t } = useContent();
  const hero = t.hero;

  return (
    <section
      id="top"
      className="relative overflow-hidden pt-32 lg:pt-40 pb-20 lg:pb-28 has-grain"
    >
      <HeroBlobs />

      <Container size="wide" className="relative z-10">
        <div className="grid gap-14 lg:gap-16 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: smooth }}
            >
              <Eyebrow align="centerOnMobile">{hero.eyebrow}</Eyebrow>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.1, ease: smooth }}
              className="mt-8 font-serif text-[clamp(2.2rem,4.4vw,3.2rem)] leading-[1.05] tracking-[-0.02em] text-navy"
            >
              {hero.titleBefore}{" "}
              <span className="relative inline-block italic text-gold-dark">
                {hero.titleHighlight}
                <svg
                  aria-hidden
                  className="absolute -bottom-2 left-0 h-3 w-full"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                >
                  <motion.path
                    d="M2 9 Q 50 2, 100 6 T 198 5"
                    stroke="#D0A12B"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2, delay: 0.9, ease: smooth }}
                  />
                </svg>
              </span>
              {hero.titleAfter}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.25, ease: smooth }}
              className="mt-7 max-w-xl text-lg sm:text-xl text-navy-soft leading-relaxed"
            >
              {hero.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: smooth }}
              className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4"
            >
              <span className="inline-flex animate-pulse-soft will-change-transform"
                style={{
                  ["--pulse-duration" as string]: "var(--pulse-duration-cta)",
                  ["--pulse-scale" as string]: "1.02",
                } as React.CSSProperties}
              >
                <LiquidGlassShell
                  lightVariant
                  tintOpacity={0.55}
                  filter="glass-distortion-soft"
                  borderRadius="9999px"
                >
                  <a
                    href="#contact"
                    className="inline-flex items-center gap-2 px-8 h-14 text-base font-medium text-navy hover:text-gold-dark transition-colors whitespace-nowrap"
                  >
                    {hero.ctaPrimary}
                    <ArrowUpRight className="size-4 text-gold" aria-hidden />
                  </a>
                </LiquidGlassShell>
              </span>

              <LiquidGlassShell
                lightVariant
                tintOpacity={0.45}
                filter="glass-distortion-soft"
                borderRadius="9999px"
              >
                <a
                  href="#services"
                  className="inline-flex items-center gap-2 px-8 h-14 text-base font-medium text-navy hover:text-gold-dark transition-colors whitespace-nowrap"
                >
                  {hero.ctaSecondary}
                </a>
              </LiquidGlassShell>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7, ease: smooth }}
              className="mt-16 grid grid-cols-3 gap-8 sm:gap-12 max-w-xl"
            >
              {hero.stats.map((s) => (
                <StatCounter key={s.label} number={s.number} label={s.label} />
              ))}
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: smooth }}
            className="lg:col-span-5 relative"
          >
            <div className="relative aspect-[4/5] rounded-xl overflow-hidden shadow-[var(--shadow-long)] bg-champagne">
              <Image
                src="/patricia.webp"
                alt="Patrícia Viana, founder of Alttavia Relocation"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover object-[55%_30%]"
              />
              {/* Subtle gold vignette at base only — blue gradient removed */}
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-gold/10 via-transparent to-transparent"
              />
            </div>

            {/* Floating attorney card — now liquid glass */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.85, ease: smooth }}
              className="absolute -bottom-6 -left-4 sm:-left-8 max-w-[260px]"
            >
              <LiquidGlassShell
                lightVariant
                tintOpacity={0.45}
                filter="glass-distortion-soft"
                borderRadius="1rem"
                contentClassName="px-5 py-4"
              >
                <ConcentricRings
                  count={3}
                  size={14}
                  className="absolute top-2 right-2 opacity-80"
                />
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white shrink-0">
                    <ArrowUpRight className="size-4" />
                  </span>
                  <div>
                    <div className="font-serif text-sm text-navy leading-tight">
                      {hero.cardTitle}
                    </div>
                    <div className="text-xs text-navy-muted">
                      {hero.cardRole}
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-navy-soft leading-relaxed">
                  {hero.cardDesc}
                </p>
              </LiquidGlassShell>
            </motion.div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
```

Open `http://localhost:3000/en`. Check:
- Three animated gold blobs visible behind hero content
- Stat numbers count up from 0 when stats enter viewport
- CTA buttons are glass pills
- Patrícia card is glass with navy text
- Photo has no blue overlay, just faint gold at base

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/hero.tsx src/hooks/useCountUp.ts src/components/ui/hero-blobs.tsx
git commit -m "feat(hero): animated orbital blobs, glass CTAs, glass attorney card, viewport stat counters"
```

---

## Task 8: Redesign Services section

**Files:**
- Modify: `src/components/sections/services.tsx`

- [ ] **Step 1: Rewrite services.tsx**

```tsx
"use client";

import { motion } from "framer-motion";
import { Check, FileText, Landmark } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
import { SpinningBadge } from "@/components/ui/spinning-badge";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;
const icons = [FileText, Landmark];

export function Services() {
  const { t } = useContent();
  const services = t.services;

  return (
    <section
      id="services"
      className="relative py-24 lg:py-32 overflow-visible"
    >
      {/* Rotating sticker — decorative, partially above the section fold */}
      <div className="absolute top-0 right-8 -translate-y-1/2 z-10 hidden sm:block">
        <SpinningBadge />
      </div>

      <Container size="wide" className="relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <Eyebrow>{services.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-6 font-serif text-balance text-navy">
              {services.title}
            </h2>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="mt-5 text-lg text-navy-soft leading-relaxed">
              {services.desc}
            </p>
          </Reveal>
        </div>

        <div className="mt-16 lg:mt-20 grid gap-6 lg:gap-8 lg:grid-cols-2">
          {services.items.map((item, i) => {
            const Icon = icons[i % icons.length];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-6% 0%" }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: smooth }}
                style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.06)" }}
              >
                <LiquidGlassShell
                  lightVariant
                  tintOpacity={0.50}
                  blur={24}
                  filter="glass-distortion-soft"
                  borderRadius="1.25rem"
                  enableHover
                  className="w-full h-full"
                  contentClassName="flex flex-col p-8 sm:p-10 lg:p-12"
                >
                  <span
                    className="absolute top-6 right-7 font-serif text-4xl sm:text-5xl text-gold/20 leading-none italic select-none pointer-events-none"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Header row — fixed min-height for cross-card alignment */}
                  <div className="flex items-start gap-5 min-h-[4rem]">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-wheat/40 text-gold-dark">
                      <Icon className="size-6" strokeWidth={1.5} />
                    </div>
                    <LiquidGlassShell
                      lightVariant
                      tintOpacity={0.35}
                      filter="none"
                      borderRadius="9999px"
                      className="shrink-0 self-center"
                    >
                      <span className="inline-flex items-center px-3 py-1 text-[0.68rem] font-medium uppercase tracking-wider text-gold-dark whitespace-nowrap">
                        {item.tag}
                      </span>
                    </LiquidGlassShell>
                  </div>

                  {/* Title — fixed min-height */}
                  <h3 className="mt-7 font-serif text-3xl text-navy leading-tight min-h-[5.5rem]">
                    {item.title}
                  </h3>

                  {/* Subtitle — fixed min-height */}
                  <p className="mt-2 text-base italic text-navy-soft font-serif min-h-[2.5rem]">
                    {item.subtitle}
                  </p>

                  {/* Body — grows to absorb locale length variation */}
                  <div className="mt-6 flex-grow space-y-4 text-[0.96rem] text-navy-soft leading-relaxed">
                    <p>{item.body}</p>
                    <p>{item.body2}</p>
                  </div>

                  <ul className="mt-7 space-y-3">
                    {item.bullets.map((b) => (
                      <li key={b} className="flex gap-3 text-[0.93rem] text-navy">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-white">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA — always pinned to bottom */}
                  <div className="mt-auto pt-7 border-t border-white/20">
                    <LiquidGlassShell
                      lightVariant
                      tintOpacity={0.60}
                      filter="glass-distortion-soft"
                      borderRadius="9999px"
                      className="w-full sm:w-auto inline-flex"
                    >
                      <a
                        href="#contact"
                        className="inline-flex items-center gap-2 px-7 h-12 text-sm font-medium text-navy hover:text-gold-dark transition-colors whitespace-nowrap"
                      >
                        {item.cta}
                        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M7 17L17 7M17 7H7M17 7v10" />
                        </svg>
                      </a>
                    </LiquidGlassShell>
                  </div>
                </LiquidGlassShell>
              </motion.div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
```

Open `http://localhost:3000/en` and scroll to Services. Check:
- Section has transparent background (cream bleeds through from body)
- Spinning sticker appears at top-right partially overlapping the previous section
- Cards are glass pills with navy text
- h3 titles in both cards visually align
- CTA buttons pinned to bottom

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/services.tsx src/components/ui/spinning-badge.tsx
git commit -m "feat(services): glass cards with alignment anchors, transparent bg, spinning sticker"
```

---

## Task 9: Redesign Why Us section

**Files:**
- Modify: `src/components/sections/why-us.tsx`

- [ ] **Step 1: Replace `.glass-card` with `LiquidGlassShell` on each card**

In `why-us.tsx`, replace the `<motion.li>` element inside `sectionRects.map()`. Change:

```tsx
<motion.li
  key={item.title}
  variants={staggerItem}
  className="card-hover-atelier-dark group glass-card relative rounded-xl p-6 sm:p-8 w-[82vw] sm:w-auto sm:min-w-0 snap-start flex-shrink-0"
>
  {/* card content */}
</motion.li>
```

To:

```tsx
<motion.li
  key={item.title}
  variants={staggerItem}
  className="w-[82vw] sm:w-auto sm:min-w-0 snap-start flex-shrink-0"
>
  <LiquidGlassShell
    tintOpacity={0.18}
    filter="glass-distortion-soft"
    borderRadius="1rem"
    enableHover
    className="w-full h-full card-hover-atelier-dark group relative"
    contentClassName="p-6 sm:p-8 flex flex-col"
  >
    <span
      className="absolute top-4 right-5 font-serif text-3xl text-gold-light/30 leading-none italic select-none pointer-events-none"
      aria-hidden
    >
      {String(i + 1).padStart(2, "0")}
    </span>
    <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gold/20 border border-gold/25 text-gold-light transition-colors duration-500 group-hover:bg-gold group-hover:text-navy group-hover:border-gold">
      <Icon className="size-5" strokeWidth={1.5} />
    </div>
    <h3 className="mt-5 sm:mt-6 font-serif text-xl sm:text-2xl text-white leading-snug break-words hyphens-auto">
      {item.title}
    </h3>
    <p className="mt-3 text-sm sm:text-[0.95rem] text-white/75 leading-relaxed break-words">
      {item.desc}
    </p>
  </LiquidGlassShell>
</motion.li>
```

Also add the import at the top:
```tsx
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
```

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
```

Scroll to Why Us. Cards should have dark glass (low tint over navy bg), white text. Globe and marquee unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/why-us.tsx
git commit -m "feat(why-us): replace glass-card utility with LiquidGlassShell (dark, tintOpacity 0.18)"
```

---

## Task 10: Redesign About section

**Files:**
- Modify: `src/components/sections/about.tsx`

- [ ] **Step 1: Apply glass to the text block and update photo**

In `about.tsx`, make these changes:

1. Wrap the `<div className="lg:col-span-7">` content in `LiquidGlassShell`.
2. Update the photo `div` to add a stronger box-shadow and update the quote card to glass.
3. Change gradient from `from-navy-deep/45` to `from-gold/10`.

Full replacement:

```tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function About() {
  const { t } = useContent();
  const about = t.about;

  return (
    <section
      id="about"
      className="relative py-24 lg:py-32 bg-gradient-to-b from-cream via-cream-deep/60 to-cream"
    >
      <Container size="wide" className="relative z-10">
        <div className="grid gap-14 lg:gap-20 lg:grid-cols-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-10% 0%" }}
            transition={{ duration: 0.9, ease: smooth }}
            className="lg:col-span-5 relative"
          >
            <div
              className="relative aspect-[4/5] rounded-[1.25rem] overflow-hidden"
              style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.12)" }}
            >
              <Image
                src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1200&q=80"
                alt="Patrícia Viana, founder of Alttavia Relocation"
                fill
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-gold/10 via-transparent to-transparent"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2, ease: smooth }}
              className="absolute -bottom-6 right-4 sm:-right-8 max-w-[calc(100%-2rem)] sm:max-w-sm"
            >
              <LiquidGlassShell
                lightVariant
                tintOpacity={0.50}
                filter="glass-distortion-soft"
                borderRadius="1rem"
                contentClassName="p-6"
              >
                <Quote className="size-6 text-gold-dark" aria-hidden />
                <p className="mt-3 font-serif text-lg italic text-navy leading-snug">
                  "{about.highlight.quote}"
                </p>
                <div className="mt-4 pt-4 border-t border-navy/10">
                  <div className="font-serif text-base text-navy">
                    {about.highlight.name}
                  </div>
                  <div className="text-xs text-navy-muted mt-0.5">
                    {about.highlight.role}
                  </div>
                </div>
              </LiquidGlassShell>
            </motion.div>
          </motion.div>

          <div className="lg:col-span-7">
            <LiquidGlassShell
              lightVariant
              tintOpacity={0.40}
              blur={20}
              filter="glass-distortion-soft"
              borderRadius="1.25rem"
              contentClassName="p-8 lg:p-10"
            >
              <Reveal>
                <Eyebrow align="centerOnMobile">{about.eyebrow}</Eyebrow>
              </Reveal>
              <Reveal delay={0.1}>
                <h2 className="mt-6 font-serif text-balance text-navy">
                  {about.title}
                </h2>
              </Reveal>
              <div className="mt-7 space-y-5">
                {about.paragraphs.map((p, i) => (
                  <Reveal key={i} delay={0.15 + i * 0.07}>
                    <p className="text-lg text-navy-soft leading-relaxed">{p}</p>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={0.45}>
                <dl className="mt-12 grid grid-cols-3 gap-6 sm:gap-10 border-t border-gold/30 pt-8">
                  {about.stats.map((s) => (
                    <div key={s.label}>
                      <dt className="sr-only">{s.label}</dt>
                      <dd className="font-serif text-3xl sm:text-4xl text-navy leading-none">
                        {s.number}
                      </dd>
                      <div className="mt-2 text-xs text-navy-muted uppercase tracking-wider">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </dl>
              </Reveal>
            </LiquidGlassShell>
          </div>
        </div>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
```

Scroll to About. Right text column should be inside a glass card. Photo has rounded corners and deeper shadow. Quote overlay card is glass with navy text.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/about.tsx
git commit -m "feat(about): glass text block, glass quote card, updated photo shadow"
```

---

## Task 11: Redesign Principles section

**Files:**
- Modify: `src/components/sections/principles.tsx`

- [ ] **Step 1: Replace `.glass-card` with `LiquidGlassShell` on each quote card**

In `principles.tsx`, change the `<motion.li>` element. Replace:

```tsx
<motion.li
  key={item.attribution}
  variants={staggerItem}
  className="card-hover-atelier-dark group glass-card relative flex flex-col rounded-xl p-7 lg:p-9"
>
```

With:

```tsx
<motion.li
  key={item.attribution}
  variants={staggerItem}
>
  <LiquidGlassShell
    tintOpacity={0.15}
    filter="glass-distortion-soft"
    borderRadius="1rem"
    enableHover
    className="w-full card-hover-atelier-dark group relative"
    contentClassName="flex flex-col p-7 lg:p-9"
  >
```

And close with `</LiquidGlassShell>` before `</motion.li>`.

Also add import:
```tsx
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
```

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
```

Scroll to Principles. Quote cards have dark glass (very light tint over navy). Text is white, quote marks in gold.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/principles.tsx
git commit -m "feat(principles): replace glass-card with LiquidGlassShell (dark, tintOpacity 0.15)"
```

---

## Task 12: Redesign FAQ accordion

**Files:**
- Modify: `src/components/sections/faq.tsx`

- [ ] **Step 1: Wrap each FAQ item in LiquidGlassShell**

In `faq.tsx`, change the `<motion.li>` for each FAQ item. Replace:

```tsx
<motion.li
  key={item.q}
  initial={{ opacity: 0, y: 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-5% 0%" }}
  transition={{ duration: 0.55, delay: i * 0.04, ease: smooth }}
  className="overflow-hidden rounded-xl border border-warm-line/70 bg-white transition-shadow duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:shadow-[var(--shadow-long)]"
>
```

With:

```tsx
<motion.li
  key={item.q}
  initial={{ opacity: 0, y: 16 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-5% 0%" }}
  transition={{ duration: 0.55, delay: i * 0.04, ease: smooth }}
>
  <LiquidGlassShell
    lightVariant
    tintOpacity={0.45}
    blur={20}
    filter="glass-distortion-soft"
    borderRadius="0.75rem"
    className="w-full overflow-hidden"
    contentClassName="flex flex-col"
  >
```

And close with `</LiquidGlassShell>` before `</motion.li>`.

Also remove the `space-y-3` class from the `<ul>` and replace with `space-y-3` (keep it as-is — each `motion.li` now has a gap via the parent ul's space-y).

Add import:
```tsx
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
```

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
```

Scroll to FAQ. Each question is an individual glass card. Gold particles still float in the background. Expand/collapse animation still works.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/faq.tsx
git commit -m "feat(faq): each accordion item is a light glass island"
```

---

## Task 13: Redesign CTA Banner

**Files:**
- Modify: `src/components/sections/cta-banner.tsx`

- [ ] **Step 1: Wrap content container in LiquidGlassShell**

In `cta-banner.tsx`, wrap the `<div className="relative grid ...">` inside the gradient `motion.div`:

Replace the existing inner content:
```tsx
<div className="relative grid gap-8 lg:gap-10 lg:grid-cols-12 items-center">
  <div className="lg:col-span-8">
    <h2 className="font-serif text-balance text-white">
      {ctaBanner.title}
    </h2>
    <p className="mt-4 sm:mt-5 max-w-2xl text-white/80 text-base sm:text-lg leading-relaxed">
      {ctaBanner.desc}
    </p>
  </div>
  <div className="lg:col-span-4 lg:flex lg:justify-end">
    <ButtonLink
      href="#contact"
      size="lg"
      variant="gold"
      withArrow
      className="w-full lg:w-auto"
    >
      {ctaBanner.button}
    </ButtonLink>
  </div>
</div>
```

With:
```tsx
<LiquidGlassShell
  tintOpacity={0.20}
  filter="glass-distortion-soft"
  borderRadius="1.25rem"
  className="w-full"
  contentClassName="grid gap-8 lg:gap-10 lg:grid-cols-12 items-center p-8 lg:p-10"
>
  <div className="lg:col-span-8">
    <h2 className="font-serif text-balance text-white">
      {ctaBanner.title}
    </h2>
    <p className="mt-4 sm:mt-5 max-w-2xl text-white/80 text-base sm:text-lg leading-relaxed">
      {ctaBanner.desc}
    </p>
  </div>
  <div className="lg:col-span-4 lg:flex lg:justify-end">
    <LiquidGlassShell
      tintOpacity={0.30}
      filter="glass-distortion-soft"
      borderRadius="9999px"
    >
      <a
        href="#contact"
        className="inline-flex items-center gap-2 px-8 h-14 text-base font-semibold text-gold-light hover:text-white transition-colors whitespace-nowrap w-full justify-center lg:w-auto"
      >
        {ctaBanner.button}
        <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M7 17L17 7M17 7H7M17 7v10" />
        </svg>
      </a>
    </LiquidGlassShell>
  </div>
</LiquidGlassShell>
```

Remove the `ButtonLink` import if it's no longer used. Add `LiquidGlassShell` import.

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
```

Scroll to CTA. The content box should be a glass card on top of the navy gradient. Button is a glass pill with gold text.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/cta-banner.tsx
git commit -m "feat(cta-banner): glass content container and glass pill button"
```

---

## Task 14: Redesign Contact section

**Files:**
- Modify: `src/components/sections/contact.tsx`

- [ ] **Step 1: Wrap form in LiquidGlassShell and update input styles**

In `contact.tsx`, replace the `motion.form` element. The form container changes from `bg-white` to glass.

Replace:
```tsx
<motion.form
  onSubmit={handleSubmit}
  initial={{ opacity: 0, y: 32 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-8% 0%" }}
  transition={{ duration: 0.85, ease: smooth }}
  className="lg:col-span-7 relative rounded-xl border border-warm-line/70 bg-white p-7 sm:p-10 lg:p-12 shadow-[var(--shadow-long)]"
>
```

With:
```tsx
<div className="lg:col-span-7">
  <LiquidGlassShell
    lightVariant
    tintOpacity={0.50}
    blur={24}
    filter="glass-distortion-soft"
    borderRadius="1.5rem"
    className="w-full"
  >
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0%" }}
      transition={{ duration: 0.85, ease: smooth }}
      className="p-7 sm:p-10 lg:p-12 w-full"
    >
```

And close both `</motion.form>` and `</LiquidGlassShell>` and `</div>`.

Update `Field` input className from `bg-cream-deep/50 border border-warm-line` to `bg-white/30 border border-white/40 focus:border-gold/50`:

```tsx
className="mt-2 block w-full rounded-full border border-white/40 bg-white/30 px-5 h-12 text-sm text-navy placeholder:text-navy-muted/60 focus:outline-none focus:border-gold/50 focus:bg-white/50 focus:ring-4 focus:ring-gold/10 transition-[border-color,background-color,box-shadow] duration-300"
```

Update `TextareaField` similarly:
```tsx
className="mt-2 block w-full rounded-2xl border border-white/40 bg-white/30 px-5 py-4 text-sm text-navy placeholder:text-navy-muted/60 focus:outline-none focus:border-gold/50 focus:bg-white/50 focus:ring-4 focus:ring-gold/10 transition-[border-color,background-color,box-shadow] duration-300 resize-none"
```

Update `SelectField` similarly:
```tsx
className="mt-2 block w-full appearance-none rounded-full border border-white/40 bg-white/30 px-5 h-12 text-sm text-navy focus:outline-none focus:border-gold/50 focus:bg-white/50 focus:ring-4 focus:ring-gold/10 transition-[border-color,background-color,box-shadow] duration-300"
```

Also wrap the submit `Button` in a glass pill:
```tsx
<LiquidGlassShell
  lightVariant
  tintOpacity={0.65}
  filter="glass-distortion-soft"
  borderRadius="9999px"
  className="w-full sm:w-auto shrink-0"
>
  <button
    type="submit"
    disabled={sent}
    className="inline-flex items-center gap-2 px-8 h-12 text-sm font-medium text-navy hover:text-gold-dark transition-colors whitespace-nowrap disabled:opacity-50"
  >
    {sent ? (
      <span className="inline-flex items-center gap-2">
        <Check className="size-4" />
        {contact.messageSent}
      </span>
    ) : (
      contact.formLabels.submit
    )}
  </button>
</LiquidGlassShell>
```

Add import:
```tsx
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
```

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
```

Scroll to Contact. Form is a glass card. Inputs have glass-style styling. Submit is a glass pill.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/contact.tsx
git commit -m "feat(contact): glass form container, glass inputs, glass submit button"
```

---

## Task 15: Redesign Location section

**Files:**
- Modify: `src/components/sections/location.tsx`

- [ ] **Step 1: Wrap address card column in LiquidGlassShell**

In `location.tsx`, wrap the left column (`<div className="lg:col-span-5">`) content in a `LiquidGlassShell`:

Replace:
```tsx
<div className="lg:col-span-5">
  <Reveal>...</Reveal>
  ...
</div>
```

With:
```tsx
<div className="lg:col-span-5">
  <LiquidGlassShell
    lightVariant
    tintOpacity={0.45}
    blur={20}
    filter="glass-distortion-soft"
    borderRadius="1rem"
    contentClassName="p-7 lg:p-9"
    className="w-full"
  >
    <Reveal>
      <Eyebrow align="centerOnMobile">{location.eyebrow}</Eyebrow>
    </Reveal>
    <Reveal delay={0.1}>
      <h2 className="mt-6 font-serif text-balance text-navy">
        {location.title}
      </h2>
    </Reveal>
    <Reveal delay={0.18}>
      <p className="mt-5 text-lg text-navy-soft leading-relaxed">
        {location.desc}
      </p>
    </Reveal>
    <Reveal delay={0.25}>
      <div className="mt-9 space-y-5 border-t border-gold/25 pt-7">
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 border border-white/50 text-gold-dark">
            <MapPin className="size-4" strokeWidth={1.5} />
          </span>
          <address className="not-italic text-navy leading-relaxed">
            <div>{brand.address.street}</div>
            <div>{brand.address.zip} {t.cityLabel}</div>
            <div>{t.country}</div>
          </address>
        </div>
        <div className="flex gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/60 border border-white/50 text-gold-dark">
            <Clock className="size-4" strokeWidth={1.5} />
          </span>
          <div className="text-navy leading-relaxed">{t.officeHours}</div>
        </div>
      </div>
    </Reveal>
    <Reveal delay={0.32}>
      <a
        href={brand.map.link}
        target="_blank"
        rel="noopener"
        className="mt-10 inline-flex items-center gap-2 text-sm text-gold-dark hover:text-navy transition-colors group"
      >
        <span className="border-b border-gold/40 group-hover:border-navy">
          {location.openMaps}
        </span>
        <ArrowUpRight className="size-4" />
      </a>
    </Reveal>
  </LiquidGlassShell>
</div>
```

Also update the map embed wrapper border-radius to `1rem` and remove the `bg-white border border-warm-line/70` since it's already `overflow-hidden`:
```tsx
className="lg:col-span-7 relative rounded-[1rem] overflow-hidden shadow-[var(--shadow-long)]"
```

Add import:
```tsx
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
```

- [ ] **Step 2: Verify build + visual check**

```bash
npm run build && npm run dev
```

Scroll to Location. Left address card is glass. Map has clean rounded corners.

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/location.tsx
git commit -m "feat(location): glass address card"
```

---

## Task 16: Redesign Footer

**Files:**
- Modify: `src/components/sections/footer.tsx`

- [ ] **Step 1: Wrap the bottom address/contact block in LiquidGlassShell**

In `footer.tsx`, wrap the `<div className="mt-14 grid gap-6 sm:grid-cols-2 border-t border-white/15 pt-8">` in a `LiquidGlassShell`:

Replace:
```tsx
<div className="mt-14 grid gap-6 sm:grid-cols-2 border-t border-white/15 pt-8">
  <address ...>...</address>
  <div ...>...</div>
</div>
```

With:
```tsx
<div className="mt-14">
  <LiquidGlassShell
    tintOpacity={0.12}
    filter="glass-distortion-soft"
    borderRadius="1rem"
    className="w-full"
    contentClassName="grid gap-6 sm:grid-cols-2 p-6 lg:p-8"
  >
    <address className="not-italic text-xs text-white/75 leading-relaxed">
      <span className="block uppercase tracking-[0.22em] text-gold-light mb-2">
        {footer.officeLabel}
      </span>
      {brand.address.street}
      <br />
      {brand.address.zip} {t.cityLabel}, {t.country}
    </address>
    <div className="text-xs text-white/75 leading-relaxed sm:text-right">
      <span className="block uppercase tracking-[0.22em] text-gold-light mb-2">
        {footer.getInTouchLabel}
      </span>
      <a
        href={`mailto:${brand.email}`}
        className="hover:text-white transition-colors"
      >
        {brand.email}
      </a>
      <br />
      <a
        href={brand.whatsapp}
        target="_blank"
        rel="noopener"
        className="hover:text-white transition-colors"
      >
        {brand.phone}
      </a>
    </div>
  </LiquidGlassShell>
</div>
```

Add import:
```tsx
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
```

- [ ] **Step 2: Verify full build + complete visual pass**

```bash
npm run build && npm run dev
```

Do a complete scroll-through of `http://localhost:3000/en`. Check each section:
- Navbar: floating pill, glass effect
- Hero: orbital blobs, counters animate on scroll, glass CTAs and card
- Services: transparent bg, glass cards, spinning sticker
- Why Us: dark glass cards on navy
- About: glass text block and quote card
- Principles: dark glass quote cards
- FAQ: glass accordion items
- CTA Banner: glass content box + glass button
- Contact: glass form
- Location: glass address card
- Footer: glass address block at bottom

- [ ] **Step 3: Commit**

```bash
git add src/components/sections/footer.tsx
git commit -m "feat(footer): glass address block at bottom of footer"
```

---

## Self-Review Checklist (run before offering execution)

- [x] **Spec §2 (lightVariant):** Task 1 implements it exactly as specced — tint, border, shadow, shine, content class.
- [x] **Spec §3 (Navbar island):** Task 6 — pill shape, scroll-driven opacity/scale, nested glass CTA, mobile glass sheet.
- [x] **Spec §4a (Hero blobs):** Tasks 2+3 — CSS keyframes for 3 blobs with correct colors, sizes, blend mode.
- [x] **Spec §4b (Hero photo):** Task 7 — blue gradient removed, gold vignette at base.
- [x] **Spec §4c (Road):** Task 2 — `--road-color-hero` var + road-overlay hero segment uses it.
- [x] **Spec §4d (Counters):** Tasks 4+7 — `useCountUp` hook with IntersectionObserver, `StatCounter` component in hero.
- [x] **Spec §4e (Hero buttons):** Task 7 — glass pills with `tintOpacity` hierarchy.
- [x] **Spec §4f (Attorney card):** Task 7 — glass card with `tintOpacity: 0.45`.
- [x] **Spec §5a (Services bg):** Task 8 — `bg-cream-deep/60` removed.
- [x] **Spec §5b (Service cards):** Task 8 — LiquidGlassShell with all correct params.
- [x] **Spec §5c (Card alignment):** Task 8 — min-heights on header/title/subtitle, flex-grow on body, mt-auto on CTA.
- [x] **Spec §5d (Spinning sticker):** Tasks 5+8 — `SpinningBadge` with `animateTransform`, counter-rotating icon, `textLength` for exact fit.
- [x] **Spec §6 (Why Us):** Task 9 — dark glass cards with `tintOpacity: 0.18`.
- [x] **Spec §7 (About):** Task 10 — glass text block, updated photo shadow and gradient.
- [x] **Spec §8 (Principles):** Task 11 — dark glass with `tintOpacity: 0.15`.
- [x] **Spec §9 (FAQ):** Task 12 — glass accordion, `blur: 20`.
- [x] **Spec §10 (CTA Banner):** Task 13 — glass container `tintOpacity: 0.20`, glass button `tintOpacity: 0.30`.
- [x] **Spec §11 (Contact):** Task 14 — glass form `tintOpacity: 0.50`, glass inputs, glass submit.
- [x] **Spec §12 (Location):** Task 15 — glass address card `tintOpacity: 0.45`.
- [x] **Spec §13 (Footer):** Task 16 — glass bottom block `tintOpacity: 0.12`.
- [x] **Spec §15 (LiquidGlassDefs placement):** Task 1 — added to root layout.
- [x] **Type consistency:** `useCountUp` returns `{ count: number, ref: RefObject<HTMLElement> }`. `StatCounter` casts to `RefObject<HTMLDivElement>` — correct since `HTMLDivElement extends HTMLElement`.
- [x] **No placeholders:** all code blocks are complete.
