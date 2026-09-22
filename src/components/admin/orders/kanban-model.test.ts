import { describe, expect, it } from "vitest";

import { KANBAN_LIMIT, capOrders, groupByStage, kanbanColumns, type ServiceStages } from "./kanban-model";

/**
 * The board's columns are the union of the stage keys across services, in
 * the order the catalogue reads them. These fixtures follow the seeded
 * services: NIF only ends on `nif_ready`, the bank service carries the
 * later keys, and the package runs the whole lifecycle.
 */

const NIF_ONLY: ServiceStages = {
  position: 1,
  stages: [
    { key: "awaiting_payment", label: "Awaiting payment", position: 1, is_terminal: false },
    { key: "documents", label: "Documents", position: 2, is_terminal: false },
    { key: "submitted", label: "Submitted", position: 3, is_terminal: false },
    { key: "nif_ready", label: "NIF ready", position: 4, is_terminal: true },
  ],
};

const BANK_ONLY: ServiceStages = {
  position: 2,
  stages: [
    { key: "awaiting_payment", label: "Awaiting payment", position: 1, is_terminal: false },
    { key: "documents", label: "Documents", position: 2, is_terminal: false },
    { key: "with_bank", label: "With the bank", position: 3, is_terminal: false },
    { key: "account_open", label: "Account open", position: 4, is_terminal: true },
  ],
};

const BUNDLE: ServiceStages = {
  position: 3,
  stages: [
    { key: "awaiting_payment", label: "Awaiting payment", position: 1, is_terminal: false },
    { key: "documents", label: "Documents", position: 2, is_terminal: false },
    { key: "submitted", label: "Submitted", position: 3, is_terminal: false },
    { key: "nif_ready", label: "NIF ready", position: 4, is_terminal: false },
    { key: "with_bank", label: "With the bank", position: 5, is_terminal: false },
    { key: "account_open", label: "Account open", position: 6, is_terminal: true },
  ],
};

describe("kanbanColumns", () => {
  it("reads the keys in service order, then stage order", () => {
    expect(kanbanColumns([NIF_ONLY, BANK_ONLY]).map((c) => c.key)).toEqual([
      "awaiting_payment",
      "documents",
      "submitted",
      "nif_ready",
      "with_bank",
      "account_open",
    ]);
  });

  it("sorts services by position whatever order they arrive in", () => {
    // NIF only sits at position 1, so its keys lead even when it is passed last.
    expect(kanbanColumns([BANK_ONLY, NIF_ONLY]).map((c) => c.key)).toEqual([
      "awaiting_payment",
      "documents",
      "submitted",
      "nif_ready",
      "with_bank",
      "account_open",
    ]);
  });

  it("keeps the first label for a key two services share", () => {
    const renamed: ServiceStages = {
      position: 2,
      stages: [{ key: "documents", label: "Papers", position: 1, is_terminal: false }],
    };
    const columns = kanbanColumns([NIF_ONLY, renamed]);
    expect(columns.filter((c) => c.key === "documents")).toHaveLength(1);
    expect(columns.find((c) => c.key === "documents")?.label).toBe("Documents");
  });

  it("marks a column terminal when any service ends on it", () => {
    const columns = kanbanColumns([BUNDLE, NIF_ONLY]);
    const terminal = columns.filter((c) => c.isTerminal).map((c) => c.key);
    // nif_ready is terminal for NIF only although the package passes through it.
    expect(terminal).toEqual(["nif_ready", "account_open"]);
  });

  it("marks every column as known and handles no services at all", () => {
    expect(kanbanColumns([NIF_ONLY].map((s) => s)).every((c) => c.known)).toBe(true);
    expect(kanbanColumns([])).toEqual([]);
  });
});

describe("groupByStage", () => {
  const columns = kanbanColumns([NIF_ONLY, BANK_ONLY]);

  it("keeps every column, empty ones included, in column order", () => {
    const groups = groupByStage(columns, [{ id: "a", stage_key: "documents" }]);
    expect(groups.map((g) => g.column.key)).toEqual(columns.map((c) => c.key));
    expect(groups.find((g) => g.column.key === "documents")?.rows).toHaveLength(1);
    expect(groups.find((g) => g.column.key === "submitted")?.rows).toEqual([]);
  });

  it("keeps the order the rows arrive in", () => {
    const rows = [
      { id: "a", stage_key: "documents" },
      { id: "b", stage_key: "documents" },
      { id: "c", stage_key: "documents" },
    ];
    const documents = groupByStage(columns, rows).find((g) => g.column.key === "documents");
    expect(documents?.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("gives a row on an unknown stage its own column at the end", () => {
    const groups = groupByStage(columns, [
      { id: "a", stage_key: "documents" },
      { id: "b", stage_key: "old_stage" },
      { id: "c", stage_key: "old_stage" },
    ]);
    const last = groups[groups.length - 1];
    expect(last.column).toMatchObject({ key: "old_stage", label: "old_stage", known: false, isTerminal: false });
    expect(last.rows).toHaveLength(2);
    expect(groups).toHaveLength(columns.length + 1);
  });

  it("returns empty columns for no rows at all", () => {
    const groups = groupByStage(columns, [] as { stage_key: string }[]);
    expect(groups).toHaveLength(columns.length);
    expect(groups.every((g) => g.rows.length === 0)).toBe(true);
  });
});

describe("capOrders", () => {
  const rows = (count: number) => Array.from({ length: count }, (_, i) => ({ id: String(i) }));

  it("hides nothing when everything fits", () => {
    expect(capOrders(rows(12), 12)).toEqual({ rows: rows(12), hidden: 0 });
  });

  it("counts what the query left behind", () => {
    const result = capOrders(rows(KANBAN_LIMIT), 320);
    expect(result.rows).toHaveLength(300);
    expect(result.hidden).toBe(20);
  });

  it("trims a list longer than the limit", () => {
    const result = capOrders(rows(5), 5, 3);
    expect(result.rows.map((r) => r.id)).toEqual(["0", "1", "2"]);
    expect(result.hidden).toBe(2);
  });

  it("never reports a negative count when the total lags behind the rows", () => {
    expect(capOrders(rows(4), 0).hidden).toBe(0);
  });

  it("caps at 300 by default", () => {
    expect(KANBAN_LIMIT).toBe(300);
    expect(capOrders(rows(301), 301).rows).toHaveLength(300);
  });
});
