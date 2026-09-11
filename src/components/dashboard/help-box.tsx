import { MessageCircle } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { applyCopy, whatsappUrl } from "@/content/apply";
import { CONTACT } from "@/content/bank-nif";

/**
 * The small "write to us" box at the foot of the dashboard. Same WhatsApp
 * handoff as the order success screen, with its own copy: the client is
 * looking at their order, not wondering whether a receipt arrived.
 */
const copy = {
  helpTitle: "Questions about your order?",
  helpBody: `Write to us on WhatsApp or at ${CONTACT.email} and we answer the same business day.`,
  helpCta: applyCopy.success.helpCta,
  helpMessage: applyCopy.success.helpMessage,
} as const;

export function HelpBox() {
  return (
    <section aria-labelledby="help-heading" className="rounded-lg border border-navy/10 bg-white p-6 shadow-[var(--shadow-soft)]">
      <h2 id="help-heading" className="font-serif text-lg text-navy">
        {copy.helpTitle}
      </h2>
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
  );
}
