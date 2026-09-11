import { describe, expect, it } from "vitest";

import { hrefWith, intParam, isUuid } from "./params";
import { isBareDate, resolveRange } from "./range";

const now = new Date("2026-09-11T10:30:00.000Z");

describe("resolveRange", () => {
  it("defaults to the last 30 days ending today", () => {
    expect(resolveRange({}, now)).toMatchObject({ key: "month", from: "2026-08-13", to: "2026-09-11" });
  });

  it("reads a preset", () => {
    expect(resolveRange({ range: "week" }, now)).toMatchObject({ key: "week", from: "2026-09-05", to: "2026-09-11" });
    expect(resolveRange({ range: "year" }, now)).toMatchObject({ key: "year", from: "2025-09-12" });
  });

  it("falls back to the default on an unknown preset", () => {
    expect(resolveRange({ range: "decade" }, now).key).toBe("month");
  });

  it("prefers a valid custom window over the preset", () => {
    expect(resolveRange({ range: "week", from: "2026-01-01", to: "2026-01-31" }, now)).toMatchObject({
      key: "custom",
      from: "2026-01-01",
      to: "2026-01-31",
    });
  });

  it("ignores a custom window that is reversed or half given", () => {
    expect(resolveRange({ from: "2026-02-01", to: "2026-01-01" }, now).key).toBe("month");
    expect(resolveRange({ from: "2026-02-01" }, now).key).toBe("month");
  });

  it("rejects dates that are not on the calendar", () => {
    expect(isBareDate("2026-02-31")).toBe(false);
    expect(isBareDate("2026-02-28")).toBe(true);
    expect(isBareDate("28/02/2026")).toBe(false);
  });
});

describe("params", () => {
  it("builds an href that keeps the other params", () => {
    expect(hrefWith("/admin/orders", { status: "paid", q: "a@b.c" }, { order: "x" })).toBe(
      "/admin/orders?status=paid&q=a%40b.c&order=x",
    );
    expect(hrefWith("/admin", { order: "x", range: ["week", "year"] }, { order: null })).toBe("/admin?range=week");
    expect(hrefWith("/admin", {}, { order: null })).toBe("/admin");
  });

  it("reads a page number defensively", () => {
    expect(intParam({ page: "3" }, "page", 1)).toBe(3);
    expect(intParam({ page: "0" }, "page", 1)).toBe(1);
    expect(intParam({ page: "-2" }, "page", 1)).toBe(1);
    expect(intParam({ page: "abc" }, "page", 1)).toBe(1);
  });

  it("recognises a uuid", () => {
    expect(isUuid("6f9619ff-8b86-d011-b42d-00c04fc964ff")).toBe(true);
    expect(isUuid("not-an-id")).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});
