"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal, staggerContainer, staggerItem } from "@/components/ui/reveal";
import { ConcentricRings } from "@/components/ui/concentric-rings";
import { useContent } from "@/components/providers/content-provider";
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";

export function Principles() {
  const { t } = useContent();
  const principles = t.principles;

  return (
    <section id="principles" className="relative py-28 lg:py-36 bg-navy text-white overflow-hidden isolate">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-15%] h-[520px] w-[520px] rounded-full blur-3xl opacity-25"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.5) 0%, transparent 65%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
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
              <span>{principles.eyebrow}</span>
              <span className="inline-block h-px w-8 bg-gold/70" aria-hidden />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-6 font-serif text-balance text-white">
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
              className="relative"
            >
              <LiquidGlassShell
                lightVariant={false}
                tintOpacity={0.15}
                filter="glass-distortion-soft"
                borderRadius="1rem"
                className="card-hover-atelier-dark group h-full"
                contentClassName="p-7 lg:p-9 flex flex-col"
              >
                <ConcentricRings
                  count={3}
                  size={20}
                  strokeWidth={0.5}
                  color="rgba(208,161,43,0.45)"
                  className="absolute top-3 left-3 opacity-90"
                />
                <Quote className="size-6 text-gold/30 ml-12" aria-hidden />
                <blockquote className="mt-5 font-serif italic text-lg lg:text-xl text-white/95 leading-relaxed">
                  {item.quote}
                </blockquote>
                <div className="mt-auto pt-7 text-xs uppercase tracking-[0.22em] text-gold-light">
                  {item.attribution}
                </div>
              </LiquidGlassShell>
            </motion.li>
          ))}
        </motion.ul>
      </Container>
    </section>
  );
}
