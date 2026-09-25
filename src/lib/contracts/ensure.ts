import { buildContractValues, contractFileName, type ContractValues } from "@/content/contracts/variables";
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
import { paidWithRealMoney } from "@/lib/orders/live-payment";
import { getObjectBytes, putObject } from "@/lib/r2/client";

import { parseSigningPlace } from "./signing-place";
import type { ApplicantIndex } from "./state";
import { contractPersons } from "./templates";

/**
 * The service agreement of one order: when it exists, how it comes to exist
 * and how it reaches the client. Design in docs/agreement-contract.md
 * section 5, amended by Patrícia's answers of 2026-09-24 (the Couple
 * package's one agreement for two people, the firm's signature).
 *
 *   contractState(order, service, applicants, contract) -> "off" | "needs_details" | "ready"
 *   contractStatus(order, service, applicants, contract) -> the same, saying whose details are missing
 *   parseSigningPlace(raw)                              -> the optional "city and country" field, cleaned
 *   contractStorageKey(orderId, version, nonce?)        -> contracts/{orderId}/v{version}-{nonce}.pdf
 *   ensureContract(admin, orderId, opts?)               -> generates once, emails once, idempotent
 *   regenerateContract(admin, orderId, opts?)           -> admin only: a new version, emailed again
 *
 * `admin` is the secret key client: the caller (a route handler) has already
 * checked the session and who owns the order. The table is written here and
 * nowhere else; nobody writes it through PostgREST (0009).
 *
 * ensureContract, in order: the order, the contract row (one exists: the
 * answer is `ready`, and an email that never went out is tried again), the
 * service's template and the payment (`off`), then the details of every
 * person the model names (`needs_details`, with the index of the first one
 * missing): applicant 0, and for `couple` applicant 1 as well, the partner.
 * Only then anything is written: the PDF is generated, stored under a key
 * of its own, and the row inserted. `unique (user_service_id)` settles two
 * calls racing each other: the loser's insert fails on the duplicate key, it
 * reads the winner's row and answers `ready` without emailing, because the
 * winner does. The two PDFs need not be the same (another signing place,
 * or the firm's signature uploaded between the two), which is why every
 * attempt stores its file under a key no other attempt uses (the version
 * and a random suffix, 2026-09-25): the loser's upload can never overwrite
 * the file the winner's row describes and emailed. It is left behind in the
 * order's folder, where nothing points at it. Two regenerations racing each
 * other end the same way, the update naming the version it replaces.
 *
 * The firm's signature. Patrícia's digitised signature is a PNG kept in the
 * bucket under FIRM_SIGNATURE_KEY, uploaded by hand; every generation (the
 * first version and every regeneration) of an order paid with real money
 * reads it and hands it to the generator, which draws it above the Second
 * Party's signature line. Until it is there the line stays blank, and so it
 * does whenever it cannot be read or drawn: a missing file, a bucket that
 * does not answer, a file that is not a PNG or one the generator refuses are
 * logged and the agreement is prepared without it. The signature never turns
 * a client's request into a 500. An agreement prepared before the file
 * arrived keeps its blank line until the firm regenerates it.
 *
 * Only real payments get it (2026-09-25). The bucket is shared with staging,
 * which stays up as the test environment with Stripe in test mode, and with
 * local development; there anyone can pay with a test card. So the signature
 * is read only for an order paidWithRealMoney (src/lib/orders/live-payment.ts) calls live:
 * a live Checkout Session, or a payment an admin recorded outside the
 * platform on production, as the order's own events say. A test card's
 * order, or a payment recorded on staging or in development, gets the
 * generator's specimen line on every page instead, whichever host prepares
 * the agreement. A failed read of that record fails the call before
 * anything is written.
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
export { contractStatus, missingContractApplicant, type ApplicantIndex, type ContractStatus } from "./state";

// ---------------------------------------------------------------------------
// Storage key
// ---------------------------------------------------------------------------

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9_-]*$/i;
const NONCE = /^[a-z0-9]{1,32}$/i;
const PDF = "application/pdf";

/** Eight hex characters: enough for two attempts at the same moment never to meet. */
function keyNonce(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/**
 * Where one attempt at a version of an order's agreement lives in the
 * bucket. Every version has its own key, so a regenerated agreement never
 * overwrites the one that was emailed before it, and every attempt at a
 * version its own suffix, so two requests racing for the same version never
 * overwrite each other's file (see the header). The row keeps the key of the
 * attempt that won; `nonce` is fixed only by tests.
 */
export function contractStorageKey(orderId: string, version: number, nonce: string = keyNonce()): string {
  if (!SAFE_SEGMENT.test(orderId)) throw new Error("contractStorageKey: invalid orderId");
  if (!Number.isInteger(version) || version < 1) throw new Error("contractStorageKey: invalid version");
  if (!NONCE.test(nonce)) throw new Error("contractStorageKey: invalid nonce");
  return `contracts/${orderId}/v${version}-${nonce}.pdf`;
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
  /** `applicant`: the first person the model names with no details on the order, 1 being the Couple package's partner. */
  | { status: "needs_details"; applicant: ApplicantIndex }
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

/**
 * The details of every person the model names, in applicant order, or the
 * index of the first one missing. `couple` names applicant 0 and applicant
 * 1; every other model names applicant 0 alone, so a partner row on a one
 * person order is neither read nor printed.
 */
async function findContractApplicants(
  admin: Db,
  orderId: string,
  template: ContractTemplate,
): Promise<{ ok: true; applicants: UserServiceApplicantRow[] } | { ok: false; missing: ApplicantIndex }> {
  const indexes: ApplicantIndex[] = contractPersons(template) === 2 ? [0, 1] : [0];
  const rows = await Promise.all(indexes.map((index) => findApplicant(admin, orderId, index)));
  const applicants: UserServiceApplicantRow[] = [];
  for (const [position, row] of rows.entries()) {
    if (!row) return { ok: false, missing: indexes[position] };
    applicants.push(row);
  }
  return { ok: true, applicants };
}

// ---------------------------------------------------------------------------
// The firm's signature
// ---------------------------------------------------------------------------

/** Where Patrícia's digitised signature lives in the bucket: a PNG, uploaded by hand. */
export const FIRM_SIGNATURE_KEY = "firm/signature.png";

/** The eight bytes every PNG file starts with. */
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function isPng(bytes: Uint8Array): boolean {
  return bytes.byteLength > PNG_MAGIC.length && PNG_MAGIC.every((byte, index) => bytes[index] === byte);
}

/**
 * The signature's bytes, or null. Null while the file is not in the bucket,
 * which is how it starts; a bucket that fails or a file that is not a PNG is
 * logged and read as null too, so the agreement goes out with a blank line
 * rather than not at all.
 */
async function loadFirmSignature(): Promise<Uint8Array | null> {
  try {
    const bytes = await getObjectBytes(FIRM_SIGNATURE_KEY);
    if (!bytes || bytes.byteLength === 0) return null;
    if (!isPng(bytes)) {
      console.error(`contracts: ${FIRM_SIGNATURE_KEY} is not a PNG; the agreement is prepared without the firm's signature`);
      return null;
    }
    return new Uint8Array(bytes);
  } catch (error) {
    console.error(`contracts: ${FIRM_SIGNATURE_KEY} could not be read; the agreement is prepared without the firm's signature:`, error);
    return null;
  }
}

/**
 * The PDF, with the firm's signature when there is one. A signature the
 * generator cannot draw is logged and the agreement generated again without
 * it; a failure without a signature is the generator's own and is thrown.
 * `specimen` is passed on only when set, for an order not paid with real
 * money, which never has a signature to draw.
 */
async function renderContract(
  template: ContractTemplate,
  values: ContractValues,
  reference: string,
  signature: Uint8Array | null,
  specimen: boolean,
): Promise<Uint8Array> {
  const marks = specimen ? { specimen: true } : {};
  if (signature) {
    try {
      return await generateContractPdf(template, values, { reference, signature, ...marks });
    } catch (error) {
      console.error(`contracts: the firm's signature could not be drawn for order ${reference}; prepared without it:`, error);
    }
  }
  return generateContractPdf(template, values, { reference, signature: null, ...marks });
}

type Generated = {
  pdf: Uint8Array;
  values: ContractValues;
  fileName: string;
};

async function buildPdf(
  admin: Db,
  input: {
    template: ContractTemplate;
    order: UserServiceRow;
    service: ServiceRow | null;
    /** Every person the model names, applicant 0 first (findContractApplicants). */
    applicants: UserServiceApplicantRow[];
    email: string | null;
    signingPlace: string | null;
  },
): Promise<Generated> {
  const values = buildContractValues({
    order: input.order,
    // The template this version is made with, which regenerateContract may take from the row when the service lost its own.
    service: {
      slug: input.service?.slug ?? "",
      name: input.service?.name ?? "",
      contract_template: input.template,
    },
    applicants: input.applicants,
    email: input.email ?? "",
    signingPlace: input.signingPlace,
  });
  // The firm's signature only on an order paid with real money; see the header.
  const live = await paidWithRealMoney(admin, input.order);
  const signature = live ? await loadFirmSignature() : null;
  const bytes = await renderContract(input.template, values, input.order.id, signature, !live);
  if (bytes.byteLength === 0) throw new Error(`contracts buildPdf: empty PDF for order ${input.order.id}`);
  // A fresh copy: pdf-lib hands back a view over a buffer it may reuse.
  return {
    pdf: new Uint8Array(bytes),
    values,
    fileName: contractFileName(input.template, input.applicants[0]?.full_name ?? null),
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

  const people = await findContractApplicants(admin, order.id, template);
  if (!people.ok) return { status: "needs_details", applicant: people.missing };

  const email = await findOwnerEmail(admin, order.user_id);
  const place = parseSigningPlace(opts.signingPlace);
  const generated = await buildPdf(admin, {
    template,
    order,
    service,
    applicants: people.applicants,
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

/** The line the admin reads when a person the model names has no details yet, by applicant index. */
const DETAILS_MISSING_FOR_ADMIN: Record<ApplicantIndex, string> = {
  0: "The client has not entered their details yet.",
  1: "The client has not entered their partner's details yet.",
};

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
 * what was printed last time, and the firm's signature is read again, so a
 * regeneration after the signature arrived carries it (on an order paid with
 * real money only; a test order stays a specimen).
 *
 * The template is the service's; a service that lost its template keeps the
 * one the agreement was made with. An order with no agreement yet gets its
 * first version, exactly as ensureContract would prepare it.
 *
 * Throws ContractError with a line the admin may read: 404 for an unknown
 * order or a service with no contract, 409 for an unpaid order, for details
 * the client has not entered (the partner's named apart for `couple`) and
 * for two regenerations racing each other (the update names the version it
 * replaces, so only one wins).
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

  const people = await findContractApplicants(admin, order.id, template);
  if (!people.ok) throw new ContractError("details_missing", 409, DETAILS_MISSING_FOR_ADMIN[people.missing]);

  const email = await findOwnerEmail(admin, order.user_id);
  const generated = await buildPdf(admin, {
    template,
    order,
    service,
    applicants: people.applicants,
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
