"use client";

import { motion } from "framer-motion";
import { UserCheck, Award, Languages, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal, staggerContainer, staggerItem } from "@/components/ui/reveal";
import { Globe } from "@/components/ui/globe";
import { useContent } from "@/components/providers/content-provider";

const icons = [UserCheck, Award, Languages, ShieldCheck];

export function WhyUs() {
  const { t } = useContent();
  const whyUs = t.whyUs;

  return (
    <section
      id="why"
      className="relative py-28 lg:py-36 bg-navy text-white overflow-hidden isolate"
    >
      {/* Globe — bottom-left, only top-right quarter visible */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[12%] -bottom-[55%] w-[min(140vw,1200px)] aspect-square opacity-80 sm:-left-[18%] sm:-bottom-[60%] lg:-left-[22%] lg:-bottom-[65%] z-0"
        style={{
          maskImage:
            "radial-gradient(circle at 68% 32%, black 42%, transparent 72%)",
          WebkitMaskImage:
            "radial-gradient(circle at 68% 32%, black 42%, transparent 72%)",
        }}
      >
        <Globe />
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

        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-8% 0%" }}
          className="mt-16 lg:mt-20 grid gap-5 sm:grid-cols-2"
        >
          {whyUs.items.map((item, i) => {
            const Icon = icons[i % icons.length];
            return (
              <motion.li
                key={item.title}
                variants={staggerItem}
                className="group glass-card rounded-xl p-8 transition-all duration-500"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20 border border-gold/25 text-gold-light transition-colors duration-500 group-hover:bg-gold group-hover:text-navy group-hover:border-gold">
                  <Icon className="size-5" strokeWidth={1.5} />
                </div>
                <h3 className="mt-6 font-serif text-2xl text-white leading-snug">
                  {item.title}
                </h3>
                <p className="mt-3 text-[0.95rem] text-white/75 leading-relaxed">
                  {item.desc}
                </p>
              </motion.li>
            );
          })}
        </motion.ul>
      </Container>
    </section>
  );
}
