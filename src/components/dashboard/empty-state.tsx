import { ButtonLink } from "@/components/ui/button";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { APPLY_PATH } from "@/content/apply";

/**
 * The dashboard of an account with no order at all: one line and the way
 * to the wizard, for someone who signed in before finishing /en/apply or
 * came back with a fresh account. The service cards under it are the other
 * way in.
 */
export function EmptyState() {
  return (
    <div>
      <EyebrowSolo>Your application</EyebrowSolo>
      <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-balance text-navy">
        No application yet.
      </h1>
      <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-navy-soft">
        A few questions, and we recommend the right package. Your order then appears here, with the payment and
        the documents that follow. Or pick a service below and go straight to payment.
      </p>
      <ButtonLink href={APPLY_PATH} size="lg" variant="primary" withArrow className="mt-8">
        Start my application
      </ButtonLink>
    </div>
  );
}
