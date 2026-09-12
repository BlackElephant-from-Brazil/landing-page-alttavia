import { describe, expect, it } from "vitest";

import { bucketByMonth, chartMonths, chartStart, monthKey } from "./overview-months";

const now = new Date("2026-09-11T10:30:00.000Z");

describe("chartMonths", () => {
  it("lists the last six months, oldest first, the current one included", () => {
    expect(chartMonths(now)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
  });

  it("crosses a year boundary", () => {
    expect(chartMonths(new Date("2026-02-15T00:00:00.000Z"))).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(chartStart(new Date("2026-02-15T00:00:00.000Z")).toISOString()).toBe("2025-09-01T00:00:00.000Z");
  });

  it("keys a month in UTC", () => {
    expect(monthKey(new Date("2026-09-30T23:30:00.000Z"))).toBe("2026-09");
    expect(monthKey(new Date("2026-10-01T00:00:00.000Z"))).toBe("2026-10");
  });
});

describe("bucketByMonth", () => {
  const months = chartMonths(now);

  it("zero fills every month with paid, open and revenue", () => {
    const buckets = bucketByMonth(months, [], []);
    expect(buckets).toHaveLength(6);
    for (const bucket of buckets) {
      expect(bucket).toMatchObject({ paid: 0, open: 0, revenueCents: 0 });
    }
    expect(buckets.map((b) => b.month)).toEqual(months);
  });

  it("counts paid orders and revenue by paid_at and open orders by created_at", () => {
    const buckets = bucketByMonth(
      months,
      [
        { paid_at: "2026-09-02T09:00:00.000Z", total_cents: 14900 },
        { paid_at: "2026-09-20T09:00:00.000Z", total_cents: 49700 },
        { paid_at: "2026-07-01T09:00:00.000Z", total_cents: 39900 },
        { paid_at: null, total_cents: 14900 },
      ],
      [{ created_at: "2026-09-05T09:00:00.000Z" }, { created_at: "2026-08-31T23:59:00.000Z" }],
    );

    expect(buckets.find((b) => b.month === "2026-09")).toEqual({ month: "2026-09", paid: 2, open: 1, revenueCents: 64600 });
    expect(buckets.find((b) => b.month === "2026-08")).toEqual({ month: "2026-08", paid: 0, open: 1, revenueCents: 0 });
    expect(buckets.find((b) => b.month === "2026-07")).toEqual({ month: "2026-07", paid: 1, open: 0, revenueCents: 39900 });
  });

  it("ignores rows outside the window", () => {
    const buckets = bucketByMonth(
      months,
      [{ paid_at: "2026-03-31T23:59:00.000Z", total_cents: 100 }],
      [{ created_at: "2025-12-01T00:00:00.000Z" }],
    );
    expect(buckets.every((b) => b.paid === 0 && b.open === 0 && b.revenueCents === 0)).toBe(true);
  });
});
