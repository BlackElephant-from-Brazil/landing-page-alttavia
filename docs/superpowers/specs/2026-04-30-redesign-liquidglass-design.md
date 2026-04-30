# Redesign: Full Island / Liquid Glass — Alttavia Landing Page

**Date:** 2026-04-30  
**Branch:** develop-split-a  
**Scope:** Complete redesign — all 11 sections

---

## 1. Decisions locked in

| Question | Decision |
|---|---|
| Glass variant | **Light glass** — white semi-transparent tint, navy text, same SVG filters as `LiquidGlass.tsx` |
| Scope | **Full redesign** — every section gets the island treatment |
| Rotating tag text | `"CERTIFIED LAWYERS · ZERO MIDDLEMEN ·"` × 2 |
| Rotating tag icon | `Scale` (Lucide) |
| Rotating tag placement | Decorative sticker, `absolute top-0 right-0` on Services `<section>`, partially offscreen |
| Hero gradient | Animated orbital blobs (CSS `@keyframes`, no JS) |
| Counter trigger | Viewport (`IntersectionObserver`), fires once |
| Global approach | **Approach A — Everything island** — glass from navbar to footer |

---

## 2. LiquidGlass component changes

The existing `LiquidGlassShell` in `src/components/ui/LiquidGlass.tsx` gets a **light variant** added alongside the current dark one.

```tsx
// New prop
lightVariant?: boolean   // default false (preserves current dark behaviour)
```

When `lightVariant: true`:
- Tint layer: `rgba(255, 255, 255, 0.55)` instead of `rgba(18, 18, 18, tintOpacity)`
- Border: `1px solid rgba(255, 255, 255, 0.50)` (slightly more opaque than dark variant)
- Content wrapper: removes `text-white` and `textShadow`; content inherits color from parent (navy by default)
- Box-shadow: `0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(208,161,43,0.08)` (subtle gold ring)
- Shine layer gradient: `rgba(255,255,255,0.18) → rgba(255,255,255,0.06) → rgba(255,255,255,0.10)` (slightly brighter than dark variant)

SVG filters, `feDisplacementMap`, `feSpecularLighting`, blur, and all other parameters are **identical** to the dark variant. The `LiquidGlassDefs` SVG block is unchanged.

The dark variant (`lightVariant: false`) is untouched — used for future dark-background needs.

---

## 3. Navbar Island

**Layout change:** `fixed inset-x-0` full-width → `fixed top-4 left-1/2 -translate-x-1/2 z-50`  
**Shape:** `border-radius: 9999px` (pill)  
**Max-width:** `780px` desktop, `90vw` mobile  
**Glass:** `LiquidGlassShell` lightVariant, `filter: glass-distortion-soft`, `blur: 24px`, `tintOpacity: 0.55`

**Scroll behaviour:**
- `scrollY < 12`: opacity 0.92, `scale(0.99)`, shadow minimal
- `scrollY ≥ 12`: opacity 1.0, `scale(1.0)`, shadow `0 8px 32px rgba(0,0,0,0.10)` — island never disappears

**Internal layout** (unchanged from today):
- Left: Logo
- Center: nav links (hidden on mobile)
- Right: LanguageSwitcher + CTA button

**CTA button inside navbar:** Nested `LiquidGlassShell` pill (`tintOpacity: 0.65`, `border-radius: 9999px`). Slightly more opaque than the navbar itself to create a "button within glass" hierarchy. Text navy, hover: bg shifts to `rgba(208,161,43,0.25)` (gold tint).

**Mobile:** Pill shows Logo + hamburger only. Mobile menu sheet slides from top with `LiquidGlassShell` background (`tintOpacity: 0.80`, `border-radius: 1.5rem`, fills ~80vh).

---

## 4. Hero Section

### 4a. Background — animated orbital blobs

Remove the two static `radial-gradient` blobs. Replace with a new `<HeroBlobs />` component (`src/components/ui/hero-blobs.tsx`) containing 3 blobs:

| Blob | Size | Position | Keyframe duration | Colors |
|---|---|---|---|---|
| 1 | 600px | top-right | 18s | `rgba(224,207,159,0.55)` → `rgba(208,161,43,0.35)` |
| 2 | 400px | bottom-left | 14s (reverse) | `rgba(208,161,43,0.50)` → `rgba(230,185,74,0.25)` |
| 3 | 280px | center-right | 22s (offset start) | `rgba(208,161,43,0.30)` → transparent |

Each blob: `position: absolute`, `border-radius: 50%`, `blur-3xl`, `mix-blend-mode: multiply`, `pointer-events-none`, `will-change: transform`. Keyframes use `translate` only (no opacity flash) for smooth GPU animation.

### 4b. Hero photo

- Remove `bg-gradient-to-t from-navy-deep/35` (the blue gradient)
- Replace with `bg-gradient-to-t from-gold/10 via-transparent to-transparent` (very subtle gold vignette at base only)

### 4c. Road / traçado

The existing `RoadOverlay` is **not rewritten**. Only the CSS variable for the hero segment color changes:

```css
/* globals.css */
--road-color-hero: var(--color-gold); /* #D0A12B */
```

In `road-overlay.tsx`, the hero section's `motion.path` gets `stroke="var(--road-color-hero)"` instead of `var(--road-color-light)`. All other segments unchanged.

### 4d. Stat counters (800+, 100%, 100%)

New hook `src/hooks/useCountUp.ts`:
- Accepts `(target: number, options: { duration?: number; ease?: string })`
- Uses `IntersectionObserver` (fires once, threshold 0.5) on a ref attached to the `<ul>` stats block
- Animates from 0 to target using `requestAnimationFrame` with easeOut interpolation
- Duration: 1200ms

Suffix (`+`, `%`) is static JSX rendered after the animated number. No changes to copy/messages.ts.

### 4e. Buttons (CTA primary + secondary)

Both `ButtonLink` wrappers replaced with `LiquidGlassShell` pills:
- `border-radius: 9999px`
- `lightVariant: true`
- `tintOpacity: 0.55`
- `filter: glass-distortion-soft`
- Primary: same `animate-pulse-soft` preserved; arrow icon in gold
- Secondary: `tintOpacity: 0.45` (slightly more transparent for visual hierarchy)

### 4f. Floating attorney card (Patrícia Viana)

Current `bg-white rounded-xl` card → `LiquidGlassShell`:
- `lightVariant: true`
- `tintOpacity: 0.45`
- `borderRadius: "1rem"`
- `filter: glass-distortion-soft`
- Navy avatar circle + white ArrowUpRight icon preserved
- Text in navy (legible over light glass)
- `ConcentricRings` decorative element preserved

---

## 5. Services Section ("What We Do")

### 5a. Background

Remove `bg-cream-deep/60` class from `<section>`. Section is transparent — body cream shows through. The hero blobs bleed subtly into this section for visual continuity.

### 5b. Service cards

Each `<article>` → `LiquidGlassShell`:
- `lightVariant: true`
- `tintOpacity: 0.50`
- `blur: 24px`
- `filter: glass-distortion-soft`
- `borderRadius: "1.25rem"`
- `enableHover: true`
- External box-shadow: `0 8px 40px rgba(0,0,0,0.06)`

**Internal text:**
- Headings (h3, subtitle): navy, unchanged
- Body text: navy-soft, unchanged
- Number decoration (`01`, `02`): `text-gold/20`
- Bullet check circles: navy bg + white icon, unchanged
- Badge tag: nested `LiquidGlassShell` pill (`tintOpacity: 0.35`, `border-radius: 9999px`)

### 5c. Card alignment (card 1 ↔ card 2)

Flex column layout with explicit `min-height` per zone:
- Icon + badge row: `min-h-[4rem]`
- h3 title: `min-h-[5.5rem]`
- Italic subtitle: `min-h-[2.5rem]`
- Body paragraphs: `flex-grow` (absorbs locale length variation)
- Bullets: natural height
- CTA row: `mt-auto pt-7 border-t border-white/20` — always pinned to card bottom

This keeps card 1 and card 2 text blocks visually aligned at every breakpoint and locale.

### 5d. Rotating sticker tag

New component `src/components/ui/spinning-badge.tsx`.

**Position:** `absolute top-0 right-8 -translate-y-1/2 z-10` on the Services `<section>` (sticker partially above the section fold). The section needs `overflow: visible` and `relative` positioning.

**Structure:**
```
LiquidGlassShell (circle, 112×112px, tintOpacity: 0.45, lightVariant)
  └─ SVG (112×112, viewBox "0 0 112 112")
      ├─ <path id="circle-path" d="M 56,56 m -42,0 a 42,42 0 1,1 84,0 a 42,42 0 1,1 -84,0" />
      ├─ <text>
      │    <textPath href="#circle-path" startOffset="0%">
      │      CERTIFIED LAWYERS · ZERO MIDDLEMEN · CERTIFIED LAWYERS · ZERO MIDDLEMEN ·
      │    </textPath>
      │  </text>  ← font-size: 7.5px, fill: navy-muted, letter-spacing: 0.08em
      └─ Scale icon (Lucide, 24×24, centered at 56,56, stroke: navy)
```

**Animation:** The entire SVG (text + icon) rotates via `animateTransform type="rotate" from="0 56 56" to="360 56 56" dur="12s" repeatCount="indefinite"`. The icon counter-rotates at the same speed so it stays upright: a second `animateTransform` on the icon group `from="0 56 56" to="-360 56 56"`.

**Text sizing:** `"CERTIFIED LAWYERS · ZERO MIDDLEMEN · "` at 7.5px on a 42px-radius arc ≈ 264px circumference. At ~4.5px per character (7.5px × ~0.6 advance) the string fills ~264/2 = one full revolution. Repeating it twice fills the circle exactly with the two ends connecting.

---

## 6. Why Us Section

**Background:** navy, unchanged.

**Cards:** current `.glass-card` utility replaced with `LiquidGlassShell`:
- `lightVariant: false` (dark glass — white text on navy, very low tint)
- `tintOpacity: 0.18`
- `filter: glass-distortion-soft`
- `borderRadius: "1rem"`

Title, intro, globe: unchanged.

---

## 7. About Section

**Background:** cream, unchanged.

**Text block** (right column): wraps in `LiquidGlassShell`:
- `lightVariant: true`
- `tintOpacity: 0.40`
- `borderRadius: "1.25rem"`
- `blur: 20px`

Photo: gains `border-radius: 1.25rem`, `box-shadow: 0 24px 60px rgba(0,0,0,0.12)`. No other change.

---

## 8. Principles Section

**Background:** navy, unchanged.

**Quote cards:** `LiquidGlassShell`:
- `lightVariant: false`
- `tintOpacity: 0.15`
- `filter: glass-distortion-soft`

Decorative quote marks: `text-gold/30`. Text: white, unchanged.

---

## 9. FAQ Section

**Background:** cream, unchanged. Gold particles preserved.

**Accordion items:** each item → `LiquidGlassShell`:
- `lightVariant: true`
- `tintOpacity: 0.45`
- `borderRadius: "0.75rem"`
- `blur: 20px`

Items spaced with `gap-3`. Separators removed (each island is its own visual unit). Expanded content animates height within the glass shell.

---

## 10. CTA Banner

**Background:** plum gradient, unchanged.

**Content container** (text + button): `LiquidGlassShell`:
- `lightVariant: false`
- `tintOpacity: 0.20`
- `borderRadius: "1.5rem"`

**Gold button:** nested `LiquidGlassShell` pill:
- `lightVariant: false`
- `tintOpacity: 0.30`
- `border-radius: 9999px`

---

## 11. Contact Section

**Form container:** `LiquidGlassShell`:
- `lightVariant: true`
- `tintOpacity: 0.50`
- `borderRadius: "1.5rem"`

**Inputs:** `bg-white/30 border border-white/40 rounded-lg`. Focus state: border shifts to `border-gold/50`.

**Submit button:** glass pill, same treatment as navbar CTA.

---

## 12. Location Section

**Address card:** `LiquidGlassShell` (`lightVariant: true`, `tintOpacity: 0.45`, `borderRadius: "1rem"`).

**Map embed:** `border-radius: 1rem`, `overflow: hidden`. Unchanged otherwise.

---

## 13. Footer

**Background:** navy-deep, unchanged.

**Link/address block:** `LiquidGlassShell`:
- `lightVariant: false`
- `tintOpacity: 0.12`
- `borderRadius: "1rem"`

Minimal glass — just enough to lift the block from the flat navy.

---

## 14. Files to create / modify

| File | Action |
|---|---|
| `src/components/ui/LiquidGlass.tsx` | Add `lightVariant` prop + light tint branch |
| `src/components/ui/hero-blobs.tsx` | **Create** — 3 animated orbital blobs |
| `src/hooks/useCountUp.ts` | **Create** — IntersectionObserver counter hook |
| `src/components/ui/spinning-badge.tsx` | **Create** — rotating circular sticker |
| `src/components/sections/navbar.tsx` | Island pill layout + glass |
| `src/components/sections/hero.tsx` | Blobs, counters, glass buttons, glass card, road color, photo gradient |
| `src/components/sections/services.tsx` | Glass cards, alignment min-heights, sticker, transparent bg |
| `src/components/sections/why-us.tsx` | Replace .glass-card with LiquidGlassShell |
| `src/components/sections/about.tsx` | Glass text block, photo shadow |
| `src/components/sections/principles.tsx` | Glass quote cards |
| `src/components/sections/faq.tsx` | Glass accordion items |
| `src/components/sections/cta-banner.tsx` | Glass container + glass button |
| `src/components/sections/contact.tsx` | Glass form container + inputs |
| `src/components/sections/location.tsx` | Glass address card |
| `src/components/sections/footer.tsx` | Glass link block |
| `src/app/globals.css` | Add `--road-color-hero`, orbital blob keyframes |
| `src/components/road/road-overlay.tsx` | Use `--road-color-hero` for hero segment |

---

## 15. LiquidGlassDefs placement

`LiquidGlassDefs` (the hidden SVG with filter definitions) must render **exactly once** per page. It should be placed in `src/app/[locale]/layout.tsx` (or the root layout), not inside individual components. Individual `LiquidGlassShell` instances reference the filter IDs via `url(#glass-distortion)` and `url(#glass-distortion-soft)` — they work as long as the `<defs>` block exists anywhere in the DOM.

If `LiquidGlassDefs` is currently being rendered inside a component that mounts multiple times, it must be moved to the layout during implementation.

---

## 16. Out of scope

- Copy changes (messages.ts untouched except no new strings needed)
- i18n routing changes
- Backend / contact form wiring
- New sections
- Logo or brand token changes
- Why Us globe (cobe) behaviour
