"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Reveal } from "@/components/ui/reveal";
import { GoldParticles } from "@/components/ui/gold-particles";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function Faq() {
  const { t } = useContent();
  const faq = t.faq;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="relative py-20 sm:py-24 lg:py-32 overflow-hidden isolate"
    >
      <GoldParticles count={24} />
      <Container className="relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <Eyebrow>{faq.eyebrow}</Eyebrow>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-6 font-serif text-balance text-navy">
              {faq.title}
            </h2>
          </Reveal>
        </div>

        <ul className="mt-14 lg:mt-16 mx-auto max-w-3xl flex flex-col gap-3">
          {faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.li
                key={item.q}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-5% 0%" }}
                transition={{ duration: 0.55, delay: i * 0.04, ease: smooth }}
              >
                <div className="bg-white rounded-xl border border-black/[0.06] shadow-sm overflow-hidden">
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="group flex w-full items-center justify-between gap-4 sm:gap-6 px-5 sm:px-8 py-5 sm:py-6 text-left"
                  >
                    <span className="font-serif text-base sm:text-lg lg:text-xl text-navy leading-snug">
                      {item.q}
                    </span>
                    <span
                      className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ${
                        isOpen
                          ? "bg-navy text-white border-navy rotate-45"
                          : "bg-white/50 text-navy-soft border-white/40 group-hover:border-gold/50 group-hover:text-gold-dark"
                      }`}
                      aria-hidden
                    >
                      <Plus className="size-3.5 sm:size-4" strokeWidth={1.75} />
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: smooth }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 sm:px-8 pb-5 sm:pb-7 pr-12 sm:pr-14 text-sm sm:text-[0.96rem] text-navy-soft leading-relaxed">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
