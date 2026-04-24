"use client";

import { motion } from "framer-motion";
import { Check, FileText, Landmark } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;
const icons = [FileText, Landmark];

export function Services() {
  const { t } = useContent();
  const services = t.services;

  return (
    <section
      id="services"
      className="relative py-24 lg:py-32 bg-cream-deep/60"
    >
      <Container size="wide">
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
              <motion.article
                key={item.id}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-6% 0%" }}
                transition={{ duration: 0.8, delay: i * 0.1, ease: smooth }}
                className="group relative flex flex-col overflow-hidden rounded-xl bg-white border border-warm-line/70 p-8 sm:p-10 lg:p-12 shadow-[var(--shadow-soft)] transition-all duration-500 hover:border-gold/50 hover:shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start gap-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-wheat/40 text-gold-dark">
                    <Icon className="size-6" strokeWidth={1.5} />
                  </div>
                  <span className="inline-flex items-center rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[0.68rem] font-medium uppercase tracking-wider text-gold-dark">
                    {item.tag}
                  </span>
                </div>

                <h3 className="mt-7 font-serif text-3xl text-navy leading-tight">
                  {item.title}
                </h3>
                <p className="mt-2 text-base italic text-navy-soft font-serif">
                  {item.subtitle}
                </p>

                <div className="mt-6 space-y-4 text-[0.96rem] text-navy-soft leading-relaxed">
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

                <div className="mt-9 pt-7 border-t border-warm-line/70">
                  <ButtonLink
                    href="#contact"
                    size="md"
                    withArrow
                    className="w-full sm:w-auto"
                  >
                    {item.cta}
                  </ButtonLink>
                </div>
              </motion.article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
