"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { ConcentricRings } from "@/components/ui/concentric-rings";
import { HeroBlobs } from "@/components/ui/hero-blobs";
import { LiquidGlassShell } from "@alttavia/liquid-glass";
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
              <span
                className="inline-flex animate-pulse-soft will-change-transform"
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
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-gold/10 via-transparent to-transparent"
              />
            </div>

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
