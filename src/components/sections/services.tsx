"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Check, FileText, Landmark } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { LiquidGlassShell } from "@alttavia/liquid-glass";
import { SpinningBadge } from "@/components/ui/spinning-badge";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;
const icons = [FileText, Landmark];

export function Services() {
  const { t } = useContent();
  const services = t.services;

  return (
    <section
      id="services"
      className="relative py-24 lg:py-32 overflow-visible"
    >
      {/* Rotating sticker — decorative, partially above the section fold */}
      <div className="absolute top-0 left-[90px] -translate-y-1/2 z-10 hidden sm:block">
        <SpinningBadge />
      </div>

      <Container size="wide" className="relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <Eyebrow>{services.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-6 font-serif text-balance text-navy">
              {services.title}
            </h2>
          </Reveal>
          <Reveal delay={0.18}>
            <p className="mt-5 text-lg text-navy-soft leading-relaxed">
              {services.desc}
            </p>
          </Reveal>
        </div>

        <div className="mt-16 lg:mt-20 grid gap-6 lg:gap-8 lg:grid-cols-2">
          {services.items.map((item, i) => {
            const Icon = icons[i % icons.length];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-6% 0%" }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: smooth }}
                style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.06)" }}
              >
                <LiquidGlassShell
                  lightVariant
                  tintOpacity={0.50}
                  blur={24}
                  filter="glass-distortion-soft"
                  borderRadius="1.25rem"
                  enableHover
                  className="w-full h-full"
                  contentClassName="flex flex-col p-8 sm:p-10 lg:p-12"
                >
                  <span
                    className="absolute top-6 right-7 font-serif text-4xl sm:text-5xl text-gold/20 leading-none italic select-none pointer-events-none"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Header row — fixed min-height for cross-card alignment */}
                  <div className="flex items-start gap-5 min-h-[4rem]">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-wheat/40 text-gold-dark">
                      <Icon className="size-6" strokeWidth={1.5} />
                    </div>
                    <LiquidGlassShell
                      lightVariant
                      tintOpacity={0.35}
                      filter="none"
                      borderRadius="9999px"
                      className="shrink-0 self-center"
                    >
                      <span className="inline-flex items-center px-3 py-1 text-[0.68rem] font-medium uppercase tracking-wider text-gold-dark whitespace-nowrap">
                        {item.tag}
                      </span>
                    </LiquidGlassShell>
                  </div>

                  {/* Title — fixed min-height */}
                  <h3 className="mt-7 font-serif text-3xl text-navy leading-tight min-h-[5.5rem]">
                    {item.title}
                  </h3>

                  {/* Subtitle — fixed min-height */}
                  <p className="mt-2 text-base italic text-navy-soft font-serif min-h-[2.5rem]">
                    {item.subtitle}
                  </p>

                  {/* Body — grows to absorb locale length variation */}
                  <div className="mt-6 flex-grow space-y-4 text-[0.96rem] text-navy-soft leading-relaxed">
                    <p>{item.body}</p>
                    <p>{item.body2}</p>
                  </div>

                  <ul className="mt-7 space-y-3">
                    {item.bullets.map((b) => (
                      <li key={b} className="flex gap-3 text-[0.93rem] text-navy">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-white">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA — always pinned to bottom */}
                  <div className="mt-auto pt-7 border-t border-white/20">
                    <LiquidGlassShell
                      lightVariant
                      tintOpacity={0.60}
                      filter="glass-distortion-soft"
                      borderRadius="9999px"
                      className="inline-flex"
                    >
                      <a
                        href="#contact"
                        className="inline-flex items-center gap-2 px-7 h-12 text-sm font-medium text-navy hover:text-gold-dark transition-colors whitespace-nowrap"
                      >
                        {item.cta}
                        <ArrowUpRight className="size-4" aria-hidden />
                      </a>
                    </LiquidGlassShell>
                  </div>
                </LiquidGlassShell>
              </motion.div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
