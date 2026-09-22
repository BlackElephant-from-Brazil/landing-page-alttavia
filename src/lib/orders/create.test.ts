import { describe, expect, it } from "vitest";

import { normalizeSlug, orderShapeFor } from "./create";

/** The pure half of createOrder: what a slug may be, and what one unit is. */

describe("normalizeSlug", () => {
  it("accepts a catalogue slug, trimmed and lower cased", () => {
    expect(normalizeSlug("  Bank-Only ")).toBe("bank-only");
    expect(normalizeSlug("nif-only")).toBe("nif-only");
  });

  it("refuses anything that is not a slug", () => {
    for (const raw of ["", "   ", "nif only", "nif_only", "-nif", "nif-", "NIF--ONLY", 7, null, undefined, {}]) {
      expect(normalizeSlug(raw)).toBeNull();
    }
  });

  it("refuses a slug longer than the column allows", () => {
    expect(normalizeSlug("a".repeat(64))).toBe("a".repeat(64));
    expect(normalizeSlug("a".repeat(65))).toBeNull();
  });
});

describe("orderShapeFor", () => {
  it("sells one unit for one person", () => {
    expect(orderShapeFor({ slug: "nif-only", price_cents: 14900, currency: "eur" })).toEqual({
      joint: false,
      applicants: 1,
      totalCents: 14900,
      currency: "eur",
    });
  });

  it("makes the couple package one order for two people", () => {
    expect(orderShapeFor({ slug: "couple", price_cents: 59700, currency: "eur" })).toEqual({
      joint: true,
      applicants: 2,
      totalCents: 59700,
      currency: "eur",
    });
  });

  it("falls back to euros when the row carries no currency", () => {
    expect(orderShapeFor({ slug: "bundle", price_cents: 49700, currency: "" }).currency).toBe("eur");
  });
});
