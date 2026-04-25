"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/container";
import { ButtonLink } from "@/components/ui/button";
import { useContent } from "@/components/providers/content-provider";

const smooth = [0.22, 0.61, 0.36, 1] as const;

export function CtaBanner() {
  const { t } = useContent();
  const ctaBanner = t.ctaBanner;

  return (
    <section className="relative py-16 sm:py-20 lg:py-28">
      <Container size="wide">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0%" }}
          transition={{ duration: 0.9, ease: smooth }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-deep via-navy to-navy-deep px-7 py-12 sm:px-14 sm:py-20 lg:px-20 lg:py-24 text-white"
        >
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

          <div className="relative grid gap-8 lg:gap-10 lg:grid-cols-12 items-center">
            <div className="lg:col-span-8">
              <h2 className="font-serif text-balance text-white">
                {ctaBanner.title}
              </h2>
              <p className="mt-4 sm:mt-5 max-w-2xl text-white/80 text-base sm:text-lg leading-relaxed">
                {ctaBanner.desc}
              </p>
            </div>
            <div className="lg:col-span-4 lg:flex lg:justify-end">
              <ButtonLink
                href="#contact"
                size="lg"
                variant="gold"
                withArrow
                className="w-full lg:w-auto"
              >
                {ctaBanner.button}
              </ButtonLink>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
