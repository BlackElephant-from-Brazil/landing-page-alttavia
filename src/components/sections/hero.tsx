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
      className="relative isolate overflow-hidden bg-navy text-white pt-28 lg:pt-36 pb-20 lg:pb-28 has-grain-dark"
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

      {/* issue strip — editorial mast */}
      <Container size="wide" className="relative">
        <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-4 mb-10 lg:mb-14 text-[0.68rem] uppercase tracking-[0.28em] text-white/60">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-block h-px w-6 bg-gold/70" />
            <span>{hero.issueLabel}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{hero.issueDate}</span>
          </div>
          <PulseBadge tone="green" className="text-[0.62rem]">
            <span>{status.live}</span>
            <span className="hidden sm:inline opacity-70">/ {status.label}</span>
          </PulseBadge>
        </div>
      </Container>

      <Container size="wide" className="relative">
        <div className="grid gap-14 lg:gap-20 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: smooth }}
              className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.3em] text-gold-light"
            >
              <span aria-hidden className="inline-block h-px w-8 bg-gold/70" />
              <span>{hero.eyebrow}</span>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05, ease: smooth }}
              className="mt-6 font-serif italic text-lg sm:text-xl text-gold-light/90"
            >
              {hero.kicker}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.12, ease: smooth }}
              className="mt-4 font-serif text-[clamp(2.6rem,6.5vw,5.4rem)] leading-[0.98] tracking-[-0.025em]"
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

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: smooth }}
              className="mt-8 max-w-xl text-base sm:text-lg text-white/75 leading-relaxed"
            >
              {hero.lede}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.42, ease: smooth }}
              className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4"
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

            {/* hero stat strip */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.65, ease: smooth }}
              className="mt-14 flex items-end gap-6 max-w-md"
            >
              <div className="font-serif italic font-light text-[clamp(3rem,6vw,4.5rem)] leading-none text-gold">
                {hero.heroStat.number}
              </div>
              <div className="pb-2 text-xs sm:text-sm uppercase tracking-[0.18em] text-white/55 leading-tight">
                {hero.heroStat.label}
              </div>
            </motion.div>
          </div>

          {/* photo column with floating chips */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.25, ease: smooth }}
            className="lg:col-span-5 relative"
          >
            <div className="relative">
              {/* gold frame offset */}
              <div
                aria-hidden
                className="absolute -inset-3 rounded-xl border border-gold/30 translate-x-3 translate-y-3"
              />
              <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-navy-deep">
                <Image
                  src="/patricia.webp"
                  alt="Patrícia Viana, founder of Alttavia Relocation"
                  fill
                  priority
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  className="object-cover object-[55%_30%]"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-navy-deep/65 via-transparent to-transparent"
                />
                {/* photo caption */}
                <div className="absolute bottom-4 left-4 right-4 text-[0.7rem] uppercase tracking-[0.2em] text-white/85">
                  <span aria-hidden className="inline-block h-px w-6 bg-gold/70 align-middle mr-2" />
                  {hero.photoCaption}
                </div>
              </div>

              {/* floating chips */}
              <div className="absolute -top-4 -left-6 sm:-left-10 float-bob" style={{ ["--bob-duration" as string]: "5.5s" }}>
                <Chip label={hero.floatingChips[0].label} className="tilt-l" />
              </div>
              <div className="absolute top-1/3 -right-4 sm:-right-8 float-bob" style={{ ["--bob-duration" as string]: "6.5s", ["--bob-delay" as string]: "-1s" }}>
                <Chip label={hero.floatingChips[1].label} className="tilt-r" />
              </div>
              <div className="absolute -bottom-5 left-6 sm:left-10 float-bob" style={{ ["--bob-duration" as string]: "7s", ["--bob-delay" as string]: "-2.5s" }}>
                <Chip label={hero.floatingChips[2].label} className="tilt-l" />
              </div>
            </div>
          </motion.div>
        </div>
      </Container>

      {/* trust marquee at hero bottom */}
      <Container size="wide" className="relative mt-20 lg:mt-28">
        <div className="flex items-center gap-5 border-t border-white/12 pt-6">
          <span className="shrink-0 text-[0.65rem] uppercase tracking-[0.28em] text-white/45">
            {trust.label}
          </span>
          <div className="flex-1 text-sm text-white/70">
            <Marquee
              items={trust.cities}
              duration={45}
              edgeFade
              itemClassName="font-serif italic text-base lg:text-lg"
            />
          </div>
          <ArrowDown className="hidden sm:block size-4 text-gold-light shrink-0" aria-hidden />
        </div>
      </Container>
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
