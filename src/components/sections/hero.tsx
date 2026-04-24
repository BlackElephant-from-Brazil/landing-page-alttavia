"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function Hero() {
  const { t } = useContent();
  const hero = t.hero;

  return (
    <section
      id="top"
      className="relative overflow-hidden pt-32 lg:pt-40 pb-20 lg:pb-28 has-grain"
    >
      {/* Decorative gradient blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[560px] w-[560px] rounded-full blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(circle at center, rgba(224,207,159,0.55) 0%, rgba(208,161,43,0.35) 35%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -left-32 h-[380px] w-[380px] rounded-full blur-3xl opacity-25"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.55) 0%, transparent 70%)",
        }}
      />

      <Container size="wide" className="relative">
        <div className="grid gap-14 lg:gap-16 lg:grid-cols-12 items-center">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: smooth }}
            >
              <Eyebrow align="left">{hero.eyebrow}</Eyebrow>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.1, ease: smooth }}
              className="mt-8 font-serif text-[clamp(2.75rem,6vw,5rem)] leading-[1.03] tracking-[-0.02em] text-navy"
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
              <ButtonLink href="#contact" size="lg" withArrow>
                {hero.ctaPrimary}
              </ButtonLink>
              <ButtonLink href="#services" size="lg" variant="outline">
                {hero.ctaSecondary}
              </ButtonLink>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.7, ease: smooth }}
              className="mt-14 grid grid-cols-3 gap-6 sm:gap-10 max-w-xl"
            >
              {hero.stats.map((s) => (
                <li key={s.label} className="border-l border-gold/30 pl-4 sm:pl-5">
                  <div className="font-serif text-3xl sm:text-4xl text-navy leading-none">
                    {s.number}
                  </div>
                  <div className="mt-1.5 text-xs sm:text-sm text-navy-muted uppercase tracking-wider">
                    {s.label}
                  </div>
                </li>
              ))}
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: smooth }}
            className="lg:col-span-5 relative"
          >
            <div className="relative aspect-[4/5] rounded-xl overflow-hidden shadow-[var(--shadow-card)] bg-champagne">
              <Image
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1200&q=80"
                alt="Alttavia Relocation attorney in a refined working environment"
                fill
                priority
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-navy-deep/35 via-transparent to-transparent"
              />
            </div>
            {/* Floating card */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.85, ease: smooth }}
              className="absolute -bottom-6 -left-4 sm:-left-8 bg-white rounded-xl shadow-[var(--shadow-card)] px-5 py-4 max-w-[260px] border border-warm-line/80"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white">
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
            </motion.div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
