import Image from "next/image";
import { BadgeCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { RichText } from "@/components/bank/rich-text";
import { bankNif } from "@/content/bank-nif";

/**
 * Section 6. A real photograph and a name on the Bar roll, not stock imagery.
 * The reader is about to email a passport scan to a stranger, so the face and
 * the license are what lower that barrier.
 */
export function Solution() {
  const { solution } = bankNif;
  const { portrait } = solution;

  return (
    <section className="bg-paper py-8 lg:py-12">
      <Container size="wide">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <Reveal className="lg:col-span-5">
            <div className="relative mx-auto max-w-sm lg:max-w-none">
              <div
                aria-hidden
                className="absolute -bottom-4 -left-4 h-full w-full rounded-lg border border-gold/40"
              />
              <div className="relative overflow-hidden rounded-lg bg-white shadow-[var(--shadow-card)]">
                <div className="relative aspect-[4/5] w-full bg-wheat/30">
                  <Image
                    src={portrait.src}
                    alt={portrait.alt}
                    fill
                    className="object-cover object-[55%_30%]"
                    sizes="(min-width: 1024px) 40vw, 90vw"
                  />
                </div>
                <div className="flex items-center gap-3 border-t border-navy/8 px-5 py-4">
                  <BadgeCheck className="size-5 shrink-0 text-gold-dark" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-serif text-lg leading-tight text-navy">
                      {portrait.name}
                    </p>
                    <p className="text-xs text-navy-muted">
                      {portrait.role} · {portrait.credential}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="lg:col-span-7">
            <Reveal>
              <EyebrowSolo>{solution.eyebrow}</EyebrowSolo>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-4 font-serif text-[clamp(1.7rem,3.3vw,2.4rem)] text-balance text-navy">
                {solution.h2}
              </h2>
            </Reveal>
            <div className="mt-6 space-y-4">
              {solution.paragraphs.map((paragraph, i) => (
                <Reveal key={i} delay={0.12 + i * 0.06}>
                  <p className="text-base leading-relaxed text-navy-soft sm:text-lg">
                    <RichText text={paragraph} />
                  </p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
