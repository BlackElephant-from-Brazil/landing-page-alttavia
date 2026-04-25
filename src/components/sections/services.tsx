"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Check, FileText, Landmark, Calendar, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function Services() {
  const { t } = useContent();
  const services = t.services;
  const b = services.bento;

  return (
    <section id="services" className="relative py-24 lg:py-32 bg-white overflow-hidden">
      <div aria-hidden className="absolute inset-0 grid-lines-cream opacity-60 pointer-events-none" />
      <Container size="wide" className="relative">
        <div className="grid gap-10 lg:grid-cols-12 items-end">
          <div className="lg:col-span-7">
            <Reveal>
              <div className="flex items-center gap-3 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-gold-dark">
                <span aria-hidden className="inline-block h-px w-8 bg-gold/60" />
                <span>{services.eyebrow}</span>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="mt-6 font-serif text-balance text-navy">
                {services.title}
              </h2>
            </Reveal>
          </div>
          <div className="lg:col-span-5">
            <Reveal delay={0.18}>
              <p className="text-lg text-navy-soft leading-relaxed">
                {services.lede}
              </p>
            </Reveal>
          </div>
        </div>

        {/* Bento grid */}
        <div className="mt-16 lg:mt-20 grid gap-5 lg:grid-cols-12">
          {/* NIF — large primary card */}
          <BentoLarge
            number={b.nifNumber}
            tag={b.nifTag}
            title={b.nifTitle}
            desc={b.nifDesc}
            bullets={b.nifBullets}
            cta={b.nifCta}
            icon={FileText}
            tone="navy"
            className="lg:col-span-7"
          />

          {/* Right column: Bank stacked above two equal-width bonus cards */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <BentoMedium
              number={b.bankNumber}
              tag={b.bankTag}
              title={b.bankTitle}
              desc={b.bankDesc}
              bullets={b.bankBullets}
              cta={b.bankCta}
              icon={Landmark}
            />
            <div className="grid grid-cols-2 gap-5 flex-1">
              <BentoSmall
                tag={b.sideOne.tag}
                title={b.sideOne.title}
                desc={b.sideOne.desc}
                icon={Calendar}
              />
              <BentoSmall
                tag={b.sideTwo.tag}
                title={b.sideTwo.title}
                desc={b.sideTwo.desc}
                icon={ShieldCheck}
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

type LargeProps = {
  number: string;
  tag: string;
  title: string;
  desc: string;
  bullets: readonly string[];
  cta: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "navy" | "white";
  className?: string;
};

function BentoLarge({ number, tag, title, desc, bullets, cta, icon: Icon, className }: LargeProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-6% 0%" }}
      transition={{ duration: 0.8, ease: smooth }}
      className={`relative group overflow-hidden rounded-2xl bg-navy text-white p-8 sm:p-10 lg:p-12 has-grain-dark flex flex-col ${className ?? ""}`}
    >
      {/* gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-20 h-[420px] w-[420px] rounded-full blur-3xl opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.50) 0%, transparent 70%)",
        }}
      />
      {/* big editorial number — desktop only, anchored to bottom-right corner so it never
          fights the tag pill or the icon at the top of the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-2 hidden lg:block editorial-number text-[12rem] text-gold-light/30 leading-none"
      >
        {number}
      </div>

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gold text-navy">
          <Icon className="size-6" strokeWidth={1.75} />
        </div>
        <span className="inline-flex items-center self-start sm:self-center rounded-full bg-white/10 border border-white/15 px-3 py-1 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-gold-light">
          {tag}
        </span>
      </div>

      <h3 className="relative mt-7 font-serif text-3xl sm:text-4xl text-white leading-tight max-w-md">
        {title}
      </h3>
      <p className="relative mt-5 text-base text-white/75 leading-relaxed max-w-xl">
        {desc}
      </p>

      <ul className="relative mt-7 space-y-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex gap-3 text-sm text-white/85">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold text-navy">
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="relative mt-auto pt-9">
        <ButtonLink href="#contact" size="md" variant="gold" withArrow>
          {cta}
        </ButtonLink>
      </div>
    </motion.article>
  );
}

type MediumProps = Omit<LargeProps, "tone">;
function BentoMedium({ number, tag, title, desc, bullets, cta, icon: Icon, className }: MediumProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-6% 0%" }}
      transition={{ duration: 0.8, delay: 0.05, ease: smooth }}
      className={`relative group overflow-hidden rounded-2xl bg-cream-deep/60 border border-warm-line p-8 sm:p-10 flex flex-col hover:bg-white hover:border-gold/40 hover:shadow-[var(--shadow-card)] transition-all duration-500 ${className ?? ""}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-4 -right-2 hidden lg:block editorial-number text-[9rem] text-navy/12 leading-none"
      >
        {number}
      </div>

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-navy text-white">
          <Icon className="size-5" strokeWidth={1.75} />
        </div>
        <span className="inline-flex items-center self-start sm:self-center rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-gold-dark">
          {tag}
        </span>
      </div>

      <h3 className="relative mt-6 font-serif text-2xl sm:text-3xl text-navy leading-tight">
        {title}
      </h3>
      <p className="relative mt-4 text-[0.95rem] text-navy-soft leading-relaxed">
        {desc}
      </p>

      <ul className="relative mt-6 space-y-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex gap-3 text-sm text-navy">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-white">
              <Check className="size-3" strokeWidth={3} />
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="relative mt-auto pt-7">
        <a
          href="#contact"
          className="inline-flex items-center gap-2 text-sm font-medium text-gold-dark hover:text-navy transition-colors group/cta"
        >
          <span className="border-b border-gold/40 group-hover/cta:border-navy">{cta}</span>
          <ArrowUpRight className="size-4 group-hover/cta:translate-x-0.5 transition-transform" />
        </a>
      </div>
    </motion.article>
  );
}

type SmallProps = {
  tag: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  className?: string;
};

function BentoSmall({ tag, title, desc, icon: Icon, className }: SmallProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-6% 0%" }}
      transition={{ duration: 0.7, delay: 0.1, ease: smooth }}
      className={`relative rounded-2xl bg-white border border-warm-line p-6 lg:p-7 flex flex-col ${className ?? ""}`}
    >
      <div className="flex items-center gap-3">
        <Icon className="size-5 text-gold-dark" strokeWidth={1.75} />
        <span className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-navy-muted">
          {tag}
        </span>
      </div>
      <h4 className="mt-4 font-serif text-lg text-navy leading-snug">{title}</h4>
      <p className="mt-2 text-sm text-navy-soft leading-relaxed">{desc}</p>
    </motion.article>
  );
}
