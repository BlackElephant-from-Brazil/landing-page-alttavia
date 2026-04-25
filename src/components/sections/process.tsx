"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function Process() {
  const { t } = useContent();
  const process = t.process;

  return (
    <section id="process" className="relative py-24 lg:py-32 bg-cream-deep/60 overflow-hidden">
      <Container size="wide">
        <div className="grid gap-10 lg:grid-cols-12 items-end">
          <div className="lg:col-span-7">
            <Reveal>
              <div className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold-dark">
                <span aria-hidden className="inline-block h-px w-8 bg-gold/60" />
                <span>{process.eyebrow}</span>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="mt-6 font-serif text-balance text-navy">
                {process.title}
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-5">
            <Reveal delay={0.18}>
              <p className="text-lg text-navy-soft leading-relaxed">
                {process.lede}
              </p>
            </Reveal>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative mt-16 lg:mt-20">
          {/* desktop horizontal connector */}
          <div
            aria-hidden
            className="hidden lg:block absolute top-[88px] left-[6%] right-[6%] h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
          />

          <ol className="grid gap-10 lg:gap-6 lg:grid-cols-4 relative">
            {process.steps.map((step, i) => (
              <motion.li
                key={step.n}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-6% 0%" }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: smooth }}
                className="relative"
              >
                {/* number circle — every step pulses, but staggered so the ring fires
                    in sequence (01, 02, 03, 04) inside a single 9.6s cycle */}
                <div className="relative flex items-center gap-4 lg:flex-col lg:items-start">
                  <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-white border border-warm-line shadow-[var(--shadow-soft)]">
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full border-2 border-gold/40 pulse-step"
                      style={{ animationDelay: `${i * 2.4}s` }}
                    />
                    <span className="font-serif italic text-3xl text-gold-dark">{step.n}</span>
                  </div>
                  <div className="flex-1 lg:mt-7 lg:flex-none">
                    <div className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-navy-muted">
                      {step.duration}
                    </div>
                    <h3 className="mt-1 font-serif text-2xl text-navy leading-tight">
                      {step.title}
                    </h3>
                  </div>
                </div>
                <p className="mt-5 text-sm text-navy-soft leading-relaxed lg:max-w-[26ch]">
                  {step.desc}
                </p>

                {/* mobile vertical connector */}
                {i < process.steps.length - 1 && (
                  <div
                    aria-hidden
                    className="lg:hidden absolute left-9 top-[72px] h-[calc(100%+1rem)] w-px bg-gradient-to-b from-gold/40 to-transparent"
                  />
                )}
              </motion.li>
            ))}
          </ol>

          <Reveal delay={0.45}>
            <p className="mt-14 text-xs italic text-navy-muted text-center max-w-2xl mx-auto">
              {process.footnote}
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
