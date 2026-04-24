---
name: alttavia-project
description: Context and conventions for the Alttavia Relocation landing page. Use whenever working on the project to align on design tokens, content, stack, and workflow. Update this skill whenever a meaningful decision is made (new dependency, token change, new section, copy update, i18n change).
---

# Alttavia Relocation Landing Page — Project Skill

## Client snapshot (current)
- **Brand:** Alttavia Relocation — relocation arm of **Viana Consultancy**.
- **Legal entity / lead:** Patrícia Viana, licensed Portuguese attorney (OA Portugal + OAB Brasil).
- **One-liner:** "Moving people with legal certainty."
- **Target audience:** retirees, digital nomads, and passive-income residents with USD 5K+ monthly income, ages 35–55, **English-speaking, predominantly US-based** (but site also serves PT-BR and ES markets).

## Services (narrow scope — only two)
1. **NIF with fiscal representation** — Portuguese tax ID + legal representative. Required from the D7 visa stage. Remote.
2. **Remote bank account opening for non-residents** — required to prove funds for D7 and Golden Visa. Remote, with compliance pre-screening.

## Key differentiator (storytelling spine)
> "Most relocation firms outsource their legal work. We ARE the law firm."

Primary narrative lever in Hero, Why Us, About, CTA banner.

## Stack (authoritative)
- **Next.js 16** (App Router + Turbopack), TypeScript, `src/` layout, `@/*` alias.
- **Tailwind CSS v4** with `@theme` directive in `src/app/globals.css`. Base layer rules wrapped in `@layer base` so Tailwind utilities win specificity battles.
- **Framer Motion 12** for scroll-triggered animations (`Reveal` + `staggerContainer`/`staggerItem` in `@/components/ui/reveal.tsx`).
- **Fonts:** `next/font` — `Fraunces` (serif) for headings, `Inter` (sans) for body.
- **Icons:** `lucide-react` (latest). Brand icons (Instagram / Facebook / WhatsApp) are inline SVGs (lucide removed them for trademark reasons).
- **Globe:** `cobe` v2 — WebGL globe with markers + arcs from Lisbon HQ to 10 client cities. Wrapped in `@/components/ui/globe.tsx`.
- **Images:** `next/image` with `remotePatterns: images.unsplash.com` in `next.config.ts`.

## Design tokens (brand-authored, in `globals.css`)
```
--color-white:      #FFFFFF
--color-paper:      #FAFAF7
--color-wheat:      #E0CF9F   (wheat mist)
--color-navy:       #0E2A47   (midnight blue — primary)
--color-navy-deep:  #081F66   (royal indigo — plum sections)
--color-navy-soft:  #2D4B72
--color-navy-muted: #5B7199
--color-gold:       #D0A12B   (gold oak — primary accent)
--color-gold-dark:  #A67D1E
--color-gold-light: #E6B94A
--color-clay:       #DB3D34   (reserved; use sparingly)
```
Legacy aliases (`cream`, `ink`, `plum`, `rose-gold`, `blush`) are mapped to the brand tokens so existing className usages keep working — see the `@theme` block.

## Section order (current page.tsx)
1. Navbar (scroll-reactive, mobile drawer, language switcher)
2. Hero (animated underline on highlight, stats, floating attorney card)
3. Services (2 expanded cards: NIF + Bank account)
4. Why Us (**navy bg, glassmorphic cards, rotating globe bottom-left with arcs from Lisbon, only top-right quarter visible**)
5. About (Patrícia's founder story)
6. Principles (quote cards — philosophy, not fake testimonials)
7. **FAQ (cream bg, floating gold smoke particles behind)**
8. CTA banner (plum gradient, **gold button** variant)
9. Contact (form with interest select)
10. Location (Google Maps embed + address)
11. Footer (navy-deep bg with address + contact block)
12. WhatsappFloat (appears after 400px scroll)

## i18n (PT / EN / ES)
- Routing: `src/app/[locale]/` with `page.tsx` + `layout.tsx` reading `params.locale`.
- Root `/` redirect: `src/app/page.tsx` reads cookie / Accept-Language and `redirect()`s to `/en|/pt|/es`.
- Content: single `src/content/messages.ts` with `en`, `pt`, `es` keys (same shape, enforced by `Messages` type).
- Brand data (email, phone, address street, social URLs) is locale-neutral in `src/content/brand.ts`.
- Context: `ContentProvider` (`src/components/providers/content-provider.tsx`) exposes `{ locale, brand, t }` via `useContent()` hook. Every section uses it.
- Locale detection priority in root redirect: cookie (`alttavia_locale`) → `Accept-Language` → default `en`.
- Switcher: `src/components/ui/language-switcher.tsx` — EN · PT · ES pills. Navigates via `router.push` and writes cookie client-side.
- `LOCALES` / `Locale` / `DEFAULT_LOCALE` in `src/lib/i18n.ts`.
- `<html lang>` is static "en" in root layout (limitation of App Router root layout access); nested `[locale]/layout.tsx` adds a wrapper `<div lang={locale}>` so assistive tech reads the correct language for content.

## Button conventions
- **Default primary** (`variant="primary"`): `bg-navy text-white`, hover → `bg-gold text-navy`. For light backgrounds.
- **Gold** (`variant="gold"`): `bg-gold text-white`, hover → `bg-gold-dark`. Use on dark backgrounds (CTA banner).
- **Outline** / **Ghost**: transparent variants.

## Visual effects
- **Glassmorphism** utility: `.glass-card` in `globals.css` — translucent white (6%), blur 24px, saturation 180%, inset highlight. Used in Why Us cards.
- **Gold particles**: `GoldParticles` component in `@/components/ui/gold-particles.tsx`. Deterministic seeded pseudo-random positions, 22 particles floating upward with `float-up` keyframe. Used in FAQ background.
- **Rotating globe**: cobe v2 with 19 city markers + 10 arcs from Lisbon. Auto-rotation ~0.0022 rad/frame. Fade-in on mount. Masked with radial gradient to show only the upper-right quadrant.

## Repo & workflow
- Remote: https://github.com/BlackElephant-from-Brazil/landing-page-alttavia
- Branches: `main`, `main-split-a`, `develop-split-a` (active work).
- **Do not commit unless user asks.** Variant A is one of several parallel design variants.

## Update protocol for this skill
Update this file when:
- New dependency added / removed
- Token / palette changed (especially if brand colors supersede current palette)
- Section added / removed / renamed
- Copy contract changes (new copy block, CTA destination, form field)
- i18n change (new locale, routing change)
- Repo workflow change

Keep entries lean. This is project memory, not a changelog.

## Known open questions / blockers
- **Logo** — client confirmed having one; file not yet provided. Currently wordmark "alttavia." in Fraunces.
- **Social links** — Instagram / Facebook URLs not yet provided. Currently `#`.
- **Hero + About images** — still Unsplash placeholders. Need real portrait of Patrícia + office/Lisbon imagery.
- **Contact form destination** — no backend wired. Submission is no-op with success state. Need email/webhook/CRM endpoint.
- **Legal pages** (Privacy / Terms / Cookies / Regulator link) — linked to `#`.
- **Translation review** — PT and ES copy written without native-speaker review. Patrícia should validate.
