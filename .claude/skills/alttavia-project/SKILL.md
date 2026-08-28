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
- **Fonts:** `next/font`. `Spectral` (serif, exposed as `--font-serif`) for headings. `Inter` (sans) for body. Spectral pairs warmer-classical look with enough weight to feel corporate.
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

## Branch `main-split-bank-and-nif` (bank-nif-portugal.alttavia-relocation.com)

A separate product: a single sales page for **NIF + remote bank account**, sold
through the /en/apply wizard and, later, Stripe checkout. It replaces
`src/app/[locale]/page.tsx` on this branch only, so the ad destination is
`bank-nif-portugal.alttavia-relocation.com/en`. The main-site sections in
`src/components/sections/` are left in place but unused here. This branch deploys
on every push (Netlify), so commit only coherent states.

- **Source of truth for the copy:** `~/Downloads/landing-copy-nif-conta-alttavia.md`
  (sections 0 to 15). Implemented sections 1 to 14, in order.
- **Content:** `src/content/bank-nif.ts`. Holds every string, the `APPLY_LINKS`
  block (every buy button goes to `/en/apply`, product cards add `?product=`), the
  `PRICES` block and its numeric twin `PRICE_CENTS` (a test keeps them in sync).
  Current prices: NIF €149, bundle €497, bank €399, couple €597, renewal €99.
- **Components:** `src/components/bank/*`, one file per section, plus
  `rich-text.tsx` (renders the `**bold**` / `*italic*` markers used in the content).
- **English only.** All locale routes render the same English copy; PT and ES come
  after the campaign proves out.
- **Mobile:** sticky bottom CTA (`sticky-cta.tsx`) appears past the hero and hides
  over the final CTA. Featured pricing card is ordered first below `lg`.
- **Assets:** `public/sicnot.svg` and `public/publico-jornal.webp` (press logos,
  linked to the real articles), `public/patricia.webp`.
- **Apply wizard (`/en/apply`):** `src/app/[locale]/apply/page.tsx` (English only,
  `robots: noindex`, disallowed in `robots.ts`). One question per screen: proof of
  address country, who is applying (+ children checkbox), who already has a NIF,
  bank account (joint / separate / none for couples), passports, visa (only when a
  non EEA passport wants the bank). `src/lib/apply/recommend.ts` is the pure
  decision table (tested in `recommend.test.ts`, run `npm test`); `steps.ts` owns
  visibility, validation and the `?step=` clamp; `storage.ts` keeps answers in
  sessionStorage (`alttavia_apply_v1`); `rules.ts` holds the business rules the
  client can change (bank nationality blocklist, visas the bank accepts). Copy in
  `src/content/apply.ts`, same house rules as `bank-nif.ts`. Components in
  `src/components/apply/`.
- **Checkout: Stripe Payment Links, no API of ours.** `CHECKOUT_LINKS` in
  `bank-nif.ts` holds one hosted link per product, verified against the live
  checkout page (149, 497, 399, 597 euro). `checkoutUrl()` in `content/apply.ts`
  appends a `client_reference_id` describing the order without personal data, so a
  payment can be read back to the answers behind it. There is no checkout route, no
  secret key and no webhook yet. Two NIFs on one order has no link, because a
  Payment Link sells a fixed quantity, so that one case still goes to WhatsApp.
- **After payment:** `/en/apply/success` (noindex) says what happens next and clears
  the wizard's stored answers. It is only reached if each Payment Link is configured
  in Stripe to redirect there, which is a dashboard setting, not code.
- **Analytics:** `src/lib/analytics.ts` pushes funnel events to `window.dataLayer`
  (`apply_step`, `apply_recommendation`, `begin_checkout`, `apply_exit`,
  `purchase_landed`). `src/components/analytics.tsx` loads GTM only when
  `NEXT_PUBLIC_GTM_ID` is set, so nothing third party runs until someone sets it.
  No event carries personal data.
- **Open before traffic:** Stripe Checkout behind the wizard result, document upload
  after payment, the answers from the client to the pending business questions (see
  `../notes/pendencias.md` in the workspace), Stripe purchase event wired to Google
  Ads. The `reviews` array holds two real Google reviews.

## Section order (current page.tsx, main site branches)
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
- Root `/` redirect: `src/app/page.tsx` reads the `alttavia_locale` cookie and `redirect()`s to `/en|/pt|/es` (default `en`).
- Content: single `src/content/messages.ts` with `en`, `pt`, `es` keys (same shape, enforced by `Messages` type).
- Brand data (email, phone, address street, social URLs) is locale-neutral in `src/content/brand.ts`.
- Context: `ContentProvider` (`src/components/providers/content-provider.tsx`) exposes `{ locale, brand, t }` via `useContent()` hook. Every section uses it.
- Locale detection priority in root redirect: cookie (`alttavia_locale`) first; otherwise default `en`. (Accept-Language was removed; first-time visitors always see English unless they pick another locale via the switcher.)
- Switcher: `src/components/ui/language-switcher.tsx` — EN · PT · ES pills. Navigates via `router.push` and writes cookie client-side.
- `LOCALES` / `Locale` / `DEFAULT_LOCALE` in `src/lib/i18n.ts`.
- `<html lang>` is static "en" in root layout (limitation of App Router root layout access); nested `[locale]/layout.tsx` adds a wrapper `<div lang={locale}>` so assistive tech reads the correct language for content.

## Button conventions
- **Default primary** (`variant="primary"`): `bg-navy text-white`, hover → `bg-gold text-navy`. For light backgrounds.
- **Gold** (`variant="gold"`): `bg-gold text-white`, hover → `bg-gold-dark`. Use on dark backgrounds (CTA banner).
- **Outline** / **Ghost**: transparent variants.

## Visual effects
- **Glassmorphism** utility: `.glass-card` in `globals.css`. Translucent white (6%), blur 24px, saturation 180%, inset highlight. Used in Why Us cards.
- **Gold particles**: `GoldParticles` component in `@/components/ui/gold-particles.tsx`. Deterministic seeded pseudo-random positions, 22 particles floating upward with `float-up` keyframe. Used in FAQ background.
- **Rotating globe**: cobe v2 with 19 city markers (sized at ~30% of the original beads, kept small to read as quiet pins) + 10 arcs from Lisbon. Auto-rotation ~0.0022 rad/frame. Fade-in on mount. Masked with radial gradient to show only the upper-right quadrant. Mobile positioning is tuned to keep that quadrant inside the viewport.

## Why Us mobile carousel
- Below `sm`, the cards become a horizontal snap-scrolling list with `min-w-[78vw]` so the next card peeks. ChevronLeft/Right arrows sit *below* the carousel on mobile only.
- Above `sm`, layout reverts to a 2-column grid.

## Copy voice (the-humanizer rules in force)
- **No em-dashes anywhere.** Use commas, periods, semicolons, or parentheses. Applies to copy, alt text, comments, and JSDoc.
- Skip AI buzzwords (seamless, transformative, leverage, robust, comprehensive, holistic, navigate, unlock, etc.).
- Concrete > abstract. Numbers, named things, real consequences.
- Vary sentence length. No `X. Y. Z.` stacked fragment cadence.
- Active voice unless the passive carries clearer meaning.
- The shape of `messages.ts` is parallel across `en`, `pt`, `es`. Update all three when changing copy.

## Repo & workflow
- Remote: https://github.com/BlackElephant-from-Brazil/landing-page-alttavia
- Branches: `main`, `develop-split-a`, `develop-split-b` (main-site design variants),
  `main-split-bank-and-nif` (the bank + NIF sales page, branched from the commit the
  two split branches share).
- Deploys go out through git: push the branch and let GitHub trigger Netlify. Never
  the Netlify CLI or connector.
- **Do not commit unless user asks.** `develop-split-a` and `develop-split-b` are parallel
  design variants of the main site; `main-split-bank-and-nif` is the bank + NIF product.
- Tooling: `npm run typecheck` (tsc), `npm run lint`, `npm test` (vitest, `src/**/*.test.ts`).
  `npm run dev` runs a `predev` that wipes `.next` only when it holds a production
  build, because `next build` and `next dev` share that directory and dev on top of
  build artefacts makes every route 404 with no error. `eslint` ignores `scripts/**`:
  the Next presets take minutes on plain Node files and report nothing.
- Environment: `.env.example` lists every variable the deploy will need, grouped by
  phase (checkout, email, upload, analytics), all empty. `.env.local` mirrors it and
  is gitignored. Nothing in the app reads an env var yet except `NEXT_PUBLIC_GTM_ID`.
- `scripts/stripe-setup.mjs` creates the four products and prices from `PRICE_CENTS`
  over the Stripe REST API, so the amounts in Stripe cannot drift from the page.

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
- **Logo** — `public/logo.svg` is now live; rendered via `next/image` in `src/components/ui/logo.tsx`. `tone="cream"` applies `brightness-0 invert` for dark backgrounds.
- **Social links** — Instagram / Facebook URLs not yet provided. Currently `#`.
- **Hero + About images** — still Unsplash placeholders. Need real portrait of Patrícia + office/Lisbon imagery.
- **Contact form destination** — no backend wired. Submission is no-op with success state. Need email/webhook/CRM endpoint.
- **Legal pages** (Privacy / Terms / Cookies / Regulator link) — linked to `#`.
- **Translation review** — PT and ES copy written without native-speaker review. Patrícia should validate.
