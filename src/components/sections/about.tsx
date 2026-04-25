"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Quote, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

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
        {/* Press kit header strip */}
        <div className="flex items-center justify-between gap-4 border-b border-warm-line pb-4 text-[0.68rem] uppercase tracking-[0.28em] text-navy-muted">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-block h-px w-8 bg-gold/60" />
            <span className="text-gold-dark">{founder.eyebrow}</span>
          </div>
          <span className="font-mono text-navy/40">{founder.kicker}</span>
        </div>

        <div className="mt-12 lg:mt-16 grid gap-14 lg:gap-20 lg:grid-cols-12 items-start">
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

              {/* credentials chip stack */}
              <ul className="mt-8 grid grid-cols-2 gap-3">
                {founder.credentials.map((c) => (
                  <li
                    key={c.label}
                    className="rounded-xl border border-warm-line bg-white p-4 hover:border-gold/40 transition-colors"
                  >
                    <div className="text-[0.6rem] font-medium uppercase tracking-[0.22em] text-navy-muted">
                      {c.label}
                    </div>
                    <div className="mt-1 font-serif text-base text-navy">{c.value}</div>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* bio */}
          <div className="lg:col-span-7 lg:pt-2">
            <Reveal>
              <h2 className="font-serif text-balance text-navy">
                {founder.title}
              </h2>
            </Reveal>

            <Reveal delay={0.1}>
              <p className="mt-7 text-lg text-navy-soft leading-relaxed">{founder.bio}</p>
            </Reveal>

            {/* big quote */}
            <Reveal delay={0.2}>
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
              <a
                href="#contact"
                className="mt-10 inline-flex items-center gap-3 rounded-full border border-navy/15 bg-white px-5 py-3 text-sm font-medium text-navy hover:bg-navy hover:text-white transition-colors group"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold pulse-dot" aria-hidden />
                {founder.stickerCta}
                <ArrowUpRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
