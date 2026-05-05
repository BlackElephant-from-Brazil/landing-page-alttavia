"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Check, FileText, Landmark } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
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
      <div className="absolute top-[170px] left-[90px] -translate-y-1/2 z-10 hidden sm:block">
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

        <div className="mt-12 sm:mt-16 lg:mt-20 grid gap-5 sm:gap-6 lg:gap-8 lg:grid-cols-2">
          {services.items.map((item, i) => {
            const Icon = icons[i % icons.length];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-6% 0%" }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: smooth }}
              >
                <div className="relative bg-white rounded-[1.25rem] border border-black/[0.06] shadow-md w-full h-full flex flex-col p-7 sm:p-10 lg:p-12">
                  <span
                    className="absolute top-6 right-7 font-serif text-4xl sm:text-5xl text-gold/20 leading-none italic select-none pointer-events-none"
                    aria-hidden
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Header row */}
                  <div className="flex items-center">
                    <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-wheat/40 text-gold-dark">
                      <Icon className="size-5 sm:size-6" strokeWidth={1.5} />
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="mt-6 font-serif text-2xl sm:text-3xl text-navy leading-tight lg:min-h-[5.5rem]">
                    {item.title}
                  </h3>

                  {/* Subtitle */}
                  <p className="mt-2 text-sm sm:text-base italic text-navy-soft font-serif lg:min-h-[2.5rem]">
                    {item.subtitle}
                  </p>

                  {/* Body — grows to absorb locale length variation */}
                  <div className="mt-5 flex-grow space-y-3 sm:space-y-4 text-sm sm:text-[0.96rem] text-navy-soft leading-relaxed">
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
                  <div className="mt-auto pt-7 border-t border-black/[0.06]">
                    <a
                      href="#contact"
                      className="inline-flex items-center gap-2 px-7 h-12 text-sm font-medium text-white bg-navy rounded-full hover:bg-gold hover:text-navy transition-colors whitespace-nowrap"
                    >
                      {item.cta}
                      <ArrowUpRight className="size-4" aria-hidden />
                    </a>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
