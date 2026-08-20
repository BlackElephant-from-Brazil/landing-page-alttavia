import { Check, Users } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { ButtonLink } from "@/components/ui/button";
import { RichText } from "@/components/bank/rich-text";
import { bankNif } from "@/content/bank-nif";
import { cn } from "@/lib/cn";

/**
 * Section 8. The middle card is the hero: struck through anchor, social badge,
 * and the credit that connects this purchase to the strategy session further
 * up the funnel. It leads on mobile, where nobody scrolls sideways to find it.
 *
 * The bank card never says approval is guaranteed. The honest promise, and the
 * one that actually converts, is that the account opens or the money comes back.
 */
export function Pricing() {
  const { pricing } = bankNif;

  return (
    <section id="pricing" className="scroll-mt-24 bg-paper py-8 lg:py-12">
      <Container size="wide">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <EyebrowSolo className="justify-center">{pricing.eyebrow}</EyebrowSolo>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-serif text-[clamp(1.7rem,3.3vw,2.4rem)] text-balance text-navy">{pricing.h2}</h2>
          </Reveal>
        </div>

        <div className="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-3 lg:gap-7">
          {pricing.cards.map((card, i) => (
            <Reveal
              key={card.id}
              delay={i * 0.08}
              className={cn("h-full", card.featured && "order-first lg:order-none")}
            >
              <article
                className={cn(
                  "relative flex h-full flex-col rounded-lg p-7 sm:p-8",
                  card.featured
                    ? "bg-navy text-white shadow-[var(--shadow-card)] ring-2 ring-gold lg:-mt-5 lg:pb-10 lg:pt-11"
                    : "border border-navy/10 bg-white shadow-[var(--shadow-soft)]"
                )}
              >
                {card.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gold px-4 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-white shadow-[var(--shadow-glow)]">
                    {card.badge}
                  </span>
                )}

                <h3
                  className={cn(
                    "font-serif text-xl",
                    card.featured ? "text-white" : "text-navy"
                  )}
                >
                  {card.name}
                </h3>
                <p
                  className={cn(
                    "mt-1.5 text-sm leading-snug",
                    card.featured ? "text-white/65" : "text-navy-muted"
                  )}
                >
                  {card.summary}
                </p>

                <p
                  className={cn(
                    "mt-6 font-serif text-5xl leading-none",
                    card.featured ? "text-white" : "text-navy"
                  )}
                >
                  {card.price}
                </p>
                {card.anchor ? (
                  <p className="mt-3 text-[0.8rem] text-gold-light">
                    {card.anchor}
                  </p>
                ) : (
                  <p
                    className={cn(
                      "mt-3 text-[0.8rem]",
                      card.featured ? "text-white/55" : "text-navy-muted"
                    )}
                  >
                    {card.meta}
                  </p>
                )}

                <ul className="mt-6 flex-1 space-y-3">
                  {card.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          card.featured ? "text-gold-light" : "text-gold-dark"
                        )}
                        aria-hidden
                      />
                      <span
                        className={cn(
                          "text-[0.92rem] leading-relaxed",
                          card.featured ? "text-white/80" : "text-navy-soft"
                        )}
                      >
                        <RichText text={feature} />
                      </span>
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  href={card.href}
                  size="lg"
                  variant={card.featured ? "gold" : "outline"}
                  className="mt-8 w-full"
                >
                  {card.cta}
                </ButtonLink>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.12}>
          <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center gap-5 rounded-lg border border-navy/10 bg-white px-6 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="flex items-start gap-3 text-[0.95rem] leading-relaxed text-navy-soft">
              <Users className="mt-1 size-4 shrink-0 text-gold-dark" aria-hidden />
              <span>
                <RichText text={pricing.couple.text} />
              </span>
            </p>
            <ButtonLink
              href={pricing.couple.href}
              size="md"
              variant="outline"
              className="w-full shrink-0 sm:w-auto"
            >
              {pricing.couple.cta}
            </ButtonLink>
          </div>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-5 text-center text-[0.8rem] text-navy-muted">
            {pricing.footnote}
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
