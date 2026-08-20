import { Plus } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { bankNif } from "@/content/bank-nif";

/**
 * Section 12. Every answer closes one specific buying objection, and the order
 * is the order the objections arrive in: rejection, travel, which bank, then
 * FATCA, which is the one American readers open before they pay.
 *
 * Built on <details> so it works with the keyboard, with search, and before any
 * JavaScript has loaded.
 */
export function Faq() {
  const { faq } = bankNif;

  return (
    <section id="faq" className="scroll-mt-24 bg-paper py-8 lg:py-12">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <EyebrowSolo>{faq.eyebrow}</EyebrowSolo>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-serif text-[clamp(1.7rem,3.3vw,2.4rem)] text-balance text-navy">{faq.h2}</h2>
          </Reveal>
        </div>

        <div className="mx-auto mt-8 max-w-3xl divide-y divide-navy/10 border-y border-navy/10">
          {faq.items.map((item, i) => (
            <Reveal key={item.q} delay={Math.min(i, 4) * 0.05}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-5 py-5 text-left [&::-webkit-details-marker]:hidden">
                  <span className="font-serif text-lg leading-snug text-navy transition-colors duration-200 group-hover:text-gold-dark sm:text-xl">
                    {item.q}
                  </span>
                  <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full border border-navy/15 text-navy-muted transition-all duration-300 group-open:rotate-45 group-open:border-gold group-open:text-gold-dark">
                    <Plus className="size-3.5" aria-hidden />
                  </span>
                </summary>
                <p className="pb-6 pr-12 text-[0.95rem] leading-relaxed text-navy-soft">
                  {item.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
