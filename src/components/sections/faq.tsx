"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { GoldParticles } from "@/components/ui/gold-particles";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function Faq() {
  const { t } = useContent();
  const faq = t.faq;
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [open, setOpen] = useState<number | null>(0);

  const categories = ["All", ...faq.categories];
  const filtered =
    activeCategory === "All"
      ? faq.items
      : faq.items.filter((it) => it.category === activeCategory);

  return (
    <section
      id="faq"
      className="relative py-24 lg:py-32 bg-cream-deep/70 overflow-hidden isolate"
    >
      <GoldParticles count={20} />
      <Container size="wide" className="relative z-10">
        <div className="grid gap-10 lg:grid-cols-12 items-end">
          <div className="lg:col-span-7">
            <Reveal>
              <div className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold-dark">
                <span aria-hidden className="inline-block h-px w-8 bg-gold/60" />
                <span>{faq.eyebrow}</span>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="mt-6 font-serif text-balance text-navy">{faq.title}</h2>
            </Reveal>
          </div>

          {/* category filter */}
          <Reveal delay={0.18} className="lg:col-span-5">
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {categories.map((cat) => {
                const active = cat === activeCategory;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat);
                      setOpen(0);
                    }}
                    className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.18em] transition-colors ${
                      active
                        ? "bg-navy text-white border-navy"
                        : "border-navy/15 bg-white text-navy-soft hover:border-navy/30 hover:text-navy"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </Reveal>
        </div>

        <ul className="mt-14 lg:mt-16 grid gap-4 lg:grid-cols-2">
          {filtered.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.li
                key={`${activeCategory}-${item.q}`}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-5% 0%" }}
                transition={{ duration: 0.5, delay: i * 0.04, ease: smooth }}
                className={`overflow-hidden rounded-xl border border-warm-line/70 bg-white transition-all duration-300 ${
                  isOpen ? "shadow-[var(--shadow-card)] border-gold/40" : "hover:shadow-[var(--shadow-soft)]"
                }`}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start justify-between gap-5 px-6 sm:px-8 py-6 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="font-mono text-xs text-gold-dark">{item.n}</span>
                      <span className="text-[0.6rem] font-medium uppercase tracking-[0.22em] text-navy-muted bg-navy/5 px-2 py-0.5 rounded">
                        {item.category}
                      </span>
                    </div>
                    <span className="font-serif text-lg text-navy leading-snug">
                      {item.q}
                    </span>
                  </div>
                  <span
                    className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-500 ${
                      isOpen
                        ? "bg-navy text-white border-navy rotate-45"
                        : "bg-white text-navy-soft border-warm-line"
                    }`}
                    aria-hidden
                  >
                    <Plus className="size-4" strokeWidth={1.75} />
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
                      <p className="px-6 sm:px-8 pb-7 pr-14 text-[0.95rem] text-navy-soft leading-relaxed">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
