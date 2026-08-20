import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { RichText } from "@/components/bank/rich-text";
import { bankNif } from "@/content/bank-nif";

/**
 * Section 7. Step two exists to answer the question nobody asks out loud: how
 * much work is this going to be for me? One call, about twenty minutes, and
 * then nothing.
 */
export function HowItWorks() {
  const { howItWorks } = bankNif;

  return (
    <section id="how-it-works" className="scroll-mt-24 bg-white py-8 lg:py-12">
      <Container size="wide">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <EyebrowSolo className="justify-center">{howItWorks.eyebrow}</EyebrowSolo>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-serif text-[clamp(1.7rem,3.3vw,2.4rem)] text-balance text-navy">
              {howItWorks.h2}
            </h2>
          </Reveal>
        </div>

        <ol className="relative mt-8 grid gap-8 lg:mt-10 lg:grid-cols-3 lg:gap-8">
          {/* The rail: vertical on mobile, horizontal from lg up. */}
          <span
            aria-hidden
            className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-gold/50 via-gold/25 to-transparent lg:left-0 lg:right-0 lg:top-[19px] lg:bottom-auto lg:h-px lg:w-full lg:bg-gradient-to-r lg:from-gold/15 lg:via-gold/50 lg:to-gold/15"
          />

          {howItWorks.steps.map((step, i) => (
            <Reveal
              as="li"
              key={step.title}
              delay={i * 0.09}
              className="relative flex gap-5 lg:block"
            >
              <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-white font-serif text-base text-gold-dark shadow-[var(--shadow-soft)]">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1 lg:mt-6 lg:pr-4">
                <h3 className="font-serif text-xl leading-snug text-navy">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[0.72rem] font-medium uppercase tracking-[0.18em] text-gold-dark">
                  {step.meta}
                </p>
                <p className="mt-3 text-[0.95rem] leading-relaxed text-navy-soft">
                  <RichText text={step.body} />
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}
