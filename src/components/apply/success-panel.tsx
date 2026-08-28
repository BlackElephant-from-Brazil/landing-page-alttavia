"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";

import { RichText } from "@/components/bank/rich-text";
import { ButtonLink } from "@/components/ui/button";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { applyCopy, whatsappUrl } from "@/content/apply";
import { trackPurchase } from "@/lib/analytics";
import { clearAnswers } from "@/lib/apply/storage";

/**
 * The screen a buyer lands on when Stripe sends them back.
 *
 * It clears the wizard's stored answers: the order is placed, and someone
 * returning to the site later should start from a clean sheet rather than the
 * answers behind a purchase they already made.
 */
export function SuccessPanel() {
  const copy = applyCopy.success;
  const params = useSearchParams();
  const reference = params.get("client_reference_id") ?? undefined;

  useEffect(() => {
    clearAnswers();
    trackPurchase(reference);
  }, [reference]);

  return (
    <div>
      <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
      <h1 className="mt-4 font-serif text-[clamp(2rem,4.5vw,2.75rem)] leading-tight text-balance text-navy">
        {copy.heading}
      </h1>
      <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-navy-soft">{copy.lead}</p>

      <ol className="relative mt-10 grid gap-8">
        <span
          className="absolute bottom-3 left-[19px] top-3 w-px bg-gradient-to-b from-gold/50 via-gold/25 to-transparent"
          aria-hidden
        />
        {copy.steps.map((step, i) => (
          <li key={step.title} className="flex gap-5">
            <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-white font-serif text-base text-gold-dark shadow-[var(--shadow-soft)]">
              {i + 1}
            </span>
            <span className="min-w-0 pt-1">
              <span className="block font-serif text-lg text-navy">{step.title}</span>
              <span className="mt-1.5 block text-[0.72rem] font-medium uppercase tracking-[0.18em] text-gold-dark">
                {step.meta}
              </span>
              <span className="mt-2 block max-w-prose text-[0.95rem] leading-relaxed text-navy-soft">
                <RichText text={step.body} />
              </span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-10 text-[0.8rem] leading-relaxed text-navy-muted">{copy.footnote}</p>

      <section className="mt-10 rounded-lg border border-navy/10 bg-white p-6 shadow-[var(--shadow-soft)]">
        <h2 className="font-serif text-lg text-navy">{copy.helpTitle}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-navy-soft">{copy.helpBody}</p>
        <ButtonLink
          href={whatsappUrl(copy.helpMessage)}
          target="_blank"
          rel="noopener noreferrer"
          variant="outline"
          size="md"
          className="mt-5"
        >
          <MessageCircle className="size-4" aria-hidden />
          {copy.helpCta}
        </ButtonLink>
      </section>
    </div>
  );
}
