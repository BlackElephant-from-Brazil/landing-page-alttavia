import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceStageRow } from "@/lib/db/types";

/**
 * advanceStage against a fake admin client. No network: the admin client is
 * replaced with vi.mock before the module under test loads. The fake answers
 * reads from the `tables` fixture and records every update and insert in
 * `writes`, so each test asserts what would have reached the database. An
 * insert also lands in `tables`, so a later call reads the events an earlier
 * one wrote, as the first completion rule needs.
 */

const { tables, writes, hooks } = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  writes: [] as { table: string; op: "update" | "insert"; payload: Record<string, unknown>; filters: [string, unknown][] }[],
  /** Runs right before an update is applied, to simulate a concurrent write. */
  hooks: { beforeUpdate: null as (() => void) | null },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const filters: [string, unknown][] = [];
      let op: "select" | "update" = "select";
      let payload: Record<string, unknown> = {};
      let orderBy: string | null = null;
      let limit: number | null = null;

      const matching = () =>
        (tables[table] ?? []).filter((row) => filters.every(([column, value]) => row[column] === value));

      const run = () => {
        if (op === "update") {
          hooks.beforeUpdate?.();
          const rows = matching();
          for (const row of rows) Object.assign(row, payload);
          writes.push({ table, op: "update", payload, filters: [...filters] });
          return { data: rows.map((row) => ({ id: row.id })), error: null };
        }
        const rows = matching();
        if (orderBy) rows.sort((a, b) => (a[orderBy!] as number) - (b[orderBy!] as number));
        return { data: limit === null ? rows : rows.slice(0, limit), error: null };
      };

      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        order(column: string) {
          orderBy = column;
          return query;
        },
        limit(count: number) {
          limit = count;
          return query;
        },
        update(values: Record<string, unknown>) {
          op = "update";
          payload = values;
          return query;
        },
        insert(values: Record<string, unknown>) {
          writes.push({ table, op: "insert", payload: values, filters: [] });
          (tables[table] ??= []).push({ id: crypto.randomUUID(), ...values });
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          // A copy, as a database would answer: a later update must not
          // reach into what the caller already read.
          const rows = matching();
          return Promise.resolve({ data: rows[0] ? { ...rows[0] } : null, error: null });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  }),
}));

import { StageError, advanceStage } from "./lifecycle";

const SERVICE_ID = "44444444-4444-4444-8444-444444444444";
const ORDER_ID = "33333333-3333-4333-8333-333333333333";
const ACTOR_ID = "55555555-5555-4555-8555-555555555555";

function stage(key: string, position: number, is_terminal = false): ServiceStageRow {
  return { id: `stage-${position}`, service_id: SERVICE_ID, key, label: key, description: null, position, is_terminal };
}

/** nif-only's lifecycle, stored out of order to prove the sort. */
const STAGES = [
  stage("awaiting_financas", 3),
  stage("awaiting_payment", 1),
  stage("nif_ready", 4, true),
  stage("documents", 2),
];

const PAID_AT = "2026-09-10T09:00:00.000Z";

function seed(stageKey: string, completedAt: string | null = null, paidAt: string | null = PAID_AT) {
  tables.user_services = [
    { id: ORDER_ID, service_id: SERVICE_ID, stage_key: stageKey, completed_at: completedAt, paid_at: paidAt },
  ];
  tables.service_stages = STAGES.map((s) => ({ ...s }));
}

function order() {
  return tables.user_services[0];
}

function lastEvent() {
  return writes.filter((w) => w.op === "insert" && w.table === "user_service_events").at(-1)?.payload;
}

beforeEach(() => {
  writes.length = 0;
  hooks.beforeUpdate = null;
  for (const key of Object.keys(tables)) delete tables[key];
});

describe("advanceStage", () => {
  it("moves forward to the next position and records the event with the actor", async () => {
    seed("documents");

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" });

    expect(result).toEqual({ stageKey: "awaiting_financas", completed: false, firstCompletion: false });
    expect(order().stage_key).toBe("awaiting_financas");
    expect(order().completed_at).toBeNull();
    expect(lastEvent()).toEqual({
      user_service_id: ORDER_ID,
      from_stage: "documents",
      to_stage: "awaiting_financas",
      actor_id: ACTOR_ID,
    });
  });

  it("moves back to the previous position", async () => {
    seed("awaiting_financas");

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "back" });

    expect(result).toEqual({ stageKey: "documents", completed: false, firstCompletion: false });
    expect(order().stage_key).toBe("documents");
    expect(lastEvent()).toMatchObject({ from_stage: "awaiting_financas", to_stage: "documents" });
  });

  it("jumps to a named stage", async () => {
    seed("documents");

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { stageKey: "awaiting_financas" });

    expect(result).toEqual({ stageKey: "awaiting_financas", completed: false, firstCompletion: false });
    expect(lastEvent()).toMatchObject({ from_stage: "documents", to_stage: "awaiting_financas" });
  });

  it("sets completed_at when the terminal stage is reached", async () => {
    seed("awaiting_financas");

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" });

    expect(result).toEqual({ stageKey: "nif_ready", completed: true, firstCompletion: true });
    expect(typeof order().completed_at).toBe("string");
    expect(new Date(order().completed_at as string).getTime()).not.toBeNaN();
  });

  it("clears completed_at when moving back from the terminal stage", async () => {
    seed("nif_ready", "2026-09-11T10:00:00.000Z");

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "back" });

    expect(result).toEqual({ stageKey: "awaiting_financas", completed: false, firstCompletion: false });
    expect(order().completed_at).toBeNull();
    const update = writes.find((w) => w.op === "update");
    expect(update?.payload).toEqual({ stage_key: "awaiting_financas", completed_at: null });
  });

  it("keeps the original completed_at when jumping to the terminal stage again", async () => {
    seed("documents", "2026-09-01T10:00:00.000Z");

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { stageKey: "nif_ready" });

    expect(result.completed).toBe(true);
    expect(order().completed_at).toBe("2026-09-01T10:00:00.000Z");
  });

  it("rejects an unknown stage without writing", async () => {
    seed("documents");

    await expect(advanceStage(ORDER_ID, ACTOR_ID, { stageKey: "on_the_moon" })).rejects.toMatchObject({
      name: "StageError",
      code: "unknown_stage",
      status: 422,
    });
    expect(writes).toHaveLength(0);
    expect(order().stage_key).toBe("documents");
  });

  it("refuses to go forward from the last stage or back from the first", async () => {
    seed("nif_ready", "2026-09-11T10:00:00.000Z");
    await expect(advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).rejects.toBeInstanceOf(StageError);

    seed("awaiting_payment");
    await expect(advanceStage(ORDER_ID, ACTOR_ID, { direction: "back" })).rejects.toMatchObject({
      code: "no_previous_stage",
    });
    expect(writes).toHaveLength(0);
  });

  it("writes nothing when the named stage is the current one", async () => {
    seed("documents");

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { stageKey: "documents" });

    expect(result).toEqual({ stageKey: "documents", completed: false, firstCompletion: false });
    expect(writes).toHaveLength(0);
  });

  it("keeps an unpaid order on the first stage", async () => {
    seed("awaiting_payment", null, null);

    await expect(advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).rejects.toMatchObject({
      name: "StageError",
      code: "unpaid",
      status: 409,
      message: "Payment first.",
    });
    await expect(advanceStage(ORDER_ID, ACTOR_ID, { stageKey: "nif_ready" })).rejects.toMatchObject({ code: "unpaid" });
    expect(writes).toHaveLength(0);
    expect(order().stage_key).toBe("awaiting_payment");

    // Naming the first stage itself is still allowed: nothing to write.
    const result = await advanceStage(ORDER_ID, ACTOR_ID, { stageKey: "awaiting_payment" });
    expect(result).toEqual({ stageKey: "awaiting_payment", completed: false, firstCompletion: false });
    expect(writes).toHaveLength(0);
  });

  it("answers 404 for an unknown order", async () => {
    seed("documents");

    await expect(advanceStage("00000000-0000-4000-8000-000000000000", ACTOR_ID, { direction: "forward" })).rejects.toMatchObject({
      code: "order_not_found",
      status: 404,
    });
  });

  it("answers stale before it writes an event on a terminal move that lost the race", async () => {
    seed("awaiting_financas");
    hooks.beforeUpdate = () => {
      tables.user_services[0].stage_key = "documents";
    };

    await expect(advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).rejects.toMatchObject({ code: "stale" });
    expect(lastEvent()).toBeUndefined();
  });

  it("updates only when the stage is still the one it read", async () => {
    seed("documents");
    // Someone else moves the order between our read and our write.
    hooks.beforeUpdate = () => {
      tables.user_services[0].stage_key = "awaiting_financas";
    };

    await expect(advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).rejects.toMatchObject({ code: "stale" });
    expect(lastEvent()).toBeUndefined();
    expect(order().stage_key).toBe("awaiting_financas");
  });
});

describe("advanceStage firstCompletion", () => {
  function event(to_stage: string, from_stage: string | null, user_service_id = ORDER_ID) {
    return { id: crypto.randomUUID(), user_service_id, from_stage, to_stage, note: null, actor_id: ACTOR_ID };
  }

  it("is true only on the first arrival: back and forward again, or a jump, is not", async () => {
    seed("awaiting_financas");

    const first = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" });
    expect(first).toEqual({ stageKey: "nif_ready", completed: true, firstCompletion: true });

    const back = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "back" });
    expect(back.firstCompletion).toBe(false);

    const again = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" });
    expect(again).toEqual({ stageKey: "nif_ready", completed: true, firstCompletion: false });

    await advanceStage(ORDER_ID, ACTOR_ID, { stageKey: "documents" });
    const jump = await advanceStage(ORDER_ID, ACTOR_ID, { stageKey: "nif_ready" });
    expect(jump).toEqual({ stageKey: "nif_ready", completed: true, firstCompletion: false });
  });

  it("counts an earlier event that reached the terminal stage, a review on it included", async () => {
    seed("awaiting_financas");
    tables.user_service_events = [event("nif_ready", "awaiting_financas")];
    expect((await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).firstCompletion).toBe(false);

    seed("awaiting_financas");
    // A document reviewed while the order sat on the terminal stage: from and to are the same.
    tables.user_service_events = [event("nif_ready", "nif_ready")];
    expect((await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).firstCompletion).toBe(false);
  });

  it("ignores events of other stages and of other orders", async () => {
    seed("awaiting_financas");
    tables.user_service_events = [
      event("awaiting_payment", null),
      event("documents", "awaiting_payment"),
      event("awaiting_financas", "documents"),
      event("nif_ready", "awaiting_financas", "66666666-6666-4666-8666-666666666666"),
    ];

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" });

    expect(result.firstCompletion).toBe(true);
  });

  it("is false for a move that does not reach the terminal stage and for one that writes nothing", async () => {
    seed("documents");
    expect((await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).firstCompletion).toBe(false);

    seed("nif_ready", "2026-09-11T10:00:00.000Z");
    tables.user_service_events = [];
    const stay = await advanceStage(ORDER_ID, ACTOR_ID, { stageKey: "nif_ready" });
    expect(stay).toEqual({ stageKey: "nif_ready", completed: true, firstCompletion: false });
  });
});

/**
 * The documents stage holds the order until every required slot has an
 * approved file (docs/admin-contract.md section 4, 2026-09-22). The rule
 * itself is tested in src/components/admin/order/required-docs.test.ts;
 * these cover what advanceStage does with its answer.
 */
describe("advanceStage on the documents stage", () => {
  function requireDocument(key: string, status: string | null, required = true) {
    const id = `doc-${key}`;
    (tables.service_docs ??= []).push({
      id,
      service_id: SERVICE_ID,
      key,
      required,
      per_applicant: false,
      position: (tables.service_docs?.length ?? 0) + 1,
    });
    if (status) {
      (tables.user_documents ??= []).push({
        id: `file-${key}`,
        user_service_id: ORDER_ID,
        service_doc_id: id,
        applicant_index: 0,
        status,
        created_at: "2026-09-12T09:00:00.000Z",
      });
    }
  }

  it("refuses to move forward while a required document is not approved, and writes nothing", async () => {
    seed("documents");
    requireDocument("passport", "uploaded");

    await expect(advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).rejects.toMatchObject({
      name: "StageError",
      code: "documents_pending",
      status: 409,
      message: "Approve every required document before moving on.",
    });
    expect(writes).toHaveLength(0);
    expect(order().stage_key).toBe("documents");
  });

  it("refuses a jump to any later stage the same way", async () => {
    seed("documents");
    requireDocument("passport", null);

    await expect(advanceStage(ORDER_ID, ACTOR_ID, { stageKey: "nif_ready" })).rejects.toMatchObject({
      code: "documents_pending",
    });
    expect(writes).toHaveLength(0);
  });

  it("lets the order go back to an earlier stage", async () => {
    seed("documents");
    requireDocument("passport", "rejected");

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "back" });

    expect(result).toEqual({ stageKey: "awaiting_payment", completed: false, firstCompletion: false });
  });

  it("moves on once every required document is approved and ignores optional slots", async () => {
    seed("documents");
    requireDocument("passport", "approved");
    requireDocument("extra", "uploaded", false);

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" });

    expect(result).toEqual({ stageKey: "awaiting_financas", completed: false, firstCompletion: false });
  });

  it("counts a per applicant slot once per person on a couple order", async () => {
    seed("documents");
    tables.user_services[0].applicants = 2;
    (tables.service_docs ??= []).push({
      id: "doc-passport",
      service_id: SERVICE_ID,
      key: "passport",
      required: true,
      per_applicant: true,
      position: 1,
    });
    (tables.user_documents ??= []).push({
      id: "file-passport-0",
      user_service_id: ORDER_ID,
      service_doc_id: "doc-passport",
      applicant_index: 0,
      status: "approved",
      created_at: "2026-09-12T09:00:00.000Z",
    });

    await expect(advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).rejects.toMatchObject({
      code: "documents_pending",
    });

    (tables.user_documents ??= []).push({
      id: "file-passport-1",
      user_service_id: ORDER_ID,
      service_doc_id: "doc-passport",
      applicant_index: 1,
      status: "approved",
      created_at: "2026-09-12T10:00:00.000Z",
    });

    expect((await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).stageKey).toBe("awaiting_financas");
  });

  it("leaves another stage alone, whatever the documents say", async () => {
    seed("awaiting_financas");
    requireDocument("passport", "uploaded");

    const result = await advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" });

    expect(result).toEqual({ stageKey: "nif_ready", completed: true, firstCompletion: true });
  });

  it("ignores documents of another order", async () => {
    seed("documents");
    requireDocument("passport", null);
    (tables.user_documents ??= []).push({
      id: "file-other",
      user_service_id: "66666666-6666-4666-8666-666666666666",
      service_doc_id: "doc-passport",
      applicant_index: 0,
      status: "approved",
      created_at: "2026-09-12T09:00:00.000Z",
    });

    await expect(advanceStage(ORDER_ID, ACTOR_ID, { direction: "forward" })).rejects.toMatchObject({
      code: "documents_pending",
    });
  });
});
