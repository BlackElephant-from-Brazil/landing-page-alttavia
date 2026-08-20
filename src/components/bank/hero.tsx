"use client";

import { motion } from "framer-motion";
import { ArrowDown, CreditCard, FileText, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { bankNif, STRIPE_LINKS } from "@/content/bank-nif";

const smooth = [0.22, 0.61, 0.36, 1] as const;

/**
 * Section 2.
 *
 * The H1 validates the reader before it shows the wall, so the two halves are
 * typeset differently: the compliment stays upright, the impossibility gets the
 * italic and the drawn underline. The price sits inside the button on purpose,
 * to filter curiosity clicks out of the Google Ads spend.
 */
export function Hero() {
  const { hero } = bankNif;
  const { deliverables } = hero;

  return (
    <section id="top" className="has-grain relative overflow-hidden bg-paper">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-52 h-[520px] w-[520px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, rgba(224,207,159,0.6) 0%, rgba(208,161,43,0.32) 38%, transparent 72%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/2 h-[360px] w-[360px] rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.5) 0%, transparent 70%)",
        }}
      />

      {/* Bottom padding stays tight: on a wide screen the copy column runs out
          before the trust bar, and the leftover gap read as dead space. */}
      <Container size="wide" className="relative pb-10 pt-10 sm:pb-12 sm:pt-14 lg:pb-14 lg:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: smooth }}
            >
              {/* Tighter tracking than the default: this eyebrow carries the
                  search terms, so it is longer than the others and wraps to two
                  lines at the 1024px breakpoint otherwise. */}
              <EyebrowSolo tracking="tracking-[0.16em]">
                {hero.eyebrow}
              </EyebrowSolo>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.08, ease: smooth }}
              // The headline runs longer than the one the copy document
              // opened with, so the ramp is gentler. At the 1024px breakpoint,
              // where the copy column is at its narrowest, this is the
              // difference between five lines and six, and six pushes the buy
              // button under the fold on a short laptop.
              className="mt-6 font-serif text-[clamp(1.95rem,4.6vw,3.25rem)] leading-[1.07] tracking-[-0.02em] text-navy"
            >
              {hero.titleBefore}{" "}
              <span className="relative inline-block italic text-gold-dark">
                {hero.titleHighlight}
                <svg
                  aria-hidden
                  className="absolute -bottom-1.5 left-0 h-3 w-full sm:-bottom-2"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                >
                  <motion.path
                    d="M2 9 Q 50 2, 100 6 T 198 5"
                    stroke="#D0A12B"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.1, delay: 0.85, ease: smooth }}
                  />
                </svg>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.75, delay: 0.22, ease: smooth }}
              className="mt-6 max-w-xl text-base leading-relaxed text-navy-soft sm:text-lg"
            >
              {hero.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.36, ease: smooth }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"
            >
              <ButtonLink
                href={STRIPE_LINKS.bundle}
                size="lg"
                className="w-full sm:w-auto"
              >
                {hero.ctaPrimary}
              </ButtonLink>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 text-sm font-medium text-navy-soft transition-colors duration-200 hover:text-gold-dark sm:justify-start"
              >
                {hero.ctaSecondary}
                <ArrowDown className="size-4" aria-hidden />
              </a>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6, ease: smooth }}
              className="mt-6 flex flex-col gap-2 text-[0.8rem] text-navy-muted sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2"
            >
              {hero.micro.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span
                    className="inline-block size-1.5 shrink-0 rounded-full bg-gold"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* What the client actually receives. Concrete beats adjectives. */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4, ease: smooth }}
            className="lg:col-span-5"
          >
            <div className="relative rounded-lg border border-navy/10 bg-white p-6 shadow-[var(--shadow-card)] sm:p-7">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-gold-dark">
                {deliverables.label}
              </p>

              <ul className="mt-5 space-y-4">
                {[
                  { icon: FileText, ...deliverables.nif },
                  { icon: CreditCard, ...deliverables.bank },
                ].map(({ icon: Icon, title, detail, eta }) => (
                  <li key={title} className="flex items-start gap-4">
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy">
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-lg leading-snug text-navy">
                        {title}
                      </p>
                      <p className="mt-0.5 text-sm text-navy-muted">{detail}</p>
                      <p className="mt-2 inline-flex rounded-full bg-gold/12 px-3 py-1 text-[0.72rem] font-medium tracking-wide text-gold-dark">
                        {eta}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-center gap-3 border-t border-navy/8 pt-5">
                <ShieldCheck className="size-4 shrink-0 text-gold-dark" aria-hidden />
                <p className="text-sm leading-snug text-navy-soft">
                  {deliverables.seal}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
