"use client";

import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { Globe } from "@/components/ui/globe";
import { Marquee } from "@/components/ui/marquee";
import { useContent } from "@/components/providers/content-provider";

export function WhyUs() {
  const { t } = useContent();
  const globe = t.globe;
  const trust = t.trustMarquee;

  return (
    <section
      id="globe"
      className="relative py-24 lg:py-32 bg-navy text-white overflow-hidden has-grain-dark isolate"
    >
      <div aria-hidden className="absolute inset-0 grid-lines-navy opacity-40 pointer-events-none z-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[640px] w-[640px] rounded-full blur-3xl opacity-30 z-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.45) 0%, transparent 70%)",
        }}
      />

      {/* Large background globe: 210vw wide, top hemisphere only, centered at 30% from left */}
      <div
        aria-hidden
        className="absolute bottom-0 pointer-events-none overflow-hidden z-[1]"
        style={{
          width: "210vw",
          height: "105vw",
          left: "calc(30% - 105vw)",
        }}
      >
        <div
          className="absolute top-0 opacity-[0.13]"
          style={{ width: "210vw", height: "210vw" }}
        >
          <Globe rotationSpeed={0.0006} />
        </div>
      </div>

      <Container size="wide" className="relative z-10">
        <div className="lg:max-w-2xl">
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

          <Reveal delay={0.28}>
            <div className="mt-10">
              <div className="text-[0.62rem] font-medium uppercase tracking-[0.28em] text-white/45 mb-4">
                {globe.cityListLabel}
              </div>
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2.5">
                {trust.cities.slice(0, 8).map((city) => (
                  <li
                    key={city}
                    className="flex items-center gap-2 font-serif italic text-base text-white/85"
                  >
                    <span
                      aria-hidden
                      className="inline-block h-1 w-1 rounded-full bg-gold shrink-0"
                    />
                    {city}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Container>

      {/* large city marquee at bottom */}
      <div className="relative mt-20 lg:mt-28 border-y border-white/10 py-6 text-white/40 z-10">
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
