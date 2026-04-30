---
title: Alttavia Landing Page — Visual Redesign
date: 2026-04-30
status: approved (auto-approved by user — no further sign-off gates between spec and implementation)
audience: implementation team (designer + frontend dev)
scope: Pure visual redesign. No copy edits beyond microcopy. No backend, no routes, no business logic.
---

# Alttavia Redesign — Visual Design Spec

## 1. Intent

Lift the existing site from "still" to "alive" while preserving the institutional weight a Portuguese law firm needs. The dialect is **atelier boutique** — Massimo Vignelli / Hermès-graphic / Milan studios — disciplined typography, micromarks (concentric circles, fine hairlines), gold treated as a rare jewel. A continuous animated road threads behind all content, opacity 60%, with personality (loops, edge exits, transversal moves, return). Section backgrounds alternate light and navy in a **Heartbeat** rhythm so the structure feels like it's breathing.

## 2. Constraints

### 2.1 Preserved (do not touch)
- All copy in three locales (`src/content/messages.ts`). Only microcopy in CTAs/labels may be adjusted, and only with prior approval.
- Brand palette — see tokens in `src/app/globals.css`.
- Type families — Spectral (serif) and Inter (sans), already loaded via `next/font/google` in `src/app/layout.tsx`.
- The cobe globe (`src/components/ui/globe.tsx`). Its position and surrounding treatment may be adjusted.
- Section flow and IDs (`#services`, `#why`, `#about`, `#principles`, `#faq`, `#contact`, `#location`) — referenced by nav and footer.
- The locale system (en, pt, es) and the language switcher.

### 2.2 Forbidden
- Introducing new brand color families. Only neutral grays/wheats already in palette permitted for shadows/lines.
- Replacing typography (weight, size, tracking adjustments are fine).
- Editing routing, data, business logic, or backend.
- Heavy new animation deps (GSAP, lottie, three.js) without explicit approval.
- Animating layout properties (`width`, `height`, `top`, `left`). Use only `transform` and `opacity` for motion.

### 2.3 Permitted
- New tokens (shadows, road colors, animation durations) extending the existing `@theme` block.
- New components for road, marquee, micromarks.
- Visual restructuring within sections (reordering, changing card layouts).
- Adjusting type weights, sizes, tracking, leading.

## 3. Mood: Atelier Boutique

References:
- Massimo Vignelli's grid discipline (NYC subway, American Airlines).
- Hermès graphic system (the typographic and frame discipline, not the orange).
- Milan architectural and design studios (oblique grids, concentric ornaments).
- Brunello Cucinelli, Loro Piana — warm restraint, navy + gold without flourish.

Visual vocabulary:
- **Concentric circles** as micromark — used in WhyUs (around globe), Principles (signature on quote cards), CtaBanner card, Footer.
- **Hairlines** — 1px or 0.5px gold lines used as separators or anchors (a tailor's basting thread).
- **Eyebrow with flanking dashes** — current `Eyebrow` component retained, but recolored to brand tokens (`text-gold-dark`, `bg-gold/60`) instead of legacy aliases.
- **Gold as jewel** — gold appears in markers, hover highlights, eyebrow text, focus rings — never as a section fill.
- **Long shadows** — new `--shadow-long` token replaces the timid `--shadow-soft` on hero card, service cards, principle cards, contact form, location map. Vertical-dominant: 0–20px Y offset, 40–60px blur, 0.10–0.14 navy alpha.

## 4. Section-bg Rhythm: Heartbeat (60% light / 40% navy)

| # | Section | Background | Notes |
|---|---|---|---|
| 1 | Hero | Light cream | Existing gold radial blob preserved |
| 2 | Services | Light cream-deep | Existing |
| 3 | **WhyUs** | **Navy `#0E2A47`** | Globe + new marquee strip at bottom |
| 4 | About | Light gradient | Existing |
| 5 | **Principles** | **Navy `#0E2A47`** | NEW dark moment — manifesto treatment |
| 6 | FAQ | Light cream-deep | Existing, gold particles continue |
| 7 | CtaBanner | Light section bg, **navy card inside** | Card carries the dark moment |
| 8 | Contact | Light cream-deep | Existing |
| 9 | Location | Light | Existing |
| 10 | Footer | **Navy** | Existing |

Four navy moments total. Each is a distinct *tese*:
- **WhyUs** — market proof (the firm other firms call).
- **Principles** — the oath / manifesto.
- **CTA card** — the ask.
- **Footer** — institutional close.

## 5. The Road (Central Feature)

### 5.1 Behavior

- One continuous SVG path covering the full height of `<main>`.
- Stroke is drawn by scroll progress: `stroke-dashoffset` animates from `pathLength` to `0` as the user scrolls from top to bottom of `<main>`.
- **Color:** `#D4D4D4` (warm gray) over light sections; `#E3DAD0` (wheat-tinted neutral) over navy sections. The color shifts at section boundaries via per-section path clipping (multiple `<use href="#road">` nodes, each with `clip-path` and matching `stroke`).
- **Stroke width:** `2.5px` desktop, `2px` mobile. Constant — no thickness variation.
- **Opacity:** `0.6` on the entire road group (`<g opacity="0.6">`).
- **Layering:** road sits above section background but **below all content**. Each section's content has higher z-index (typically `z-10`); the road group is `z-0` or below.
- **`pointer-events: none`** — the road never intercepts clicks, hovers, or scroll.

### 5.2 Trajectory (six personality moments)

The road is intentionally meandering. It exits the screen edges, makes a partial orbit around the globe, and curves transversally between sections. Six personality moments, in scroll order:

1. **Hero → Services**: descend from top center, sweep right with a wide curve, first marker on entering WhyUs.
2. **Globe orbit (WhyUs)**: ~270° anti-clockwise around the globe. The globe (currently bottom-right of WhyUs) becomes the visual anchor of the orbit. Marker at globe center.
3. **Left-edge exit (About)**: slides off the left edge of the viewport, returns just below.
4. **Right-edge exit (Principles bottom)**: slides off the right edge, returns just below — symmetry with #3.
5. **CTA detour**: contornos the CtaBanner card pelo lado esquerdo-inferior, makes a small detour before continuing.
6. **Location loop → Footer**: small gentle loop in Location (geographical wink — Lisbon), descends straight into the footer.

The path waypoints will be tuned in implementation; the final-page `<main>` height will determine the exact y-coordinates. The mockup in `.superpowers/brainstorm/.../content/road-trajectory.html` is the reference for personality (not pixel-precision).

### 5.3 Technical implementation

- The road covers **from the top of the Hero section through the bottom of the Footer** — i.e., everything below `<Navbar>`. To achieve this, introduce a `<RoadOverlay />` wrapper that wraps `<main>` plus `<Footer>` in `src/app/[locale]/page.tsx` (or absolute-positioned at the layout level with explicit height). The SVG inside is `position: absolute; inset: 0;` filling that wrapper.
- ViewBox responsive: width = viewport width, height = the wrapper's scrollHeight measured after layout.
- Path defined with `M` and `C` commands. Multiple `M` commands let the path appear to "exit and re-enter" the screen by jumping outside the viewBox' visible x-range.
- Use `useScroll` (target = the wrapper ref) + `useTransform` from Framer Motion to drive a `motionValue` wired to `stroke-dashoffset` via `motion.path` (or `useMotionValueEvent` writing to the path's `style`).
- Recalculate path length and wrapper height on resize via `ResizeObserver`. Throttle to one update per animation frame.
- Performance: `will-change: stroke-dashoffset` on the path during active scroll; `transform: translateZ(0)` on the SVG group for compositor promotion. Stop `will-change` when scroll idles.
- Markers as separate `<motion.circle>` elements with `whileInView` triggering a pulse loop (scale 1 → 1.03 → 1, 2.5s, `--ease-smooth`).

### 5.4 Mobile

- Path simplified to ~50% the curves; **no edge exits** (path stays within viewport horizontally).
- Stroke width 2px, same color logic.
- Globe orbit becomes a single curve (not a full orbit).
- Markers fewer (4 instead of 6).
- Same scroll-driven draw behavior.

### 5.5 prefers-reduced-motion

- Stroke-dashoffset animation disabled — path renders fully and immediately, no draw-on-scroll.
- Marker pulse keyframes set to `animation-iteration-count: 1` (already enforced globally in `globals.css`).
- Marquee replaced by a static list (or `animation-duration` set to `0s`).
- All `Reveal` and stagger animations also bypassed (already enforced).

## 6. Token additions (extend `@theme` in `src/app/globals.css`)

```css
/* Long shadows */
--shadow-long: 0 20px 60px rgba(14, 42, 71, 0.12), 0 8px 20px rgba(14, 42, 71, 0.06);
--shadow-long-dark: 0 20px 60px rgba(0, 0, 0, 0.40), 0 8px 20px rgba(0, 0, 0, 0.20);
--shadow-long-hover: 0 28px 80px rgba(14, 42, 71, 0.16), 0 12px 28px rgba(14, 42, 71, 0.08);

/* Road */
--road-color-light: #D4D4D4;
--road-color-dark: #E3DAD0;
--road-stroke: 2.5px;
--road-stroke-mobile: 2px;
--road-opacity: 0.6;
--marker-color: #D0A12B;
--marker-color-light: #E6B94A;

/* Animation */
--ease-smooth: cubic-bezier(0.22, 0.61, 0.36, 1);
--marquee-duration: 60s;
--pulse-duration: 2.5s;
--pulse-duration-cta: 3s;
```

Existing `--shadow-soft` / `--shadow-card` / `--shadow-glow` / `--shadow-glass` retained for compatibility but avoided by new components in favor of `--shadow-long*`.

## 7. Animation system additions

The existing `Reveal` component, `staggerContainer`/`staggerItem`, and the `smooth` ease are kept. Additions:

### 7.1 Marquee
- New component: `src/components/ui/marquee.tsx`.
- Horizontal infinite scroll. Content rendered twice in a row (the second copy is `aria-hidden`). The wrapper translates `transform: translateX(0%) → translateX(-50%)` via CSS `@keyframes marquee` over `--marquee-duration`.
- Pauses on `:hover` (desktop only — `(hover: hover)` media query).
- `prefers-reduced-motion`: animation halted.

### 7.2 Pulse
- New utility `@keyframes pulse-soft { 50% { transform: scale(1.03); } }`.
- Applied via class `animate-pulse-soft` (mapped to a Tailwind v4 `@utility` directive).
- Used on:
  - Road markers (when in viewport).
  - Hero primary CTA (subtle, 3s loop, scale 1→1.02).
  - WhatsappFloat (subtle, 4s loop, scale 1→1.03, less prominent).

### 7.3 Card hover (unified pattern)
- On hover:
  - `transform: translateY(-4px)`
  - `box-shadow: var(--shadow-long-hover)` (or `--shadow-long-dark` on navy)
  - `border-color: rgba(208, 161, 43, 0.40)` (gold/40)
  - `transition: transform 500ms var(--ease-smooth), box-shadow 500ms var(--ease-smooth), border-color 500ms var(--ease-smooth)`
- Applied to: service cards, why-us glass cards, principles quote cards, faq accordion items, contact form (subtle), location map card.

### 7.4 Button microinteraction
- Existing `-translate-y-0.5` on hover retained.
- New: when `withArrow={true}`, the inner `ArrowUpRight` icon translates `(2px, -2px)` on the parent's hover via `group-hover:translate-x-[2px] group-hover:-translate-y-[2px]` Tailwind utility (or equivalent `transition-transform`).
- Existing background-color shift retained.

## 8. Marquee content & placement

- **Location:** bottom strip of WhyUs, still navy background. 1px gold-tinted hairline (rgba(208, 161, 43, 0.25)) above the strip.
- **Content:** the 19 cities served, same set as the globe markers — `LISBOA · MADRID · PARIS · LONDON · BERLIN · ROMA · VALLETTA · NYC · LA · MIAMI · CHICAGO · HOUSTON · SÃO PAULO · RIO · MEXICO CITY · DUBAI · SINGAPORE · TOKYO · SYDNEY`.
- **Format:** uppercase, tracking `0.18em`, font Inter weight 500, color `#E0CF9F` at opacity 0.8.
- **Duration:** 60s for one full loop.
- **Pause:** on hover (desktop only).
- **Mobile:** same animation, slightly smaller font (`text-[10px]` vs `text-xs`).

## 9. Pulse effects (specific list)

| Element | Trigger | Behavior |
|---|---|---|
| Road markers (gold dots) | enters viewport | pulse loop 2.5s, scale 1 → 1.03 → 1 |
| Hero primary CTA | always (after entrance) | subtle pulse loop 3s, scale 1 → 1.02 → 1 |
| WhatsappFloat | always (after appearance) | subtle pulse loop 4s, scale 1 → 1.03 → 1 |
| Lisbon globe marker (cobe) | already configurable | left as is (cobe handles internal animation) |

## 10. Section transformations

### 10.1 Hero (light)
- Layout retained (split 7/5).
- Title sublinhado SVG on "lawyers" — already a proof of concept of the road's vocabulary, kept.
- Stats row: hairline gold above each stat (`border-l border-gold/30 pl-4` already exists, kept), increased number size, more breathing room (gap-8 instead of gap-6).
- Patrícia portrait card: `rounded-xl` preserved; new `--shadow-long`.
- Floating "Patrícia Viana" card: `--shadow-long`, gold concentric circles micromark in upper-right corner of card (1 hairline ring, 12px radius).
- Decorative gold blobs preserved.

### 10.2 Services (light)
- 2 cards keep layout. Hover: unified card-hover pattern. New `--shadow-long` on rest state.
- Atelier addition: serif numeral "01" / "02" in upper-left corner of each card, hairline color (`text-gold/40`), large display size.
- Bullets retained.

### 10.3 WhyUs (navy) — biggest visual moment
- Globe stays bottom-right but slightly bigger and less aggressively masked. Three concentric SVG hairline rings around the globe (gold/30, gold/20, gold/10 outwards) added as atelier vocabulary.
- 4 glass cards: hover gets unified pattern + gold border. Each card gets a small serif numeral "01" – "04" in upper-right (gold-light/40).
- New: marquee strip at the bottom of the section.
- The road performs its globe orbit here (~270° anti-clockwise).
- Vignette gradient retained.

### 10.4 About (light)
- Layout preserved (split 5/7).
- Quote-card lifts on hover with `--shadow-long`.
- Stats row: hairline gold above each stat.
- Image: the Unsplash placeholder currently in use stays for this redesign. Swapping to a local Patrícia asset is **out of scope**.

### 10.5 Principles (NAVY — new)
- **Section background changed from light to navy**, becoming the second interior dark section.
- 4 quote-cards become glass-cards (using existing `glass-card` class).
- Each glass-card gets a concentric gold ring micromark (3 hairline rings) in upper-left, an atelier signature.
- Quote serif text: white at 95% opacity (`text-white/95`).
- Attribution stays at bottom, eyebrow style with gold tracking.

### 10.6 FAQ (light)
- Existing accordion preserved. The plus button gets a subtle gold pulse on hover (scale 1.05 in 200ms).
- GoldParticles already there, kept.
- Each item gets `--shadow-long` on hover.
- Open state styling retained (rotation 45° + bg navy).

### 10.7 CtaBanner (light section, navy card)
- Card becomes more pronounced: `rounded-2xl` (24px) preserved; `--shadow-long-dark` added.
- Gold concentric ring micromark (3 hairline rings) in upper-right corner of card.
- Existing decorative blobs kept.
- Button gold variant retained.

### 10.8 Contact (light)
- Form card: `--shadow-long`, slightly bigger radius (`rounded-2xl`), atelier "01" "02" numeral marks in section header (e.g., next to eyebrow).
- Inputs: pill border-radius 9999px (already), focus ring gold/15 added at 4px.
- Submit button: arrow icon microinteraction.

### 10.9 Location (light)
- Map iframe: `--shadow-long`, `rounded-xl` preserved.
- Address card: hairline gold above each list item, atelier mark.
- "Open in Google Maps" link: arrow microinteraction.
- Road makes a small loop here (geographical hint of Lisbon).

### 10.10 Footer (navy)
- Tighter layout. Atelier "vol. 01" mark next to logo (small gold serif italic numeral, optional — confirmable in implementation).
- Copyright + "Crafted in Lisbon" line gets a small gold concentric ring marker as a closing mark.
- Social icons keep hover (border + text go gold).

## 11. Mobile considerations

- Container padding scales (existing).
- Hero: stays split → stack at lg:.
- WhyUs cards: existing horizontal scroll carousel preserved with peek + scroll arrows. Marquee strip retained.
- Road: simplified path (no edge exits, single curve through globe).
- Marquee: same animation, slightly smaller font.
- Long shadows: reduce blur/spread on small screens for performance.
- All hover effects degrade gracefully to no-op on touch.
- Visual review at ~375px wide is mandatory before any section is signed off.

## 12. Accessibility

- `prefers-reduced-motion` already enforced globally; explicitly applies to road, marquee, pulse, reveal, hover transitions.
- Road has `aria-hidden="true"` and `pointer-events: none`.
- Marquee text duplicated for animation; the duplicate is `aria-hidden`.
- Color contrast: gold body text on navy (#D0A12B / #E6B94A on #0E2A47) checked at WCAG AA. Decorative below-AA text is small and non-informational only.
- Focus rings: 4px gold/15 on all interactive elements (inputs, buttons, links).
- Maintain semantic HTML: section landmarks, heading hierarchy, form labels.

## 13. Out of scope

- Copy edits beyond microcopy on CTAs/labels (and only with explicit approval).
- New languages, new routes, new pages.
- Backend / API integrations (form is placeholder, kept).
- Replacing the cobe globe library.
- Replacing or augmenting the i18n system.
- Replacing Framer Motion with another animation library.
- Adding a CMS or content provider.
- Switching image hosting (Unsplash placeholders kept where currently used).

## 14. Acceptance criteria

A section is considered complete when:
1. Visual treatment matches this spec (mood, micromarks, long-shadow, hover, pulse where applicable).
2. The road traverses the section as described, with correct color per light/dark and z-index behind content.
3. Verified at 375px and 1280px+ viewports in browser, scrolled top-to-bottom, with hover/focus interactions exercised.
4. `prefers-reduced-motion` toggled on confirms motion is disabled or simplified.
5. No layout-property animations (`width`, `height`, `top`, `left`).
6. No new dependencies introduced without prior approval.

## 15. References (in this repo)

- Existing tokens: `src/app/globals.css`
- Section sources: `src/components/sections/*.tsx`
- Reusable UI: `src/components/ui/{button,container,reveal,eyebrow,globe,gold-particles,whatsapp-float,language-switcher,logo}.tsx`
- Content: `src/content/{messages,brand}.ts`
- Visual mockups (this brainstorming session): `.superpowers/brainstorm/194-1777562441/content/{mood,intercalation,road-behavior,road-trajectory}.html`
