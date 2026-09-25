import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * validateServiceInput is pure and tested as such. upsertService runs
 * against a fake database that knows enough PostgREST to reconcile child
 * rows: filters, count heads, insert, update, upsert on (service_id, key)
 * and delete. getServiceForAdmin (embedded selects the fake cannot do) is
 * mocked to read the fake tables back.
 */

type Row = Record<string, unknown>;

const { tables, log } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  /** Every write in order: "upsert service_stages [1001,1002]" and the like. */
  log: [] as string[],
}));

vi.mock("@/lib/db/admin-queries", () => ({
  getServiceForAdmin: async (_db: unknown, id: string) => {
    const service = (tables.services ?? []).find((s) => s.id === id);
    if (!service) return null;
    const children = (table: string) =>
      (tables[table] ?? []).filter((r) => r.service_id === id).sort((a, b) => (a.position as number) - (b.position as number));
    return {
      ...service,
      stages: children("service_stages"),
      docs: children("service_docs"),
      deliverables: children("service_deliverables"),
      orders_count: (tables.user_services ?? []).filter((o) => o.service_id === id).length,
    };
  },
}));

function fakeDb() {
  return {
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = [];
      let op: "select" | "update" | "insert" | "upsert" | "delete" = "select";
      let payload: Row | Row[] = {};
      let conflict: string[] = [];
      let head = false;
      const rows = () => (tables[table] ??= []);
      const matching = () => rows().filter((row) => filters.every((f) => f(row)));
      const run = () => {
        if (op === "select") {
          const hit = matching();
          return { data: head ? null : hit.map((r) => ({ ...r })), count: hit.length, error: null };
        }
        if (op === "update") {
          const hit = matching();
          for (const row of hit) Object.assign(row, payload as Row);
          log.push(`update ${table} ${JSON.stringify(payload)}`);
          return { data: hit.map((r) => ({ ...r })), error: null };
        }
        if (op === "insert") {
          const row: Row = { id: crypto.randomUUID(), ...(payload as Row) };
          rows().push(row);
          log.push(`insert ${table} ${row.slug ?? row.key ?? ""}`);
          return { data: [{ ...row }], error: null };
        }
        if (op === "upsert") {
          const list = Array.isArray(payload) ? payload : [payload];
          for (const incoming of list) {
            const existing = rows().find((r) => conflict.every((c) => r[c] === incoming[c]));
            if (existing) Object.assign(existing, incoming);
            else rows().push({ id: crypto.randomUUID(), ...incoming });
          }
          log.push(`upsert ${table} ${JSON.stringify(list.map((r) => [r.key, r.position]))}`);
          return { data: null, error: null };
        }
        const hit = matching();
        tables[table] = rows().filter((r) => !hit.includes(r));
        log.push(`delete ${table} ${hit.map((r) => r.key).join(",")}`);
        return { data: null, error: null };
      };
      const query = {
        select(_columns?: string, options?: { head?: boolean }) {
          head = Boolean(options?.head);
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push((row) => row[column] === value);
          return query;
        },
        in(column: string, values: unknown[]) {
          filters.push((row) => values.includes(row[column]));
          return query;
        },
        update(values: Row) {
          op = "update";
          payload = values;
          return query;
        },
        insert(values: Row) {
          op = "insert";
          payload = values;
          return query;
        },
        upsert(values: Row | Row[], options: { onConflict: string }) {
          op = "upsert";
          payload = values;
          conflict = options.onConflict.split(",");
          return query;
        },
        delete() {
          op = "delete";
          return query;
        },
        maybeSingle() {
          const r = run();
          return Promise.resolve({ data: r.data?.[0] ?? null, error: null });
        },
        single() {
          const r = run();
          return Promise.resolve(
            r.data?.[0] ? { data: r.data[0], error: null } : { data: null, error: { message: "no rows" } },
          );
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

import type { Db } from "@/lib/db/queries";

import { LIMITS, ServiceError, upsertService, validateServiceInput, type ServiceInput } from "./services-admin";

const SERVICE_ID = "44444444-4444-4444-8444-444444444444";

function stage(key: string, position: number, is_terminal = false) {
  return { key, label: key.replace(/_/g, " "), description: null, position, is_terminal };
}

/** A valid nif-only, as the editor would post it. */
function input(overrides: Partial<Record<keyof ServiceInput, unknown>> = {}): Record<string, unknown> {
  return {
    slug: "nif-only",
    name: "NIF only",
    tagline: "Your Portuguese tax number, remotely.",
    description: null,
    price_cents: 14900,
    currency: "EUR",
    includes: ["Fiscal representation for one year", "NIF certificate in PDF"],
    timeline: "3 to 5 business days",
    stripe_price_id_test: "price_test_123",
    stripe_price_id_live: null,
    stripe_payment_link_test: "https://buy.stripe.com/test_abc",
    stripe_payment_link_live: "",
    position: 1,
    active: true,
    stages: [stage("awaiting_payment", 1), stage("documents", 2), stage("awaiting_financas", 3), stage("nif_ready", 4, true)],
    docs: [
      { key: "passport", label: "Passport", accepted_mime: ["application/pdf", "image/jpeg"], max_bytes: 10485760 },
      { key: "proof_of_address", label: "Proof of address", note: "Under 3 months old.", per_applicant: false },
    ],
    deliverables: [
      { key: "nif_certificate", label: "NIF certificate", kind: "document" },
      { key: "summary", label: "Summary", kind: "report" },
    ],
    ...overrides,
  };
}

function errorOf(body: unknown): string {
  const result = validateServiceInput(body);
  if (result.ok) throw new Error("expected the input to be refused");
  return result.error;
}

describe("validateServiceInput", () => {
  it("accepts the editor's form and normalises it", () => {
    const result = validateServiceInput(input());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.currency).toBe("eur");
    expect(result.value.stripe_payment_link_live).toBeNull();
    expect(result.value.stages.map((s) => s.key)).toEqual(["awaiting_payment", "documents", "awaiting_financas", "nif_ready"]);
    expect(result.value.docs[1]).toMatchObject({
      note: "Under 3 months old.",
      accepted_mime: ["application/pdf", "image/jpeg", "image/png"],
      max_bytes: 10485760,
      per_applicant: false,
      required: true,
      position: 1,
      template: null,
    });
    expect(result.value.deliverables.map((d) => d.position)).toEqual([0, 1]);
  });

  it("accepts a deed or the signed agreement on a document, reads null or absent as none, and refuses anything else", () => {
    const withDeed = validateServiceInput(
      input({
        docs: [
          { key: "poa_nif", label: "Power of attorney for the NIF", template: "poa_nif" },
          { key: "poa_bank", label: "Power of attorney for the bank account", template: "poa_bank" },
          { key: "passport", label: "Passport", template: null },
          // 0013 adds this slot to every wizard service; saving them must send it back unchanged.
          { key: "signed_agreement", label: "Signed service agreement", template: "agreement" },
        ],
      }),
    );
    expect(withDeed.ok && withDeed.value.docs.map((d) => d.template)).toEqual(["poa_nif", "poa_bank", null, "agreement"]);
    const absent = validateServiceInput(input());
    expect(absent.ok && absent.value.docs.every((d) => d.template === null)).toBe(true);
    expect(errorOf(input({ docs: [{ key: "x", label: "X", template: "poa_x" }] }))).toBe("Choose a document to sign or none.");
    expect(errorOf(input({ docs: [{ key: "x", label: "X", template: "" }] }))).toBe("Choose a document to sign or none.");
    expect(errorOf(input({ docs: [{ key: "x", label: "X", template: 1 }] }))).toBe("Choose a document to sign or none.");
  });

  it("refuses a signed agreement slot on a service whose contract is none, and only when the body names the contract", () => {
    const agreementSlot = { key: "signed_agreement", label: "Signed service agreement", template: "agreement" };
    const docs = [{ key: "passport", label: "Passport" }, agreementSlot];

    expect(errorOf(input({ docs, contract_template: null }))).toBe(
      "Choose a service contract, or remove the signed service agreement from the documents.",
    );
    expect(validateServiceInput(input({ docs, contract_template: "nif" })).ok).toBe(true);
    // No agreement slot: no contract is fine.
    expect(validateServiceInput(input({ contract_template: null })).ok).toBe(true);
    // Without the key the stored contract decides, in upsertService.
    expect(validateServiceInput(input({ docs })).ok).toBe(true);
  });

  it("accepts one of the four contract models, reads null as none, and refuses anything else", () => {
    for (const model of ["nif", "bank", "package", "couple"] as const) {
      const result = validateServiceInput(input({ contract_template: model }));
      expect(result.ok && result.value.contract_template).toBe(model);
    }
    const none = validateServiceInput(input({ contract_template: null }));
    expect(none.ok && none.value.contract_template).toBeNull();
    expect(none.ok && "contract_template" in none.value).toBe(true);

    expect(errorOf(input({ contract_template: "pair" }))).toBe("Choose a contract or none.");
    expect(errorOf(input({ contract_template: "" }))).toBe("Choose a contract or none.");
    expect(errorOf(input({ contract_template: "NIF" }))).toBe("Choose a contract or none.");
    expect(errorOf(input({ contract_template: 1 }))).toBe("Choose a contract or none.");
    expect(errorOf(input({ contract_template: ["nif"] }))).toBe("Choose a contract or none.");
  });

  it("keeps an absent contract apart from an explicit null: the key is left out, not set to null", () => {
    const absent = validateServiceInput(input());
    expect(absent.ok).toBe(true);
    expect(absent.ok && "contract_template" in absent.value).toBe(false);

    // What JSON cannot carry reads as absent too.
    const undefinedValue = validateServiceInput(input({ contract_template: undefined }));
    expect(undefinedValue.ok && "contract_template" in undefinedValue.value).toBe(false);

    // Every other key of the input is still there, so nothing else changed shape.
    const explicit = validateServiceInput(input({ contract_template: null }));
    if (!absent.ok || !explicit.ok) throw new Error("expected both to pass");
    expect(Object.keys(explicit.value).filter((k) => k !== "contract_template")).toEqual(Object.keys(absent.value));
  });

  it("reports a wrong contract where the form shows it: after the timeline, before the Stripe fields", () => {
    expect(errorOf(input({ timeline: "x".repeat(121), contract_template: "pair" }))).toContain("Timeline");
    expect(errorOf(input({ contract_template: "pair", stripe_price_id_live: "prod_123" }))).toBe(
      "Choose a contract or none.",
    );
  });

  it("sorts stages by position whatever order they arrive in", () => {
    const shuffled = input({ stages: [stage("nif_ready", 3, true), stage("awaiting_payment", 1), stage("documents", 2)] });
    const result = validateServiceInput(shuffled);
    expect(result.ok && result.value.stages.map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it("refuses anything that is not an object", () => {
    expect(errorOf(null)).toContain("object");
    expect(errorOf([])).toContain("object");
  });

  it("checks the slug shape and length", () => {
    expect(errorOf(input({ slug: "NIF Only" }))).toContain("Slug");
    expect(errorOf(input({ slug: "-nif" }))).toContain("Slug");
    expect(errorOf(input({ slug: "ab" }))).toContain("3 to 40");
    expect(errorOf(input({ slug: "a".repeat(LIMITS.slug.max + 1) }))).toContain("3 to 40");
  });

  it("checks name, price and currency", () => {
    expect(errorOf(input({ name: "NI" }))).toContain("Name");
    expect(errorOf(input({ price_cents: 0 }))).toContain("Price");
    expect(errorOf(input({ price_cents: 149.5 }))).toContain("whole number");
    expect(errorOf(input({ currency: "euro" }))).toContain("Currency");
  });

  it("limits includes to 12 items of 120 characters", () => {
    expect(errorOf(input({ includes: Array(13).fill("x") }))).toContain("at most 12");
    expect(errorOf(input({ includes: ["y".repeat(121)] }))).toContain("Includes item 1");
    expect(errorOf(input({ includes: ["", "ok"] }))).toContain("Includes item 1");
  });

  it("requires the first stage to be awaiting_payment and one terminal stage last", () => {
    expect(errorOf(input({ stages: [stage("awaiting_payment", 1, true)] }))).toContain("at least two");
    expect(errorOf(input({ stages: [stage("documents", 1), stage("done", 2, true)] }))).toContain("awaiting_payment");
    expect(errorOf(input({ stages: [stage("awaiting_payment", 1), stage("done", 2)] }))).toContain("Exactly one");
    expect(errorOf(input({ stages: [stage("awaiting_payment", 1, true), stage("done", 2, true)] }))).toContain("Exactly one");
    expect(errorOf(input({ stages: [stage("awaiting_payment", 1), stage("done", 2, true), stage("after", 3)] }))).toContain(
      "last one",
    );
  });

  it("requires contiguous positions from 1 and unique lower snake keys", () => {
    expect(errorOf(input({ stages: [stage("awaiting_payment", 1), stage("done", 3, true)] }))).toContain("no gaps");
    expect(errorOf(input({ stages: [stage("awaiting_payment", 1), stage("done", 1, true)] }))).toContain("no gaps");
    expect(errorOf(input({ stages: [stage("awaiting_payment", 1), stage("awaiting_payment", 2, true)] }))).toContain(
      "unique",
    );
    expect(errorOf(input({ stages: [stage("awaiting_payment", 1), stage("Done-Now", 2, true)] }))).toContain("lower case");
  });

  it("checks documents: keys, file types and sizes", () => {
    expect(errorOf(input({ docs: [{ key: "passport", label: "A" }, { key: "passport", label: "B" }] }))).toContain("unique");
    expect(errorOf(input({ docs: [{ key: "passport", label: "A", accepted_mime: ["text/plain"] }] }))).toContain("file type");
    expect(errorOf(input({ docs: [{ key: "passport", label: "A", accepted_mime: [] }] }))).toContain("at least one");
    expect(errorOf(input({ docs: [{ key: "passport", label: "A", max_bytes: LIMITS.docMaxBytes + 1 }] }))).toContain(
      "size limit",
    );
    expect(errorOf(input({ docs: [{ key: "passport", label: "" }] }))).toContain("label");
  });

  it("checks deliverables: kind and keys", () => {
    expect(errorOf(input({ deliverables: [{ key: "x", label: "X", kind: "video" }] }))).toContain("kind");
    expect(errorOf(input({ deliverables: [{ key: "x", label: "X", kind: "report" }, { key: "x", label: "Y", kind: "report" }] }))).toContain(
      "unique",
    );
  });

  it("checks the Stripe fields' prefixes and accepts empty ones", () => {
    expect(errorOf(input({ stripe_price_id_live: "prod_123" }))).toContain("price_");
    expect(errorOf(input({ stripe_payment_link_live: "http://buy.stripe.com/x" }))).toContain("https://");
    const ok = validateServiceInput(input({ stripe_price_id_test: "", stripe_payment_link_test: null }));
    expect(ok.ok && ok.value.stripe_price_id_test).toBeNull();
  });

  it("defaults the flags a form may leave out", () => {
    const result = validateServiceInput(input({ active: undefined, position: undefined }));
    expect(result.ok && result.value).toMatchObject({ active: true, position: 0 });
  });
});

describe("upsertService", () => {
  const db = fakeDb() as unknown as Db;

  function valid(overrides: Partial<Record<keyof ServiceInput, unknown>> = {}): ServiceInput {
    const result = validateServiceInput(input(overrides));
    if (!result.ok) throw new Error(result.error);
    return result.value;
  }

  /** nif-only as the seed left it, so an update has something to reconcile. */
  function seedExisting() {
    tables.services = [{ id: SERVICE_ID, slug: "nif-only", name: "NIF only", price_cents: 14900 }];
    tables.service_stages = [
      { id: "st1", service_id: SERVICE_ID, key: "awaiting_payment", label: "Awaiting payment", position: 1, is_terminal: false },
      { id: "st2", service_id: SERVICE_ID, key: "documents", label: "Documents", position: 2, is_terminal: false },
      { id: "st3", service_id: SERVICE_ID, key: "awaiting_financas", label: "With Finanças", position: 3, is_terminal: false },
      { id: "st4", service_id: SERVICE_ID, key: "nif_ready", label: "NIF ready", position: 4, is_terminal: true },
    ];
    tables.service_docs = [
      { id: "d1", service_id: SERVICE_ID, key: "passport", label: "Passport", position: 0 },
      { id: "d2", service_id: SERVICE_ID, key: "proof_of_address", label: "Proof of address", position: 1 },
    ];
    tables.service_deliverables = [
      { id: "dl1", service_id: SERVICE_ID, key: "nif_certificate", label: "NIF certificate", kind: "document", position: 0 },
      { id: "dl2", service_id: SERVICE_ID, key: "summary", label: "Summary", kind: "report", position: 1 },
    ];
    tables.user_services = [];
    tables.user_documents = [];
    tables.user_service_deliverables = [];
  }

  beforeEach(() => {
    log.length = 0;
    for (const key of Object.keys(tables)) delete tables[key];
    tables.services = [];
    tables.service_stages = [];
    tables.service_docs = [];
    tables.service_deliverables = [];
    tables.user_services = [];
    tables.user_documents = [];
    tables.user_service_deliverables = [];
  });

  it("creates a service with its stages, documents and deliverables", async () => {
    const saved = await upsertService(db, valid());

    expect(saved.slug).toBe("nif-only");
    expect(saved.stages.map((s) => [s.key, s.position])).toEqual([
      ["awaiting_payment", 1],
      ["documents", 2],
      ["awaiting_financas", 3],
      ["nif_ready", 4],
    ]);
    expect(saved.docs.map((d) => d.key)).toEqual(["passport", "proof_of_address"]);
    expect(saved.deliverables.map((d) => d.kind)).toEqual(["document", "report"]);
    expect(tables.service_stages.every((s) => s.service_id === saved.id)).toBe(true);
    // A creation never parks positions: one upsert per child table.
    expect(log.filter((l) => l.startsWith("upsert service_stages"))).toHaveLength(1);
    expect(log.some((l) => l.startsWith("delete"))).toBe(false);
  });

  it("refuses a slug another service already uses, before writing", async () => {
    tables.services = [{ id: "other", slug: "nif-only", name: "Old" }];

    await expect(upsertService(db, valid())).rejects.toMatchObject({ name: "ServiceError", code: "slug_taken", status: 409 });
    expect(log).toHaveLength(0);
  });

  it("updates in place, reorders stages by parking them first and deletes what is gone", async () => {
    seedExisting();
    const reordered = valid({
      name: "NIF only, renamed",
      stages: [stage("awaiting_payment", 1), stage("awaiting_financas", 2), stage("documents", 3), stage("nif_ready", 4, true)],
      docs: [{ key: "passport", label: "Passport" }],
      deliverables: [{ key: "summary", label: "Summary", kind: "report" }],
    });

    const saved = await upsertService(db, reordered, SERVICE_ID);

    expect(saved.id).toBe(SERVICE_ID);
    expect(saved.name).toBe("NIF only, renamed");
    expect(saved.stages.map((s) => [s.key, s.position])).toEqual([
      ["awaiting_payment", 1],
      ["awaiting_financas", 2],
      ["documents", 3],
      ["nif_ready", 4],
    ]);
    expect(tables.service_stages.find((s) => s.key === "documents")?.id).toBe("st2");
    expect(saved.docs.map((d) => d.key)).toEqual(["passport"]);
    expect(saved.deliverables.map((d) => d.key)).toEqual(["summary"]);

    const stageWrites = log.filter((l) => l.includes("service_stages"));
    expect(stageWrites[0]).toContain("1000");
    expect(stageWrites[stageWrites.length - 1]).toContain('["nif_ready",4]');
    expect(log).toContain("delete service_docs proof_of_address");
    expect(log).toContain("delete service_deliverables nif_certificate");
  });

  it("deletes a removed stage nobody sits on and adds a new one", async () => {
    seedExisting();
    const changed = valid({
      stages: [stage("awaiting_payment", 1), stage("documents", 2), stage("with_notary", 3), stage("nif_ready", 4, true)],
    });

    const saved = await upsertService(db, changed, SERVICE_ID);

    expect(saved.stages.map((s) => s.key)).toEqual(["awaiting_payment", "documents", "with_notary", "nif_ready"]);
    expect(log).toContain("delete service_stages awaiting_financas");
  });

  it("writes the generated deed of every document slot, none as null", async () => {
    seedExisting();
    const changed = valid({
      docs: [
        { key: "passport", label: "Passport" },
        { key: "proof_of_address", label: "Proof of address", per_applicant: false },
        { key: "poa_nif", label: "Power of attorney for the NIF", template: "poa_nif" },
      ],
    });

    const saved = await upsertService(db, changed, SERVICE_ID);

    expect(saved.docs.map((d) => [d.key, d.template])).toEqual([
      ["passport", null],
      ["proof_of_address", null],
      ["poa_nif", "poa_nif"],
    ]);
    // The saved rows carry the column explicitly, so a later save cannot leave a seeded value behind by omission.
    expect(tables.service_docs.every((d) => "template" in d)).toBe(true);
  });

  it("writes the contract model on insert and on update, even on an application form service", async () => {
    const created = await upsertService(db, valid({ slug: "niss-only", contract_template: "package" }));
    expect(created.contract_template).toBe("package");
    expect(tables.services.find((s) => s.id === created.id)?.contract_template).toBe("package");

    seedExisting();
    tables.services[0].contract_template = "nif";

    // nif-only keeps its slug and price locked; the contract is not part of that lock.
    const changed = await upsertService(db, valid({ contract_template: "bank" }), SERVICE_ID);
    expect(changed.contract_template).toBe("bank");
  });

  it("leaves the contract alone when the save does not name it, and clears it only on an explicit null", async () => {
    seedExisting();
    tables.services[0].contract_template = "nif";

    // A caller that predates the field, or a script that only renames: the agreement stays on.
    const untouched = await upsertService(db, valid({ name: "NIF only, renamed" }), SERVICE_ID);
    expect(untouched.name).toBe("NIF only, renamed");
    expect(untouched.contract_template).toBe("nif");
    const silent = log.filter((l) => l.startsWith("update services")).pop() ?? "";
    expect(silent).not.toContain("contract_template");

    const cleared = await upsertService(db, valid({ contract_template: null }), SERVICE_ID);
    expect(cleared.contract_template).toBeNull();
    const explicit = log.filter((l) => l.startsWith("update services")).pop() ?? "";
    expect(explicit).toContain('"contract_template":null');
  });

  it("refuses a signed agreement slot the stored contract cannot serve, before writing", async () => {
    const agreementDocs = [
      { key: "passport", label: "Passport" },
      { key: "proof_of_address", label: "Proof of address", per_applicant: false },
      { key: "signed_agreement", label: "Signed service agreement", template: "agreement" },
    ];

    // A body that leaves the contract out, on a service stored with none.
    seedExisting();
    tables.services[0].contract_template = null;
    await expect(upsertService(db, valid({ docs: agreementDocs }), SERVICE_ID)).rejects.toMatchObject({
      name: "ServiceError",
      code: "agreement_without_contract",
      status: 422,
      message: "Choose a service contract, or remove the signed service agreement from the documents.",
    });
    expect(log).toHaveLength(0);

    // A new service with the slot and no contract.
    await expect(upsertService(db, valid({ slug: "niss-only", docs: agreementDocs }))).rejects.toMatchObject({
      code: "agreement_without_contract",
      status: 422,
    });
    expect(log).toHaveLength(0);

    // The stored contract serves it when the body is silent.
    tables.services[0].contract_template = "nif";
    const saved = await upsertService(db, valid({ docs: agreementDocs }), SERVICE_ID);
    expect(saved.contract_template).toBe("nif");
    expect(saved.docs.map((d) => d.template)).toContain("agreement");
  });

  it("stores null for a new service whose form did not name a contract", async () => {
    const created = await upsertService(db, valid({ slug: "niss-only" }));

    const stored = tables.services.find((s) => s.id === created.id);
    expect(stored && "contract_template" in stored).toBe(true);
    expect(stored?.contract_template).toBeNull();
  });

  it("refuses to remove a stage an order still sits on, with the count, before writing", async () => {
    seedExisting();
    tables.user_services = [
      { id: "o1", service_id: SERVICE_ID, stage_key: "awaiting_financas" },
      { id: "o2", service_id: SERVICE_ID, stage_key: "awaiting_financas" },
      { id: "o3", service_id: "another-service", stage_key: "awaiting_financas" },
    ];
    const without = valid({ stages: [stage("awaiting_payment", 1), stage("documents", 2), stage("nif_ready", 3, true)] });

    const error = await upsertService(db, without, SERVICE_ID).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceError);
    expect(error).toMatchObject({ code: "stage_in_use", status: 409, count: 2 });
    expect((error as ServiceError).message).toBe("2 orders still sit on a stage you removed. Move them first.");
    expect(log).toHaveLength(0);
    expect(tables.service_stages).toHaveLength(4);
  });

  it("refuses to remove a document slot a client has uploaded to", async () => {
    seedExisting();
    tables.user_documents = [{ id: "u1", service_doc_id: "d2" }];

    await expect(upsertService(db, valid({ docs: [{ key: "passport", label: "Passport" }] }), SERVICE_ID)).rejects.toMatchObject({
      code: "doc_in_use",
      status: 409,
      count: 1,
    });
    expect(log).toHaveLength(0);
  });

  it("refuses to remove a deliverable a file has been returned under", async () => {
    seedExisting();
    tables.user_service_deliverables = [{ id: "f1", service_deliverable_id: "dl1" }];

    await expect(
      upsertService(db, valid({ deliverables: [{ key: "summary", label: "Summary", kind: "report" }] }), SERVICE_ID),
    ).rejects.toMatchObject({ code: "deliverable_in_use", status: 409 });
    expect(log).toHaveLength(0);
  });

  it("keeps the slug and the price of an application form service in code", async () => {
    seedExisting();

    await expect(upsertService(db, valid({ slug: "nif-solo" }), SERVICE_ID)).rejects.toMatchObject({
      code: "slug_locked",
      status: 409,
      message: "This slug is used by the application form and cannot change.",
    });
    await expect(upsertService(db, valid({ price_cents: 15900 }), SERVICE_ID)).rejects.toMatchObject({
      code: "price_locked",
      status: 409,
      message: "Prices of the four application form services change in code, not here.",
    });
    expect(log).toHaveLength(0);

    // The same slug and price with any other change still saves.
    const saved = await upsertService(db, valid({ name: "NIF only, renamed" }), SERVICE_ID);
    expect(saved.name).toBe("NIF only, renamed");
  });

  it("lets a service outside the application form change its slug and price", async () => {
    seedExisting();
    tables.services = [{ id: SERVICE_ID, slug: "niss-only", name: "NISS only", price_cents: 9900 }];

    const saved = await upsertService(db, valid({ slug: "niss", price_cents: 12900 }), SERVICE_ID);
    expect(saved.slug).toBe("niss");
    expect(saved.price_cents).toBe(12900);
  });

  it("answers 404 when updating an unknown service", async () => {
    await expect(upsertService(db, valid(), SERVICE_ID)).rejects.toMatchObject({ code: "service_not_found", status: 404 });
  });
});
