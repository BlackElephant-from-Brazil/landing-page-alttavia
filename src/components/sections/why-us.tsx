"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Globe } from "@/components/ui/globe";
import { Marquee } from "@/components/ui/marquee";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function WhyUs() {
  const { t } = useContent();
  const globe = t.globe;
  const trust = t.trustMarquee;

  return (
    <section
      id="globe"
      className="relative py-24 lg:py-32 bg-navy text-white overflow-hidden has-grain-dark isolate"
    >
      <div aria-hidden className="absolute inset-0 grid-lines-navy opacity-40 pointer-events-none" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[640px] w-[640px] rounded-full blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.45) 0%, transparent 70%)",
        }}
      />

      <Container size="wide" className="relative">
        <div className="grid gap-14 lg:gap-20 lg:grid-cols-12 items-center">
          {/* text */}
          <div className="lg:col-span-5">
            <Reveal>
              <div className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold-light">
                <span aria-hidden className="inline-block h-px w-8 bg-gold/70" />
                <span>{globe.eyebrow}</span>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="mt-6 font-serif text-balance text-white">
                {globe.title}
              </h2>
            </Reveal>
            <Reveal delay={0.18}>
              <p className="mt-6 text-lg text-white/75 leading-relaxed">
                {globe.lede}
              </p>
            </Reveal>

            {/* Recent cities mini-list */}
            <Reveal delay={0.28}>
              <div className="mt-10">
                <div className="text-[0.62rem] font-medium uppercase tracking-[0.28em] text-white/45 mb-4">
                  {globe.cityListLabel}
                </div>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                  {trust.cities.slice(0, 8).map((city) => (
                    <li
                      key={city}
                      className="flex items-center gap-2 font-serif italic text-base text-white/85"
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1 w-1 rounded-full bg-gold"
                      />
                      {city}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          {/* globe */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-10% 0%" }}
            transition={{ duration: 1.2, ease: smooth }}
            className="lg:col-span-7 relative aspect-square max-w-[560px] mx-auto"
          >
            {/* glow ring */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-full blur-3xl opacity-50"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(208,161,43,0.25) 0%, transparent 70%)",
              }}
            />
            <div className="relative">
              <Globe />
            </div>

            {/* floating "Lisbon HQ" tag */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="flex flex-col items-center">
                <div
                  aria-hidden
                  className="h-2.5 w-2.5 rounded-full bg-gold ring-4 ring-gold/20 pulse-dot"
                />
                <div className="mt-3 rounded-full bg-white/95 backdrop-blur-md px-3 py-1 text-[0.65rem] font-medium uppercase tracking-[0.18em] text-navy">
                  Lisbon HQ
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </Container>

      {/* large city marquee at bottom */}
      <div className="relative mt-20 lg:mt-28 border-y border-white/10 py-6 text-white/40">
        <Marquee
          items={[...trust.cities, ...trust.cities.slice(0, 4)]}
          duration={55}
          edgeFade
          itemClassName="font-serif italic text-2xl sm:text-3xl"
        />
      </div>
    </section>
  );
}
