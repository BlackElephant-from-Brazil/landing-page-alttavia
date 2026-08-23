import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { bankNif, APPLY_LINKS } from "@/content/bank-nif";

/**
 * Section 13. Same button label as the hero, word for word. A CTA that changes
 * wording halfway down the page reads as a different offer.
 */
export function FinalCta() {
  const { finalCta } = bankNif;

  return (
    <section
      id="start"
      className="has-grain relative scroll-mt-24 overflow-hidden bg-navy-deep py-20 text-white lg:py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at center, rgba(208,161,43,0.6) 0%, transparent 68%)",
        }}
      />

      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <div className="flex items-center justify-center gap-3 text-[0.72rem] font-medium uppercase tracking-[0.28em] text-gold-light">
              <span className="inline-block h-px w-8 bg-gold/70" aria-hidden />
              <span>{finalCta.eyebrow}</span>
              <span className="inline-block h-px w-8 bg-gold/70" aria-hidden />
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="mt-5 font-serif text-[clamp(1.7rem,3.3vw,2.4rem)] text-balance text-white">
              {finalCta.h2}
            </h2>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="mt-8">
              <ButtonLink
                href={APPLY_LINKS.bundle}
                size="lg"
                variant="gold"
                className="w-full sm:w-auto"
              >
                {finalCta.cta}
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal delay={0.22}>
            <ul className="mt-6 flex flex-col items-center gap-2 text-[0.82rem] text-white/60 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-5">
              {finalCta.micro.map((item, i) => (
                <li key={item} className="flex items-center gap-5">
                  {i > 0 && (
                    <span
                      className="hidden size-1 rounded-full bg-gold sm:inline-block"
                      aria-hidden
                    />
                  )}
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
