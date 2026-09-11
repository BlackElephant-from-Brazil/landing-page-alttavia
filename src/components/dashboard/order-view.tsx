import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EyebrowSolo } from "@/components/ui/eyebrow";
import { formatEuro } from "@/content/bank-nif";
import { summarizeAnswers } from "@/lib/apply/summary";
import type { OrderViewData } from "@/lib/db/client-queries";
import type { UserServiceRow } from "@/lib/db/types";

import { AnswersSummary } from "./answers-summary";
import { Deliverables } from "./deliverables";
import { DocumentList } from "./documents/document-list";
import { HelpBox } from "./help-box";
import { Notice } from "./notice";
import { hasAnswers, orderStatus, rejectedSlots } from "./order-status";
import { PayButton } from "./pay-button";
import { Pendencies } from "./pendencies";
import { RejectedCallout } from "./rejected-callout";
import { ServiceCard } from "./service-card";
import { StageTimeline } from "./stage-timeline";

/**
 * One order, as the client sees it. Admin contract section 7, "Client order
 * view". Server component; the page passes everything it loaded
 * (getOrderViewData in src/lib/db/client-queries.ts) and this file only lays
 * it out. Used by /en/dashboard for the current order and by
 * /en/dashboard/orders/[id] for any order of the account.
 *
 * Order of sections, top to bottom: notices, heading, the package card, the
 * stage timeline (with its completed state), then what needs the client
 * (payment, pendencies whatever the payment state, and rejected files above
 * the upload slots once paid), then what the firm returned (files and the
 * closing report), the wizard answers when the order has any, and the help
 * box.
 */

export type OrderNotice = "cancelled" | "unconfirmed";

type Props = OrderViewData & {
  order: UserServiceRow;
  notice?: OrderNotice;
  /** The eyebrow above the heading. */
  eyebrow?: string;
  /** When set, a "Back to your orders" link renders above the heading. */
  backHref?: string;
};

const copy = {
  eyebrow: "Your application",
  back: "Back to your orders",
  cancelled: "Payment not completed. You can try again whenever you are ready.",
  unconfirmed:
    "We could not confirm the payment yet. If you paid, it shows here within a few minutes. Refresh the page to check.",
  paymentHeading: "Payment",
  pay: (price: string) => `Pay ${price} and start`,
  payHint:
    "Secure payment through Stripe. You upload your documents right after, on this page, and that is usually all we need from you.",
  paidTitle: "Payment received",
  paidBody: "Your order is in. Send the documents below and we file it from there.",
  completedTitle: "Order complete",
  completedBody: "Everything on this order is done.",
  completedBodyWithFiles: "Everything on this order is done. Your documents from us are below, and they stay here for you.",
} as const;

export function OrderView({
  order,
  service,
  stages,
  docs,
  documents,
  notes,
  deliverables,
  questions,
  notice,
  eyebrow = copy.eyebrow,
  backHref,
}: Props) {
  const status = orderStatus(order);
  const paid = status !== "awaiting_payment";
  const completed = status === "completed";
  const price = formatEuro(order.total_cents);
  const answers = hasAnswers(order.answers_snapshot) ? summarizeAnswers(order.answers_snapshot, questions) : [];
  const rejected = paid ? rejectedSlots(docs, documents, order.applicants) : [];
  const returned = deliverables.length > 0 || !!order.report;

  return (
    <div className="space-y-12">
      {!paid && notice === "cancelled" && <Notice>{copy.cancelled}</Notice>}
      {!paid && notice === "unconfirmed" && <Notice>{copy.unconfirmed}</Notice>}

      <header>
        {backHref && (
          <Link
            href={backHref}
            className="mb-5 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {copy.back}
          </Link>
        )}
        <div>
          <EyebrowSolo>{eyebrow}</EyebrowSolo>
        </div>
        <h1 className="mt-4 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-balance text-navy">
          {service.name}
        </h1>
      </header>

      <ServiceCard order={order} service={service} />

      <StageTimeline stages={stages} currentKey={order.stage_key} completed={completed} />

      {completed ? (
        <Notice tone="success" title={copy.completedTitle}>
          {returned ? copy.completedBodyWithFiles : copy.completedBody}
        </Notice>
      ) : paid ? (
        <Notice tone="success" title={copy.paidTitle}>
          {copy.paidBody}
        </Notice>
      ) : (
        <section aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="text-xs uppercase tracking-wider text-navy-muted">
            {copy.paymentHeading}
          </h2>
          <PayButton userServiceId={order.id} label={copy.pay(price)} className="mt-4" />
          <p className="mt-3 max-w-prose text-[0.85rem] leading-relaxed text-navy-muted">{copy.payHint}</p>
        </section>
      )}

      <Pendencies notes={notes} />

      {paid && (
        <div className="space-y-6">
          <RejectedCallout slots={rejected} applicants={order.applicants} />
          <DocumentList order={order} docs={docs} uploaded={documents} />
        </div>
      )}

      {paid && <Deliverables files={deliverables} report={order.report} completed={completed} />}

      <AnswersSummary items={answers} />

      <HelpBox />
    </div>
  );
}
