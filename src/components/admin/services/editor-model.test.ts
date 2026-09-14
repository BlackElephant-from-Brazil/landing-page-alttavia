import { describe, expect, it } from "vitest";

import type { PoaTemplate, ServiceWithConfig } from "@/lib/db/types";

import {
  bodyFromService,
  centsToPrice,
  draftFromService,
  emptyDraft,
  messages,
  newDeliverable,
  newDoc,
  newStage,
  nextPosition,
  priceToCents,
  suggestKey,
  suggestSlug,
  validateDraft,
  type ServiceDraft,
} from "./editor-model";

const SERVICE: ServiceWithConfig = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "nif-only",
  name: "NIF only",
  tagline: "The tax number, filed for you.",
  description: null,
  price_cents: 14900,
  currency: "eur",
  includes: ["Official NIF", "12 months of tax representation **included**"],
  timeline: "NIF in 3 to 5 business days",
  stripe_price_id_test: "price_test",
  stripe_price_id_live: null,
  stripe_payment_link_test: null,
  stripe_payment_link_live: "https://buy.stripe.com/live",
  position: 1,
  active: true,
  created_at: "2026-09-11T00:00:00Z",
  updated_at: "2026-09-11T00:00:00Z",
  stages: [
    { id: "s1", service_id: "svc", key: "awaiting_payment", label: "Awaiting payment", description: null, position: 1, is_terminal: false },
    { id: "s2", service_id: "svc", key: "documents", label: "Documents", description: "Send us the files.", position: 2, is_terminal: false },
    { id: "s3", service_id: "svc", key: "nif_ready", label: "NIF ready", description: null, position: 3, is_terminal: true },
  ],
  docs: [
    {
      id: "d1",
      service_id: "svc",
      key: "passport",
      label: "Passport",
      note: "All four corners visible.",
      accepted_mime: ["application/pdf", "image/jpeg"],
      max_bytes: 10 * 1024 * 1024,
      per_applicant: true,
      required: true,
      position: 1,
      template: null,
    },
  ],
  deliverables: [{ id: "v1", service_id: "svc", key: "nif_certificate", label: "Your Portuguese NIF", kind: "document", position: 1 }],
  orders_count: 3,
};

function validDraft(): ServiceDraft {
  return draftFromService(SERVICE);
}

describe("suggestions", () => {
  it("turns a label into a snake case key", () => {
    expect(suggestKey("Proof of address")).toBe("proof_of_address");
    expect(suggestKey("  Bank statements / income  ")).toBe("bank_statements_income");
    expect(suggestKey("Certidão Finanças")).toBe("certidao_financas");
    expect(suggestKey("2nd passport")).toBe("k_2nd_passport");
  });

  it("turns a name into a kebab case slug", () => {
    expect(suggestSlug("NIF + Bank Account")).toBe("nif-bank-account");
    expect(suggestSlug("Test consult")).toBe("test-consult");
  });
});

describe("prices", () => {
  it("round trips cents and euros", () => {
    expect(centsToPrice(14900)).toBe("149");
    expect(centsToPrice(14950)).toBe("149.50");
    expect(priceToCents("149")).toBe(14900);
    expect(priceToCents("149.5")).toBe(14950);
    expect(priceToCents("149,50")).toBe(14950);
    expect(priceToCents("abc")).toBeNull();
    expect(priceToCents("1.999")).toBeNull();
  });
});

describe("draftFromService", () => {
  it("freezes saved keys and formats sizes in megabytes", () => {
    const draft = validDraft();
    expect(draft.slugTouched).toBe(true);
    expect(draft.price).toBe("149");
    expect(draft.includes).toBe("Official NIF\n12 months of tax representation **included**");
    expect(draft.stages.every((s) => s.saved && s.keyTouched)).toBe(true);
    expect(draft.docs[0].max_mb).toBe("10");
    expect(draft.docs[0].uid).toBe("d1");
    expect(draft.docs[0].template).toBeNull();
  });

  it("reads the generated deed off a document row", () => {
    const withDeed: ServiceWithConfig = {
      ...SERVICE,
      docs: [...SERVICE.docs, { ...SERVICE.docs[0], id: "d2", key: "poa_nif", label: "Power of attorney for the NIF", position: 2, template: "poa_nif" }],
    };
    expect(draftFromService(withDeed).docs.map((d) => d.template)).toEqual([null, "poa_nif"]);
    expect(bodyFromService(withDeed, true).docs.map((d) => d.template)).toEqual([null, "poa_nif"]);
  });

  it("starts a new service with the payment stage in place", () => {
    const draft = emptyDraft();
    expect(draft.stages).toHaveLength(1);
    expect(draft.stages[0].key).toBe("awaiting_payment");
    expect(draft.active).toBe(true);
    expect(draft.currency).toBe("eur");
  });
});

describe("validateDraft", () => {
  it("accepts a saved service unchanged and rebuilds the payload", () => {
    const result = validateDraft(validDraft());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body).toEqual(bodyFromService(SERVICE, true));
  });

  it("rejects a bad slug, price, currency and position", () => {
    const draft = { ...validDraft(), slug: "Nif Only", price: "0", currency: "euros", position: "one" };
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.slug).toBe(messages.slug);
    expect(result.errors.price).toBe(messages.price);
    expect(result.errors.currency).toBe(messages.currency);
    expect(result.errors.position).toBe(messages.integer);
  });

  it("requires the first stage to be awaiting_payment", () => {
    const draft = validDraft();
    draft.stages[0] = { ...draft.stages[0], key: "intake" };
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.stages).toBe(messages.firstStage);
  });

  it("requires exactly one terminal stage, at the end", () => {
    const none = validDraft();
    none.stages = none.stages.map((s) => ({ ...s, is_terminal: false }));
    const noneResult = validateDraft(none);
    expect(!noneResult.ok && noneResult.errors.stages).toBe(messages.oneTerminal);

    const middle = validDraft();
    middle.stages = middle.stages.map((s) => ({ ...s, is_terminal: s.key === "documents" }));
    const middleResult = validateDraft(middle);
    expect(!middleResult.ok && middleResult.errors.stages).toBe(messages.terminalLast);
  });

  it("needs a second stage, contiguous positions and a short enough name and slug", () => {
    const only = emptyDraft();
    const onlyResult = validateDraft({ ...only, name: "Test consult", slug: "test-consult", price: "95" });
    expect(!onlyResult.ok && onlyResult.errors.stages).toBe(messages.twoStages);

    const gap = validDraft();
    gap.stages[2] = { ...gap.stages[2], position: "5" };
    const gapResult = validateDraft(gap);
    expect(!gapResult.ok && gapResult.errors.stages).toBe(messages.contiguous);

    const short = { ...validDraft(), name: "AB", slug: "ab" };
    const shortResult = validateDraft(short);
    expect(!shortResult.ok && shortResult.errors.name).toBe(messages.nameLength);
    expect(!shortResult.ok && shortResult.errors.slug).toBe(messages.slugLength);
  });

  it("limits the includes list", () => {
    const many = { ...validDraft(), includes: Array.from({ length: 13 }, (_, i) => `Item ${i}`).join("\n") };
    const manyResult = validateDraft(many);
    expect(!manyResult.ok && manyResult.errors.includes).toBe(messages.includesCount);

    const long = { ...validDraft(), includes: "x".repeat(121) };
    const longResult = validateDraft(long);
    expect(!longResult.ok && longResult.errors.includes).toBe(messages.includesLength);
  });

  it("flags duplicate keys and positions on the row", () => {
    const draft = validDraft();
    draft.stages = [...draft.stages, { ...newStage("new-1", 2), key: "documents", label: "Again" }];
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors["stages.new-1.key"]).toBe(messages.duplicateKey);
    expect(result.errors["stages.s2.key"]).toBe(messages.duplicateKey);
    expect(result.errors["stages.new-1.position"]).toBe(messages.duplicatePosition);
  });

  it("checks key shape, file types and sizes on documents", () => {
    const draft = validDraft();
    draft.docs = [
      ...draft.docs,
      { ...newDoc("new-doc", 2), key: "Bad Key", label: "Statement", accepted_mime: [], max_mb: "40" },
    ];
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors["docs.new-doc.key"]).toBe(messages.key);
    expect(result.errors["docs.new-doc.accepted_mime"]).toBe(messages.mime);
    expect(result.errors["docs.new-doc.max_mb"]).toBe(messages.maxMb);
  });

  it("sends the generated deed with every document, null for a plain upload", () => {
    expect(newDoc("new-doc", 2).template).toBeNull();
    const draft = validDraft();
    draft.docs = [
      ...draft.docs,
      { ...newDoc("deed", 2), key: "poa_nif", label: "Power of attorney for the NIF", template: "poa_nif" },
    ];
    const result = validateDraft(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.docs.map((d) => d.template)).toEqual([null, "poa_nif"]);
    expect(Object.keys(result.body.docs[0])).toContain("template");
  });

  it("refuses a deed it does not know", () => {
    const draft = validDraft();
    draft.docs = [...draft.docs, { ...newDoc("bad", 2), key: "poa_x", label: "X", template: "poa_x" as unknown as PoaTemplate }];
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors["docs.bad.template"]).toBe(messages.template);
  });

  it("converts megabytes to bytes and drops blank include lines", () => {
    const draft = validDraft();
    draft.includes = "One\n\n  Two  \n";
    draft.docs[0] = { ...draft.docs[0], max_mb: "2.5" };
    const result = validateDraft(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.includes).toEqual(["One", "Two"]);
    expect(result.body.docs[0].max_bytes).toBe(Math.round(2.5 * 1024 * 1024));
  });

  it("requires a label and key on a new deliverable", () => {
    const draft = validDraft();
    draft.deliverables = [...draft.deliverables, newDeliverable("new-del", 2)];
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors["deliverables.new-del.key"]).toBe(messages.required);
    expect(result.errors["deliverables.new-del.label"]).toBe(messages.required);
  });

  it("checks the Stripe field shapes only when filled", () => {
    const draft = { ...validDraft(), stripe_price_id_live: "prod_x", stripe_payment_link_test: "buy.stripe.com/x" };
    const result = validateDraft(draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.stripe_price_id_live).toBe(messages.priceId);
    expect(result.errors.stripe_payment_link_test).toBe(messages.paymentLink);
    expect(result.errors.stripe_price_id_test).toBeUndefined();
  });
});

describe("nextPosition", () => {
  it("continues after the highest position", () => {
    expect(nextPosition([{ position: "1" }, { position: "4" }], 1)).toBe(5);
    expect(nextPosition([], 1)).toBe(1);
    expect(nextPosition([], 0)).toBe(0);
    expect(nextPosition([{ position: "x" }], 0)).toBe(0);
  });
});
