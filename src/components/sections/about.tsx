"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Quote, Award, GraduationCap, Languages, Calendar } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

const credentialIcons = [Award, GraduationCap, Languages, Calendar];

export function About() {
  const { t } = useContent();
  const founder = t.founder;

  return (
    <section id="founder" className="relative py-24 lg:py-32 bg-white overflow-hidden">
      <div aria-hidden className="absolute inset-0 grid-lines-cream opacity-50 pointer-events-none" />
      {/* gold corner blob */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.45) 0%, transparent 70%)",
        }}
      />

      <Container size="wide" className="relative">
        <div className="grid gap-14 lg:gap-20 lg:grid-cols-12 items-start">
          {/* photo + credentials */}
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-10% 0%" }}
            transition={{ duration: 0.85, ease: smooth }}
            className="lg:col-span-5 relative"
          >
            <div className="relative">
              {/* gold offset frame */}
              <div
                aria-hidden
                className="absolute -inset-3 rounded-xl border border-gold/40 -translate-x-3 translate-y-3"
              />
              <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-cream-deep">
                <Image
                  src="/patricia.webp"
                  alt={founder.title}
                  fill
                  sizes="(min-width: 1024px) 40vw, 90vw"
                  className="object-cover object-[55%_30%]"
                />
              </div>
            </div>

            {/* credentials block — now a single rounded card with iconified rows
                so it reads as one credentialing badge instead of four loose tiles */}
            <div className="relative mt-10 rounded-2xl bg-navy text-white p-6 sm:p-7 shadow-[var(--shadow-card)] overflow-hidden has-grain-dark">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-16 -right-16 h-[240px] w-[240px] rounded-full blur-3xl opacity-40"
                style={{
                  background:
                    "radial-gradient(circle at center, rgba(208,161,43,0.50) 0%, transparent 70%)",
                }}
              />
              <div className="relative">
                <div className="flex items-center gap-2 text-[0.6rem] font-medium uppercase tracking-[0.28em] text-gold-light">
                  <span aria-hidden className="inline-block h-px w-6 bg-gold/70" />
                  <span>Patrícia Viana</span>
                </div>
                <ul className="mt-5 divide-y divide-white/10">
                  {founder.credentials.map((c, i) => {
                    const Icon = credentialIcons[i % credentialIcons.length];
                    return (
                      <li
                        key={c.label}
                        className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/15 border border-gold/25 text-gold-light">
                          <Icon className="size-4" strokeWidth={1.75} />
                        </span>
                        <div className="flex-1 min-w-0 flex items-baseline justify-between gap-3">
                          <span className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">
                            {c.label}
                          </span>
                          <span className="font-serif text-base text-white">{c.value}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </motion.div>

          {/* bio */}
          <div className="lg:col-span-7 lg:pt-2">
            <Reveal>
              <div className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold-dark">
                <span aria-hidden className="inline-block h-px w-8 bg-gold/60" />
                <span>{founder.eyebrow}</span>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-6 font-serif text-balance text-navy">
                {founder.title}
              </h2>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-7 text-lg text-navy-soft leading-relaxed">{founder.bio}</p>
            </Reveal>

            {/* big quote */}
            <Reveal delay={0.24}>
              <figure className="mt-10 relative rounded-xl bg-cream-deep/70 border-l-4 border-gold p-7 sm:p-9">
                <Quote
                  className="absolute -top-3 left-7 size-8 bg-cream-deep text-gold-dark"
                  aria-hidden
                />
                <blockquote className="font-serif italic text-xl sm:text-2xl text-navy leading-snug">
                  {founder.quote}
                </blockquote>
                <figcaption className="mt-5 text-xs uppercase tracking-[0.22em] text-navy-muted">
                  Patrícia Viana
                </figcaption>
              </figure>
            </Reveal>

            <Reveal delay={0.32}>
              <ButtonLink
                href="#contact"
                size="lg"
                variant="primary"
                withArrow
                className="mt-10"
              >
                {founder.stickerCta}
              </ButtonLink>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
