"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { UserCheck, Award, Languages, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal, staggerContainer, staggerItem } from "@/components/ui/reveal";
import { Globe } from "@/components/ui/globe";
import { ConcentricRings } from "@/components/ui/concentric-rings";
import { Marquee } from "@/components/ui/marquee";
import { useContent } from "@/components/providers/content-provider";

const icons = [UserCheck, Award, Languages, ShieldCheck];

export function WhyUs() {
  const { t } = useContent();
  const whyUs = t.whyUs;

  const scrollRef = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  return (
    <section
      id="why"
      className="relative py-20 sm:py-28 lg:py-36 bg-navy text-white overflow-hidden isolate"
    >
      {/* Globe: hidden on mobile (too large, causes layout issues), shown sm+ */}
      <div
        aria-hidden
        className="pointer-events-none absolute hidden sm:block sm:-left-[15%] sm:-bottom-[55%] sm:w-[min(150vw,1200px)] lg:-left-[22%] lg:-bottom-[65%] aspect-square opacity-70 z-0"
        style={{
          maskImage:
            "radial-gradient(circle at 68% 32%, black 42%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(circle at 68% 32%, black 42%, transparent 72%)",
        }}
      >
        <Globe />
      </div>
      {/* Mobile globe — bottom-left, hangs 30% below section */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[25%] -bottom-[22%] w-[min(130vw,520px)] aspect-square opacity-35 sm:hidden z-0"
        style={{
          maskImage:
            "radial-gradient(circle at 70% 28%, black 42%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(circle at 70% 28%, black 42%, transparent 70%)",
        }}
      >
        <Globe />
      </div>

      {/* Atelier concentric rings around the globe (behind the globe itself but above bg) */}
      <div
        aria-hidden
        className="pointer-events-none absolute hidden sm:block z-0"
        style={{
          left: "calc(-15% + 56vw)",
          bottom: "-25%",
          width: "min(70vw, 560px)",
          height: "min(70vw, 560px)",
        }}
      >
        <div className="relative w-full h-full">
          <ConcentricRings
            count={1}
            size={220}
            strokeWidth={0.5}
            color="rgba(208,161,43,0.30)"
            className="absolute inset-0 m-auto"
          />
          <ConcentricRings
            count={1}
            size={170}
            strokeWidth={0.5}
            color="rgba(208,161,43,0.20)"
            className="absolute inset-0 m-auto"
          />
          <ConcentricRings
            count={1}
            size={130}
            strokeWidth={0.5}
            color="rgba(208,161,43,0.12)"
            className="absolute inset-0 m-auto"
          />
        </div>
      </div>

      {/* Soft gold glow top-right */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-20%] h-[600px] w-[600px] rounded-full blur-3xl opacity-30 z-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.5) 0%, transparent 65%)",
        }}
      />

      {/* Subtle vignette to deepen card contrast */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, transparent 20%, rgba(8, 16, 40, 0.55) 75%)",
        }}
      />

      <Container size="wide" className="relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="flex items-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-gold-light justify-center">
              <span className="inline-block h-px w-8 bg-gold/70" aria-hidden />
              <span>{whyUs.eyebrow}</span>
              <span className="inline-block h-px w-8 bg-gold/70" aria-hidden />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-6 font-serif text-balance text-white">
              {whyUs.title}
            </h2>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="mt-6 text-lg text-white/80 leading-relaxed">
              {whyUs.intro}
            </p>
          </Reveal>
        </div>

        {/* Mobile: horizontal scroll carousel with peek. Desktop: 2-col grid */}
        <div className="mt-16 lg:mt-20">
          <motion.ul
            ref={scrollRef}
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-8% 0%" }}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-3 -mx-5 pl-7 pr-5 scroll-pl-7 sm:mx-0 sm:px-0 sm:scroll-pl-0 sm:grid sm:grid-cols-2 sm:gap-5 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {whyUs.items.map((item, i) => {
              const Icon = icons[i % icons.length];
              return (
                <motion.li
                  key={item.title}
                  variants={staggerItem}
                  className="w-[82vw] sm:w-auto sm:min-w-0 snap-start flex-shrink-0"
                >
                  <div className="group card-hover-atelier-dark relative h-full bg-white/[0.07] border border-white/[0.10] rounded-xl p-6 sm:p-8 flex flex-col">
                    <span
                      className="absolute top-4 right-5 font-serif text-3xl text-gold-light/30 leading-none italic select-none pointer-events-none"
                      aria-hidden
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-gold/20 border border-gold/25 text-gold-light transition-colors duration-500 group-hover:bg-gold group-hover:text-navy group-hover:border-gold">
                      <Icon className="size-5" strokeWidth={1.5} />
                    </div>
                    <h3 className="mt-5 sm:mt-6 font-serif text-xl sm:text-2xl text-white leading-snug break-words hyphens-auto">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm sm:text-[0.95rem] text-white/75 leading-relaxed break-words">
                      {item.desc}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>

          {/* Scroll arrows: mobile only, sit beneath the carousel */}
          <div className="flex gap-2 justify-center mt-6 sm:hidden">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/80 hover:border-gold hover:text-gold transition-colors"
              aria-label="Previous card"
              onClick={() => scroll(-1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/80 hover:border-gold hover:text-gold transition-colors"
              aria-label="Next card"
              onClick={() => scroll(1)}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        {/* Cities-served marquee, closes the WhyUs section */}
        <div className="mt-16 sm:mt-20 -mx-5 sm:mx-0 border-t border-gold/20 pt-8">
          <Marquee>
            <CityLine />
          </Marquee>
        </div>
      </Container>
    </section>
  );
}

const CITIES = [
  "LISBOA",
  "MADRID",
  "PARIS",
  "LONDON",
  "BERLIN",
  "ROMA",
  "VALLETTA",
  "NYC",
  "LA",
  "MIAMI",
  "CHICAGO",
  "HOUSTON",
  "SÃO PAULO",
  "RIO",
  "MEXICO CITY",
  "DUBAI",
  "SINGAPORE",
  "TOKYO",
  "SYDNEY",
] as const;

function CityLine() {
  return (
    <div className="flex items-center gap-8 sm:gap-10 px-8 text-[0.7rem] sm:text-xs uppercase tracking-[0.18em] font-medium text-wheat/80">
      {CITIES.map((city, i) => (
        <span key={`${city}-${i}`} className="flex items-center gap-8 sm:gap-10">
          <span>{city}</span>
          <span className="text-gold-light/40" aria-hidden>·</span>
        </span>
      ))}
    </div>
  );
}
