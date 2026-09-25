import { isProductId } from "@/lib/apply/types";
import { getServiceForAdmin } from "@/lib/db/admin-queries";
import type { Db } from "@/lib/db/queries";
import { CONTRACT_TEMPLATES } from "@/lib/contracts/templates";
import type { ContractTemplate, DeliverableKind, DocTemplate, ServiceRow, ServiceWithConfig } from "@/lib/db/types";
import { DOC_TEMPLATES } from "@/lib/documents/templates";
import { extensionFor } from "@/lib/r2/keys";

/**
 * The service editor's server side. Contract (docs/admin-contract.md)
 * sections 6 and 7.
 *
 *   const result = validateServiceInput(body);          // pure, no database
 *   if (!result.ok) return refuse(422, result.error);
 *   const service = await upsertService(db, result.value, id);
 *
 * validateServiceInput reads the whole editor form (the service's columns
 * plus `stages`, `docs` and `deliverables`) and answers either the typed
 * input or one line naming the first thing wrong, in the order the form
 * shows its fields. Nothing from the browser reaches the database without
 * passing here. `contract_template` names the firm's contract model the
 * service uses (docs/agreement-contract.md section 5). Three cases, kept
 * apart on purpose: one of `nif`, `bank`, `package` sets it; an explicit
 * `null` clears it; a body WITHOUT the key says nothing about it, so the key
 * is left out of the validated input and an update does not touch the
 * column (a caller that predates the field, or a script that only renames a
 * service, must not switch a service's agreement off by omission). The
 * editor always sends the key. A create without it stores null.
 *
 * A document slot whose template is 'agreement' (0013) takes back the signed
 * service agreement, so it needs a contract on the service (review of
 * 2026-09-25). Without one no agreement is ever prepared, the slot never
 * opens (POST /api/documents/upload-url answers 409 until an agreement
 * exists) and, the slot being required, the order can never leave the
 * documents stage. validateServiceInput refuses the pair with 422 when the
 * body names the contract; upsertService refuses it, also 422, when the
 * body leaves the contract out and the stored one is null.
 *
 * upsertService writes the service row, then reconciles each child table by
 * (service_id, key): rows in the input are upserted, rows no longer present
 * are deleted. Before anything is written, it refuses (409, with the count)
 * to delete a stage an order still sits on, a document slot a client has
 * uploaded to, or a deliverable that has been returned on an order. The four
 * services the application form sells (`isProductId`) keep their slug and
 * their price in code (`PRICE_CENTS` in src/content/bank-nif.ts, checked by
 * /api/apply/submit), so a different slug or price on one of them is
 * refused with 409 as well. There
 * is no transaction across the PostgREST calls, so the checks come first
 * and the writes after; a failure half way is logged by the route and the
 * editor shows the saved state on reload.
 *
 * Stage positions are unique per service in the database. Reordering two
 * stages would collide half way through one upsert, so kept stages are first
 * parked on positions above 1000, removed ones deleted, and the final
 * positions written in a second upsert.
 */

export type StageInput = {
  key: string;
  label: string;
  description: string | null;
  position: number;
  is_terminal: boolean;
};

export type DocInput = {
  key: string;
  label: string;
  note: string | null;
  accepted_mime: string[];
  max_bytes: number;
  per_applicant: boolean;
  required: boolean;
  position: number;
  /**
   * The deed the slot generates (documents contract section 3), or
   * 'agreement' for the slot the signed service agreement comes back in
   * (0013); null for a plain upload.
   */
  template: DocTemplate | null;
};

export type DeliverableInput = {
  key: string;
  label: string;
  kind: DeliverableKind;
  position: number;
};

export type ServiceInput = {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  includes: string[];
  timeline: string | null;
  /**
   * The firm's contract model the service uses (agreement contract section 4);
   * null for none. The key is absent when the body did not carry it: an update
   * then leaves the column alone, a create stores null.
   */
  contract_template?: ContractTemplate | null;
  stripe_price_id_test: string | null;
  stripe_price_id_live: string | null;
  stripe_payment_link_test: string | null;
  stripe_payment_link_live: string | null;
  position: number;
  active: boolean;
  stages: StageInput[];
  docs: DocInput[];
  deliverables: DeliverableInput[];
};

export type ValidationResult = { ok: true; value: ServiceInput } | { ok: false; error: string };

export const FIRST_STAGE_KEY = "awaiting_payment";

export const LIMITS = {
  slug: { min: 3, max: 40 },
  name: { min: 3, max: 80 },
  tagline: 160,
  description: 2000,
  timeline: 120,
  includes: { items: 12, chars: 120 },
  key: 40,
  stageLabel: 60,
  stageDescription: 200,
  docLabel: 80,
  docNote: 200,
  docMaxBytes: 50 * 1024 * 1024,
  deliverableLabel: 80,
  stripeField: 200,
  priceCents: 100_000_000,
  stages: 20,
  docs: 30,
  deliverables: 20,
} as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KEY = /^[a-z][a-z0-9_]*$/;
const CURRENCY = /^[a-z]{3}$/;
const TEMPLATE_MESSAGE = "Choose a document to sign or none.";
const CONTRACT_TEMPLATE_MESSAGE = "Choose a contract or none.";
/** An 'agreement' slot on a service with no contract; the same line as `messages.agreementNeedsContract` in the editor. */
export const AGREEMENT_NEEDS_CONTRACT = "Choose a service contract, or remove the signed service agreement from the documents.";

/** Thrown inside the validator and turned into `{ ok: false }` at its edge. */
class Invalid extends Error {}

function fail(message: string): never {
  throw new Invalid(message);
}

function asObject(value: unknown, what: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${what} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, what: string, min: number, max: number): string {
  if (typeof value !== "string") fail(`${what} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    fail(min > 0 ? `${what} must be ${min} to ${max} characters.` : `${what} must be at most ${max} characters.`);
  }
  return trimmed;
}

/** Missing, null or blank becomes null; otherwise trimmed text within `max`. */
function optionalText(value: unknown, what: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = text(value, what, 0, max);
  return trimmed || null;
}

function bool(value: unknown, what: string, fallback?: boolean): boolean {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "boolean") fail(`${what} must be true or false.`);
  return value;
}

function integer(value: unknown, what: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value)) fail(`${what} must be a whole number.`);
  if (value < min || value > max) fail(`${what} must be between ${min} and ${max}.`);
  return value;
}

function key(value: unknown, what: string): string {
  const k = text(value, what, 1, LIMITS.key);
  if (!KEY.test(k)) fail(`${what} must be lower case letters, digits and underscores, starting with a letter.`);
  return k;
}

function list(value: unknown, what: string, max: number): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(`${what} must be a list.`);
  if (value.length > max) fail(`${what} can hold at most ${max} items.`);
  return value;
}

function uniqueKeys(rows: { key: string }[], what: string): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.key)) fail(`${what} keys must be unique: "${row.key}" appears twice.`);
    seen.add(row.key);
  }
}

function stripeId(value: unknown, what: string, prefix: string): string | null {
  const v = optionalText(value, what, LIMITS.stripeField);
  if (v !== null && !v.startsWith(prefix)) fail(`${what} must start with "${prefix}".`);
  return v;
}

/**
 * Missing or null is a plain upload; otherwise one of the two deed keys or
 * 'agreement' (DOC_TEMPLATES, src/lib/documents/templates.ts), and nothing
 * else. Since 0013 every wizard service carries an 'agreement' slot, so a
 * save of those services sends it back.
 */
function template(value: unknown): DocTemplate | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && (DOC_TEMPLATES as readonly string[]).includes(value)) return value as DocTemplate;
  return fail(TEMPLATE_MESSAGE);
}

/**
 * The `contract_template` key of the input, or no key at all. Absent
 * (`undefined`, which is all a JSON body without the key can be) is "the
 * body did not say": nothing is returned, so an update does not touch the
 * column. Null is a service with no contract; otherwise one of the four
 * models (CONTRACT_TEMPLATES, src/lib/contracts/templates.ts, `couple`
 * since 0017), and nothing else.
 */
function contractTemplateField(value: unknown): Pick<ServiceInput, "contract_template"> {
  if (value === undefined) return {};
  if (value === null) return { contract_template: null };
  if (typeof value === "string" && (CONTRACT_TEMPLATES as readonly string[]).includes(value)) {
    return { contract_template: value as ContractTemplate };
  }
  return fail(CONTRACT_TEMPLATE_MESSAGE);
}

function stage(raw: unknown, index: number): StageInput {
  const s = asObject(raw, `Stage ${index + 1}`);
  return {
    key: key(s.key, `Stage ${index + 1} key`),
    label: text(s.label, `Stage ${index + 1} label`, 1, LIMITS.stageLabel),
    description: optionalText(s.description, `Stage ${index + 1} description`, LIMITS.stageDescription),
    position: integer(s.position, `Stage ${index + 1} position`, 1, LIMITS.stages),
    is_terminal: bool(s.is_terminal, `Stage ${index + 1} terminal flag`, false),
  };
}

function stages(raw: unknown): StageInput[] {
  const rows = list(raw, "Stages", LIMITS.stages).map(stage);
  if (rows.length < 2) fail("A service needs at least two stages: awaiting payment and one more.");
  uniqueKeys(rows, "Stage");

  const sorted = [...rows].sort((a, b) => a.position - b.position);
  sorted.forEach((row, i) => {
    if (row.position !== i + 1) fail(`Stage positions must run from 1 to ${rows.length} with no gaps or repeats.`);
  });
  if (sorted[0].key !== FIRST_STAGE_KEY) fail(`The first stage must be "${FIRST_STAGE_KEY}".`);

  const terminals = sorted.filter((row) => row.is_terminal);
  if (terminals.length !== 1) fail("Exactly one stage must be marked as terminal.");
  if (!sorted[sorted.length - 1].is_terminal) fail("The terminal stage must be the last one.");

  return sorted;
}

function doc(raw: unknown, index: number): DocInput {
  const d = asObject(raw, `Document ${index + 1}`);
  const what = `Document ${index + 1}`;

  const mimeRaw = d.accepted_mime === undefined ? ["application/pdf", "image/jpeg", "image/png"] : d.accepted_mime;
  if (!Array.isArray(mimeRaw) || mimeRaw.length === 0) fail(`${what} needs at least one accepted file type.`);
  const accepted_mime = Array.from(
    new Set(
      mimeRaw.map((m) => {
        if (typeof m !== "string") fail(`${what} accepted file types must be text.`);
        const mime = m.trim().toLowerCase();
        if (!extensionFor(mime)) fail(`${what} accepts a file type we do not store: ${mime || "empty"}.`);
        return mime;
      }),
    ),
  );

  return {
    key: key(d.key, `${what} key`),
    label: text(d.label, `${what} label`, 1, LIMITS.docLabel),
    note: optionalText(d.note, `${what} note`, LIMITS.docNote),
    accepted_mime,
    max_bytes: d.max_bytes === undefined ? 10 * 1024 * 1024 : integer(d.max_bytes, `${what} size limit`, 1, LIMITS.docMaxBytes),
    per_applicant: bool(d.per_applicant, `${what} per applicant flag`, true),
    required: bool(d.required, `${what} required flag`, true),
    position: d.position === undefined ? index : integer(d.position, `${what} position`, 0, 1000),
    template: template(d.template),
  };
}

function docs(raw: unknown): DocInput[] {
  const rows = list(raw, "Documents", LIMITS.docs).map(doc);
  uniqueKeys(rows, "Document");
  return rows.sort((a, b) => a.position - b.position);
}

function deliverable(raw: unknown, index: number): DeliverableInput {
  const d = asObject(raw, `Deliverable ${index + 1}`);
  const what = `Deliverable ${index + 1}`;
  const kind = d.kind;
  if (kind !== "report" && kind !== "document") fail(`${what} kind must be "report" or "document".`);
  return {
    key: key(d.key, `${what} key`),
    label: text(d.label, `${what} label`, 1, LIMITS.deliverableLabel),
    kind,
    position: d.position === undefined ? index : integer(d.position, `${what} position`, 0, 1000),
  };
}

function deliverables(raw: unknown): DeliverableInput[] {
  const rows = list(raw, "Deliverables", LIMITS.deliverables).map(deliverable);
  uniqueKeys(rows, "Deliverable");
  return rows.sort((a, b) => a.position - b.position);
}

function includes(raw: unknown): string[] {
  return list(raw, "Includes", LIMITS.includes.items).map((item, i) =>
    text(item, `Includes item ${i + 1}`, 1, LIMITS.includes.chars),
  );
}

export function validateServiceInput(body: unknown): ValidationResult {
  try {
    const b = asObject(body, "The service");

    const slug = text(b.slug, "Slug", LIMITS.slug.min, LIMITS.slug.max);
    if (!SLUG.test(slug)) fail("Slug must be lower case letters, digits and single hyphens between them.");

    const currencyRaw = b.currency === undefined || b.currency === null ? "eur" : b.currency;
    if (typeof currencyRaw !== "string" || !CURRENCY.test(currencyRaw.trim().toLowerCase())) {
      fail("Currency must be a three letter code.");
    }

    const value: ServiceInput = {
      slug,
      name: text(b.name, "Name", LIMITS.name.min, LIMITS.name.max),
      tagline: optionalText(b.tagline, "Tagline", LIMITS.tagline),
      description: optionalText(b.description, "Description", LIMITS.description),
      price_cents: integer(b.price_cents, "Price in cents", 1, LIMITS.priceCents),
      currency: (currencyRaw as string).trim().toLowerCase(),
      includes: includes(b.includes),
      timeline: optionalText(b.timeline, "Timeline", LIMITS.timeline),
      // Checked here, where the form shows it; the key exists only when the body carried it.
      ...contractTemplateField(b.contract_template),
      stripe_price_id_test: stripeId(b.stripe_price_id_test, "Test price id", "price_"),
      stripe_price_id_live: stripeId(b.stripe_price_id_live, "Live price id", "price_"),
      stripe_payment_link_test: stripeId(b.stripe_payment_link_test, "Test payment link", "https://"),
      stripe_payment_link_live: stripeId(b.stripe_payment_link_live, "Live payment link", "https://"),
      position: b.position === undefined ? 0 : integer(b.position, "Position", 0, 1000),
      active: bool(b.active, "Active flag", true),
      stages: stages(b.stages),
      docs: docs(b.docs),
      deliverables: deliverables(b.deliverables),
    };
    // Only when the body names the contract; without the key, upsertService checks against the stored one.
    if ("contract_template" in value && !agreementHasContract(value.docs, value.contract_template ?? null)) {
      fail(AGREEMENT_NEEDS_CONTRACT);
    }
    return { ok: true, value };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message };
    throw error;
  }
}

/** False when a slot takes back the signed agreement while the service has no contract to prepare one. */
function agreementHasContract(docs: readonly Pick<DocInput, "template">[], contract: ContractTemplate | null): boolean {
  return contract !== null || !docs.some((doc) => doc.template === "agreement");
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type ServiceErrorCode =
  | "service_not_found"
  | "slug_taken"
  | "slug_locked"
  | "price_locked"
  | "stage_in_use"
  | "doc_in_use"
  | "deliverable_in_use"
  | "agreement_without_contract";

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly status: 404 | 409 | 422;
  /** How many rows stand in the way, for the in-use errors. */
  readonly count: number;

  constructor(code: ServiceErrorCode, status: 404 | 409 | 422, message: string, count = 0) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
    this.count = count;
  }
}

/** Positions kept stages are parked on while the final order is written. */
const PARK_OFFSET = 1000;

function dbFail(where: string, error: { message: string }): never {
  throw new Error(`${where}: ${error.message}`);
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

type ChildRow = { id: string; key: string };

async function countRows(db: Db, table: string, column: string, values: string[], extra?: [string, string]): Promise<number> {
  if (values.length === 0) return 0;
  let query = db.from(table).select("id", { count: "exact", head: true }).in(column, values);
  if (extra) query = query.eq(extra[0], extra[1]);
  const { count, error } = await query;
  if (error) dbFail(`upsertService ${table}`, error);
  return count ?? 0;
}

async function childRows(db: Db, table: string, serviceId: string): Promise<ChildRow[]> {
  const { data, error } = await db.from(table).select("id, key").eq("service_id", serviceId);
  if (error) dbFail(`upsertService ${table}`, error);
  return (data ?? []) as ChildRow[];
}

export async function upsertService(db: Db, input: ServiceInput, id?: string): Promise<ServiceWithConfig> {
  const { stages, docs, deliverables, ...columns } = input;

  // Slug clash with another service.
  const { data: clash, error: clashError } = await db.from("services").select("id").eq("slug", input.slug).maybeSingle();
  if (clashError) dbFail("upsertService slug", clashError);
  const clashId = (clash as { id: string } | null)?.id;
  if (clashId && clashId !== id) {
    throw new ServiceError("slug_taken", 409, "That slug is already in use.");
  }

  // Every check before any write.
  let removedStages: ChildRow[] = [];
  let removedDocs: ChildRow[] = [];
  let removedDeliverables: ChildRow[] = [];
  if (!id && !agreementHasContract(docs, columns.contract_template ?? null)) {
    throw new ServiceError("agreement_without_contract", 422, AGREEMENT_NEEDS_CONTRACT);
  }
  if (id) {
    const { data: existing, error: existingError } = await db
      .from("services")
      .select("id, slug, price_cents, contract_template")
      .eq("id", id)
      .maybeSingle();
    if (existingError) dbFail("upsertService services", existingError);
    if (!existing) throw new ServiceError("service_not_found", 404, "Service not found.");

    // The four application form services keep their slug and price in code.
    const stored = existing as Pick<ServiceRow, "id" | "slug" | "price_cents" | "contract_template">;

    // The contract the service will have after this save: the body's, or the stored one when the body is silent.
    const contract = "contract_template" in columns ? (columns.contract_template ?? null) : (stored.contract_template ?? null);
    if (!agreementHasContract(docs, contract)) {
      throw new ServiceError("agreement_without_contract", 422, AGREEMENT_NEEDS_CONTRACT);
    }
    if (isProductId(stored.slug)) {
      if (input.slug !== stored.slug) {
        throw new ServiceError("slug_locked", 409, "This slug is used by the application form and cannot change.");
      }
      if (input.price_cents !== stored.price_cents) {
        throw new ServiceError("price_locked", 409, "Prices of the four application form services change in code, not here.");
      }
    }

    const [oldStages, oldDocs, oldDeliverables] = await Promise.all([
      childRows(db, "service_stages", id),
      childRows(db, "service_docs", id),
      childRows(db, "service_deliverables", id),
    ]);
    const keptStages = new Set(stages.map((s) => s.key));
    const keptDocs = new Set(docs.map((d) => d.key));
    const keptDeliverables = new Set(deliverables.map((d) => d.key));
    removedStages = oldStages.filter((s) => !keptStages.has(s.key));
    removedDocs = oldDocs.filter((d) => !keptDocs.has(d.key));
    removedDeliverables = oldDeliverables.filter((d) => !keptDeliverables.has(d.key));

    const ordersOnStage = await countRows(db, "user_services", "stage_key", removedStages.map((s) => s.key), ["service_id", id]);
    if (ordersOnStage > 0) {
      throw new ServiceError(
        "stage_in_use",
        409,
        `${plural(ordersOnStage, "order still sits", "orders still sit")} on a stage you removed. Move them first.`,
        ordersOnStage,
      );
    }
    const uploadsOnDoc = await countRows(db, "user_documents", "service_doc_id", removedDocs.map((d) => d.id));
    if (uploadsOnDoc > 0) {
      throw new ServiceError(
        "doc_in_use",
        409,
        `${plural(uploadsOnDoc, "upload uses", "uploads use")} a document you removed. Keep it or mark it not required.`,
        uploadsOnDoc,
      );
    }
    const filesOnDeliverable = await countRows(
      db,
      "user_service_deliverables",
      "service_deliverable_id",
      removedDeliverables.map((d) => d.id),
    );
    if (filesOnDeliverable > 0) {
      throw new ServiceError(
        "deliverable_in_use",
        409,
        `${plural(filesOnDeliverable, "file has", "files have")} been returned under a deliverable you removed. Keep it.`,
        filesOnDeliverable,
      );
    }
  }

  // The service row. `columns` holds `contract_template` only when the body
  // carried it, so an update without it leaves the column as it is; a new
  // service without it has no contract, said explicitly.
  let serviceId: string;
  if (id) {
    const { data, error } = await db.from("services").update(columns).eq("id", id).select("id").maybeSingle();
    if (error) dbFail("upsertService update", error);
    if (!data) throw new ServiceError("service_not_found", 404, "Service not found.");
    serviceId = id;
  } else {
    const { data, error } = await db
      .from("services")
      .insert({ ...columns, contract_template: columns.contract_template ?? null })
      .select("id")
      .single();
    if (error || !data) dbFail("upsertService insert", error ?? { message: "no row" });
    serviceId = (data as { id: string }).id;
  }

  // Stages: park, delete, then final positions.
  const stageRows = stages.map((s) => ({ ...s, service_id: serviceId }));
  if (id) {
    const parked = stageRows.map((s, i) => ({ ...s, position: PARK_OFFSET + i }));
    const { error } = await db.from("service_stages").upsert(parked, { onConflict: "service_id,key" });
    if (error) dbFail("upsertService stages park", error);
  }
  if (removedStages.length > 0) {
    const { error } = await db.from("service_stages").delete().in("id", removedStages.map((s) => s.id));
    if (error) dbFail("upsertService stages delete", error);
  }
  {
    const { error } = await db.from("service_stages").upsert(stageRows, { onConflict: "service_id,key" });
    if (error) dbFail("upsertService stages", error);
  }

  // Documents and deliverables: delete removed, upsert the rest.
  if (removedDocs.length > 0) {
    const { error } = await db.from("service_docs").delete().in("id", removedDocs.map((d) => d.id));
    if (error) dbFail("upsertService docs delete", error);
  }
  if (docs.length > 0) {
    const rows = docs.map((d) => ({ ...d, service_id: serviceId }));
    const { error } = await db.from("service_docs").upsert(rows, { onConflict: "service_id,key" });
    if (error) dbFail("upsertService docs", error);
  }
  if (removedDeliverables.length > 0) {
    const { error } = await db.from("service_deliverables").delete().in("id", removedDeliverables.map((d) => d.id));
    if (error) dbFail("upsertService deliverables delete", error);
  }
  if (deliverables.length > 0) {
    const rows = deliverables.map((d) => ({ ...d, service_id: serviceId }));
    const { error } = await db.from("service_deliverables").upsert(rows, { onConflict: "service_id,key" });
    if (error) dbFail("upsertService deliverables", error);
  }

  const saved = await getServiceForAdmin(db, serviceId);
  if (!saved) throw new Error(`upsertService: service ${serviceId} vanished after write`);
  return saved;
}
