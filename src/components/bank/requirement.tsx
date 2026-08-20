import { CalendarClock } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { RichText } from "@/components/bank/rich-text";
import { bankNif } from "@/content/bank-nif";

/**
 * Section 4.
 *
 * The urgency here is arithmetic, not alarm: the money has to be in a
 * Portuguese account on the day of the consulate appointment, the account
 * waits on the tax number, and that chain is the longest item on the list.
 * Nothing on this page tells the reader that Portugal is going to be hard.
 */
export function Requirement() {
  const { requirement } = bankNif;

  return (
    <section id="requirements" className="scroll-mt-24 bg-white py-8 lg:py-12">
      <Container>
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <EyebrowSolo>{requirement.eyebrow}</EyebrowSolo>
          </Reveal>

          <Reveal delay={0.08}>
            <h2 className="mt-4 font-serif text-[clamp(1.7rem,3.3vw,2.4rem)] text-balance text-navy">
              {requirement.h2}
            </h2>
          </Reveal>

          <div className="mt-6 space-y-4">
            {requirement.paragraphs.map((paragraph, i) => (
              <Reveal key={i} delay={0.12 + i * 0.06}>
                <p className="text-base leading-relaxed text-navy-soft sm:text-lg">
                  <RichText text={paragraph} />
                </p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <div className="mt-8 overflow-hidden rounded-lg border border-navy/10 bg-paper">
              <div className="border-l-2 border-gold p-6 sm:p-8">
                <div className="flex items-start gap-3">
                  <CalendarClock
                    className="mt-1 size-5 shrink-0 text-gold-dark"
                    aria-hidden
                  />
                  <p className="font-serif text-xl leading-snug text-navy sm:text-2xl">
                    {requirement.clock.lead}
                  </p>
                </div>

                <p className="mt-4 text-base leading-relaxed text-navy-soft">
                  <RichText text={requirement.clock.body} />
                </p>

                <dl className="mt-6 grid gap-6 border-t border-navy/10 pt-6 sm:grid-cols-2 sm:gap-8">
                  {requirement.clock.stats.map((stat) => (
                    <div key={stat.value}>
                      <dt className="font-serif text-3xl leading-none text-navy sm:text-4xl">
                        {stat.value}
                      </dt>
                      <dd className="mt-2 text-sm leading-snug text-navy-muted">
                        {stat.label}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
