import { Clock, CreditCard, Landmark, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Reveal } from "@/components/ui/reveal";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { bankNif } from "@/content/bank-nif";

const ICONS: Record<string, LucideIcon> = {
  clock: Clock,
  bank: Landmark,
  card: CreditCard,
  lock: Lock,
};

/**
 * Section 11. This was the guarantees block. Every money back promise is gone
 * at the client's instruction, and the timing disclaimer took the fourth slot.
 * Framed as what is included rather than as a list of caveats.
 */
export function Guarantees() {
  const { guarantees } = bankNif;

  return (
    <section className="bg-white py-8 lg:py-12">
      <Container size="wide">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <EyebrowSolo>{guarantees.eyebrow}</EyebrowSolo>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-serif text-[clamp(1.7rem,3.3vw,2.4rem)] text-balance text-navy">
              {guarantees.h2}
            </h2>
          </Reveal>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:mt-10 lg:gap-7">
          {guarantees.items.map((item, i) => {
            const Icon = ICONS[item.icon] ?? Clock;
            return (
              <Reveal key={item.title} delay={i * 0.07} className="h-full">
                <article className="flex h-full gap-5 rounded-lg border border-navy/10 bg-paper p-7">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-gold-dark shadow-[var(--shadow-soft)]">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-serif text-xl text-navy">{item.title}</h3>
                    <p className="mt-2 text-[0.95rem] leading-relaxed text-navy-soft">
                      {item.body}
                    </p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
