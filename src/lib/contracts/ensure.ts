import { buildContractValues, contractFileName } from "@/content/contracts/variables";
import { generateContractPdf } from "@/lib/contracts/generate";
import { getOrderContract, type Db } from "@/lib/db/queries";
import type {
  ContractTemplate,
  ServiceRow,
  UserRow,
  UserServiceApplicantRow,
  UserServiceContractRow,
  UserServiceRow,
} from "@/lib/db/types";
import { sendEmail } from "@/lib/email/send";
import { dashboardUrl, serviceAgreement } from "@/lib/email/templates";
import { findApplicant, findOrder } from "@/lib/orders/applicants";
import { getObjectBytes, putObject } from "@/lib/r2/client";

import { parseSigningPlace } from "./signing-place";

/**
 * The service agreement of one order: when it exists, how it comes to exist
 * and how it reaches the client. Design in docs/agreement-contract.md
 * section 5.
 *
 *   contractState(order, service, applicants, contract) -> "off" | "needs_details" | "ready"
 *   parseSigningPlace(raw)                              -> the optional "city and country" field, cleaned
 *   contractStorageKey(orderId, version)                -> contracts/{orderId}/v{version}.pdf
 *   ensureContract(admin, orderId, opts?)               -> generates once, emails once, idempotent
 *   regenerateContract(admin, orderId, opts?)           -> admin only: a new version, emailed again
 *
 * `admin` is the secret key client: the caller (a route handler) has already
 * checked the session and who owns the order. The table is written here and
 * nowhere else; nobody writes it through PostgREST (0009).
 *
 * ensureContract, in order: the order, the contract row (one exists: the
 * answer is `ready`, and an email that never went out is tried again), the
 * service's template and the payment (`off`), applicant 0's details
 * (`needs_details`). Only then anything is written: the PDF is generated,
 * stored under a key that names its version, and the row inserted. `unique
 * (user_service_id)` settles two calls racing each other: the loser's insert
 * fails on the duplicate key, it reads the winner's row and answers `ready`
 * without emailing, because the winner does. Both wrote the same key with a
 * PDF of the same values, so whichever upload landed last is the document
 * the row describes.
 *
 * The email goes to the account's address (`users.email`) with the PDF
 * attached and a button to the order. It is sent after the row exists and
 * `emailed_at` is stamped only when the sender accepted it. A failed email
 * never fails the call: the row stays with `emailed_at` null and the next
 * ensureContract sends the stored file again, generating nothing. Two calls
 * a moment apart can both find `emailed_at` null and both send; a second
 * copy of the same file is the price of never stamping an email that did
 * not go out.
 *
 * Nothing on the payment path (mark paid, confirm, the Stripe webhook) calls
 * this module, on purpose: a contract hook must not be able to turn a
 * payment into a 500. The client asks for the agreement after paying,
 * through POST /api/orders/[id]/contract.
 *
 * This file imports the PDF generator, the bucket and the email sender,
 * which are server only and heavy. contractState and parseSigningPlace are
 * pure and live in ./state.ts and ./signing-place.ts; pages, order views and
 * forms import them from there, so none of this is bundled with them. They
 * are re-exported below for the routes and tests that read them from here.
 */

// ---------------------------------------------------------------------------
// State and the optional signing place: pure, and kept in their own modules
// so a page or a form can use them without importing what is below.
// ---------------------------------------------------------------------------

export { contractState, type ContractState } from "./state";
export { MAX_SIGNING_PLACE_LENGTH, parseSigningPlace, type SigningPlaceResult } from "./signing-place";

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9_-]*$/i;
const PDF = "application/pdf";

/**
 * Where a version of an order's agreement lives in the bucket. Every version
 * has its own key, so a regenerated agreement never overwrites the one that
 * was emailed before it.
 */
export function contractStorageKey(orderId: string, version: number): string {
  if (!SAFE_SEGMENT.test(orderId)) throw new Error("contractStorageKey: invalid orderId");
  if (!Number.isInteger(version) || version < 1) throw new Error("contractStorageKey: invalid version");
  return `contracts/${orderId}/v${version}.pdf`;
}

// ---------------------------------------------------------------------------
// Errors the admin route passes through as they are
// ---------------------------------------------------------------------------

export type ContractErrorCode = "order_not_found" | "no_template" | "unpaid" | "details_missing" | "stale";

export class ContractError extends Error {
  readonly code: ContractErrorCode;
  readonly status: 404 | 409;

  constructor(code: ContractErrorCode, status: 404 | 409, message: string) {
    super(message);
    this.name = "ContractError";
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// ensureContract
// ---------------------------------------------------------------------------

export type EnsureContractOptions = {
  /** Annex I's "[PLACE]", as parseSigningPlace cleaned it. */
  signingPlace?: string | null;
  /** The origin the request came from, for the link inside the email. */
  origin?: string | null;
};

export type EnsureContractResult =
  | { status: "off"; reason: "order_not_found" | "no_template" | "unpaid" }
  | { status: "needs_details" }
  | {
      status: "ready";
      contract: UserServiceContractRow;
      /** True when this call generated the agreement; false when it was already there. */
      created: boolean;
      /** True when this call's email was accepted by the sender. */
      emailed: boolean;
    };

/** Postgres' unique_violation, as PostgREST reports it. */
const UNIQUE_VIOLATION = "23505";

const FALLBACK_SERVICE_NAME = "your order";

type Owner = Pick<UserRow, "email">;

async function findService(admin: Db, id: string): Promise<ServiceRow | null> {
  const { data, error } = await admin.from("services").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`contracts findService: ${error.message}`);
  return (data as ServiceRow | null) ?? null;
}

/** The account's address: where the agreement is sent and what `[EMAIL]` prints. */
async function findOwnerEmail(admin: Db, userId: string): Promise<string | null> {
  const { data, error } = await admin.from("users").select("email").eq("id", userId).maybeSingle();
  if (error) throw new Error(`contracts findOwnerEmail: ${error.message}`);
  return (data as Owner | null)?.email ?? null;
}

type Generated = {
  pdf: Uint8Array;
  values: Record<string, string>;
  fileName: string;
};

async function buildPdf(input: {
  template: ContractTemplate;
  order: UserServiceRow;
  applicant: UserServiceApplicantRow;
  email: string | null;
  signingPlace: string | null;
}): Promise<Generated> {
  const values = buildContractValues({
    template: input.template,
    applicant: input.applicant,
    email: input.email,
    totalCents: input.order.total_cents,
    paidAt: input.order.paid_at,
    signingPlace: input.signingPlace,
  });
  const bytes = await generateContractPdf(input.template, values, { reference: input.order.id });
  if (bytes.byteLength === 0) throw new Error(`contracts buildPdf: empty PDF for order ${input.order.id}`);
  // A fresh copy: pdf-lib hands back a view over a buffer it may reuse.
  return {
    pdf: new Uint8Array(bytes),
    values,
    fileName: contractFileName(input.template, input.applicant.full_name),
  };
}

type Emailed = {
  /** True when the sender accepted the email. */
  emailed: boolean;
  /** The row as it stands after the attempt: stamped when the email went out. */
  contract: UserServiceContractRow;
};

/**
 * Sends the agreement and stamps `emailed_at` on that version of the row.
 * Never throws: whatever goes wrong is logged, and a row whose email did not
 * go out keeps `emailed_at` null for the next ensureContract to try again.
 */
async function emailAgreement(
  admin: Db,
  input: {
    contract: UserServiceContractRow;
    pdf: Uint8Array;
    to: string | null;
    serviceName: string | null;
    origin?: string | null;
  },
): Promise<Emailed> {
  const { contract } = input;
  try {
    if (!input.to) {
      console.error(`contracts: order ${contract.user_service_id} has no account email; agreement not sent`);
      return { emailed: false, contract };
    }
    const content = serviceAgreement({
      serviceName: input.serviceName ?? FALLBACK_SERVICE_NAME,
      dashboardUrl: dashboardUrl(input.origin, `/en/dashboard/orders/${contract.user_service_id}`),
    });
    const sent = await sendEmail({
      to: input.to,
      ...content,
      attachments: [{ filename: contract.file_name, content: input.pdf }],
    });
    if (!sent.ok) return { emailed: false, contract };

    // The version travels with the stamp, so a slow sender of version 1 never marks version 2 as emailed.
    const { data, error } = await admin
      .from("user_service_contracts")
      .update({ emailed_at: new Date().toISOString() })
      .eq("id", contract.id)
      .eq("version", contract.version)
      .select("*");
    if (error) {
      console.error(`contracts: email sent but not stamped for order ${contract.user_service_id}: ${error.message}`);
      return { emailed: true, contract };
    }
    return { emailed: true, contract: ((data ?? [])[0] as UserServiceContractRow | undefined) ?? contract };
  } catch (error) {
    console.error(`contracts: email step failed for order ${contract.user_service_id}:`, error);
    return { emailed: false, contract };
  }
}

/** The email of a row that was generated before and never sent: the stored file, attached again. */
async function retryEmail(
  admin: Db,
  order: UserServiceRow,
  contract: UserServiceContractRow,
  origin?: string | null,
): Promise<Emailed> {
  try {
    const [pdf, to, service] = await Promise.all([
      getObjectBytes(contract.storage_key),
      findOwnerEmail(admin, order.user_id),
      findService(admin, order.service_id),
    ]);
    if (!pdf) {
      console.error(`contracts: ${contract.storage_key} is not in the bucket; agreement not sent`);
      return { emailed: false, contract };
    }
    return await emailAgreement(admin, { contract, pdf, to, serviceName: service?.name ?? null, origin });
  } catch (error) {
    console.error(`contracts: email retry failed for order ${order.id}:`, error);
    return { emailed: false, contract };
  }
}

/**
 * Stores version 1 and inserts the row. Returns the row and whether this
 * call is the one that created it: on a duplicate key another call won, and
 * its row is read back instead.
 */
async function createFirstVersion(
  admin: Db,
  order: UserServiceRow,
  template: ContractTemplate,
  generated: Generated,
): Promise<{ contract: UserServiceContractRow; created: boolean }> {
  const key = contractStorageKey(order.id, 1);
  await putObject({ key, body: generated.pdf, contentType: PDF });

  const { data, error } = await admin
    .from("user_service_contracts")
    .insert({
      user_service_id: order.id,
      template,
      version: 1,
      storage_key: key,
      file_name: generated.fileName,
      size_bytes: generated.pdf.byteLength,
      variables: generated.values,
      generated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (!error && data) return { contract: data as UserServiceContractRow, created: true };

  if (error?.code === UNIQUE_VIOLATION) {
    const winner = await getOrderContract(admin, order.id);
    if (winner) return { contract: winner, created: false };
  }
  throw new Error(`contracts insert: ${error?.message ?? "no row returned"}`);
}

/**
 * Makes sure a paid order whose service has a contract has its agreement:
 * generated once, stored, recorded and emailed. Safe to call again and
 * again; see the header for the order of the checks and the race.
 */
export async function ensureContract(
  admin: Db,
  orderId: string,
  opts: EnsureContractOptions = {},
): Promise<EnsureContractResult> {
  const order = await findOrder(admin, orderId);
  if (!order) return { status: "off", reason: "order_not_found" };

  const existing = await getOrderContract(admin, order.id);
  if (existing) {
    if (existing.emailed_at) return { status: "ready", contract: existing, created: false, emailed: false };
    const retried = await retryEmail(admin, order, existing, opts.origin);
    return { status: "ready", contract: retried.contract, created: false, emailed: retried.emailed };
  }

  const service = await findService(admin, order.service_id);
  const template = service?.contract_template ?? null;
  if (!template) return { status: "off", reason: "no_template" };
  if (!order.paid_at) return { status: "off", reason: "unpaid" };

  const applicant = await findApplicant(admin, order.id, 0);
  if (!applicant) return { status: "needs_details" };

  const email = await findOwnerEmail(admin, order.user_id);
  const place = parseSigningPlace(opts.signingPlace);
  const generated = await buildPdf({
    template,
    order,
    applicant,
    email,
    signingPlace: place.ok ? place.value : null,
  });

  const { contract, created } = await createFirstVersion(admin, order, template, generated);
  if (!created) return { status: "ready", contract, created: false, emailed: false };

  const sent = await emailAgreement(admin, {
    contract,
    pdf: generated.pdf,
    to: email,
    serviceName: service?.name ?? null,
    origin: opts.origin,
  });
  return { status: "ready", contract: sent.contract, created: true, emailed: sent.emailed };
}

// ---------------------------------------------------------------------------
// regenerateContract
// ---------------------------------------------------------------------------

export type RegenerateContractResult = {
  contract: UserServiceContractRow;
  /** True when the email with the new version was accepted by the sender. */
  emailed: boolean;
};

/** Annex I's token for the signing place, as buildContractValues keys it; absent when the client left it blank. */
const PLACE_TOKEN = "[PLACE]";

/** The place printed on the version being replaced, read back from what the row says was printed. */
function printedSigningPlace(variables: Record<string, string> | null | undefined): string | null {
  const place = parseSigningPlace(variables?.[PLACE_TOKEN]);
  return place.ok ? place.value : null;
}

/**
 * Admin only (the route checks): prepares the agreement again from the
 * details as they are now, as a new version under a new key, updates the
 * row and emails the client again. The file of the version before stays in
 * the bucket. The place the client typed for Annex I is carried over from
 * what was printed last time.
 *
 * The template is the service's; a service that lost its template keeps the
 * one the agreement was made with. An order with no agreement yet gets its
 * first version, exactly as ensureContract would prepare it.
 *
 * Throws ContractError with a line the admin may read: 404 for an unknown
 * order or a service with no contract, 409 for an unpaid order, for details
 * the client has not entered and for two regenerations racing each other
 * (the update names the version it replaces, so only one wins).
 */
export async function regenerateContract(
  admin: Db,
  orderId: string,
  opts: Pick<EnsureContractOptions, "origin"> = {},
): Promise<RegenerateContractResult> {
  const order = await findOrder(admin, orderId);
  if (!order) throw new ContractError("order_not_found", 404, "Order not found.");

  const [existing, service] = await Promise.all([
    getOrderContract(admin, order.id),
    findService(admin, order.service_id),
  ]);
  const template = service?.contract_template ?? existing?.template ?? null;
  if (!template) throw new ContractError("no_template", 404, "This service has no contract.");
  if (!order.paid_at) throw new ContractError("unpaid", 409, "Payment first.");

  const applicant = await findApplicant(admin, order.id, 0);
  if (!applicant) throw new ContractError("details_missing", 409, "The client has not entered their details yet.");

  const email = await findOwnerEmail(admin, order.user_id);
  const generated = await buildPdf({
    template,
    order,
    applicant,
    email,
    signingPlace: printedSigningPlace(existing?.variables),
  });

  let contract: UserServiceContractRow;
  if (!existing) {
    const first = await createFirstVersion(admin, order, template, generated);
    // Another call created it a moment ago and is emailing it: nothing more to do here.
    if (!first.created) return { contract: first.contract, emailed: false };
    contract = first.contract;
  } else {
    const version = existing.version + 1;
    const key = contractStorageKey(order.id, version);
    await putObject({ key, body: generated.pdf, contentType: PDF });

    const { data, error } = await admin
      .from("user_service_contracts")
      .update({
        template,
        version,
        storage_key: key,
        file_name: generated.fileName,
        size_bytes: generated.pdf.byteLength,
        variables: generated.values,
        generated_at: new Date().toISOString(),
        emailed_at: null,
      })
      .eq("id", existing.id)
      .eq("version", existing.version)
      .select("*");
    if (error) throw new Error(`contracts regenerate: ${error.message}`);
    const updated = (data ?? [])[0] as UserServiceContractRow | undefined;
    if (!updated) {
      throw new ContractError("stale", 409, "This agreement was regenerated a moment ago. Refresh and try again.");
    }
    contract = updated;
  }

  const sent = await emailAgreement(admin, {
    contract,
    pdf: generated.pdf,
    to: email,
    serviceName: service?.name ?? null,
    origin: opts.origin,
  });
  return { contract: sent.contract, emailed: sent.emailed };
}
