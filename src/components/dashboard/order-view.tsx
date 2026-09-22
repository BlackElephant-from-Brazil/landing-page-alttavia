import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EyebrowSolo } from "@/components/ui/eyebrow";
import { formatEuro } from "@/content/bank-nif";
import { contractState } from "@/lib/contracts/state";
import type { OrderViewData } from "@/lib/db/client-queries";
import type { UserServiceRow } from "@/lib/db/types";

import { ContractGate } from "./contract/contract-gate";
import { Deliverables } from "./deliverables";
import { DocumentList } from "./documents/document-list";
import { HelpBox } from "./help-box";
import { Notice } from "./notice";
import { orderStatus, rejectedSlots } from "./order-status";
import { PayButton } from "./pay-button";
import { RejectedCallout } from "./rejected-callout";
import { ServiceCard } from "./service-card";
import { StageTimeline } from "./stage-timeline";

/**
 * One order, as the client sees it. Admin contract section 7, "Client order
 * view". Server component; the page passes everything it loaded
 * (getOrderViewData in src/lib/db/client-queries.ts) and this file only lays
 * it out. Used by /en/dashboard/orders/[id] as a page and, in `compact`
 * mode, inside the order modal on the dashboard and purchases pages.
 *
 * Order of sections, top to bottom: notices, heading, the package card, the
 * stage timeline (with its completed state), then what needs the client
 * (payment; once paid, the service agreement card right under the "Payment
 * received" notice, then rejected files above the upload slots), then what
 * the firm returned (files and the closing report), and the help box. The
 * wizard answers are no longer repeated here: the client typed them and the
 * firm reads them on the admin side. Compact mode drops the heading and the
 * package card: the modal's own header carries the name, the amount and the
 * status.
 *
 * The service agreement card (contract/contract-gate.tsx, agreement contract
 * section 6) follows `contractState`: nothing for a service with no contract,
 * "Confirm my details" while the agreement is still to be prepared, View and
 * Download once it exists. A completed order keeps a prepared agreement to
 * download and is not asked for one it never had. Only the agreement's date
 * and whether it was emailed are handed to the client component, not the row.
 */

export type OrderNotice = "cancelled" | "unconfirmed";

type Props = OrderViewData & {
  order: UserServiceRow;
  /** The signed in account's address: where the service agreement is sent. */
  accountEmail: string;
  notice?: OrderNotice;
  /** The eyebrow above the heading. */
  eyebrow?: string;
  /** When set, a "Back to your purchases" link renders above the heading. */
  backHref?: string;
  /** Inside the order modal: no heading, no package card, tighter spacing. */
  compact?: boolean;
};

const copy = {
  eyebrow: "Your application",
  back: "Back to your purchases",
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
  applicants,
  contract,
  deliverables,
  accountEmail,
  notice,
  eyebrow = copy.eyebrow,
  backHref,
  compact = false,
}: Props) {
  const status = orderStatus(order);
  const paid = status !== "awaiting_payment";
  const completed = status === "completed";
  const price = formatEuro(order.total_cents);
  const rejected = paid ? rejectedSlots(docs, documents, order.applicants) : [];
  const returned = deliverables.length > 0 || !!order.report;
  const agreement = contractState(order, service, applicants, contract);
  const showAgreement = paid && (agreement === "ready" || (agreement === "needs_details" && !completed));

  return (
    <div className={compact ? "space-y-10" : "space-y-12"}>
      {!paid && notice === "cancelled" && <Notice>{copy.cancelled}</Notice>}
      {!paid && notice === "unconfirmed" && <Notice>{copy.unconfirmed}</Notice>}

      {!compact && (
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
      )}

      {!compact && <ServiceCard order={order} service={service} />}

      <StageTimeline stages={stages} currentKey={order.stage_key} completed={completed} />

      {paid ? (
        <div className="space-y-6">
          {completed ? (
            <Notice tone="success" title={copy.completedTitle}>
              {returned ? copy.completedBodyWithFiles : copy.completedBody}
            </Notice>
          ) : (
            <Notice tone="success" title={copy.paidTitle}>
              {copy.paidBody}
            </Notice>
          )}
          {showAgreement && (
            <ContractGate
              orderId={order.id}
              paidAt={order.paid_at}
              accountEmail={accountEmail}
              applicant={applicants.find((row) => row.applicant_index === 0) ?? null}
              preparedAt={contract?.generated_at ?? null}
              emailed={!!contract?.emailed_at}
            />
          )}
        </div>
      ) : (
        <section aria-labelledby="payment-heading">
          <h2 id="payment-heading" className="text-xs uppercase tracking-wider text-navy-muted">
            {copy.paymentHeading}
          </h2>
          <PayButton userServiceId={order.id} label={copy.pay(price)} className="mt-4" />
          <p className="mt-3 max-w-prose text-[0.85rem] leading-relaxed text-navy-muted">{copy.payHint}</p>
        </section>
      )}

      {paid && (
        <div className="space-y-6">
          <RejectedCallout slots={rejected} applicants={order.applicants} />
          <DocumentList order={order} docs={docs} uploaded={documents} applicants={applicants} />
        </div>
      )}

      {paid && <Deliverables files={deliverables} report={order.report} completed={completed} />}

      <HelpBox />
    </div>
  );
}
