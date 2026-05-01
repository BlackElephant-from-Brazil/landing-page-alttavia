# Liquid Glass — Session 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the `@alttavia/liquid-glass` library with 5 UI widgets and a DebugOverlay, then migrate all 12 Alttavia consumer files from the shim to direct package imports, and delete the legacy shim.

**Architecture:** Tasks 1–2 add widgets/debug to the package; Task 3 updates the root `index.ts` exports; Task 4 is a mechanical import-path migration across 12 Alttavia files; Task 5 removes the temporary shim and cleans up layout.tsx.

**Tech Stack:** React 19, TypeScript 5, Next.js 16 (App Router + Turbopack), Tailwind CSS v4, `@alttavia/liquid-glass` (local package at `packages/liquid-glass/`).

**Spec:** `docs/superpowers/specs/2026-04-30-liquid-glass-design.md` — Section 10 (widgets), Section 11 (Alttavia migration).

**Session 1 output:** `packages/liquid-glass/` fully scaffolded with `LiquidGlass`, `LiquidGlassShell`, `LiquidGlassDefs`, hooks, and WebGL map generator. All 12 Alttavia consumers currently import from `@/components/ui/LiquidGlass` (shim).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/liquid-glass/src/components/widgets/LensGlass.tsx` | Create | Circular magnifying-glass lens preset |
| `packages/liquid-glass/src/components/widgets/SearchboxGlass.tsx` | Create | Glass input field with squircle refraction |
| `packages/liquid-glass/src/components/widgets/SwitchGlass.tsx` | Create | Glass toggle switch |
| `packages/liquid-glass/src/components/widgets/SliderGlass.tsx` | Create | Glass range slider with circular bezel thumb |
| `packages/liquid-glass/src/components/widgets/PlayerGlass.tsx` | Create | Glass container for media player controls |
| `packages/liquid-glass/src/debug/DebugOverlay.tsx` | Create | Dev overlay rendering displacement map + stats |
| `packages/liquid-glass/src/components/LiquidGlass.tsx` | Modify | Add `debug` prop, render DebugOverlay |
| `packages/liquid-glass/src/index.ts` | Modify | Add widget + debug exports |
| `src/components/sections/navbar.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/sections/hero.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/sections/services.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/sections/why-us.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/sections/about.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/sections/principles.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/sections/faq.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/sections/cta-banner.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/sections/contact.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/sections/location.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/sections/footer.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/components/ui/spinning-badge.tsx` | Modify | Import from `@alttavia/liquid-glass` |
| `src/app/layout.tsx` | Modify | Remove `LiquidGlassDefs` import + JSX |
| `src/components/ui/LiquidGlass.tsx` | Delete | Shim no longer needed after migration |

---

## Task 1: UI Widgets

**Files:**
- Create: `packages/liquid-glass/src/components/widgets/LensGlass.tsx`
- Create: `packages/liquid-glass/src/components/widgets/SearchboxGlass.tsx`
- Create: `packages/liquid-glass/src/components/widgets/SwitchGlass.tsx`
- Create: `packages/liquid-glass/src/components/widgets/SliderGlass.tsx`
- Create: `packages/liquid-glass/src/components/widgets/PlayerGlass.tsx`

### Prop table

| Widget | Surface | `power` | `bezelWidth` | `strength` |
|--------|---------|---------|--------------|------------|
| `LensGlass` | circle | 2 | 10% of size | 1.5 |
| `SearchboxGlass` | squircle | 6 | 14 | 0.5 |
| `SwitchGlass` | squircle | 6 | 12 | 1.0 |
| `SliderGlass` | circle | 2 | 10 | 1.2 |
| `PlayerGlass` | squircle | 6 | 20 | 0.7 |

`power=2` produces a circle (Euclidean SDF); `power=6` is the Apple squircle default.

- [ ] **Step 1: Create `packages/liquid-glass/src/components/widgets/LensGlass.tsx`**

```tsx
"use client";

import { type ReactNode } from "react";
import { LiquidGlass } from "../LiquidGlass";

export type LensGlassProps = {
  /** Diameter in px (component is always square). */
  size?: number;
  children?: ReactNode;
  className?: string;
};

/**
 * Circular magnifying-glass lens.
 * Uses power=2 (Euclidean circle SDF) and strong displacement for maximum lens effect.
 */
export function LensGlass({ size = 200, children, className = "" }: LensGlassProps) {
  const bezelWidth = Math.round(size * 0.1);
  return (
    <LiquidGlass
      bezelWidth={bezelWidth}
      power={2}
      strength={1.5}
      specular={{ opacity: 0.6, saturation: 1.2, angle: -1.05 }}
      borderRadius="9999px"
      lightVariant
      tintOpacity={0.08}
      className={`items-center justify-center shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </LiquidGlass>
  );
}
```

- [ ] **Step 2: Create `packages/liquid-glass/src/components/widgets/SearchboxGlass.tsx`**

```tsx
"use client";

import { type ChangeEvent, type InputHTMLAttributes } from "react";
import { LiquidGlass } from "../LiquidGlass";

export type SearchboxGlassProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className"
> & {
  containerClassName?: string;
  inputClassName?: string;
};

/**
 * Glass input field with squircle light refraction.
 */
export function SearchboxGlass({
  containerClassName = "",
  inputClassName = "",
  ...inputProps
}: SearchboxGlassProps) {
  return (
    <LiquidGlass
      bezelWidth={14}
      power={6}
      strength={0.5}
      specular={{ opacity: 0.2, saturation: 1, angle: -1.05 }}
      borderRadius="9999px"
      lightVariant
      tintOpacity={0.12}
      blur={16}
      className={`items-center ${containerClassName}`}
      contentClassName="px-4 py-2"
    >
      <input
        {...inputProps}
        className={`bg-transparent outline-none w-full text-sm placeholder:text-black/40 text-black ${inputClassName}`}
      />
    </LiquidGlass>
  );
}
```

- [ ] **Step 3: Create `packages/liquid-glass/src/components/widgets/SwitchGlass.tsx`**

```tsx
"use client";

import { LiquidGlass } from "../LiquidGlass";

export type SwitchGlassProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
};

/**
 * Glass toggle switch. The thumb slides within a glass pill track.
 */
export function SwitchGlass({ checked, onChange, label, disabled = false }: SwitchGlassProps) {
  return (
    <label
      className={`inline-flex items-center gap-3 cursor-pointer select-none ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative w-14 h-8 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      >
        <LiquidGlass
          bezelWidth={12}
          power={6}
          strength={1.0}
          specular={{ opacity: 0.35, saturation: 1, angle: -1.05 }}
          borderRadius="9999px"
          lightVariant={!checked}
          tintOpacity={checked ? 0.6 : 0.25}
          blur={12}
          className="absolute inset-0 items-center"
          style={{ background: checked ? "rgba(208,161,43,0.35)" : undefined }}
        >
          {/* Thumb */}
          <span
            className="absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-200"
            style={{ left: checked ? "calc(100% - 1.75rem)" : "0.25rem" }}
          />
        </LiquidGlass>
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}
```

- [ ] **Step 4: Create `packages/liquid-glass/src/components/widgets/SliderGlass.tsx`**

```tsx
"use client";

import { type ChangeEvent } from "react";
import { LiquidGlass } from "../LiquidGlass";

export type SliderGlassProps = {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  className?: string;
};

/**
 * Glass range slider. The thumb has a convex circular bezel (power=2).
 */
export function SliderGlass({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  label,
  className = "",
}: SliderGlassProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && <span className="text-sm text-current/70">{label}</span>}
      <div className="relative flex items-center h-8">
        {/* Track */}
        <LiquidGlass
          bezelWidth={6}
          power={6}
          strength={0.4}
          specular={{ opacity: 0.15, saturation: 1, angle: -1.05 }}
          borderRadius="9999px"
          lightVariant
          tintOpacity={0.18}
          blur={8}
          className="w-full h-2 items-center overflow-hidden"
        >
          {/* Fill */}
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-current/20"
            style={{ width: `${pct}%` }}
          />
        </LiquidGlass>

        {/* Thumb -- a small glass circle that moves along the track */}
        <div
          className="absolute -translate-x-1/2"
          style={{ left: `${pct}%` }}
        >
          <LiquidGlass
            bezelWidth={10}
            power={2}
            strength={1.2}
            specular={{ opacity: 0.5, saturation: 1.1, angle: -1.05 }}
            borderRadius="9999px"
            lightVariant
            tintOpacity={0.3}
            blur={10}
            style={{ width: 28, height: 28 }}
            className="items-center justify-center shrink-0"
          />
        </div>

        {/* Native range for interaction (invisible, sits on top) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
          aria-label={label}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `packages/liquid-glass/src/components/widgets/PlayerGlass.tsx`**

```tsx
"use client";

import { type ReactNode } from "react";
import { LiquidGlass } from "../LiquidGlass";

export type PlayerGlassProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Glass container for media player controls.
 * Squircle surface with subtle specular highlight.
 */
export function PlayerGlass({ children, className = "", contentClassName = "" }: PlayerGlassProps) {
  return (
    <LiquidGlass
      bezelWidth={20}
      power={6}
      strength={0.7}
      specular={{ opacity: 0.3, saturation: 1.2, angle: -1.05 }}
      borderRadius="16px"
      tintOpacity={0.5}
      blur={20}
      className={className}
      contentClassName={`p-4 flex items-center gap-4 ${contentClassName}`}
    >
      {children}
    </LiquidGlass>
  );
}
```

- [ ] **Step 6: Commit widgets**

```bash
git add packages/liquid-glass/src/components/widgets/
git commit -m "feat(liquid-glass): add 5 UI widgets (Lens, Searchbox, Switch, Slider, Player)"
```

---

## Task 2: DebugOverlay + `debug` prop

**Files:**
- Create: `packages/liquid-glass/src/debug/DebugOverlay.tsx`
- Modify: `packages/liquid-glass/src/components/LiquidGlass.tsx` (add `debug` prop)

- [ ] **Step 1: Create `packages/liquid-glass/src/debug/DebugOverlay.tsx`**

```tsx
"use client";

import type { MapGenResult } from "../gl/generate-map";

type Props = {
  maps: MapGenResult;
  filterId: string;
  width: number;
  height: number;
};

/**
 * Dev overlay activated by <LiquidGlass debug>.
 * Shows displacement map and filter metadata in a floating panel.
 */
export function DebugOverlay({ maps, filterId, width, height }: Props) {
  return (
    <div
      className="absolute inset-0 z-50 pointer-events-none flex flex-col gap-2 p-2"
      style={{ fontSize: 10, fontFamily: "monospace" }}
    >
      {/* Displacement map preview */}
      <div className="flex gap-2 items-start">
        <div>
          <div className="text-yellow-300 mb-1">displacement map</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={maps.displacementUrl}
            alt="displacement map"
            width={Math.min(width / 2, 120)}
            height={Math.min(height / 2, 60)}
            style={{ imageRendering: "pixelated", border: "1px solid rgba(255,255,0,0.3)" }}
          />
        </div>
        <div>
          <div className="text-yellow-300 mb-1">specular map</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={maps.specularUrl}
            alt="specular map"
            width={Math.min(width / 2, 120)}
            height={Math.min(height / 2, 60)}
            style={{ imageRendering: "pixelated", border: "1px solid rgba(255,255,0,0.3)" }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="text-yellow-300/80 leading-relaxed bg-black/50 px-2 py-1 rounded w-fit">
        <div>filter: #{filterId}</div>
        <div>size: {width}×{height}px</div>
        <div>maxDisp: {maps.maxDisplacement}px</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `debug` prop to `LiquidGlass`**

In `packages/liquid-glass/src/components/LiquidGlass.tsx`:

Add `debug?: boolean` to `LiquidGlassProps`:
```tsx
export type LiquidGlassProps = {
  // ... existing props ...
  /** Show displacement map + filter stats overlay. Dev only. */
  debug?: boolean;
};
```

Add `debug = false` to the destructured parameters:
```tsx
export function LiquidGlass({
  // ... existing params ...
  debug = false,
}: LiquidGlassProps) {
```

Add a dynamic import for DebugOverlay and render it. Insert this import at the top of the component body (after filterId):
```tsx
  // In the return, inside the outermost div, after the SVG filter block:
  {debug && maps && (
    <DebugOverlay maps={maps} filterId={filterId} width={width} height={height} />
  )}
```

And add the import at the top of the file:
```tsx
import { DebugOverlay } from "../debug/DebugOverlay";
```

The full updated LiquidGlass.tsx is shown in Step 3 below.

- [ ] **Step 3: Write full updated `packages/liquid-glass/src/components/LiquidGlass.tsx`**

```tsx
"use client";

import { type ReactNode, useId, useRef } from "react";
import type { SpecularOptions } from "../gl/generate-map";
import { useResizeObserver } from "../hooks/useResizeObserver";
import { useFeatureDetect } from "../hooks/useFeatureDetect";
import { useDisplacementMap } from "../hooks/useDisplacementMap";
import { DebugOverlay } from "../debug/DebugOverlay";

export type LiquidGlassProps = {
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Bezel width in pixels. The ring around the edge that gets refracted. */
  bezelWidth?: number;
  /** Squircle exponent -- 6 = Apple default. 2 = circle. Higher = more rectangular. */
  power?: number;
  /** Displacement strength multiplier. */
  strength?: number;
  specular?: SpecularOptions;
  /** Additional backdrop blur in px (stacked on the filter). */
  blur?: number;
  /** White tint (light surfaces) vs dark tint. */
  lightVariant?: boolean;
  tintOpacity?: number;
  borderRadius?: string;
  style?: React.CSSProperties;
  /** Show displacement map + filter stats overlay. Dev only. */
  debug?: boolean;
  /** @deprecated use bezelWidth/power/strength instead */
  filter?: string;
  /** @deprecated ignored -- kept for drop-in compatibility with LiquidGlassShell */
  enableHover?: boolean;
};

export function LiquidGlass({
  children,
  className = "",
  contentClassName = "",
  bezelWidth = 20,
  power = 6,
  strength = 1,
  specular = { opacity: 0.4, saturation: 1, angle: -Math.PI / 3 },
  blur = 20,
  lightVariant = false,
  tintOpacity = 0.55,
  borderRadius = "24px",
  style,
  debug = false,
}: LiquidGlassProps) {
  const rawId = useId();
  const filterId = `lg-${rawId.replace(/:/g, "")}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const { width, height } = useResizeObserver(containerRef);
  const { backdropFilterUrl, backdropFilter } = useFeatureDetect();
  const maps = useDisplacementMap(width, height, { bezelWidth, power, strength, specular });

  const tintColor = lightVariant
    ? `rgba(255,255,255,${tintOpacity})`
    : `rgba(18,18,18,${tintOpacity})`;

  const borderColor = lightVariant
    ? "rgba(255,255,255,0.50)"
    : "rgba(255,255,255,0.12)";

  const shineGradient = lightVariant
    ? "linear-gradient(180deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.06) 40%,rgba(255,255,255,0.10) 100%)"
    : "linear-gradient(180deg,rgba(255,255,255,0.08) 0%,rgba(255,255,255,0.02) 40%,rgba(255,255,255,0.04) 100%)";

  const outerShadow = lightVariant
    ? "0 4px 24px rgba(0,0,0,0.06),0 0 0 1px rgba(208,161,43,0.08)"
    : "0 4px 24px rgba(0,0,0,0.1),0 0 1px rgba(255,255,255,0.1)";

  const hasFilter = backdropFilterUrl && maps !== null;
  const backdropValue = hasFilter
    ? `url(#${filterId})${blur > 0 ? ` blur(${blur}px)` : ""}`
    : backdropFilter
    ? `blur(${blur}px) saturate(140%)`
    : "none";

  return (
    <div
      ref={containerRef}
      className={`relative flex ${className}`}
      style={{ borderRadius, boxShadow: outerShadow, ...style }}
    >
      {hasFilter && maps && (
        <svg
          style={{ display: "none", position: "absolute" }}
          aria-hidden
          focusable="false"
        >
          <defs>
            <filter
              id={filterId}
              x="0%" y="0%" width="100%" height="100%"
              colorInterpolationFilters="sRGB"
              filterUnits="objectBoundingBox"
            >
              <feImage href={maps.displacementUrl} result="dispMap" preserveAspectRatio="none" />
              <feDisplacementMap
                in="SourceGraphic"
                in2="dispMap"
                scale={maps.maxDisplacement}
                xChannelSelector="R"
                yChannelSelector="G"
                result="refracted"
              />
              <feImage href={maps.specularUrl} result="specular" preserveAspectRatio="none" />
              <feBlend in="refracted" in2="specular" mode="screen" />
            </filter>
          </defs>
        </svg>
      )}

      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ borderRadius: "inherit" }}
      >
        <div
          className="absolute inset-0 z-0"
          suppressHydrationWarning
          style={{
            backdropFilter: backdropValue,
            WebkitBackdropFilter: backdropValue,
          }}
        />
        <div className="absolute inset-0 z-[1]" style={{ background: tintColor }} />
        <div
          className="absolute inset-0 z-[2]"
          style={{
            background: shineGradient,
            boxShadow:
              "inset 1px 1px 0 0 rgba(255,255,255,0.12),inset -1px -1px 0 0 rgba(255,255,255,0.06)",
          }}
        />
      </div>

      <div
        className="absolute inset-0 z-[2] pointer-events-none"
        style={{ borderRadius: "inherit", border: `1px solid ${borderColor}` }}
      />

      <div
        className={`relative z-[3] w-full ${lightVariant ? "" : "text-white"} ${contentClassName}`}
        style={lightVariant ? undefined : { textShadow: "0 1px 2px rgba(0,0,0,0.14)" }}
      >
        {children}
      </div>

      {debug && maps && (
        <DebugOverlay maps={maps} filterId={filterId} width={width} height={height} />
      )}
    </div>
  );
}

export { LiquidGlass as LiquidGlassShell };

export function LiquidGlassDefs() {
  return null;
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/liquid-glass/src/debug/ packages/liquid-glass/src/components/LiquidGlass.tsx
git commit -m "feat(liquid-glass): DebugOverlay + debug prop on LiquidGlass"
```

---

## Task 3: Update package `index.ts`

**Files:**
- Modify: `packages/liquid-glass/src/index.ts`

- [ ] **Step 1: Update `packages/liquid-glass/src/index.ts`**

Replace the entire file with:

```ts
// Core component
export { LiquidGlass, LiquidGlassShell, LiquidGlassDefs } from "./components/LiquidGlass";
export type { LiquidGlassProps } from "./components/LiquidGlass";

// Widgets
export { LensGlass } from "./components/widgets/LensGlass";
export type { LensGlassProps } from "./components/widgets/LensGlass";
export { SearchboxGlass } from "./components/widgets/SearchboxGlass";
export type { SearchboxGlassProps } from "./components/widgets/SearchboxGlass";
export { SwitchGlass } from "./components/widgets/SwitchGlass";
export type { SwitchGlassProps } from "./components/widgets/SwitchGlass";
export { SliderGlass } from "./components/widgets/SliderGlass";
export type { SliderGlassProps } from "./components/widgets/SliderGlass";
export { PlayerGlass } from "./components/widgets/PlayerGlass";
export type { PlayerGlassProps } from "./components/widgets/PlayerGlass";

// Debug
export { DebugOverlay } from "./debug/DebugOverlay";

// Types
export type { SpecularOptions, MapGenResult } from "./gl/generate-map";
export type { FeatureSupport } from "./hooks/useFeatureDetect";
```

- [ ] **Step 2: Commit**

```bash
git add packages/liquid-glass/src/index.ts
git commit -m "feat(liquid-glass): export widgets and debug from index"
```

---

## Task 4: Alttavia migration — update import paths

**Goal:** Change each section file's import from `"@/components/ui/LiquidGlass"` to `"@alttavia/liquid-glass"`. The component names (`LiquidGlassShell`) and all props are unchanged — this is purely an import path change.

**Background:** The new `LiquidGlassShell` from `@alttavia/liquid-glass` accepts all the old props. The `filter` prop (e.g., `filter="glass-distortion-soft"`) is typed as `filter?: string` and is silently ignored at runtime — the new implementation generates its own physics-based filter. The visual result will differ slightly (WebGL refraction instead of feTurbulence), which is the intended upgrade.

- [ ] **Step 1: Update `src/components/sections/navbar.tsx`**

Change line 9:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 2: Update `src/components/sections/hero.tsx`**

Change:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 3: Update `src/components/sections/services.tsx`**

Change:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 4: Update `src/components/sections/why-us.tsx`**

Change:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 5: Update `src/components/sections/about.tsx`**

Change:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 6: Update `src/components/sections/principles.tsx`**

Change:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 7: Update `src/components/sections/faq.tsx`**

Change:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 8: Update `src/components/sections/cta-banner.tsx`**

Change:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 9: Update `src/components/sections/contact.tsx`**

Change:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 10: Update `src/components/sections/location.tsx`**

Change:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 11: Update `src/components/sections/footer.tsx`**

Change:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 12: Update `src/components/ui/spinning-badge.tsx`**

Change line 1:
```tsx
import { LiquidGlassShell } from "@alttavia/liquid-glass";
```

- [ ] **Step 13: Commit all migrations**

```bash
git add src/components/sections/ src/components/ui/spinning-badge.tsx
git commit -m "feat(alttavia): migrate all LiquidGlassShell usages to @alttavia/liquid-glass"
```

---

## Task 5: Remove shim + clean up layout

**Files:**
- Delete: `src/components/ui/LiquidGlass.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Remove `LiquidGlassDefs` from `src/app/layout.tsx`**

The `LiquidGlassDefs` component is now a no-op (returns `null`) — it was only needed for the old global SVG filter approach. Remove both the import and the JSX usage.

The updated `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Spectral, Inter } from "next/font/google";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Delete the shim**

```bash
rm src/components/ui/LiquidGlass.tsx
```

- [ ] **Step 3: Verify dev server still compiles**

```bash
npm run dev
```

Expected: `✓ Compiled` with no TypeScript errors. Check all pages still render with the glass effect.

- [ ] **Step 4: Commit cleanup**

```bash
git add src/app/layout.tsx
git rm src/components/ui/LiquidGlass.tsx
git commit -m "chore(alttavia): remove LiquidGlass shim and LiquidGlassDefs from layout"
```

---

## Self-review notes

- **Spec coverage:** All 5 widgets covered (Task 1). DebugOverlay (Task 2). All 12 Alttavia migration files covered in Task 4 steps 1–12. `layout.tsx` update in Task 5. Shim removal in Task 5.
- **Placeholder scan:** None. All widget code is complete. All import paths are exact.
- **Type consistency:** `LiquidGlassProps.debug` is `boolean | undefined`; `DebugOverlay` receives `MapGenResult | null` guarded by `debug && maps &&`. Widgets import `LiquidGlass` from the relative path `"../LiquidGlass"` which resolves correctly inside `src/components/widgets/`.
- **Breaking change guard:** The `filter` prop on `LiquidGlassShell` (e.g., `filter="glass-distortion-soft"`) is preserved as `filter?: string` in `LiquidGlassProps` — TypeScript will not complain and it is silently ignored at runtime. No consumer files need prop changes.
