"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

function CountUp({ value, active }: { value: string; active: boolean }) {
  const match = value.match(/^(\d+)(.*)/);
  const target = match ? parseInt(match[1], 10) : null;
  const suffix = match ? match[2] : "";
  const [current, setCurrent] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || target === null || startedRef.current) return;
    startedRef.current = true;
    if (target === 0) { setCurrent(0); return; }
    const duration = 1800;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCurrent(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);

  if (target === null) return <>{value}</>;
  return <>{current}{suffix}</>;
}

export function BigStats() {
  const { t } = useContent();
  const stats = t.bigStats;
  const listRef = useRef<HTMLUListElement>(null);
  const inView = useInView(listRef, { once: true, margin: "-6% 0%" });

  return (
    <section
      id="numbers"
      className="relative py-24 lg:py-32 bg-navy text-white overflow-hidden has-grain-dark isolate"
    >
      <div aria-hidden className="absolute inset-0 grid-lines-navy opacity-50 pointer-events-none" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[480px] w-[680px] rounded-full blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.45) 0%, transparent 70%)",
        }}
      />

      <Container size="wide" className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold-light lg:justify-center">
              <span aria-hidden className="inline-block h-px w-8 bg-gold/70" />
              <span>{stats.eyebrow}</span>
              <span aria-hidden className="hidden lg:inline-block h-px w-8 bg-gold/70" />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-6 font-serif text-balance text-white">
              {stats.title}
            </h2>
          </Reveal>
        </div>

        <ul
          ref={listRef}
          className="mt-16 lg:mt-20 grid gap-px sm:grid-cols-2 lg:grid-cols-4 bg-white/10 rounded-2xl overflow-hidden border border-white/10"
        >
          {stats.items.map((item, i) => (
            <motion.li
              key={item.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-6% 0%" }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: smooth }}
              className="relative bg-navy p-8 lg:p-10 group transition-colors hover:bg-navy-deep/80"
            >
              <div className="font-serif italic font-light text-[clamp(3.5rem,7vw,5.5rem)] leading-[0.9] text-gold">
                <CountUp value={item.number} active={inView} />
              </div>
              <div className="mt-3 text-xs uppercase tracking-[0.22em] text-white/55">
                {item.label}
              </div>
              <p className="mt-3 text-sm text-white/70 leading-relaxed max-w-[28ch]">
                {item.caption}
              </p>
              <span
                aria-hidden
                className="absolute top-4 right-4 text-[0.62rem] font-mono text-gold/40"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            </motion.li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
