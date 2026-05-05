"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { PulseBadge } from "@/components/ui/pulse-badge";
import { Marquee } from "@/components/ui/marquee";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function Hero() {
  const { t } = useContent();
  const hero = t.hero;
  const trust = t.trustMarquee;
  const status = t.statusBadge;

  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-navy text-white pt-24 lg:pt-36 pb-20 lg:pb-28 has-grain-dark"
    >
      {/* decorative bg layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-lines-navy opacity-40" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 h-[640px] w-[640px] rounded-full blur-3xl opacity-50"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.50) 0%, rgba(208,161,43,0.18) 35%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-32 h-[480px] w-[480px] rounded-full blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(8,31,102,0.85) 0%, transparent 70%)",
        }}
      />

      {/* horizontal scan lines — right half, desktop only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-[0.035] hidden lg:block"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(255,255,255,0.6) 28px, rgba(255,255,255,0.6) 29px)",
        }}
      />

      {/* editorial docket strip */}
      <Container size="wide" className="relative">
        <div className="flex items-center border-b border-white/15 pb-4 mb-8 lg:mb-14 text-[0.68rem] uppercase tracking-[0.28em] text-white/60">
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <span aria-hidden className="inline-block h-px w-6 bg-gold/70" />
            <span>{hero.issueLabel}</span>
            <span aria-hidden className="text-white/25">·</span>
            <span>{hero.issueDate}</span>
          </div>
          <div
            aria-hidden
            className="flex-1 border-b border-dashed border-white/15 mb-[3px] mx-4 hidden sm:block"
          />
          <PulseBadge tone="green" className="text-[0.62rem] shrink-0">
            {status.live}
          </PulseBadge>
        </div>
      </Container>

      <Container size="wide" className="relative">
        <div className="grid gap-6 lg:gap-20 lg:grid-cols-12 items-start">

          {/* text column — below photo on mobile, left on desktop */}
          <div className="lg:col-span-7 order-2 lg:order-1">

            {/* kicker — #1 conversion hook */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: smooth }}
              className="border-l-[3px] border-gold pl-5 font-serif italic text-xl sm:text-2xl lg:text-[1.75rem] leading-snug text-gold-light/95"
            >
              {hero.kicker}
            </motion.p>

            {/* eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06, ease: smooth }}
              className="mt-6 flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.3em] text-gold-light"
            >
              <span aria-hidden className="inline-block h-px w-8 bg-gold/70" />
              <span>{hero.eyebrow}</span>
            </motion.div>

            {/* H1 */}
            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.12, ease: smooth }}
              className="mt-3 font-serif text-[clamp(3rem,9vw,5.4rem)] leading-[0.98] tracking-[-0.025em]"
            >
              <span className="block text-white">{hero.titlePre}</span>
              <span className="block text-white/95">
                <span className="italic font-light text-gold-light">{hero.titleEm}</span>{" "}
                <span className="relative inline-block italic font-light text-gold">
                  {hero.titleEm2}
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
                      transition={{ duration: 1.2, delay: 0.95, ease: smooth }}
                    />
                  </svg>
                </span>
              </span>
              <span className="block text-white">{hero.titlePost}</span>
            </motion.h1>

            {/* lede */}
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: smooth }}
              className="mt-7 max-w-xl text-sm sm:text-base lg:text-lg text-white/70 leading-relaxed"
            >
              {hero.lede}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.42, ease: smooth }}
              className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4"
            >
              <ButtonLink href="#contact" size="lg" variant="gold" withArrow>
                {hero.ctaPrimary}
              </ButtonLink>
              <ButtonLink
                href="#process"
                size="lg"
                className="bg-transparent border border-white/25 text-white hover:bg-white hover:text-navy"
              >
                {hero.ctaSecondary}
              </ButtonLink>
            </motion.div>

            {/* stat strip */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.65, ease: smooth }}
              className="mt-10 lg:mt-14 pt-7 lg:pt-8 border-t border-white/10 flex items-end gap-6 lg:gap-8"
            >
              <div>
                <div className="font-serif italic text-[3rem] sm:text-[3.5rem] lg:text-[4.5rem] leading-none text-gold">
                  {hero.heroStat.number}
                </div>
                <div className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-white/45 leading-tight">
                  {hero.heroStat.label}
                </div>
              </div>
              {/* intake info — hidden on mobile to keep the stat clean */}
              <div className="pb-2 border-l border-white/15 pl-6 lg:pl-8 hidden sm:block">
                <div className="text-[0.65rem] uppercase tracking-[0.2em] text-white/35">{status.live}</div>
                <div className="mt-0.5 text-sm text-white/60 font-serif italic">{status.label}</div>
              </div>
            </motion.div>
          </div>

          {/* photo column — first on mobile (above copy), right side on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.08, ease: smooth }}
            className="order-first lg:order-none lg:col-span-5 relative -mx-5 sm:-mx-8 lg:mx-0"
          >
            <div className="relative">
              {/* gold frame offset — desktop only */}
              <div
                aria-hidden
                className="absolute -inset-3 rounded-xl border border-gold/30 translate-x-3 translate-y-3 hidden lg:block"
              />

              {/* photo — landscape on mobile, portrait on desktop */}
              <div className="relative aspect-[4/3] lg:aspect-[4/5] overflow-hidden bg-navy-deep lg:rounded-xl">
                <Image
                  src="/patricia.webp"
                  alt="Patrícia Viana, founder of Alttavia Relocation"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover object-[55%_15%] lg:object-[55%_30%]"
                />
                {/* stronger bottom gradient on mobile so copy below reads clearly */}
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-navy/75 via-navy/5 to-transparent lg:from-navy-deep/55 lg:via-transparent"
                />
                {/* caption */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.2em] text-white/70 z-10">
                  <span aria-hidden className="inline-block h-px w-4 bg-gold/70 shrink-0" />
                  <span>{hero.photoCaption}</span>
                </div>
              </div>

              {/* floating chips — desktop only */}
              <div className="hidden lg:block absolute -top-4 -left-10 float-bob z-10" style={{ ["--bob-duration" as string]: "5.5s" }}>
                <Chip label={hero.floatingChips[0].label} className="tilt-l" />
              </div>
              <div className="hidden lg:block absolute top-1/3 -right-8 float-bob z-10" style={{ ["--bob-duration" as string]: "6.5s", ["--bob-delay" as string]: "-1s" }}>
                <Chip label={hero.floatingChips[1].label} className="tilt-r" />
              </div>
              <div className="hidden lg:block absolute -bottom-5 left-10 float-bob z-10" style={{ ["--bob-duration" as string]: "7s", ["--bob-delay" as string]: "-2.5s" }}>
                <Chip label={hero.floatingChips[2].label} className="tilt-l" />
              </div>
            </div>
          </motion.div>
        </div>
      </Container>

      {/* trust marquee — label inside container, scroll track full-bleed */}
      <div className="relative mt-16 lg:mt-28">
        <Container size="wide">
          <div className="border-t border-white/12 pt-5 pb-4 flex items-center gap-3">
            <span className="shrink-0 text-[0.65rem] uppercase tracking-[0.28em] text-white/45">
              {trust.label}
            </span>
            <ArrowDown className="size-4 text-gold-light shrink-0" aria-hidden />
          </div>
        </Container>
        <Marquee
          items={trust.cities}
          duration={45}
          edgeFade
          itemClassName="font-serif italic text-base lg:text-lg text-white/60"
        />
      </div>
    </section>
  );
}

function Chip({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full bg-white/95 backdrop-blur-md px-4 py-2 text-[0.72rem] font-medium tracking-[-0.005em] text-navy shadow-[0_8px_28px_rgba(8,16,40,0.4)] border border-white ${className ?? ""}`}
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-gold" />
      {label}
    </div>
  );
}
