import { headers } from "next/headers";

import { documentCounts, latestDocument } from "@/components/dashboard/order-status";
import { formatEuro } from "@/content/bank-nif";
import { getServiceDocs, getUserDocuments, type Db } from "@/lib/db/queries";
import type { ServiceDocRow, ServiceRow, UserDocumentRow, UserRow, UserServiceRow } from "@/lib/db/types";
import { sendEmail, type SendEmailInput } from "@/lib/email/send";
import { dashboardUrl, documentsReady, newPaidOrder, paymentMismatch, paymentReceived } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The emails that tell people an order moved without anyone opening /admin.
 *
 *   notifyOrderPaid(order, opts?)                -> "Payment received" to the client, "New paid order" to the team
 *   notifyDocumentsReady({ order, document }, opts?) -> "Documents ready to review" to the team, when the
 *                                                   confirmed upload filled the last required slot
 *   completesDossier(docs, documents, applicants, confirmed) -> the pure rule behind the second one
 *   notifyPaymentMismatch({ order, sessionId, paidCents, paidCurrency }, opts?) -> "Paid amount does not
 *                                                   match the order" to the team
 *
 * Callers:
 *
 * - `settleVerifiedSession` in src/lib/stripe/confirm.ts, the one funnel both
 *   the dashboard return and the Stripe webhook go through, loads this module
 *   with `import()` and calls notifyOrderPaid only when `markOrderPaid`
 *   answered `changed: true`. That flag comes from the conditional update
 *   (`paid_at is null`), so of the two callers exactly one sends, and a
 *   repeat sends nothing. The lazy load keeps the dashboard page's own import
 *   graph free of the email code.
 * - POST /api/documents/confirm calls notifyDocumentsReady after the row is
 *   `uploaded`, and only when the upload moved the set from incomplete to
 *   complete. A resubmission after a rejection completes the set again and
 *   sends again, on purpose: the set waits for a review again. Swapping a
 *   file that was still waiting for review sends nothing, since the slot was
 *   already filled and the firm already has the set in its queue;
 *   confirmDocumentUpload decides that from the row it superseded.
 * - POST /api/stripe/webhook calls notifyPaymentMismatch when a paid session
 *   names a known order but its amount or currency differs: the money was
 *   taken and the order stays unpaid, so a person has to look. Only the
 *   webhook sends it (once per Stripe event), not the dashboard return, so
 *   one payment never makes two notices.
 *
 * Best effort, like every email here: nothing in this file throws. A database
 * error, a missing address or a failed send is logged in one line and the
 * payment or the upload that triggered it stands. The only delay the caller
 * sees is the lookups and the send itself.
 *
 * The team address is EMAIL_TEAM_INBOX, one address. Locally it points at
 * the test inbox, so development mail never reaches the firm. When it is not
 * set, the team email is skipped with one log line; the client email still
 * goes.
 *
 * Payment path rule: this module imports nothing from src/lib/contracts or
 * src/content/contracts. Whether a service has an agreement is read from
 * `services.contract_template`, a column, so a contract module can never turn
 * a Stripe webhook into a 500.
 */

export type NotifyOptions = {
  /** The admin client to read with; one is created when absent. */
  db?: Db;
  /**
   * The origin links are built on when NEXT_PUBLIC_SITE_URL is empty (local
   * development). Absent: read from the current request's headers.
   */
  origin?: string | null;
};

export type PaidNotice = { client: boolean; team: boolean };

type PaidOrder = Pick<UserServiceRow, "id" | "user_id" | "service_id" | "total_cents" | "currency">;
type DossierOrder = Pick<UserServiceRow, "id" | "user_id" | "service_id" | "applicants">;
type ConfirmedDocument = Pick<UserDocumentRow, "service_doc_id" | "applicant_index">;
type Slot = Pick<ServiceDocRow, "id" | "position" | "per_applicant" | "required" | "template">;

const CLIENT_ORDER_PATH = (orderId: string) => `/en/dashboard/orders/${orderId}`;
const ADMIN_ORDER_PATH = (orderId: string) => `/admin/orders?order=${orderId}`;

const HOST = /^[a-z0-9.-]+(:\d{1,5})?$/i;
const LOCAL_HOST = /^(localhost|127\.|192\.168\.|10\.)/;

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

/** Sends "Payment received" and "New paid order". Never throws. */
export async function notifyOrderPaid(order: PaidOrder, opts: NotifyOptions = {}): Promise<PaidNotice> {
  const sent: PaidNotice = { client: false, team: false };
  try {
    const db = opts.db ?? createAdminClient();
    const [context, origin] = await Promise.all([orderContext(db, order), resolveOrigin(opts.origin)]);
    const jobs: Promise<void>[] = [];

    if (context.email) {
      const content = paymentReceived({
        serviceName: context.serviceName,
        hasAgreement: context.hasAgreement,
        dashboardUrl: dashboardUrl(origin, CLIENT_ORDER_PATH(order.id)),
      });
      jobs.push(
        send({ to: context.email, ...content }).then((ok) => {
          sent.client = ok;
        }),
      );
    } else {
      console.error(`notifyOrderPaid: no email on record for the owner of ${order.id}; "Payment received" not sent`);
    }

    const team = teamInbox("New paid order", order.id);
    if (team) {
      const content = newPaidOrder({
        serviceName: context.serviceName,
        amount: formatAmount(order.total_cents, order.currency),
        clientEmail: context.email ?? "Not on record",
        hasAgreement: context.hasAgreement,
        orderId: order.id,
        adminUrl: dashboardUrl(origin, ADMIN_ORDER_PATH(order.id)),
      });
      jobs.push(
        send({ to: team, ...content }).then((ok) => {
          sent.team = ok;
        }),
      );
    }

    await Promise.all(jobs);
  } catch (err) {
    console.error(`notifyOrderPaid: ${order.id} not notified:`, err);
  }
  return sent;
}

/**
 * Sends "Paid amount does not match the order" to the team inbox. Answers
 * whether it went out. Never throws.
 */
export async function notifyPaymentMismatch(
  input: { order: PaidOrder; sessionId: string; paidCents: number | null; paidCurrency: string | null },
  opts: NotifyOptions = {},
): Promise<boolean> {
  const { order } = input;
  try {
    const team = teamInbox("Paid amount does not match the order", order.id);
    if (!team) return false;

    const db = opts.db ?? createAdminClient();
    const [context, origin] = await Promise.all([orderContext(db, order), resolveOrigin(opts.origin)]);
    const content = paymentMismatch({
      serviceName: context.serviceName,
      clientEmail: context.email ?? "Not on record",
      paid:
        input.paidCents === null
          ? "Not stated"
          : input.paidCurrency
            ? formatAmount(input.paidCents, input.paidCurrency)
            : `${(input.paidCents / 100).toFixed(2)}, currency not stated`,
      expected: formatAmount(order.total_cents, order.currency),
      sessionId: input.sessionId,
      orderId: order.id,
      adminUrl: dashboardUrl(origin, ADMIN_ORDER_PATH(order.id)),
    });
    return await send({ to: team, ...content });
  } catch (err) {
    console.error(`notifyPaymentMismatch: ${order.id} not notified:`, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * True when the confirmed upload sits in a required slot of the order and,
 * with it, every required slot holds an uploaded or approved file. Slots are
 * counted as `documentCounts` counts them: one per document, one per
 * applicant when `per_applicant`, the newest non pending row deciding.
 * An optional slot filled after the set was complete does not count as
 * completing it.
 */
export function completesDossier(
  docs: readonly Slot[],
  documents: readonly UserDocumentRow[],
  applicants: number,
  confirmed: ConfirmedDocument,
): boolean {
  const slot = docs.find((doc) => doc.id === confirmed.service_doc_id);
  if (!slot?.required) return false;
  const people = applicants === 2 ? 2 : 1;
  if (confirmed.applicant_index >= (slot.per_applicant ? people : 1)) return false;
  const counts = documentCounts(docs, documents, applicants);
  return counts.required > 0 && counts.received === counts.required;
}

/** Files whose newest upload waits for a review, over every slot of the order. */
function filesToReview(docs: readonly Slot[], documents: readonly UserDocumentRow[], applicants: number): number {
  const people = applicants === 2 ? 2 : 1;
  let count = 0;
  for (const doc of docs) {
    for (let index = 0; index < (doc.per_applicant ? people : 1); index++) {
      if (latestDocument(documents, doc.id, index as 0 | 1)?.status === "uploaded") count++;
    }
  }
  return count;
}

/**
 * Sends "Documents ready to review" when `document`, just confirmed, filled
 * the last required slot of `order`. Answers whether it went out. Never throws.
 */
export async function notifyDocumentsReady(
  input: { order: DossierOrder; document: ConfirmedDocument },
  opts: NotifyOptions = {},
): Promise<boolean> {
  const { order, document } = input;
  try {
    const db = opts.db ?? createAdminClient();
    const [docs, documents] = await Promise.all([getServiceDocs(db, order.service_id), getUserDocuments(db, order.id)]);
    if (!completesDossier(docs, documents, order.applicants, document)) return false;

    const team = teamInbox("Documents ready to review", order.id);
    if (!team) return false;

    const [context, origin] = await Promise.all([orderContext(db, order), resolveOrigin(opts.origin)]);
    const content = documentsReady({
      serviceName: context.serviceName,
      clientEmail: context.email ?? "Not on record",
      filesToReview: filesToReview(docs, documents, order.applicants),
      applicants: order.applicants,
      orderId: order.id,
      adminUrl: dashboardUrl(origin, ADMIN_ORDER_PATH(order.id)),
    });
    return await send({ to: team, ...content });
  } catch (err) {
    console.error(`notifyDocumentsReady: ${order.id} not notified:`, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

type OrderContext = { serviceName: string; hasAgreement: boolean; email: string | null };

/**
 * The service's name and whether it carries an agreement, and the owner's
 * email. A failed lookup is logged and degrades the email, it never stops it.
 */
async function orderContext(db: Db, order: Pick<UserServiceRow, "id" | "user_id" | "service_id">): Promise<OrderContext> {
  const [serviceResult, userResult] = await Promise.all([
    db.from("services").select("name, contract_template").eq("id", order.service_id).maybeSingle(),
    db.from("users").select("email").eq("id", order.user_id).maybeSingle(),
  ]);
  if (serviceResult.error) console.error(`notify: service lookup failed for ${order.id}: ${serviceResult.error.message}`);
  if (userResult.error) console.error(`notify: owner lookup failed for ${order.id}: ${userResult.error.message}`);

  const service = serviceResult.data as Pick<ServiceRow, "name" | "contract_template"> | null;
  const user = userResult.data as Pick<UserRow, "email"> | null;
  return {
    serviceName: service?.name ?? "service",
    hasAgreement: !!service?.contract_template,
    email: user?.email ?? null,
  };
}

/** EMAIL_TEAM_INBOX, or null with one log line naming what was skipped. */
function teamInbox(what: string, orderId: string): string | null {
  const to = process.env.EMAIL_TEAM_INBOX?.trim();
  if (!to) {
    console.warn(`notify: EMAIL_TEAM_INBOX not set; "${what}" for order ${orderId} not sent`);
    return null;
  }
  return to;
}

/** sendEmail never throws by contract; this holds even if that ever changes. */
async function send(input: SendEmailInput): Promise<boolean> {
  try {
    return (await sendEmail(input)).ok;
  } catch (err) {
    console.error(`notify: "${input.subject}" not sent:`, err);
    return false;
  }
}

/** "€497" for euros, the way every price is written; any other currency spelled out. */
function formatAmount(cents: number, currency: string): string {
  if (currency.toLowerCase() === "eur") return formatEuro(cents);
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

/**
 * The origin to build links on. Given by the caller when it has the request;
 * otherwise read from the current request's headers (the dashboard page and
 * the webhook both run inside one). Only matters when NEXT_PUBLIC_SITE_URL
 * is empty outside production, see `dashboardUrl`.
 */
async function resolveOrigin(given: string | null | undefined): Promise<string | null> {
  if (given !== undefined) return given;
  try {
    const list = await headers();
    const host = (list.get("x-forwarded-host") ?? list.get("host"))?.split(",")[0]?.trim();
    if (!host || !HOST.test(host)) return null;
    const forwarded = list.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto = forwarded === "http" || forwarded === "https" ? forwarded : LOCAL_HOST.test(host) ? "http" : "https";
    return `${proto}://${host}`;
  } catch {
    return null;
  }
}
