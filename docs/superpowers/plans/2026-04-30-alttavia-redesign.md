# Alttavia Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the atelier-boutique visual redesign described in `docs/superpowers/specs/2026-04-30-alttavia-redesign-design.md` — extend tokens, build a scroll-driven SVG road behind all content, transform every section, and add atelier-vocabulary primitives (concentric rings, marquee, pulse, long shadows).

**Architecture:** Pure UI work in the existing Next.js 16 / React 19 / Tailwind v4 / Framer Motion stack. No new heavy deps. New atelier primitives live under `src/components/ui/`. The road is its own subsystem under `src/components/road/`. Section transformations stay inside `src/components/sections/*.tsx`. New design tokens extend the existing `@theme` block in `src/app/globals.css`. Copy in `src/content/messages.ts` is preserved.

**Tech Stack:** Next.js 16.2, React 19, TypeScript 5, Tailwind CSS v4 (via @tailwindcss/postcss), Framer Motion 12.38, cobe 2.0.1 (preserved), lucide-react.

**Branch:** Work continues on `develop-split-a`.

---

## Pre-flight

Before starting any task:

1. Ensure the dev server is running. From repo root:
   ```bash
   npm run dev
   ```
   Default URL: `http://localhost:3000` → redirects to `http://localhost:3000/en` (default locale).

2. Have two browser windows open: one at desktop width (`>= 1280px`), one at mobile width (`375px`). Both will be needed for visual verification on every section.

3. Each section task ends with a visual verification step. **A section is not done until verified at both 375px and 1280px+.** This rule comes from prior incidents where SSR-only sanity checks missed layout collisions on mobile.

4. After every commit, run typecheck + lint:
   ```bash
   npx tsc --noEmit
   npx eslint .
   ```
   Both must pass before moving to the next task.

5. Verify `prefers-reduced-motion` once per phase by toggling the OS setting (macOS: System Settings → Accessibility → Display → "Reduce motion"; Windows: Settings → Accessibility → Visual effects → "Animation effects" off).

---

## File Structure

### Files to create

| Path | Responsibility |
|---|---|
| `src/components/ui/concentric-rings.tsx` | Atelier micromark — SVG of N concentric hairline rings, configurable color/size/count. |
| `src/components/ui/marquee.tsx` | Generic infinite horizontal scroller; renders content twice (second copy `aria-hidden`); pauses on hover when `(hover: hover)`. |
| `src/components/road/road-path.ts` | Path-data constants and helpers (master `d` string + per-breakpoint variants + clip definitions). |
| `src/components/road/road-marker.tsx` | Single animated gold dot. Pulses on viewport entry. |
| `src/components/road/road-overlay.tsx` | The main wrapper: SVG covering main+footer, scroll-driven `stroke-dashoffset`, per-section path clipping for color shift. Renders `<RoadMarker>` children. |

### Files to modify

| Path | Change |
|---|---|
| `src/app/globals.css` | Add new tokens (`--shadow-long*`, `--road-*`, `--ease-smooth`, `--marquee-duration`, `--pulse-duration`), `@keyframes` for `marquee` and `pulse-soft`, and `@utility` rules for `.card-hover-atelier`. |
| `src/app/[locale]/page.tsx` | Wrap `<main>` and `<Footer>` inside a `<RoadOverlay>` so the road can span both. |
| `src/components/ui/eyebrow.tsx` | Replace legacy color aliases (`text-rose-gold-dark`, `bg-rose-gold/60`) with brand-token equivalents (`text-gold-dark`, `bg-gold/60`). |
| `src/components/ui/button.tsx` | Add `group` parent + arrow-icon `group-hover:translate-x-[2px] group-hover:-translate-y-[2px] transition-transform` microinteraction. |
| `src/components/ui/whatsapp-float.tsx` | Add subtle pulse loop (`animate-pulse-soft`, 4s, scale 1→1.03). |
| `src/components/sections/hero.tsx` | Long-shadow on portrait card, concentric ring micromark on floating card, `animate-pulse-soft` on primary CTA, increased stat spacing/size. |
| `src/components/sections/services.tsx` | Atelier serif numerals "01" / "02" upper-left of each card, unified card-hover, long-shadow on rest state. |
| `src/components/sections/why-us.tsx` | Concentric rings around the globe, serif numerals on glass cards, marquee strip at bottom (cities), unified card-hover. |
| `src/components/sections/about.tsx` | Long-shadow on portrait card, hairline gold above each stat, hover lift on quote-card. |
| `src/components/sections/principles.tsx` | **Switch section to navy bg**, transform 4 quote-cards to glass-cards with concentric ring micromarks, white quote text. |
| `src/components/sections/faq.tsx` | Long-shadow on item hover, plus button gold pulse on hover. |
| `src/components/sections/cta-banner.tsx` | Concentric ring micromark in upper-right of card, long-shadow-dark. |
| `src/components/sections/contact.tsx` | Long-shadow on form, atelier numerals near eyebrow, gold focus ring on inputs. |
| `src/components/sections/location.tsx` | Long-shadow on map card, hairline gold above address items. |
| `src/components/sections/footer.tsx` | Small gold concentric ring marker near "Crafted in Lisbon" line. |

---

## Task 1: Extend design tokens in globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1.1: Read the current `@theme` block to understand its shape.**

  Read `src/app/globals.css` lines 1–50.

- [ ] **Step 1.2: Append new tokens inside the existing `@theme` block (after the existing shadow tokens, before the closing `}`).**

  Append at the end of the `@theme` block (just before line `}` around the closing of `@theme`):

  ```css
  /* ------ Long shadows (atelier-boutique redesign) ------ */
  --shadow-long: 0 20px 60px rgba(14, 42, 71, 0.12), 0 8px 20px rgba(14, 42, 71, 0.06);
  --shadow-long-dark: 0 20px 60px rgba(0, 0, 0, 0.40), 0 8px 20px rgba(0, 0, 0, 0.20);
  --shadow-long-hover: 0 28px 80px rgba(14, 42, 71, 0.16), 0 12px 28px rgba(14, 42, 71, 0.08);
  --shadow-long-hover-dark: 0 28px 80px rgba(0, 0, 0, 0.48), 0 12px 28px rgba(0, 0, 0, 0.24);

  /* ------ Road tokens ------ */
  --road-color-light: #D4D4D4;
  --road-color-dark: #E3DAD0;
  --road-stroke: 2.5px;
  --road-stroke-mobile: 2px;
  --road-opacity: 0.6;
  --marker-color: #D0A12B;
  --marker-color-light: #E6B94A;

  /* ------ Animation tokens ------ */
  --ease-smooth: cubic-bezier(0.22, 0.61, 0.36, 1);
  --marquee-duration: 60s;
  --pulse-duration: 2.5s;
  --pulse-duration-cta: 3s;
  --pulse-duration-float: 4s;
  ```

- [ ] **Step 1.3: Append two new keyframes (after the existing `@keyframes float-up` block, before the `@media (prefers-reduced-motion: reduce)` block).**

  ```css
  @keyframes marquee {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  @keyframes pulse-soft {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(var(--pulse-scale, 1.03)); }
  }
  ```

- [ ] **Step 1.4: Append three new `@utility` rules (Tailwind v4 syntax) at the end of the file, after the `@media (prefers-reduced-motion)` block.**

  ```css
  @utility card-hover-atelier {
    transition: transform 500ms var(--ease-smooth), box-shadow 500ms var(--ease-smooth), border-color 500ms var(--ease-smooth);

    &:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-long-hover);
      border-color: rgba(208, 161, 43, 0.40);
    }
  }

  @utility card-hover-atelier-dark {
    transition: transform 500ms var(--ease-smooth), box-shadow 500ms var(--ease-smooth), border-color 500ms var(--ease-smooth);

    &:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-long-hover-dark);
      border-color: rgba(208, 161, 43, 0.50);
    }
  }

  @utility animate-pulse-soft {
    animation: pulse-soft var(--pulse-duration) var(--ease-smooth) infinite;
  }
  ```

- [ ] **Step 1.5: Verify typecheck and lint pass.**

  ```bash
  npx tsc --noEmit
  npx eslint .
  ```
  Expected: both clean.

- [ ] **Step 1.6: Visually verify nothing broke.**

  Open `http://localhost:3000` in both windows. Scroll top-to-bottom. Existing site should look identical to before — new tokens are not yet referenced anywhere.

- [ ] **Step 1.7: Commit.**

  ```bash
  git add src/app/globals.css
  git commit -m "feat(tokens): extend theme with atelier shadows, road, animation tokens"
  ```

---

## Task 2: Create `<ConcentricRings>` micromark component

**Files:**
- Create: `src/components/ui/concentric-rings.tsx`

- [ ] **Step 2.1: Create the file with this content.**

  ```tsx
  import { cn } from "@/lib/cn";

  type ConcentricRingsProps = {
    /** Number of rings (1–5). Default 3. */
    count?: 1 | 2 | 3 | 4 | 5;
    /** Outer-most ring radius in px. Default 24. */
    size?: number;
    /** Hairline stroke width in px. Default 0.75. */
    strokeWidth?: number;
    /** Stroke color (CSS color). Default "rgba(208,161,43,0.30)". Inner rings step down opacity. */
    color?: string;
    className?: string;
  };

  /**
   * Atelier micromark: a stack of concentric hairline rings.
   * Used as a corner ornament on cards, near logos, and around the globe.
   */
  export function ConcentricRings({
    count = 3,
    size = 24,
    strokeWidth = 0.75,
    color = "rgba(208,161,43,0.30)",
    className,
  }: ConcentricRingsProps) {
    const cx = size + strokeWidth;
    const cy = size + strokeWidth;
    const viewBoxSize = (size + strokeWidth) * 2;

    return (
      <svg
        aria-hidden
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        width={viewBoxSize}
        height={viewBoxSize}
        className={cn("pointer-events-none", className)}
      >
        {Array.from({ length: count }).map((_, i) => {
          // Inner rings get smaller and slightly more opaque
          const r = size * (1 - i * 0.22);
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              opacity={1 - i * 0.18}
            />
          );
        })}
      </svg>
    );
  }
  ```

- [ ] **Step 2.2: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/ui/concentric-rings.tsx
  ```
  Expected: both clean.

- [ ] **Step 2.3: Commit.**

  ```bash
  git add src/components/ui/concentric-rings.tsx
  git commit -m "feat(ui): add ConcentricRings atelier micromark"
  ```

---

## Task 3: Create `<Marquee>` component

**Files:**
- Create: `src/components/ui/marquee.tsx`

- [ ] **Step 3.1: Create the file with this content.**

  ```tsx
  "use client";

  import { cn } from "@/lib/cn";
  import type { ReactNode } from "react";

  type MarqueeProps = {
    children: ReactNode;
    /** CSS duration string. Defaults to var(--marquee-duration). */
    duration?: string;
    /** Whether to pause on hover (only on hover-capable devices). */
    pauseOnHover?: boolean;
    className?: string;
  };

  /**
   * Infinite horizontal marquee. Renders children twice; the duplicate is
   * aria-hidden so screen readers don't double-read. Animation halts under
   * prefers-reduced-motion via the global rule in globals.css.
   */
  export function Marquee({
    children,
    duration,
    pauseOnHover = true,
    className,
  }: MarqueeProps) {
    return (
      <div
        className={cn(
          "group relative w-full overflow-hidden",
          className,
        )}
      >
        <div
          className={cn(
            "flex w-max items-center will-change-transform",
            pauseOnHover && "[@media(hover:hover)]:group-hover:[animation-play-state:paused]",
          )}
          style={{
            animation: `marquee ${duration ?? "var(--marquee-duration)"} linear infinite`,
          }}
        >
          <div className="flex shrink-0 items-center">{children}</div>
          <div aria-hidden className="flex shrink-0 items-center">{children}</div>
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 3.2: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/ui/marquee.tsx
  ```
  Expected: both clean.

- [ ] **Step 3.3: Commit.**

  ```bash
  git add src/components/ui/marquee.tsx
  git commit -m "feat(ui): add infinite horizontal Marquee component"
  ```

---

## Task 4: Create the road system

This task has four sub-deliverables: path data, marker, overlay, and finally page integration. Each step is independently committable.

**Files:**
- Create: `src/components/road/road-path.ts`
- Create: `src/components/road/road-marker.tsx`
- Create: `src/components/road/road-overlay.tsx`

- [ ] **Step 4.1: Create the path data file.**

  Create `src/components/road/road-path.ts`:

  ```ts
  /**
   * Master path data for the animated road overlay.
   *
   * The road is rendered into a viewBox sized to the wrapper element's
   * scrollHeight. Coordinates here are *normalized to a 1000-unit-wide grid*;
   * the SVG's preserveAspectRatio handles the actual mapping. Y-coordinates
   * scale with the wrapper's measured pixel height.
   */

  export type RoadVariant = "desktop" | "mobile";

  /**
   * The visible portions of the path, expressed as ratios of the wrapper height.
   * Section ratios are computed at runtime from the actual rendered DOM positions
   * (RoadOverlay measures section refs); these constants are only the curve-shape
   * waypoints that control personality.
   */
  export type SectionId =
    | "hero"
    | "services"
    | "whyus"
    | "about"
    | "principles"
    | "faq"
    | "ctaBanner"
    | "contact"
    | "location"
    | "footer";

  export const SECTION_IDS: readonly SectionId[] = [
    "hero",
    "services",
    "whyus",
    "about",
    "principles",
    "faq",
    "ctaBanner",
    "contact",
    "location",
    "footer",
  ] as const;

  /**
   * Sections rendered in navy. Used for per-section path coloring.
   * Keep in sync with the spec section 4.
   */
  export const NAVY_SECTIONS: ReadonlySet<SectionId> = new Set([
    "whyus",
    "principles",
    "footer",
  ]);

  /**
   * Master path for desktop. ViewBox is 1000 wide × dynamic height.
   * Multiple `M` commands produce the screen-edge "exit and re-enter" effect
   * (off-viewBox segments are simply not visible).
   *
   * Coordinates assume a viewBox of `0 0 1000 H` where H is the wrapper height.
   * Y-coordinates here are *placeholder ratios scaled to a reference 7000-tall page*;
   * the path generator below scales Y to the actual measured height.
   */
  const REFERENCE_HEIGHT = 7000;

  // Waypoints expressed as [x, y-ratio]. y-ratio is y / REFERENCE_HEIGHT
  // so the path scales gracefully across page heights.
  type Waypoint = [number, number]; // [x in 0–1000, yRatio in 0–1+]

  // Personality waypoints (see spec §5.2):
  //  1. Top center → sweep right through services
  //  2. Globe orbit (~270° anti-clockwise) in WhyUs around (right ~75%, mid)
  //  3. Sweep left → exit screen left in About
  //  4. Re-enter left → sweep right → exit right in Principles bottom
  //  5. CTA detour
  //  6. Location loop → straight descent into footer
  const DESKTOP_WAYPOINTS: Waypoint[] = [
    [500, 0.000],   // start top center
    [720, 0.040],
    [890, 0.080],   // services right side
    [950, 0.130],   // entering WhyUs upper right
    [820, 0.160],   // start orbit, descending into globe area
    [710, 0.200],
    [780, 0.230],   // orbit bottom-back
    [900, 0.225],   // orbit right
    [990, 0.190],   // orbit top-right
    [890, 0.150],   // closing orbit
    [780, 0.180],
    [600, 0.220],
    [350, 0.250],   // sweep left across About top
    [80, 0.270],
    [-80, 0.300],   // EXIT LEFT EDGE
    [-80, 0.330],   // re-enter left (off-viewBox above means invisible bridge)
    [120, 0.345],
    [400, 0.360],
    [700, 0.380],
    [950, 0.400],
    [1080, 0.420],  // EXIT RIGHT EDGE (Principles bottom)
    [1080, 0.450],  // re-enter right
    [880, 0.470],
    [600, 0.500],
    [350, 0.540],   // FAQ left-ish
    [200, 0.580],
    [120, 0.620],   // CTA detour: comes around card from left
    [180, 0.660],   // under the card horizontally
    [400, 0.665],
    [620, 0.660],
    [780, 0.690],
    [800, 0.730],   // descending into Contact
    [620, 0.760],
    [430, 0.790],   // Location
    [380, 0.820],
    [450, 0.850],   // small loop in Location
    [560, 0.870],
    [560, 0.900],
    [500, 0.940],
    [500, 1.000],   // exits bottom (footer)
  ];

  const MOBILE_WAYPOINTS: Waypoint[] = [
    [500, 0.000],
    [620, 0.060],
    [720, 0.110],
    [780, 0.180],   // single curve near globe (no full orbit)
    [620, 0.230],
    [400, 0.270],
    [220, 0.310],
    [320, 0.380],
    [500, 0.430],
    [680, 0.490],
    [620, 0.560],
    [400, 0.620],
    [300, 0.690],
    [400, 0.750],
    [520, 0.810],
    [500, 0.880],
    [500, 1.000],
  ];

  /**
   * Build the SVG path `d` string from waypoints, using cubic Béziers between
   * each pair (control points placed at one-third along the segment for smooth
   * curvature). The `M` command splits at jumps where x leaves the visible
   * viewBox to create the edge-exit/re-enter illusion.
   */
  export function buildPathD(variant: RoadVariant, totalHeight: number): string {
    const waypoints = variant === "desktop" ? DESKTOP_WAYPOINTS : MOBILE_WAYPOINTS;
    const scaleY = (yr: number) => yr * totalHeight;

    const cmds: string[] = [];
    let prevOffViewbox = false;

    for (let i = 0; i < waypoints.length; i++) {
      const [x, yr] = waypoints[i];
      const y = scaleY(yr);
      const offViewbox = x < -50 || x > 1050;

      if (i === 0) {
        cmds.push(`M ${x} ${y}`);
      } else if (prevOffViewbox && !offViewbox) {
        // Just re-entered visible area: lift pen with M
        cmds.push(`M ${x} ${y}`);
      } else {
        const [px, pyr] = waypoints[i - 1];
        const py = scaleY(pyr);
        const c1x = px + (x - px) / 3;
        const c1y = py + (y - py) / 3;
        const c2x = px + ((x - px) * 2) / 3;
        const c2y = py + ((y - py) * 2) / 3;
        // Add a slight tangent perturbation so the curve has personality
        const dx = (i % 2 === 0) ? 30 : -30;
        cmds.push(`C ${c1x + dx} ${c1y}, ${c2x - dx} ${c2y}, ${x} ${y}`);
      }

      prevOffViewbox = offViewbox;
    }

    return cmds.join(" ");
  }

  /**
   * Marker waypoint info for the gold dots placed along the path.
   * Each marker has a label (used for aria) and a y-ratio + x position.
   */
  export type RoadMarkerSpec = {
    id: string;
    x: number;
    yRatio: number;
    /** If true, marker uses the lighter gold (over navy). */
    onNavy?: boolean;
  };

  export const DESKTOP_MARKERS: readonly RoadMarkerSpec[] = [
    { id: "services-edge", x: 950, yRatio: 0.130 },
    { id: "globe-orbit", x: 820, yRatio: 0.160, onNavy: true },
    { id: "left-exit", x: 80, yRatio: 0.270 },
    { id: "right-exit", x: 950, yRatio: 0.400, onNavy: true },
    { id: "cta-detour", x: 120, yRatio: 0.620 },
    { id: "footer-arrival", x: 500, yRatio: 0.940 },
  ] as const;

  export const MOBILE_MARKERS: readonly RoadMarkerSpec[] = [
    { id: "globe-pass", x: 780, yRatio: 0.180, onNavy: true },
    { id: "left-curve", x: 220, yRatio: 0.310 },
    { id: "mid-arc", x: 680, yRatio: 0.490 },
    { id: "footer-arrival", x: 500, yRatio: 0.880 },
  ] as const;
  ```

- [ ] **Step 4.2: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/road/road-path.ts
  ```
  Expected: both clean.

- [ ] **Step 4.3: Commit road-path.**

  ```bash
  git add src/components/road/road-path.ts
  git commit -m "feat(road): add path data and marker specs"
  ```

- [ ] **Step 4.4: Create `src/components/road/road-marker.tsx`.**

  ```tsx
  "use client";

  import { motion } from "framer-motion";
  import type { RoadMarkerSpec } from "./road-path";

  type RoadMarkerProps = {
    marker: RoadMarkerSpec;
    totalHeight: number;
  };

  /**
   * A single gold dot along the road. Pulses on viewport entry, then loops
   * a subtle pulse animation indefinitely.
   */
  export function RoadMarker({ marker, totalHeight }: RoadMarkerProps) {
    const cy = marker.yRatio * totalHeight;
    const fill = marker.onNavy ? "#E6B94A" : "#D0A12B";

    return (
      <motion.circle
        cx={marker.x}
        cy={cy}
        r={4.5}
        fill={fill}
        initial={{ scale: 0, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-10% 0%" }}
        transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
        style={{
          transformOrigin: `${marker.x}px ${cy}px`,
          transformBox: "fill-box",
          animation: "pulse-soft var(--pulse-duration) var(--ease-smooth) infinite",
        }}
      />
    );
  }
  ```

- [ ] **Step 4.5: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/road/road-marker.tsx
  ```
  Expected: both clean.

- [ ] **Step 4.6: Commit road-marker.**

  ```bash
  git add src/components/road/road-marker.tsx
  git commit -m "feat(road): add RoadMarker with viewport pulse"
  ```

- [ ] **Step 4.7: Create `src/components/road/road-overlay.tsx`.**

  ```tsx
  "use client";

  import { useEffect, useRef, useState } from "react";
  import { motion, useScroll, useTransform } from "framer-motion";
  import {
    buildPathD,
    DESKTOP_MARKERS,
    MOBILE_MARKERS,
    SECTION_IDS,
    NAVY_SECTIONS,
    type SectionId,
  } from "./road-path";
  import { RoadMarker } from "./road-marker";

  type RoadOverlayProps = {
    children: React.ReactNode;
  };

  type SectionRect = { id: SectionId; top: number; height: number };

  /**
   * Wraps the page content (everything below the navbar). Renders an absolutely
   * positioned SVG covering the full wrapper height. The road path is drawn by
   * scroll progress (stroke-dashoffset) and clipped per-section so the stroke
   * color shifts at light↔navy boundaries.
   *
   * Performance:
   *  - opacity 0.6 on the whole road group
   *  - pointer-events: none
   *  - z-index: 0; child sections must establish their own stacking context
   *    (e.g., `relative z-10`) so content stays above the road.
   */
  export function RoadOverlay({ children }: RoadOverlayProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [variant, setVariant] = useState<"desktop" | "mobile">("desktop");
    const [totalHeight, setTotalHeight] = useState(0);
    const [sectionRects, setSectionRects] = useState<SectionRect[]>([]);
    const [pathLength, setPathLength] = useState(1);
    const pathRef = useRef<SVGPathElement>(null);

    // Detect variant
    useEffect(() => {
      const mq = window.matchMedia("(min-width: 768px)");
      const update = () => setVariant(mq.matches ? "desktop" : "mobile");
      update();
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }, []);

    // Measure wrapper height + section positions
    useEffect(() => {
      if (!wrapperRef.current) return;
      const el = wrapperRef.current;

      const measure = () => {
        const wrapperTop = el.getBoundingClientRect().top + window.scrollY;
        setTotalHeight(el.scrollHeight);

        const rects: SectionRect[] = [];
        for (const id of SECTION_IDS) {
          // Hero is "#top"; everything else uses its anchor id;
          // footer is the only one that uses tag-based selection.
          let secEl: HTMLElement | null = null;
          if (id === "hero") {
            secEl = document.getElementById("top");
          } else if (id === "footer") {
            secEl = el.querySelector("footer");
          } else if (id === "ctaBanner") {
            // CtaBanner has no id; pick the section between #faq and #contact.
            // Fall back to scanning for an element with class containing "cta" sentinel.
            const sentinel = el.querySelector("[data-section='cta-banner']");
            secEl = sentinel as HTMLElement | null;
          } else {
            secEl = document.getElementById(id);
          }
          if (!secEl) continue;
          const rect = secEl.getBoundingClientRect();
          rects.push({
            id,
            top: rect.top + window.scrollY - wrapperTop,
            height: rect.height,
          });
        }
        setSectionRects(rects);
      };

      measure();
      const ro = new ResizeObserver(() => requestAnimationFrame(measure));
      ro.observe(el);
      window.addEventListener("load", measure);
      return () => {
        ro.disconnect();
        window.removeEventListener("load", measure);
      };
    }, []);

    // Measure path length once it renders
    useEffect(() => {
      if (!pathRef.current) return;
      setPathLength(pathRef.current.getTotalLength());
    }, [totalHeight, variant]);

    // Scroll-driven dashoffset.
    // offset: progress 0 when the wrapper's top hits the viewport top (page load,
    // since navbar is fixed and the wrapper starts at scrollY ≈ 0),
    // progress 1 when the wrapper's bottom hits the viewport bottom (scrolled to
    // the very bottom of the page).
    const { scrollYProgress } = useScroll({
      target: wrapperRef,
      offset: ["start start", "end end"],
    });
    const strokeDashoffset = useTransform(
      scrollYProgress,
      [0, 1],
      [pathLength, 0],
    );

    const pathD = totalHeight ? buildPathD(variant, totalHeight) : "";
    const markers = variant === "desktop" ? DESKTOP_MARKERS : MOBILE_MARKERS;

    return (
      <div ref={wrapperRef} className="relative">
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          width="100%"
          height={totalHeight || "100%"}
          viewBox={`0 0 1000 ${totalHeight || 1}`}
          preserveAspectRatio="none"
          style={{ overflow: "visible" }}
        >
          <defs>
            {sectionRects.map((s) => (
              <clipPath key={s.id} id={`road-clip-${s.id}`} clipPathUnits="userSpaceOnUse">
                <rect x="-200" y={s.top} width="1400" height={s.height} />
              </clipPath>
            ))}
          </defs>
          <g style={{ opacity: "var(--road-opacity)", willChange: "transform" }}>
            {/* Master invisible path used as a length reference */}
            <path
              ref={pathRef}
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth="0"
            />
            {/* Per-section colored copies, animated via dashoffset */}
            {sectionRects.map((s) => (
              <motion.path
                key={s.id}
                d={pathD}
                fill="none"
                stroke={
                  NAVY_SECTIONS.has(s.id)
                    ? "var(--road-color-dark)"
                    : "var(--road-color-light)"
                }
                strokeLinecap="round"
                clipPath={`url(#road-clip-${s.id})`}
                vectorEffect="non-scaling-stroke"
                style={{
                  strokeWidth:
                    variant === "desktop"
                      ? "var(--road-stroke)"
                      : "var(--road-stroke-mobile)",
                  strokeDasharray: pathLength,
                  strokeDashoffset,
                  willChange: "stroke-dashoffset",
                }}
              />
            ))}
            {/* Markers */}
            {markers.map((m) => (
              <RoadMarker key={m.id} marker={m} totalHeight={totalHeight} />
            ))}
          </g>
        </svg>

        {/* Children render above the SVG via stacking context. Each section
            should already have `relative` positioning. */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
  ```

- [ ] **Step 4.8: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/road/road-overlay.tsx
  ```
  Expected: both clean.

- [ ] **Step 4.9: Commit road-overlay.**

  ```bash
  git add src/components/road/road-overlay.tsx
  git commit -m "feat(road): add RoadOverlay with scroll-driven dashoffset"
  ```

---

## Task 5: Refresh `<Eyebrow>` to brand tokens

The current `Eyebrow` uses legacy aliases (`text-rose-gold-dark`, `bg-rose-gold/60`). They map to the same colors today, but the redesign explicitly uses the canonical tokens.

**Files:**
- Modify: `src/components/ui/eyebrow.tsx`

- [ ] **Step 5.1: Replace the two color references in `Eyebrow` and `EyebrowSolo`.**

  In `src/components/ui/eyebrow.tsx`, change:

  ```tsx
  "flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-rose-gold-dark",
  ```
  to:
  ```tsx
  "flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-gold-dark",
  ```

  And change `bg-rose-gold/60` to `bg-gold/60` (4 occurrences total — 2 in `Eyebrow` and 2 in `EyebrowSolo`).

- [ ] **Step 5.2: Verify typecheck, lint, and visual.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/ui/eyebrow.tsx
  ```
  Open http://localhost:3000 and visually verify that eyebrow labels (e.g., "What we do", "Why Alttavia Relocation") render the same color as before — they should, since `--color-rose-gold-dark` and `--color-gold-dark` map to identical hex values.

- [ ] **Step 5.3: Commit.**

  ```bash
  git add src/components/ui/eyebrow.tsx
  git commit -m "refactor(eyebrow): use canonical gold brand tokens"
  ```

---

## Task 6: Button arrow microinteraction

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 6.1: Add `group` to the base classes and wrap the arrow icon in a span with `group-hover` transforms.**

  Replace the `base` constant:

  ```ts
  const base =
    "group inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] transition-all duration-300 ease-out rounded-full whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream disabled:opacity-50 disabled:cursor-not-allowed";
  ```

  Then update the two render sites where `<ArrowUpRight />` is rendered:

  ```tsx
  // Inside Button (around line 53)
  {withArrow && (
    <ArrowUpRight
      className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
      aria-hidden
    />
  )}

  // Inside ButtonLink (around line 73)
  {withArrow && (
    <ArrowUpRight
      className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
      aria-hidden
    />
  )}
  ```

- [ ] **Step 6.2: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/ui/button.tsx
  ```
  Expected: both clean.

- [ ] **Step 6.3: Visually verify the arrow shifts on hover.**

  Open http://localhost:3000. Hover over the Hero "Request my NIF" button. The arrow should slide up-right (2px right, 2px up) smoothly while the button itself lifts. At 375px width, hover doesn't apply (touch) — verify the icon still renders at rest position.

- [ ] **Step 6.4: Commit.**

  ```bash
  git add src/components/ui/button.tsx
  git commit -m "feat(button): add arrow icon hover microinteraction"
  ```

---

## Task 7: WhatsApp float subtle pulse

The pulse must NOT live on the `motion.a` itself — Framer Motion is already animating its `transform` for entrance/exit. Putting CSS `animation: pulse-soft` on the same element would conflict. Instead, wrap the inner `<svg>` icon in a `<span>` and apply the pulse there.

**Files:**
- Modify: `src/components/ui/whatsapp-float.tsx`

- [ ] **Step 7.1: Wrap the inner `<svg>` icon in a `<span>` carrying the pulse class.**

  Locate the existing `<svg>` inside the `motion.a`. Replace this fragment:

  ```tsx
  <svg
    className="size-6"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <path d="..." />
  </svg>
  ```

  with:

  ```tsx
  <span
    className="inline-flex animate-pulse-soft will-change-transform"
    style={{
      ["--pulse-duration" as string]: "var(--pulse-duration-float)",
      ["--pulse-scale" as string]: "1.03",
    } as React.CSSProperties}
  >
    <svg
      className="size-6"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="..." />
    </svg>
  </span>
  ```

  (Keep the existing `<path d="..." />` content unchanged — only its surrounding wrapper changes.)

- [ ] **Step 7.2: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/ui/whatsapp-float.tsx
  ```

- [ ] **Step 7.3: Visually verify.**

  Open http://localhost:3000. Scroll past 400px to make the float appear. Observe a subtle 4s pulse loop on the icon (the button itself stays still after entrance). Hover changes bg to gold normally — pulse continues. Toggle prefers-reduced-motion → pulse should freeze.

- [ ] **Step 7.4: Commit.**

  ```bash
  git add src/components/ui/whatsapp-float.tsx
  git commit -m "feat(whatsapp): add subtle pulse loop on icon"
  ```

---

## Task 8: Hero atelier polish

**Files:**
- Modify: `src/components/sections/hero.tsx`

- [ ] **Step 8.1: Add `relative z-10` to the section's children wrapper so the road sits behind.**

  In the existing `<Container size="wide" className="relative">` line, change to `<Container size="wide" className="relative z-10">`.

- [ ] **Step 8.2: Replace the portrait card's shadow.**

  Find the line:
  ```tsx
  className="relative aspect-[4/5] rounded-xl overflow-hidden shadow-[var(--shadow-card)] bg-champagne"
  ```
  Replace `shadow-[var(--shadow-card)]` with `shadow-[var(--shadow-long)]`.

- [ ] **Step 8.3: Replace the floating "Patrícia" card shadow and add a `<ConcentricRings>` micromark.**

  Add the import at the top:
  ```tsx
  import { ConcentricRings } from "@/components/ui/concentric-rings";
  ```

  Find the floating card (around line 144 in the existing file), and replace `shadow-[var(--shadow-card)]` with `shadow-[var(--shadow-long)]`. Just inside that card (after the opening `<motion.div>`), add the micromark:

  ```tsx
  <ConcentricRings
    count={3}
    size={14}
    className="absolute top-2 right-2 opacity-80"
  />
  ```

- [ ] **Step 8.4: Add subtle pulse to the primary CTA.**

  The button's own hover already animates `transform: -translate-y-0.5`. Putting CSS `animation: pulse-soft` directly on the `<a>` would fight that hover transform. Instead, wrap the primary `<ButtonLink>` in a `<span>` whose only job is the pulse.

  Replace this fragment:

  ```tsx
  <ButtonLink href="#contact" size="lg" withArrow>
    {hero.ctaPrimary}
  </ButtonLink>
  ```

  with:

  ```tsx
  <span
    className="inline-flex animate-pulse-soft will-change-transform"
    style={{
      ["--pulse-duration" as string]: "var(--pulse-duration-cta)",
      ["--pulse-scale" as string]: "1.02",
    } as React.CSSProperties}
  >
    <ButtonLink href="#contact" size="lg" withArrow>
      {hero.ctaPrimary}
    </ButtonLink>
  </span>
  ```

  This keeps the button's hover transform clean while the wrapper does the pulse.

- [ ] **Step 8.5: Increase stat row breathing room.**

  Find the `<motion.ul>` containing the stats and change `gap-6 sm:gap-10` to `gap-8 sm:gap-12`. Also change the `mt-14` to `mt-16` for more space below the CTA row.

- [ ] **Step 8.6: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/sections/hero.tsx
  ```

- [ ] **Step 8.7: Visual verification at 375px and 1280px.**

  - Desktop: portrait + floating card both have a much more present shadow. Tiny concentric rings visible upper-right of the floating card. CTA button visibly pulses every 3s without becoming distracting. Stat row has more air between numbers.
  - Mobile (375px): same elements stack; floating card now overlaps slightly less due to mt change. Concentric rings still visible. CTA pulses unchanged.
  - Toggle reduced-motion: pulse stops.

- [ ] **Step 8.8: Commit.**

  ```bash
  git add src/components/sections/hero.tsx
  git commit -m "feat(hero): atelier polish — long shadow, concentric mark, CTA pulse"
  ```

---

## Task 9: Services atelier polish

**Files:**
- Modify: `src/components/sections/services.tsx`

- [ ] **Step 9.1: Add `relative z-10` to Container.**

  Change `<Container size="wide">` to `<Container size="wide" className="relative z-10">`.

- [ ] **Step 9.2: Add long-shadow + unified card-hover utility on each card.**

  Find the `<motion.article>` className and replace:

  ```tsx
  className="group relative flex flex-col overflow-hidden rounded-xl bg-white border border-warm-line/70 p-8 sm:p-10 lg:p-12 shadow-[var(--shadow-soft)] transition-all duration-500 hover:border-gold/50 hover:shadow-[var(--shadow-card)]"
  ```

  with:

  ```tsx
  className="card-hover-atelier group relative flex flex-col overflow-hidden rounded-xl bg-white border border-warm-line/70 p-8 sm:p-10 lg:p-12 shadow-[var(--shadow-long)]"
  ```

- [ ] **Step 9.3: Add a serif numeral "01" / "02" upper-left of each card.**

  Just inside each `<motion.article>` (before the existing `<div className="flex items-start gap-5">`), insert:

  ```tsx
  <span
    className="absolute top-6 right-7 font-serif text-5xl text-gold/25 leading-none italic select-none pointer-events-none"
    aria-hidden
  >
    {String(i + 1).padStart(2, "0")}
  </span>
  ```

  (Top-right ensures it doesn't collide with the existing icon at top-left. The spec calls for upper-left, but the icon already lives there — using upper-right keeps the atelier mark legible and avoids stacking.)

- [ ] **Step 9.4: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/sections/services.tsx
  ```

- [ ] **Step 9.5: Visual verification at 375px and 1280px.**

  - Desktop: each service card now lifts visibly on hover, with the long-shadow growing and the border picking up the gold. "01" and "02" italic numerals sit in the upper-right corner in faint gold.
  - Mobile: numerals visible but don't crowd the icon row. Tag pill remains readable.

- [ ] **Step 9.6: Commit.**

  ```bash
  git add src/components/sections/services.tsx
  git commit -m "feat(services): atelier numerals, unified hover, long shadow"
  ```

---

## Task 10: WhyUs — globe rings, atelier numerals, marquee strip

**Files:**
- Modify: `src/components/sections/why-us.tsx`

- [ ] **Step 10.1: Import `ConcentricRings` and `Marquee`.**

  At the top of the file, add:

  ```tsx
  import { ConcentricRings } from "@/components/ui/concentric-rings";
  import { Marquee } from "@/components/ui/marquee";
  ```

- [ ] **Step 10.2: Add three concentric ring overlays around the globe.**

  Find the existing `<div aria-hidden ...>` that wraps the `<Globe />` (around lines 28–39). Just AFTER the closing `</div>` of that globe wrapper, add a sibling positioned similarly for the rings:

  ```tsx
  {/* Atelier concentric rings around the globe (behind the globe itself but above bg) */}
  <div
    aria-hidden
    className="pointer-events-none absolute hidden sm:block z-0"
    style={{
      left: "calc(-15% + 56vw)",
      bottom: "-25%",
      width: "min(70vw, 560px)",
      height: "min(70vw, 560px)",
    }}
  >
    <div className="relative w-full h-full">
      <ConcentricRings
        count={1}
        size={220}
        strokeWidth={0.5}
        color="rgba(208,161,43,0.30)"
        className="absolute inset-0 m-auto"
      />
      <ConcentricRings
        count={1}
        size={170}
        strokeWidth={0.5}
        color="rgba(208,161,43,0.20)"
        className="absolute inset-0 m-auto"
      />
      <ConcentricRings
        count={1}
        size={130}
        strokeWidth={0.5}
        color="rgba(208,161,43,0.12)"
        className="absolute inset-0 m-auto"
      />
    </div>
  </div>
  ```

- [ ] **Step 10.3: Add a serif numeral upper-right of each glass card.**

  Find the `<motion.li>` glass-card definition. Add inside the `<motion.li>` (just after opening) a serif numeral, similar pattern to Services:

  ```tsx
  <span
    className="absolute top-4 right-5 font-serif text-3xl text-gold-light/30 leading-none italic select-none pointer-events-none"
    aria-hidden
  >
    {String(i + 1).padStart(2, "0")}
  </span>
  ```

  Also: the `<motion.li>`'s className currently is `"group glass-card rounded-xl p-6 sm:p-8 transition-all duration-500 w-[82vw] sm:w-auto sm:min-w-0 snap-start flex-shrink-0"`. Add `relative card-hover-atelier-dark` to it:

  ```tsx
  className="card-hover-atelier-dark group glass-card relative rounded-xl p-6 sm:p-8 w-[82vw] sm:w-auto sm:min-w-0 snap-start flex-shrink-0"
  ```

  (Removing the `transition-all duration-500` that's now handled by the `card-hover-atelier-dark` utility.)

- [ ] **Step 10.4: Add the marquee strip at the bottom of the section.**

  After the closing `</div>` of the cards block (which contains the carousel), and BEFORE the closing `</Container>`, append:

  ```tsx
  {/* Cities-served marquee — closes the WhyUs section */}
  <div className="mt-16 sm:mt-20 -mx-5 sm:mx-0 border-t border-gold/20 pt-8">
    <Marquee>
      <CityLine />
    </Marquee>
  </div>
  ```

  Define `CityLine` at the bottom of the same file (after the `WhyUs` function):

  ```tsx
  const CITIES = [
    "LISBOA",
    "MADRID",
    "PARIS",
    "LONDON",
    "BERLIN",
    "ROMA",
    "VALLETTA",
    "NYC",
    "LA",
    "MIAMI",
    "CHICAGO",
    "HOUSTON",
    "SÃO PAULO",
    "RIO",
    "MEXICO CITY",
    "DUBAI",
    "SINGAPORE",
    "TOKYO",
    "SYDNEY",
  ] as const;

  function CityLine() {
    return (
      <div className="flex items-center gap-8 sm:gap-10 px-8 text-[0.7rem] sm:text-xs uppercase tracking-[0.18em] font-medium text-wheat/80">
        {CITIES.map((city, i) => (
          <span key={`${city}-${i}`} className="flex items-center gap-8 sm:gap-10">
            <span>{city}</span>
            <span className="text-gold-light/40" aria-hidden>·</span>
          </span>
        ))}
      </div>
    );
  }
  ```

- [ ] **Step 10.5: Add `relative z-10` to the section's `<Container>` to keep cards above the road.**

  The Container already has `className="relative z-10"`. Confirm the line currently reads:
  ```tsx
  <Container size="wide" className="relative z-10">
  ```
  If not, update.

- [ ] **Step 10.6: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/sections/why-us.tsx
  ```

- [ ] **Step 10.7: Visual verification at 375px and 1280px.**

  - Desktop: globe is haloed by three faint gold rings of decreasing opacity. Each glass card now lifts on hover with bigger shadow. Italic "01"–"04" sit upper-right of each card. Below the cards, a slow horizontal marquee of city names scrolls right-to-left at ~60s per loop. Hover pauses it.
  - Mobile: rings hidden (`hidden sm:block`). Marquee continues, slightly smaller font. Cards still scroll horizontally with their numerals.
  - Toggle reduced-motion: marquee freezes.

- [ ] **Step 10.8: Commit.**

  ```bash
  git add src/components/sections/why-us.tsx
  git commit -m "feat(why-us): globe rings, card numerals, cities marquee"
  ```

---

## Task 11: About atelier polish

**Files:**
- Modify: `src/components/sections/about.tsx`

- [ ] **Step 11.1: Add `relative z-10` to the Container.**

  Change `<Container size="wide">` to `<Container size="wide" className="relative z-10">`.

- [ ] **Step 11.2: Replace shadow on the portrait card.**

  Find `shadow-[var(--shadow-card)]` on the portrait container and replace with `shadow-[var(--shadow-long)]`.

- [ ] **Step 11.3: Replace shadow + add hover on the floating quote card.**

  Find the quote-card `<motion.div>` (currently uses `shadow-[var(--shadow-card)]`). Replace its className entirely with:

  ```tsx
  className="absolute -bottom-6 right-4 sm:-right-8 max-w-[calc(100%-2rem)] sm:max-w-sm rounded-xl bg-white border border-warm-line/70 p-6 shadow-[var(--shadow-long)] card-hover-atelier"
  ```

- [ ] **Step 11.4: Add hairline gold above each stat.**

  Find the stat `<dl>` (currently `mt-12 grid grid-cols-3 gap-6 sm:gap-10 border-t border-warm-line pt-8`). Replace `border-t border-warm-line` with `border-t border-gold/30` for the atelier hairline. Each stat already has its `dt`/`dd` structure; no further change.

- [ ] **Step 11.5: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/sections/about.tsx
  ```

- [ ] **Step 11.6: Visual verification at 375px and 1280px.**

  - Desktop: portrait shadow noticeably deeper. Quote-card now lifts on hover. The stat row separator is a fine gold hairline instead of the warm-line beige.
  - Mobile: same hairline visible. Quote-card hover doesn't apply (touch).

- [ ] **Step 11.7: Commit.**

  ```bash
  git add src/components/sections/about.tsx
  git commit -m "feat(about): long shadows, hover lift, gold hairline stats"
  ```

---

## Task 12: Principles — switch to navy + glass cards + ring micromarks

This is the largest single transformation: changing the section from light to navy, and re-styling the four quote-cards as glass-cards with concentric ring micromarks.

**Files:**
- Modify: `src/components/sections/principles.tsx`

- [ ] **Step 12.1: Import `ConcentricRings`.**

  At the top:
  ```tsx
  import { ConcentricRings } from "@/components/ui/concentric-rings";
  ```

- [ ] **Step 12.2: Switch section background to navy and update text colors.**

  Replace the `<section>` line:

  ```tsx
  <section id="principles" className="relative py-24 lg:py-32">
  ```

  with:

  ```tsx
  <section id="principles" className="relative py-28 lg:py-36 bg-navy text-white overflow-hidden isolate">
  ```

  Also update the heading and eyebrow inside. The current `<Eyebrow>` will use gold-dark which is too dark on navy. Override it with a wrapper class. Find the `<Reveal><Eyebrow>...</Eyebrow></Reveal>` block and replace the Eyebrow with an inline atelier eyebrow that picks up gold-light:

  ```tsx
  <Reveal>
    <div className="flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-gold-light justify-center">
      <span className="inline-block h-px w-8 bg-gold/70" aria-hidden />
      <span>{principles.eyebrow}</span>
      <span className="inline-block h-px w-8 bg-gold/70" aria-hidden />
    </div>
  </Reveal>
  ```

  Update the title element:
  ```tsx
  <h2 className="mt-6 font-serif text-balance text-white">
  ```
  (currently `text-navy` → change to `text-white`).

- [ ] **Step 12.3: Add a soft gold blob top-right (matching WhyUs treatment).**

  Just after the opening `<section>`, BEFORE the `<Container>`, add:

  ```tsx
  <div
    aria-hidden
    className="pointer-events-none absolute -top-40 right-[-15%] h-[520px] w-[520px] rounded-full blur-3xl opacity-25"
    style={{
      background:
        "radial-gradient(circle at center, rgba(208,161,43,0.5) 0%, transparent 65%)",
    }}
  />
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0"
    style={{
      background:
        "radial-gradient(ellipse at 50% 30%, transparent 20%, rgba(8, 16, 40, 0.55) 75%)",
    }}
  />
  ```

- [ ] **Step 12.4: Add `relative z-10` to the Container.**

  ```tsx
  <Container size="wide" className="relative z-10">
  ```

- [ ] **Step 12.5: Convert each quote-card to glass-card with a concentric ring micromark.**

  Replace the `<motion.li>` block. Old:

  ```tsx
  <motion.li
    key={item.attribution}
    variants={staggerItem}
    className="flex flex-col rounded-xl border border-warm-line/70 bg-white p-7 lg:p-9 shadow-[var(--shadow-soft)] transition-shadow duration-500 hover:shadow-[var(--shadow-card)]"
  >
    <Quote className="size-6 text-gold-dark" aria-hidden />
    <blockquote className="mt-5 font-serif italic text-lg lg:text-xl text-navy leading-relaxed">
      {item.quote}
    </blockquote>
    <div className="mt-auto pt-7 text-xs uppercase tracking-[0.22em] text-navy-muted">
      {item.attribution}
    </div>
  </motion.li>
  ```

  New:

  ```tsx
  <motion.li
    key={item.attribution}
    variants={staggerItem}
    className="card-hover-atelier-dark group glass-card relative flex flex-col rounded-xl p-7 lg:p-9"
  >
    <ConcentricRings
      count={3}
      size={20}
      strokeWidth={0.5}
      color="rgba(208,161,43,0.45)"
      className="absolute top-3 left-3 opacity-90"
    />
    <Quote className="size-6 text-gold-light ml-12" aria-hidden />
    <blockquote className="mt-5 font-serif italic text-lg lg:text-xl text-white/95 leading-relaxed">
      {item.quote}
    </blockquote>
    <div className="mt-auto pt-7 text-xs uppercase tracking-[0.22em] text-gold-light">
      {item.attribution}
    </div>
  </motion.li>
  ```

  (`ml-12` on the Quote icon shifts it right of the corner micromark.)

- [ ] **Step 12.6: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/sections/principles.tsx
  ```

- [ ] **Step 12.7: Visual verification at 375px and 1280px.**

  - Desktop: section is now deep navy with a faint gold radial blob upper-right and a vignette at edges. Eyebrow ("How we work") in gold-light. H2 in white. Four glass-cards with frosted background, gold concentric rings upper-left, white italic quotes, gold attribution. Hover lifts each card and the gold border intensifies.
  - Mobile: cards stack vertically (md:grid-cols-2 → 1 col below md). Concentric rings visible. Glass blur preserved.
  - Reduced-motion: hover transitions reduced to instant per global rule.

- [ ] **Step 12.8: Commit.**

  ```bash
  git add src/components/sections/principles.tsx
  git commit -m "feat(principles): switch to navy with glass quote-cards and ring marks"
  ```

---

## Task 13: FAQ atelier polish

**Files:**
- Modify: `src/components/sections/faq.tsx`

- [ ] **Step 13.1: Add `relative z-10` to the Container.**

  Already has `className="relative z-10"`. Confirm and skip if so.

- [ ] **Step 13.2: Add long-shadow on hover to each accordion item.**

  Find the `<motion.li>` and replace its className. Old:

  ```tsx
  className="overflow-hidden rounded-xl border border-warm-line/70 bg-white transition-shadow duration-300 hover:shadow-[var(--shadow-soft)]"
  ```

  New:

  ```tsx
  className="overflow-hidden rounded-xl border border-warm-line/70 bg-white transition-shadow duration-500 ease-[cubic-bezier(0.22,0.61,0.36,1)] hover:shadow-[var(--shadow-long)]"
  ```

- [ ] **Step 13.3: Add gold pulse on the plus button.**

  Find the plus icon span (the one with `transition-all duration-500` and `border-warm-line`). Add the pulse on the entire span:

  Old:
  ```tsx
  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-warm-line transition-all duration-500 ${
    isOpen
      ? "bg-navy text-white border-navy rotate-45"
      : "bg-white text-navy-soft"
  }`}
  ```

  New:
  ```tsx
  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ${
    isOpen
      ? "bg-navy text-white border-navy rotate-45"
      : "bg-white text-navy-soft border-warm-line group-hover:border-gold/50 group-hover:text-gold-dark"
  }`}
  ```

  Then add `group` to the parent `<button>` className:

  Old:
  ```tsx
  className="flex w-full items-center justify-between gap-6 px-6 sm:px-8 py-5 sm:py-6 text-left"
  ```

  New:
  ```tsx
  className="group flex w-full items-center justify-between gap-6 px-6 sm:px-8 py-5 sm:py-6 text-left"
  ```

- [ ] **Step 13.4: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/sections/faq.tsx
  ```

- [ ] **Step 13.5: Visual verification at 375px and 1280px.**

  - Desktop: hovering an FAQ item gives a long shadow and the plus button border picks up a gold tint with the icon turning gold-dark. Click expands as before.
  - Mobile: plus icon still readable. Hover doesn't apply, but tap still expands.

- [ ] **Step 13.6: Commit.**

  ```bash
  git add src/components/sections/faq.tsx
  git commit -m "feat(faq): long-shadow hover and gold plus-button affordance"
  ```

---

## Task 14: CtaBanner atelier polish

**Files:**
- Modify: `src/components/sections/cta-banner.tsx`

- [ ] **Step 14.1: Add `data-section="cta-banner"` to the section element so RoadOverlay can locate it.**

  Find the `<section>` line:
  ```tsx
  <section className="relative py-16 sm:py-20 lg:py-28">
  ```
  Replace with:
  ```tsx
  <section data-section="cta-banner" className="relative py-16 sm:py-20 lg:py-28">
  ```

- [ ] **Step 14.2: Add `relative z-10` to the Container.**

  ```tsx
  <Container size="wide" className="relative z-10">
  ```

- [ ] **Step 14.3: Import `ConcentricRings`.**

  ```tsx
  import { ConcentricRings } from "@/components/ui/concentric-rings";
  ```

- [ ] **Step 14.4: Replace card shadow + add micromark.**

  Find the `motion.div` of the card (className currently `"relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-deep via-navy to-navy-deep px-7 py-12 sm:px-14 sm:py-20 lg:px-20 lg:py-24 text-white"`). Add `shadow-[var(--shadow-long-dark)]` to it.

  Just inside the `motion.div` (BEFORE the existing decorative blob divs), insert:

  ```tsx
  <ConcentricRings
    count={3}
    size={28}
    strokeWidth={0.5}
    color="rgba(208,161,43,0.45)"
    className="absolute top-5 right-5 opacity-90 z-10"
  />
  ```

- [ ] **Step 14.5: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/sections/cta-banner.tsx
  ```

- [ ] **Step 14.6: Visual verification at 375px and 1280px.**

  - Desktop: gold concentric rings sit upper-right of the navy CTA card. Card has a deeper drop shadow.
  - Mobile: rings still visible inside the card padding. Stays out of the way of the heading.

- [ ] **Step 14.7: Commit.**

  ```bash
  git add src/components/sections/cta-banner.tsx
  git commit -m "feat(cta-banner): concentric rings mark, long-shadow-dark, section data-attr"
  ```

---

## Task 15: Contact atelier polish

**Files:**
- Modify: `src/components/sections/contact.tsx`

- [ ] **Step 15.1: Add `relative z-10` to the Container.**

  ```tsx
  <Container size="wide" className="relative z-10">
  ```

- [ ] **Step 15.2: Replace form card shadow.**

  Find the `<motion.form>` className (currently includes `shadow-[var(--shadow-soft)]`). Replace `shadow-[var(--shadow-soft)]` with `shadow-[var(--shadow-long)]`.

- [ ] **Step 15.3: Add gold focus ring to inputs and textarea.**

  In `Field`, find the `<input>` className. Replace:
  ```tsx
  className="mt-2 block w-full rounded-full border border-warm-line bg-cream-deep/50 px-5 h-12 text-sm text-navy placeholder:text-navy-muted/60 focus:outline-none focus:border-gold focus:bg-white transition-colors"
  ```
  with:
  ```tsx
  className="mt-2 block w-full rounded-full border border-warm-line bg-cream-deep/50 px-5 h-12 text-sm text-navy placeholder:text-navy-muted/60 focus:outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/15 transition-[border-color,background-color,box-shadow] duration-300"
  ```

  In `TextareaField`, do the same for the `<textarea>`:
  ```tsx
  className="mt-2 block w-full rounded-2xl border border-warm-line bg-cream-deep/50 px-5 py-4 text-sm text-navy placeholder:text-navy-muted/60 focus:outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/15 transition-[border-color,background-color,box-shadow] duration-300 resize-none"
  ```

  In `SelectField`, do the same for the `<select>`:
  ```tsx
  className="mt-2 block w-full appearance-none rounded-full border border-warm-line bg-cream-deep/50 px-5 h-12 text-sm text-navy focus:outline-none focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/15 transition-[border-color,background-color,box-shadow] duration-300"
  ```

- [ ] **Step 15.4: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/sections/contact.tsx
  ```

- [ ] **Step 15.5: Visual verification at 375px and 1280px.**

  - Desktop: form card now has long-shadow. Click into any input and a gold focus ring (15% opacity, 4px) appears around it.
  - Mobile: inputs are still pill-shaped, focus ring visible on tap.

- [ ] **Step 15.6: Commit.**

  ```bash
  git add src/components/sections/contact.tsx
  git commit -m "feat(contact): long-shadow form, gold focus ring on inputs"
  ```

---

## Task 16: Location atelier polish

**Files:**
- Modify: `src/components/sections/location.tsx`

- [ ] **Step 16.1: Add `relative z-10` to the Container.**

  ```tsx
  <Container size="wide" className="relative z-10">
  ```

- [ ] **Step 16.2: Replace shadow on the map card.**

  Find the `<motion.div>` wrapping the iframe. Replace `shadow-[var(--shadow-card)]` with `shadow-[var(--shadow-long)]`.

- [ ] **Step 16.3: Add a hairline gold separator above the address block.**

  Find the address `<div>` containing `<address>`. Wrap the address+hours block in a small additional element with a top hairline. Specifically, change:

  Old:
  ```tsx
  <Reveal delay={0.25}>
    <div className="mt-9 space-y-5">
  ```

  New:
  ```tsx
  <Reveal delay={0.25}>
    <div className="mt-9 space-y-5 border-t border-gold/25 pt-7">
  ```

- [ ] **Step 16.4: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/sections/location.tsx
  ```

- [ ] **Step 16.5: Visual verification at 375px and 1280px.**

  - Desktop: map shadow more pronounced. Hairline gold above the address area.
  - Mobile: hairline visible, map iframe shadow still felt.

- [ ] **Step 16.6: Commit.**

  ```bash
  git add src/components/sections/location.tsx
  git commit -m "feat(location): long-shadow map, gold hairline above address"
  ```

---

## Task 17: Footer atelier closing mark

**Files:**
- Modify: `src/components/sections/footer.tsx`

- [ ] **Step 17.1: Import `ConcentricRings`.**

  ```tsx
  import { ConcentricRings } from "@/components/ui/concentric-rings";
  ```

- [ ] **Step 17.2: Wrap the bottom row's "Crafted in Lisbon" line with a flex container that includes a closing concentric ring marker.**

  Find the line:
  ```tsx
  <p className="text-xs text-white/65">{footer.craftedIn}</p>
  ```

  Replace it with:

  ```tsx
  <div className="flex items-center gap-3">
    <p className="text-xs text-white/65">{footer.craftedIn}</p>
    <ConcentricRings
      count={3}
      size={10}
      strokeWidth={0.5}
      color="rgba(208,161,43,0.45)"
      className="opacity-90"
    />
  </div>
  ```

- [ ] **Step 17.3: Add `relative z-10` to the inner Container.**

  ```tsx
  <Container size="wide" className="relative z-10">
  ```

- [ ] **Step 17.4: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/components/sections/footer.tsx
  ```

- [ ] **Step 17.5: Visual verification at 375px and 1280px.**

  - Desktop: the "Crafted with care in Lisbon" line on the right now ends with a tiny set of three gold concentric rings.
  - Mobile: the rings sit next to the line on its own row (footer's `flex-col sm:flex-row` already handles stacking).

- [ ] **Step 17.6: Commit.**

  ```bash
  git add src/components/sections/footer.tsx
  git commit -m "feat(footer): concentric ring closing mark"
  ```

---

## Task 18: Wire `<RoadOverlay>` into the page

**Files:**
- Modify: `src/app/[locale]/page.tsx`

- [ ] **Step 18.1: Import `RoadOverlay`.**

  At the top of the file:
  ```tsx
  import { RoadOverlay } from "@/components/road/road-overlay";
  ```

- [ ] **Step 18.2: Wrap `<main>` and `<Footer>` inside `<RoadOverlay>`.**

  Replace the JSX body. Old:

  ```tsx
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Services />
        <WhyUs />
        <About />
        <Principles />
        <Faq />
        <CtaBanner />
        <Contact />
        <Location />
      </main>
      <Footer />
      <WhatsappFloat />
    </>
  );
  ```

  New:

  ```tsx
  return (
    <>
      <Navbar />
      <RoadOverlay>
        <main className="flex-1">
          <Hero />
          <Services />
          <WhyUs />
          <About />
          <Principles />
          <Faq />
          <CtaBanner />
          <Contact />
          <Location />
        </main>
        <Footer />
      </RoadOverlay>
      <WhatsappFloat />
    </>
  );
  ```

- [ ] **Step 18.3: Verify typecheck and lint.**

  ```bash
  npx tsc --noEmit
  npx eslint src/app/[locale]/page.tsx
  ```

- [ ] **Step 18.4: Visual verification at 375px and 1280px.**

  - Desktop: scroll from top to bottom of the page slowly. The road should appear behind all content with opacity ~60%, color shifting subtly between sections (gray on light bg, wheat on navy). At the WhyUs section, watch the road perform a partial orbit around the globe area. At ~30% of the page (About bottom), the road should slip off the left edge and reappear. Same at ~42% on the right edge. Six gold dots appear at marker positions, each pulsing softly. Resize the window — the road recomputes.
  - Mobile (375px): the road takes the simplified path (no edge exits, single curve through globe). Stroke is thinner. Markers still appear.
  - Reduced-motion: the road is fully drawn from the start (no scroll animation).
  - Open DevTools, check console for any warnings or errors.

- [ ] **Step 18.5: Commit.**

  ```bash
  git add src/app/[locale]/page.tsx
  git commit -m "feat(page): integrate RoadOverlay around main and footer"
  ```

---

## Task 19: Reduced-motion sweep

The global rule in `globals.css` already disables animations for `prefers-reduced-motion`. This task is a verification + targeted fix where needed.

- [ ] **Step 19.1: Toggle prefers-reduced-motion ON at the OS level.**

  Reload http://localhost:3000.

- [ ] **Step 19.2: Smoke-test each section.**

  Walk through each section and confirm:
  - Hero: text appears immediately, sublinhado SVG draws instantly, CTA pulse halted.
  - Services: cards appear without translate/opacity tween. Hover still works (no animation).
  - WhyUs: globe still rotates (cobe is internal — acceptable). Marquee static. Cards static on appear.
  - About: same.
  - Principles: glass-cards static.
  - FAQ: accordion opens/closes still animates briefly but no entrance reveal.
  - CtaBanner: card shows immediately.
  - Contact, Location, Footer: same.
  - Road: fully drawn from page load, no scroll animation. Marker pulses halted (animation-iteration-count is 1 globally).
  - WhatsApp float: appears statically, pulse halted.

- [ ] **Step 19.3: If any animation is still running under reduced-motion, file a fix in this same task.**

  The most likely culprits are inline `style={{ animation: ... }}` props (which the global rule still catches via `*` selector targeting `animation-duration`, but fragmenting `animation` shorthand can sometimes bypass). If found, change inline `animation: marquee 60s ...` to a class that maps the same animation, or add an explicit `@media (prefers-reduced-motion: reduce)` rule in the offending component.

  Specifically, double-check `src/components/ui/marquee.tsx` and `src/components/road/road-marker.tsx`. If marquee or marker pulse still runs with reduced-motion on, add a `@media (prefers-reduced-motion: reduce)` block inline via a CSS module or inline style — concretely, change `animation: marquee ...` to use Tailwind's `motion-safe:` prefix:

  In `marquee.tsx`, change the style attribute to be a className-driven approach — replace:
  ```tsx
  style={{
    animation: `marquee ${duration ?? "var(--marquee-duration)"} linear infinite`,
  }}
  ```
  with:
  ```tsx
  style={{
    ["--m-duration" as string]: duration ?? "var(--marquee-duration)",
  }}
  className={cn(
    "flex w-max items-center will-change-transform motion-safe:[animation:marquee_var(--m-duration)_linear_infinite]",
    pauseOnHover && "[@media(hover:hover)]:group-hover:[animation-play-state:paused]",
  )}
  ```
  (the inner div, around the Marquee body — apply this update only if Step 19.2 found marquee still running with reduced-motion).

- [ ] **Step 19.4: Toggle prefers-reduced-motion OFF and verify the full motion experience returns.**

- [ ] **Step 19.5: If a fix was made in Step 19.3, commit.**

  ```bash
  git add <touched files>
  git commit -m "fix(motion): respect prefers-reduced-motion in marquee/road"
  ```

  If no fix was needed, this task closes without a commit.

---

## Task 20: Mobile review at 375px

Final pass dedicated to mobile fidelity.

- [ ] **Step 20.1: Set the browser to 375px wide and reload.**

- [ ] **Step 20.2: Walk top-to-bottom and check each section.**

  - Hero: portrait stacks below text. Floating card not clipping. Concentric ring micromark not hidden. Stat row gap-8 still fits.
  - Services: cards full-width. Numerals upper-right not colliding with the tag pill.
  - WhyUs: cards horizontal-scroll carousel still works with peek. Globe rings hidden (sm:block). Marquee at small font legible. Card numerals visible.
  - About: portrait stacks above text. Quote-card no longer overlapping out-of-bounds. Hairline above stats correct.
  - Principles: now navy. Glass-cards stack vertically. Concentric rings visible. Quotes readable in white.
  - FAQ: accordion full-width. Plus button hover replaced by tap; tap-open state correct.
  - CtaBanner: rings inside the navy card don't crowd the heading.
  - Contact: form full-width. Focus ring visible.
  - Location: map full-width. Hairline above address.
  - Footer: 3-column collapses. Concentric rings near "Crafted in Lisbon" sits next to the line.
  - Road: simplified path visible, single curve through globe, no edge exits, ends at footer.
  - WhatsApp float: pulses subtly, doesn't overlap content.

- [ ] **Step 20.3: For each issue found, fix inline.**

  Common culprits at 375px in this codebase: portrait floating-cards exceeding viewport, marquee fonts too large, micromark coordinates colliding with content. Adjust paddings/margins or use `sm:` prefixes to scope desktop-only treatments. Run typecheck + lint after each fix.

- [ ] **Step 20.4: Commit any fixes.**

  ```bash
  git add <touched files>
  git commit -m "fix(mobile): 375px polish across redesign sections"
  ```

  If no fixes are needed, no commit.

---

## Self-Review Checklist (run before declaring complete)

- [ ] Spec section 5 (road behavior) — implemented in Tasks 4, 18.
- [ ] Spec section 6 (token additions) — implemented in Task 1.
- [ ] Spec section 7 (animation system additions) — implemented across Tasks 1, 3, 6, 7.
- [ ] Spec section 8 (marquee content) — implemented in Task 10.
- [ ] Spec section 9 (pulse effects) — implemented in Tasks 7, 8 (and road markers in Task 4).
- [ ] Spec section 10 (section transformations) — Tasks 8–17.
- [ ] Spec section 11 (mobile) — Task 20 + per-task verifications.
- [ ] Spec section 12 (accessibility) — `aria-hidden` on road and marquee duplicate, focus rings, heading hierarchy preserved.
- [ ] Spec section 14 (acceptance) — every task ends with typecheck, lint, visual at 375px+1280px, and a commit.
- [ ] No new dependencies added.
- [ ] No edits to `src/content/messages.ts`.
