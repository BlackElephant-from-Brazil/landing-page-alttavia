"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { ConcentricRings } from "@/components/ui/concentric-rings";
import { LiquidGlassShell } from "@/components/ui/LiquidGlass";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function CtaBanner() {
  const { t } = useContent();
  const ctaBanner = t.ctaBanner;

  return (
    <section data-section="cta-banner" className="relative py-16 sm:py-20 lg:py-28">
      <Container size="wide" className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0%" }}
          transition={{ duration: 0.9, ease: smooth }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-deep via-navy to-navy-deep text-white shadow-[var(--shadow-long-dark)]"
        >
          <ConcentricRings
            count={3}
            size={28}
            strokeWidth={0.5}
            color="rgba(208,161,43,0.45)"
            className="absolute top-5 right-5 opacity-90 z-10"
          />
          {/* Decorative blobs */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-32 -right-32 h-[400px] w-[400px] rounded-full blur-3xl opacity-30"
            style={{
              background:
                "radial-gradient(circle at center, rgba(208,161,43,0.55) 0%, transparent 70%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -left-20 h-[360px] w-[360px] rounded-full blur-3xl opacity-40"
            style={{
              background:
                "radial-gradient(circle at center, rgba(224,207,159,0.4) 0%, transparent 70%)",
            }}
          />

          <LiquidGlassShell
            lightVariant={false}
            tintOpacity={0.20}
            borderRadius="1.5rem"
            filter="glass-distortion-soft"
            contentClassName="px-7 py-12 sm:px-14 sm:py-20 lg:px-20 lg:py-24"
          >
            <div className="grid gap-8 lg:gap-10 lg:grid-cols-12 items-center">
              <div className="lg:col-span-8">
                <h2 className="font-serif text-balance text-white">
                  {ctaBanner.title}
                </h2>
                <p className="mt-4 sm:mt-5 max-w-2xl text-white/80 text-base sm:text-lg leading-relaxed">
                  {ctaBanner.desc}
                </p>
              </div>
              <div className="lg:col-span-4 lg:flex lg:justify-end">
                <LiquidGlassShell
                  lightVariant={false}
                  tintOpacity={0.30}
                  borderRadius="9999px"
                  filter="glass-distortion-soft"
                  enableHover
                  contentClassName="px-8 py-3 flex items-center gap-2"
                >
                  <a
                    href="#contact"
                    className="flex items-center gap-2 text-white font-medium text-base"
                  >
                    {ctaBanner.button}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </a>
                </LiquidGlassShell>
              </div>
            </div>
          </LiquidGlassShell>
        </motion.div>
      </Container>
    </section>
  );
}
