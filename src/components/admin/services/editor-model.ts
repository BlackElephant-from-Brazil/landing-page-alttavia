/**
 * The service editor's form model, kept pure so it can be tested without a
 * browser. Contract (docs/admin-contract.md) sections 6 and 7.
 *
 * Three shapes live here:
 *
 *   ServiceWithConfig  what the database holds (src/lib/db/types.ts)
 *   ServiceDraft       what the form edits: every field a string, every list
 *                      row with a stable `uid` for React and a `saved` flag
 *                      that freezes the key of rows the database already has
 *   ServiceBody        what the routes accept: the section 6 payload
 *
 * `draftFromService` and `emptyDraft` build the first; `validateDraft` turns
 * it into the third or into a map of one line messages keyed by field, the
 * same rules the API enforces, so the admin reads them next to the field
 * instead of after a round trip. `suggestKey` and `suggestSlug` are the
 * auto suggestions the key and slug fields follow until they are touched.
 */

import { CONTRACT_TEMPLATES as SHARED_CONTRACT_TEMPLATES, isContractTemplate } from "@/lib/contracts/templates";
import type { ContractTemplate, DeliverableKind, DocTemplate, ServiceWithConfig } from "@/lib/db/types";
import { DOC_TEMPLATES as SHARED_DOC_TEMPLATES } from "@/lib/documents/templates";

// ---------------------------------------------------------------------------
// Payload (section 6)
// ---------------------------------------------------------------------------

export type StageBody = {
  key: string;
  label: string;
  description: string | null;
  position: number;
  is_terminal: boolean;
};

export type DocBody = {
  key: string;
  label: string;
  note: string | null;
  accepted_mime: string[];
  max_bytes: number;
  per_applicant: boolean;
  required: boolean;
  position: number;
  /**
   * What the client signs before sending this slot: a deed it generates, or
   * the order's service agreement ('agreement', 0013); null for a plain
   * upload. Always sent, so a save never leaves it to chance.
   */
  template: DocTemplate | null;
};

export type DeliverableBody = {
  key: string;
  label: string;
  kind: DeliverableKind;
  position: number;
};

export type ServiceBody = {
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  includes: string[];
  timeline: string | null;
  /**
   * The firm's contract model the service uses (docs/agreement-contract.md
   * section 7); null for none. Always sent: the route reads a body without
   * the key as none, so leaving it out would clear it on every save.
   */
  contract_template: ContractTemplate | null;
  stripe_price_id_test: string | null;
  stripe_price_id_live: string | null;
  stripe_payment_link_test: string | null;
  stripe_payment_link_live: string | null;
  position: number;
  active: boolean;
  stages: StageBody[];
  docs: DocBody[];
  deliverables: DeliverableBody[];
};

// ---------------------------------------------------------------------------
// Draft (what the form edits)
// ---------------------------------------------------------------------------

type RowBase = {
  /** React key; the database id for saved rows, a local counter for new ones. */
  uid: string;
  /** True for rows the database already holds: their key is shown read only. */
  saved: boolean;
  key: string;
  /** Once the admin edits the key by hand it stops following the label. */
  keyTouched: boolean;
  label: string;
  position: string;
};

export type StageDraft = RowBase & {
  description: string;
  is_terminal: boolean;
};

export type DocDraft = RowBase & {
  note: string;
  accepted_mime: string[];
  /** Whole megabytes, as typed. */
  max_mb: string;
  per_applicant: boolean;
  required: boolean;
  template: DocTemplate | null;
};

export type DeliverableDraft = RowBase & {
  kind: DeliverableKind;
};

export type ServiceDraft = {
  slug: string;
  slugTouched: boolean;
  name: string;
  tagline: string;
  description: string;
  /** Euros, as typed: "149" or "149.50". */
  price: string;
  currency: string;
  /** One item per line. */
  includes: string;
  timeline: string;
  /** The service agreement the client receives after paying; null for none. */
  contract_template: ContractTemplate | null;
  stripe_price_id_test: string;
  stripe_price_id_live: string;
  stripe_payment_link_test: string;
  stripe_payment_link_live: string;
  position: string;
  active: boolean;
  stages: StageDraft[];
  docs: DocDraft[];
  deliverables: DeliverableDraft[];
};

/** The file types the documents list offers as checkboxes. */
export const ACCEPTED_MIME_OPTIONS: readonly { mime: string; label: string }[] = [
  { mime: "application/pdf", label: "PDF" },
  { mime: "image/jpeg", label: "JPEG" },
  { mime: "image/png", label: "PNG" },
  { mime: "image/webp", label: "WebP" },
  { mime: "application/msword", label: "Word (.doc)" },
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word (.docx)" },
];

export const DEFAULT_ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png"];
export const DEFAULT_MAX_MB = 10;
export const MAX_DOC_MB = 20;
export const FIRST_STAGE_KEY = "awaiting_payment";
export const DELIVERABLE_KINDS: readonly DeliverableKind[] = ["document", "report"];
/**
 * What a document slot can hand the client to sign, in the order the select
 * offers them: the two deeds, then the signed service agreement (0013). One
 * list with the server's (src/lib/documents/templates.ts), so a service that
 * carries the agreement slot can be saved from the editor.
 */
export const DOC_TEMPLATES: readonly DocTemplate[] = SHARED_DOC_TEMPLATES;
/**
 * The firm's contract models a service can use, in the order the select
 * offers them. One list with the server's (src/lib/contracts/templates.ts),
 * so the editor never offers a model the route would refuse. `couple` is the
 * Couple package's one agreement for both people (0017).
 */
export const CONTRACT_TEMPLATES: readonly ContractTemplate[] = SHARED_CONTRACT_TEMPLATES;
/** How the admin screens name each model: the editor's select, the services table, the order modal. */
export const CONTRACT_TEMPLATE_LABELS: Record<ContractTemplate, string> = {
  nif: "NIF",
  bank: "Bank account",
  package: "NIF + Bank account package",
  couple: "Couple package",
};

/** A select's value back to the model: anything that is not one of the four is none. */
export function contractTemplateFromOption(value: string): ContractTemplate | null {
  return isContractTemplate(value) ? value : null;
}

/**
 * The same lengths src/lib/orders/services-admin.ts enforces, so a field
 * is stopped here with the same limit the route would name. Not imported
 * from there: that module reaches the database and this one runs in the
 * browser.
 */
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
  deliverableLabel: 80,
  stripeField: 200,
  stages: { min: 2, max: 20 },
  docs: 30,
  deliverables: 20,
} as const;

const MB = 1024 * 1024;

/** Lower snake case, the shape `service_stages.key` and friends expect. */
export const KEY_RE = /^[a-z][a-z0-9_]*$/;
/** Lower kebab case, the shape `services.slug` expects. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CURRENCY_RE = /^[a-z]{3}$/;
const PRICE_RE = /^\d{1,7}(?:[.,]\d{1,2})?$/;
const INTEGER_RE = /^\d{1,6}$/;

function ascii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** "Proof of address" to "proof_of_address". */
export function suggestKey(label: string): string {
  return ascii(label)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(?=\d)/, "k_");
}

/** "NIF + Bank Account" to "nif-bank-account". */
export function suggestSlug(name: string): string {
  return ascii(name)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function newStage(uid: string, position: number): StageDraft {
  return {
    uid,
    saved: false,
    key: "",
    keyTouched: false,
    label: "",
    description: "",
    position: String(position),
    is_terminal: false,
  };
}

export function newDoc(uid: string, position: number): DocDraft {
  return {
    uid,
    saved: false,
    key: "",
    keyTouched: false,
    label: "",
    note: "",
    accepted_mime: [...DEFAULT_ACCEPTED_MIME],
    max_mb: String(DEFAULT_MAX_MB),
    per_applicant: true,
    required: true,
    position: String(position),
    template: null,
  };
}

export function newDeliverable(uid: string, position: number): DeliverableDraft {
  return {
    uid,
    saved: false,
    key: "",
    keyTouched: false,
    label: "",
    kind: "document",
    position: String(position),
  };
}

/** A new service: active, eur, one stage already named awaiting_payment. */
export function emptyDraft(): ServiceDraft {
  return {
    slug: "",
    slugTouched: false,
    name: "",
    tagline: "",
    description: "",
    price: "",
    currency: "eur",
    includes: "",
    timeline: "",
    contract_template: null,
    stripe_price_id_test: "",
    stripe_price_id_live: "",
    stripe_payment_link_test: "",
    stripe_payment_link_live: "",
    position: "0",
    active: true,
    stages: [
      {
        ...newStage("new-stage-0", 1),
        key: FIRST_STAGE_KEY,
        keyTouched: true,
        label: "Awaiting payment",
      },
    ],
    docs: [],
    deliverables: [],
  };
}

function bytesToMb(bytes: number): string {
  const mb = bytes / MB;
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}

/** The form state for an existing service. */
export function draftFromService(service: ServiceWithConfig): ServiceDraft {
  return {
    slug: service.slug,
    slugTouched: true,
    name: service.name,
    tagline: service.tagline ?? "",
    description: service.description ?? "",
    price: centsToPrice(service.price_cents),
    currency: service.currency,
    includes: (Array.isArray(service.includes) ? service.includes : []).join("\n"),
    timeline: service.timeline ?? "",
    contract_template: service.contract_template ?? null,
    stripe_price_id_test: service.stripe_price_id_test ?? "",
    stripe_price_id_live: service.stripe_price_id_live ?? "",
    stripe_payment_link_test: service.stripe_payment_link_test ?? "",
    stripe_payment_link_live: service.stripe_payment_link_live ?? "",
    position: String(service.position),
    active: service.active,
    stages: service.stages.map((s) => ({
      uid: s.id,
      saved: true,
      key: s.key,
      keyTouched: true,
      label: s.label,
      description: s.description ?? "",
      position: String(s.position),
      is_terminal: s.is_terminal,
    })),
    docs: service.docs.map((d) => ({
      uid: d.id,
      saved: true,
      key: d.key,
      keyTouched: true,
      label: d.label,
      note: d.note ?? "",
      accepted_mime: [...d.accepted_mime],
      max_mb: bytesToMb(d.max_bytes),
      per_applicant: d.per_applicant,
      required: d.required,
      position: String(d.position),
      template: d.template ?? null,
    })),
    deliverables: service.deliverables.map((d) => ({
      uid: d.id,
      saved: true,
      key: d.key,
      keyTouched: true,
      label: d.label,
      kind: d.kind,
      position: String(d.position),
    })),
  };
}

/** 14900 to "149", 14950 to "149.50". */
export function centsToPrice(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0")}`;
}

/** "149" or "149,50" to cents, or null when it is not a price. */
export function priceToCents(price: string): number | null {
  const text = price.trim();
  if (!PRICE_RE.test(text)) return null;
  const [whole, fraction = ""] = text.replace(",", ".").split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function parseInteger(text: string): number | null {
  const trimmed = text.trim();
  return INTEGER_RE.test(trimmed) ? Number(trimmed) : null;
}

function nullable(text: string): string | null {
  const trimmed = text.trim();
  return trimmed ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Messages keyed by field. Service fields use their own name; list rows use
 * `stages.<uid>.<field>`; list level messages use `stages`, `docs`,
 * `deliverables`. Every message is one line under the house rules, in the
 * words the screens use (a key is a "code"); ./copy.test.ts checks them.
 */
export type DraftErrors = Record<string, string>;

export type ValidationResult = { ok: true; body: ServiceBody } | { ok: false; errors: DraftErrors };

export const messages = {
  required: "Enter a value.",
  slug: "Use lower case letters, numbers and single hyphens, for example nif-only.",
  slugLength: `Use ${LIMITS.slug.min} to ${LIMITS.slug.max} characters.`,
  nameLength: `Use ${LIMITS.name.min} to ${LIMITS.name.max} characters.`,
  includesCount: `Keep to ${LIMITS.includes.items} items or fewer.`,
  includesLength: `Keep each item under ${LIMITS.includes.chars} characters.`,
  tooManyStages: `Keep to ${LIMITS.stages.max} stages or fewer.`,
  twoStages: "Add at least one stage after Awaiting payment.",
  contiguous: "Positions must run from 1 with no gaps.",
  price: "Enter a price above zero, for example 149 or 149.50.",
  currency: "Use a three letter code, for example eur.",
  integer: "Enter a whole number.",
  key: "Use lower case letters, numbers and underscores, starting with a letter.",
  duplicateKey: "This code is used twice.",
  duplicatePosition: "This position is used twice.",
  positionFrom1: "Positions start at 1.",
  noStages: "Add at least one stage.",
  firstStage: `The first stage must be Awaiting payment, with the code ${FIRST_STAGE_KEY}.`,
  oneTerminal: "Mark exactly one stage as final.",
  terminalLast: "The final stage must have the highest position.",
  mime: "Tick at least one file type.",
  maxMb: `Enter a size between 1 and ${MAX_DOC_MB} MB.`,
  priceId: "Stripe price ids start with price_.",
  paymentLink: "Payment links start with https://.",
  kind: "Choose document or report.",
  template: "Choose a document to sign or none.",
  contractTemplate: "Choose a contract or none.",
  /** The same line as AGREEMENT_NEEDS_CONTRACT in src/lib/orders/services-admin.ts. */
  agreementNeedsContract: "Choose a service contract, or remove the signed service agreement from the documents.",
} as const;

function checkRowBasics(errors: DraftErrors, prefix: string, rows: RowBase[], minPosition: 0 | 1): void {
  const seenKeys = new Map<string, number>();
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) errors[`${prefix}.${row.uid}.key`] = messages.required;
    else if (!KEY_RE.test(key)) errors[`${prefix}.${row.uid}.key`] = messages.key;
    else seenKeys.set(key, (seenKeys.get(key) ?? 0) + 1);

    if (!row.label.trim()) errors[`${prefix}.${row.uid}.label`] = messages.required;

    const position = parseInteger(row.position);
    if (position === null) errors[`${prefix}.${row.uid}.position`] = messages.integer;
    else if (position < minPosition) errors[`${prefix}.${row.uid}.position`] = messages.positionFrom1;
  }
  for (const row of rows) {
    const key = row.key.trim();
    if ((seenKeys.get(key) ?? 0) > 1) errors[`${prefix}.${row.uid}.key`] = messages.duplicateKey;
  }
}

function validateStages(errors: DraftErrors, stages: StageDraft[]): StageBody[] {
  if (stages.length === 0) {
    errors.stages = messages.noStages;
    return [];
  }
  checkRowBasics(errors, "stages", stages, 1);

  // Positions are unique per service in the database.
  const byPosition = new Map<number, number>();
  for (const stage of stages) {
    const position = parseInteger(stage.position);
    if (position !== null) byPosition.set(position, (byPosition.get(position) ?? 0) + 1);
  }
  for (const stage of stages) {
    const position = parseInteger(stage.position);
    if (position !== null && (byPosition.get(position) ?? 0) > 1) {
      errors[`stages.${stage.uid}.position`] = messages.duplicatePosition;
    }
  }

  const ordered = [...stages]
    .map((stage) => ({ stage, position: parseInteger(stage.position) }))
    .filter((entry): entry is { stage: StageDraft; position: number } => entry.position !== null)
    .sort((a, b) => a.position - b.position);

  // One list level message at a time, the first rule broken in reading order.
  const listMessage = (() => {
    if (stages.length < LIMITS.stages.min) return messages.twoStages;
    if (stages.length > LIMITS.stages.max) return messages.tooManyStages;
    if (ordered.length === stages.length && ordered.some((entry, index) => entry.position !== index + 1)) {
      return messages.contiguous;
    }
    if (ordered.length > 0 && ordered[0].stage.key.trim() !== FIRST_STAGE_KEY) return messages.firstStage;
    if (stages.filter((stage) => stage.is_terminal).length !== 1) return messages.oneTerminal;
    if (ordered.length > 0 && !ordered[ordered.length - 1].stage.is_terminal) return messages.terminalLast;
    return undefined;
  })();
  if (listMessage) errors.stages = listMessage;

  return ordered.map(({ stage, position }) => ({
    key: stage.key.trim(),
    label: stage.label.trim(),
    description: nullable(stage.description),
    position,
    is_terminal: stage.is_terminal,
  }));
}

function validateDocs(errors: DraftErrors, docs: DocDraft[]): DocBody[] {
  checkRowBasics(errors, "docs", docs, 0);
  const out: DocBody[] = [];
  for (const doc of docs) {
    if (doc.accepted_mime.length === 0) errors[`docs.${doc.uid}.accepted_mime`] = messages.mime;
    const mb = Number(doc.max_mb.trim());
    const validMb = doc.max_mb.trim() !== "" && Number.isFinite(mb) && mb >= 1 && mb <= MAX_DOC_MB;
    if (!validMb) errors[`docs.${doc.uid}.max_mb`] = messages.maxMb;
    if (doc.template !== null && !DOC_TEMPLATES.includes(doc.template)) errors[`docs.${doc.uid}.template`] = messages.template;
    out.push({
      key: doc.key.trim(),
      label: doc.label.trim(),
      note: nullable(doc.note),
      accepted_mime: [...doc.accepted_mime],
      max_bytes: validMb ? Math.round(mb * MB) : 0,
      per_applicant: doc.per_applicant,
      required: doc.required,
      position: parseInteger(doc.position) ?? 0,
      template: doc.template,
    });
  }
  return out;
}

function validateDeliverables(errors: DraftErrors, deliverables: DeliverableDraft[]): DeliverableBody[] {
  checkRowBasics(errors, "deliverables", deliverables, 0);
  return deliverables.map((d) => {
    if (!DELIVERABLE_KINDS.includes(d.kind)) errors[`deliverables.${d.uid}.kind`] = messages.kind;
    return {
      key: d.key.trim(),
      label: d.label.trim(),
      kind: d.kind,
      position: parseInteger(d.position) ?? 0,
    };
  });
}

/** The section 6 body, or the messages that stop it. */
export function validateDraft(draft: ServiceDraft): ValidationResult {
  const errors: DraftErrors = {};

  const slug = draft.slug.trim();
  if (!slug) errors.slug = messages.required;
  else if (!SLUG_RE.test(slug)) errors.slug = messages.slug;
  else if (slug.length < LIMITS.slug.min || slug.length > LIMITS.slug.max) errors.slug = messages.slugLength;

  const name = draft.name.trim();
  if (!name) errors.name = messages.required;
  else if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) errors.name = messages.nameLength;

  const includes = draft.includes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (includes.length > LIMITS.includes.items) errors.includes = messages.includesCount;
  else if (includes.some((line) => line.length > LIMITS.includes.chars)) errors.includes = messages.includesLength;

  const priceCents = priceToCents(draft.price);
  if (priceCents === null || priceCents <= 0) errors.price = messages.price;

  const currency = draft.currency.trim().toLowerCase();
  if (!CURRENCY_RE.test(currency)) errors.currency = messages.currency;

  const position = parseInteger(draft.position);
  if (position === null) errors.position = messages.integer;

  if (draft.contract_template !== null && !CONTRACT_TEMPLATES.includes(draft.contract_template)) {
    errors.contract_template = messages.contractTemplate;
  } else if (draft.contract_template === null && draft.docs.some((doc) => doc.template === "agreement")) {
    // A signed agreement slot with no contract to prepare the agreement would hold every order on the documents stage.
    errors.contract_template = messages.agreementNeedsContract;
  }

  const priceIdTest = nullable(draft.stripe_price_id_test);
  const priceIdLive = nullable(draft.stripe_price_id_live);
  if (priceIdTest && !priceIdTest.startsWith("price_")) errors.stripe_price_id_test = messages.priceId;
  if (priceIdLive && !priceIdLive.startsWith("price_")) errors.stripe_price_id_live = messages.priceId;

  const linkTest = nullable(draft.stripe_payment_link_test);
  const linkLive = nullable(draft.stripe_payment_link_live);
  if (linkTest && !linkTest.startsWith("https://")) errors.stripe_payment_link_test = messages.paymentLink;
  if (linkLive && !linkLive.startsWith("https://")) errors.stripe_payment_link_live = messages.paymentLink;

  const stages = validateStages(errors, draft.stages);
  const docs = validateDocs(errors, draft.docs);
  const deliverables = validateDeliverables(errors, draft.deliverables);

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    body: {
      slug,
      name,
      tagline: nullable(draft.tagline),
      description: nullable(draft.description),
      price_cents: priceCents as number,
      currency,
      includes,
      timeline: nullable(draft.timeline),
      contract_template: draft.contract_template,
      stripe_price_id_test: priceIdTest,
      stripe_price_id_live: priceIdLive,
      stripe_payment_link_test: linkTest,
      stripe_payment_link_live: linkLive,
      position: position as number,
      active: draft.active,
      stages,
      docs,
      deliverables,
    },
  };
}

/** The section 6 body for a saved service as it is, with `active` set. Used by Deactivate and Reactivate. */
export function bodyFromService(service: ServiceWithConfig, active: boolean): ServiceBody {
  return {
    slug: service.slug,
    name: service.name,
    tagline: service.tagline,
    description: service.description,
    price_cents: service.price_cents,
    currency: service.currency,
    includes: Array.isArray(service.includes) ? [...service.includes] : [],
    timeline: service.timeline,
    contract_template: service.contract_template ?? null,
    stripe_price_id_test: service.stripe_price_id_test,
    stripe_price_id_live: service.stripe_price_id_live,
    stripe_payment_link_test: service.stripe_payment_link_test,
    stripe_payment_link_live: service.stripe_payment_link_live,
    position: service.position,
    active,
    stages: service.stages.map(({ key, label, description, position, is_terminal }) => ({
      key,
      label,
      description,
      position,
      is_terminal,
    })),
    docs: service.docs.map(({ key, label, note, accepted_mime, max_bytes, per_applicant, required, position, template }) => ({
      key,
      label,
      note,
      accepted_mime: [...accepted_mime],
      max_bytes,
      per_applicant,
      required,
      position,
      template: template ?? null,
    })),
    deliverables: service.deliverables.map(({ key, label, kind, position }) => ({ key, label, kind, position })),
  };
}

/** The next unused position in a list, for the Add row buttons. */
export function nextPosition(rows: { position: string }[], from: 0 | 1): number {
  let max = from - 1;
  for (const row of rows) {
    const position = parseInteger(row.position);
    if (position !== null && position > max) max = position;
  }
  return max + 1;
}
