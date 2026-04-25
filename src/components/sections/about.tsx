"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function About() {
  const { t } = useContent();
  const about = t.about;

  return (
    <section
      id="about"
      className="relative py-24 lg:py-32 bg-gradient-to-b from-cream via-cream-deep/60 to-cream"
    >
      <Container size="wide">
        <div className="grid gap-14 lg:gap-20 lg:grid-cols-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-10% 0%" }}
            transition={{ duration: 0.9, ease: smooth }}
            className="lg:col-span-5 relative"
          >
            <div className="relative aspect-[4/5] rounded-xl overflow-hidden shadow-[var(--shadow-card)]">
              <Image
                src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?auto=format&fit=crop&w=1200&q=80"
                alt="Patrícia Viana, founder of Alttavia Relocation"
                fill
                sizes="(min-width: 1024px) 40vw, 90vw"
                className="object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-navy-deep/45 via-transparent to-transparent"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2, ease: smooth }}
              className="absolute -bottom-6 right-4 sm:-right-8 max-w-[calc(100%-2rem)] sm:max-w-sm rounded-xl bg-white border border-warm-line/70 p-6 shadow-[var(--shadow-card)]"
            >
              <Quote className="size-6 text-gold-dark" aria-hidden />
              <p className="mt-3 font-serif text-lg italic text-navy leading-snug">
                “{about.highlight.quote}”
              </p>
              <div className="mt-4 pt-4 border-t border-warm-line">
                <div className="font-serif text-base text-navy">
                  {about.highlight.name}
                </div>
                <div className="text-xs text-navy-muted mt-0.5">
                  {about.highlight.role}
                </div>
              </div>
            </motion.div>
          </motion.div>

          <div className="lg:col-span-7">
            <Reveal>
              <Eyebrow align="centerOnMobile">{about.eyebrow}</Eyebrow>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="mt-6 font-serif text-balance text-navy">
                {about.title}
              </h2>
            </Reveal>
            <div className="mt-7 space-y-5">
              {about.paragraphs.map((p, i) => (
                <Reveal key={i} delay={0.15 + i * 0.07}>
                  <p className="text-lg text-navy-soft leading-relaxed">{p}</p>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.45}>
              <dl className="mt-12 grid grid-cols-3 gap-6 sm:gap-10 border-t border-warm-line pt-8">
                {about.stats.map((s) => (
                  <div key={s.label}>
                    <dt className="sr-only">{s.label}</dt>
                    <dd className="font-serif text-3xl sm:text-4xl text-navy leading-none">
                      {s.number}
                    </dd>
                    <div className="mt-2 text-xs text-navy-muted uppercase tracking-wider">
                      {s.label}
                    </div>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
