"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal, staggerContainer, staggerItem } from "@/components/ui/reveal";
import { Marquee } from "@/components/ui/marquee";
import { useContent } from "@/components/providers/content-provider";

export function Versus() {
  const { t } = useContent();
  const versus = t.versus;
  const visa = t.visaMarquee;

  return (
    <section id="versus" className="relative py-24 lg:py-32 bg-cream-deep/60 overflow-hidden">
      {/* visa marquee at top, before headline */}
      <div className="border-y border-warm-line bg-white py-3 mb-20 lg:mb-28 text-navy">
        <Marquee
          items={visa.types}
          duration={40}
          edgeFade
          itemClassName="font-serif italic text-base sm:text-lg uppercase tracking-[0.18em] text-navy-soft"
        />
      </div>

      <Container size="wide">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold-dark justify-center">
              <span aria-hidden className="inline-block h-px w-8 bg-gold/60" />
              <span>{versus.eyebrow}</span>
              <span aria-hidden className="inline-block h-px w-8 bg-gold/60" />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-6 font-serif text-balance text-navy">
              {versus.title}
            </h2>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="mt-5 text-lg text-navy-soft leading-relaxed">
              {versus.lede}
            </p>
          </Reveal>
        </div>

        <div className="mt-16 lg:mt-20 grid gap-5 lg:grid-cols-2">
          {/* LEFT — middlemen */}
          <div className="relative rounded-xl border border-warm-line bg-white/60 p-7 lg:p-9">
            <div className="flex items-center gap-3 pb-5 border-b border-warm-line">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-clay/10 text-clay">
                <X className="size-4" strokeWidth={2.25} />
              </span>
              <span className="font-serif italic text-lg text-navy/70 line-through decoration-clay decoration-2">
                {versus.headerLeft}
              </span>
            </div>
            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-8% 0%" }}
              className="mt-5 space-y-4"
            >
              {versus.rows.map((row) => (
                <motion.li
                  key={row.left}
                  variants={staggerItem}
                  className="flex gap-3 text-sm text-navy-muted leading-relaxed"
                >
                  <X className="mt-1 size-4 shrink-0 text-clay/70" strokeWidth={2.25} />
                  <span>{row.left}</span>
                </motion.li>
              ))}
            </motion.ul>
          </div>

          {/* RIGHT — Alttavia */}
          <div
            className="relative rounded-xl bg-navy text-white p-7 lg:p-9 has-grain-dark overflow-hidden"
          >
            {/* gold corner accent */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-20 h-[280px] w-[280px] rounded-full blur-3xl opacity-40"
              style={{
                background:
                  "radial-gradient(circle at center, rgba(208,161,43,0.55) 0%, transparent 70%)",
              }}
            />
            <div className="relative flex items-center gap-3 pb-5 border-b border-white/15">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold text-navy">
                <Check className="size-4" strokeWidth={3} />
              </span>
              <span className="font-serif italic text-lg text-gold-light">
                {versus.headerRight}
              </span>
            </div>
            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-8% 0%" }}
              className="relative mt-5 space-y-4"
            >
              {versus.rows.map((row) => (
                <motion.li
                  key={row.right}
                  variants={staggerItem}
                  className="flex gap-3 text-sm text-white/85 leading-relaxed"
                >
                  <Check className="mt-1 size-4 shrink-0 text-gold" strokeWidth={2.5} />
                  <span>{row.right}</span>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
