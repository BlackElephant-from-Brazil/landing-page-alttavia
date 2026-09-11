import { ButtonLink } from "@/components/ui/button";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { APPLY_PATH } from "@/content/apply";

const ORDERS_PATH = "/en/dashboard/orders";

/**
 * The dashboard of an account with nothing in progress.
 *
 * Two cases. No order at all: one line and the way to the wizard, for
 * someone who signed in before finishing /en/apply or came back with a
 * fresh account. Every order complete: the way to the orders page, where
 * the finished ones and the gallery live.
 */
export function EmptyState({ hasCompletedOrders = false }: { hasCompletedOrders?: boolean }) {
  if (hasCompletedOrders) {
    return (
      <div>
        <EyebrowSolo>Your application</EyebrowSolo>
        <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-balance text-navy">
          Nothing in progress.
        </h1>
        <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-navy-soft">
          Every order on this account is complete. Your documents from us stay on each order, and you can add a
          service from the same page.
        </p>
        <ButtonLink href={ORDERS_PATH} size="lg" variant="primary" withArrow className="mt-8">
          See my orders
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <EyebrowSolo>Your application</EyebrowSolo>
      <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-balance text-navy">
        No application yet.
      </h1>
      <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-navy-soft">
        A few questions, and we recommend the right package. Your order then appears here, with the payment and
        the documents that follow.
      </p>
      <ButtonLink href={APPLY_PATH} size="lg" variant="primary" withArrow className="mt-8">
        Start my application
      </ButtonLink>
    </div>
  );
}
