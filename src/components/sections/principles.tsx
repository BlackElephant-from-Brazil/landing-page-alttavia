"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal, staggerContainer, staggerItem } from "@/components/ui/reveal";
import { useContent } from "@/components/providers/content-provider";

export function Principles() {
  const { t } = useContent();
  const principles = t.principles;

  return (
    <section id="principles" className="relative py-24 lg:py-32">
      <Container size="wide">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <Eyebrow>{principles.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-6 font-serif text-balance text-navy">
              {principles.title}
            </h2>
          </Reveal>
        </div>

        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-8% 0%" }}
          className="mt-16 lg:mt-20 grid gap-5 md:grid-cols-2"
        >
          {principles.items.map((item) => (
            <motion.li
              key={item.attribution}
              variants={staggerItem}
              className="flex flex-col rounded-xl border border-warm-line/70 bg-white p-7 lg:p-9 shadow-[var(--shadow-soft)] transition-shadow duration-500 hover:shadow-[var(--shadow-card)]"
            >
              <Quote className="size-6 text-gold-dark" aria-hidden />
              <blockquote className="mt-5 font-serif italic text-lg lg:text-xl text-navy leading-relaxed">
                {item.quote}
              </blockquote>
              <div className="mt-auto pt-7 text-xs uppercase tracking-[0.22em] text-navy-muted">
                {item.attribution}
              </div>
            </motion.li>
          ))}
        </motion.ul>
      </Container>
    </section>
  );
}
