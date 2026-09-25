import { headers } from "next/headers";

import { documentCounts, latestDocument } from "@/components/dashboard/order-status";
import { formatEuro } from "@/content/bank-nif";
import { getServiceDocs, getUserDocuments, type Db } from "@/lib/db/queries";
import type { ServiceDocRow, ServiceRow, UserDocumentRow, UserRow, UserServiceRow } from "@/lib/db/types";
import { matchesDeclaredType, signedCopyFileName } from "@/lib/documents/file-signature";
import { sendEmail, type EmailAttachment, type SendEmailInput } from "@/lib/email/send";
import {
  dashboardUrl,
  documentsReady,
  newPaidOrder,
  paymentMismatch,
  paymentReceived,
  signedAgreement,
  type SignedCopyDelivery,
} from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";

import { paidWithRealMoney } from "./live-payment";
import { SIGNED_COPY_SENT_NOTE, signedCopyClaimWins, signedCopyDue, type SignedCopyClaim } from "./signed-copy";

/**
 * The emails that tell people an order moved without anyone opening /admin.
 *
 *   notifyOrderPaid(order, opts?)                -> "Payment received" to the client, "New paid order" to the team
 *   notifyDocumentsReady({ order, document }, opts?) -> "Documents ready to review" to the team, when the
 *                                                   confirmed upload filled the last required slot
 *   completesDossier(docs, documents, applicants, confirmed) -> the pure rule behind the second one
 *   notifyPaymentMismatch({ order, sessionId, paidCents, paidCurrency }, opts?) -> "Paid amount does not
 *                                                   match the order" to the team
 *   notifySignedAgreement({ order, document }, opts?) -> "Signed service agreement received" to the
 *                                                   team, once per review round, with the signed
 *                                                   copy attached when the order was paid with
 *                                                   real money, the file is 8 MB or smaller and
 *                                                   its bytes are what its type says
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
 * - confirmDocumentUpload (src/lib/documents/confirm.ts), where the direct
 *   upload and the same origin fallback both finish, calls
 *   notifySignedAgreement when the confirmed file sits in the slot whose
 *   `service_docs.template` is 'agreement' (0013). Patrícia wants the copy
 *   signed by both parties in her inbox (answer of 2026-09-24). It goes once
 *   per review round (2026-09-25): the first copy, then one more after each
 *   copy the firm rejects, never one per upload, so a client cannot loop
 *   uploads into the firm's inbox. The rule and the event row that claims,
 *   then remembers, a send are in ./signed-copy.ts; the row is written
 *   before the send, so two confirms close together cannot both send. It is
 *   independent of "Documents ready to review", which keeps its own rule;
 *   one upload can send both.
 *
 * The client's file is attached only to an order paid with real money
 * (./live-payment.ts, review of 2026-09-25). Staging stays up
 * for good with Stripe in test mode, so anyone could otherwise open orders
 * with a test card and post a file of their choice into the firm's inbox,
 * from the platform's own sending domain. A test order's notice still goes,
 * so the flow can be followed on staging, and says the file is on the order.
 *
 * The signed copy is the one client file this module passes on, so it is
 * attached under a name the server gives it (`signed-agreement-<order>.pdf`,
 * the extension from the slot's type) and only when its first bytes are
 * what that type starts with (src/lib/documents/file-signature.ts). The name
 * the client chose appears as escaped text in the facts table, never as the
 * attachment's name.
 *
 * The signed copy is read from the bucket with a lazy `import()` of
 * src/lib/r2/client, so this module's static graph (loaded on the payment
 * path by src/lib/stripe/confirm.ts) stays free of the S3 SDK.
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
 * a Stripe webhook into a 500. The rule for an order paid with real money,
 * which the signed copy needs, is ./live-payment.ts, next to the orders for
 * that reason.
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
// Signed service agreement
// ---------------------------------------------------------------------------

/**
 * The largest signed copy that rides along as an attachment: 8 MB, in the
 * binary megabytes the upload limits use. A slot takes up to 10 MB; a larger
 * scan is left out and the email says to download it from the order, which
 * keeps the message well inside what mail servers accept once base64 adds a
 * third.
 */
export const SIGNED_COPY_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
const SIGNED_COPY_ATTACHMENT_LIMIT = "8 MB";

type AgreementOrder = Pick<
  UserServiceRow,
  "id" | "user_id" | "service_id" | "stage_key" | "paid_at" | "stripe_checkout_session_id"
>;
type SignedCopy = Pick<
  UserDocumentRow,
  "id" | "service_doc_id" | "storage_key" | "file_name" | "mime_type" | "size_bytes"
>;

/**
 * Sends "Signed service agreement received" to the team inbox when this
 * review round has not had one yet (./signed-copy.ts), with the client's
 * file attached when the order was paid with real money, the file is 8 MB or
 * smaller, the bucket gives it back and its bytes are what its type says.
 * The caller has already decided the file is a signed agreement. The round
 * is claimed with an event row on the order before anything is read or
 * sent, and the row stays as the record of the send; a lost claim or a send
 * that failed takes it back. Answers whether it went out. Never throws.
 */
export async function notifySignedAgreement(
  input: { order: AgreementOrder; document: SignedCopy },
  opts: NotifyOptions = {},
): Promise<boolean> {
  const { order, document } = input;
  let db: Db | null = null;
  let claim: string | null = null;
  try {
    const team = teamInbox("Signed service agreement received", order.id);
    if (!team) return false;

    db = opts.db ?? createAdminClient();
    claim = await claimSignedCopyRound(db, order, document);
    if (!claim) return false;

    const [context, origin, copy] = await Promise.all([
      orderContext(db, order),
      resolveOrigin(opts.origin),
      signedCopyFor(db, order, document),
    ]);
    const content = signedAgreement({
      serviceName: context.serviceName,
      clientEmail: context.email ?? "Not on record",
      orderId: order.id,
      fileName: document.file_name,
      delivery: copy.delivery,
      attachmentLimit: SIGNED_COPY_ATTACHMENT_LIMIT,
      adminUrl: dashboardUrl(origin, ADMIN_ORDER_PATH(order.id)),
    });
    const sent = await send({ to: team, ...content, ...(copy.file ? { attachments: [copy.file] } : {}) });
    if (!sent) await releaseSignedCopyClaim(db, order.id, claim);
    return sent;
  } catch (err) {
    console.error(`notifySignedAgreement: ${order.id} not notified:`, err);
    if (db && claim) await releaseSignedCopyClaim(db, order.id, claim);
    return false;
  }
}

/** The order's SIGNED_COPY_SENT_NOTE rows: every send, and every claim still in flight. */
async function signedCopyClaims(db: Db, orderId: string): Promise<SignedCopyClaim[]> {
  const { data, error } = await db
    .from("user_service_events")
    .select("id, created_at")
    .eq("user_service_id", orderId)
    .eq("note", SIGNED_COPY_SENT_NOTE);
  if (error) throw new Error(`user_service_events: ${error.message}`);
  return (data ?? []) as SignedCopyClaim[];
}

/**
 * Claims this review round's email for this call and answers the claim's id,
 * or null when the round already had its email or another call claimed it a
 * moment earlier (./signed-copy.ts has the rule and why it holds). In order:
 * the firm's rejections of this slot and the order's claims, the round's
 * rule, this call's row, the claims again. A read or a write that fails
 * throws and the caller logs it and sends nothing: the file is on the order
 * either way, and a flood is worse than a missed email.
 */
async function claimSignedCopyRound(db: Db, order: AgreementOrder, document: SignedCopy): Promise<string | null> {
  const [rejected, before] = await Promise.all([
    db
      .from("user_documents")
      .select("reviewed_at")
      .eq("user_service_id", order.id)
      .eq("service_doc_id", document.service_doc_id)
      .eq("status", "rejected"),
    signedCopyClaims(db, order.id),
  ]);
  if (rejected.error) throw new Error(`user_documents: ${rejected.error.message}`);
  const rejectedAt = ((rejected.data ?? []) as { reviewed_at?: string | null }[]).map((row) => row.reviewed_at);
  if (!signedCopyDue(before.map((row) => row.created_at), rejectedAt)) {
    console.info(`notifySignedAgreement: order ${order.id} already sent a signed copy this round; ${document.id} stays on the order`);
    return null;
  }

  // On the order's current stage, from and to the same, like a review.
  const { data, error } = await db
    .from("user_service_events")
    .insert({
      user_service_id: order.id,
      from_stage: order.stage_key,
      to_stage: order.stage_key,
      note: SIGNED_COPY_SENT_NOTE,
      actor_id: null,
    })
    .select("id")
    .single();
  const mine = (data as { id?: string } | null)?.id;
  if (error || !mine) throw new Error(`user_service_events insert: ${error?.message ?? "no row"}`);

  let claims: SignedCopyClaim[];
  try {
    claims = await signedCopyClaims(db, order.id);
  } catch (err) {
    await releaseSignedCopyClaim(db, order.id, mine);
    throw err;
  }
  if (signedCopyClaimWins(claims, rejectedAt, mine)) return mine;

  console.info(`notifySignedAgreement: order ${order.id} had its signed copy claimed a moment ago; ${document.id} stays on the order`);
  await releaseSignedCopyClaim(db, order.id, mine);
  return null;
}

/**
 * Takes a claim back: it lost the round, or its email did not go out, so
 * the next copy of the round may be sent. A failed delete is logged; the
 * round then stays closed and the file waits on the order, which is the
 * lesser harm.
 */
async function releaseSignedCopyClaim(db: Db, orderId: string, claim: string): Promise<void> {
  try {
    const { error } = await db.from("user_service_events").delete().eq("id", claim).eq("note", SIGNED_COPY_SENT_NOTE);
    if (error) console.error(`notifySignedAgreement: claim ${claim} on ${orderId} not taken back: ${error.message}`);
  } catch (err) {
    console.error(`notifySignedAgreement: claim ${claim} on ${orderId} not taken back:`, err);
  }
}

/**
 * The signed copy for the email of `order`: attached only when the order was
 * paid with real money (./live-payment.ts); a test payment's
 * notice says the file is on the order. A record that cannot be read is
 * logged and the email goes without the file.
 */
async function signedCopyFor(
  db: Db,
  order: AgreementOrder,
  document: SignedCopy,
): Promise<{ delivery: SignedCopyDelivery; file?: EmailAttachment }> {
  let live: boolean;
  try {
    live = await paidWithRealMoney(db, order);
  } catch (err) {
    console.error(`notifySignedAgreement: how ${order.id} was paid could not be read; the email goes without the file:`, err);
    return { delivery: "unavailable" };
  }
  if (!live) return { delivery: "test_payment" };
  return signedCopyAttachment(order.id, document);
}

/**
 * The signed copy as an attachment, or why it stays behind. The size on the
 * row is the one the bucket confirmed (confirmDocumentUpload compares the
 * two), so a large file is never downloaded just to be left out. The file is
 * attached under the server's own name, and only when its first bytes are
 * what its type says (src/lib/documents/file-signature.ts); anything else,
 * like a read that fails or finds nothing, is logged and the email goes
 * without the file.
 */
async function signedCopyAttachment(
  orderId: string,
  document: SignedCopy,
): Promise<{ delivery: SignedCopyDelivery; file?: EmailAttachment }> {
  if (document.size_bytes > SIGNED_COPY_ATTACHMENT_MAX_BYTES) return { delivery: "too_large" };
  const filename = signedCopyFileName(orderId, document.mime_type);
  if (!filename) {
    console.error(`notifySignedAgreement: ${document.id} is a ${document.mime_type}, which is never attached; the email goes without it`);
    return { delivery: "unavailable" };
  }
  try {
    const { getObjectBytes } = await import("@/lib/r2/client");
    const bytes = await getObjectBytes(document.storage_key);
    if (!bytes) {
      console.error(`notifySignedAgreement: ${document.id} is not in the bucket; the email goes without it`);
      return { delivery: "unavailable" };
    }
    if (bytes.byteLength > SIGNED_COPY_ATTACHMENT_MAX_BYTES) return { delivery: "too_large" };
    if (!matchesDeclaredType(bytes, document.mime_type)) {
      console.error(`notifySignedAgreement: ${document.id} does not read as ${document.mime_type}; the email goes without it`);
      return { delivery: "unavailable" };
    }
    return { delivery: "attached", file: { filename, content: bytes } };
  } catch (err) {
    console.error(`notifySignedAgreement: ${document.id} not read from the bucket; the email goes without it:`, err);
    return { delivery: "unavailable" };
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
