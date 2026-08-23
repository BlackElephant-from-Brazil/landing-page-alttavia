import { describe, expect, it } from "vitest";

import { PRICES, PRICE_CENTS, formatEuro } from "@/content/bank-nif";
import { COUNTRIES, isEea } from "./countries";
import { recommend } from "./recommend";
import type { Answers, Recommendation } from "./types";

/** A non EEA resident with a non EEA passport and a D7 in progress: the typical buyer. */
const base: Answers = {
  residence: "US",
  applicants: "one",
  hasNif: [false],
  bank: "yes",
  passport: ["US"],
  visa: "d7",
};

type Row = {
  name: string;
  answers: Partial<Answers>;
  expect: Partial<Extract<Recommendation, { kind: "product" }>> | { exit: string };
};

const MATRIX: Row[] = [
  // One person
  { name: "1 / no NIF / account", answers: {}, expect: { product: "bundle", quantity: 1, joint: false, totalCents: 49700 } },
  { name: "1 / no NIF / no account", answers: { bank: "none" }, expect: { product: "nif-only", quantity: 1, totalCents: 14900 } },
  { name: "1 / has NIF / account", answers: { hasNif: [true] }, expect: { product: "bank-only", quantity: 1, totalCents: 39900 } },
  { name: "1 / has NIF / no account", answers: { hasNif: [true], bank: "none" }, expect: { exit: "nothing-to-buy" } },

  // Two people
  { name: "2 / nobody / joint", answers: { applicants: "two", hasNif: [false, false], bank: "joint", passport: ["US", "US"] }, expect: { product: "couple", quantity: 1, joint: true, totalCents: 59700 } },
  { name: "2 / nobody / none", answers: { applicants: "two", hasNif: [false, false], bank: "none", passport: ["US", "US"] }, expect: { product: "nif-only", quantity: 2, totalCents: 29800 } },
  { name: "2 / both / joint", answers: { applicants: "two", hasNif: [true, true], bank: "joint", passport: ["US", "US"] }, expect: { product: "bank-only", quantity: 1, joint: true, totalCents: 39900 } },
  { name: "2 / you only / joint", answers: { applicants: "two", hasNif: [true, false], bank: "joint", passport: ["US", "US"] }, expect: { product: "bundle", quantity: 1, joint: true, totalCents: 49700 } },
  { name: "2 / partner only / joint", answers: { applicants: "two", hasNif: [false, true], bank: "joint", passport: ["US", "US"] }, expect: { product: "bundle", quantity: 1, joint: true } },
  { name: "2 / one / none", answers: { applicants: "two", hasNif: [true, false], bank: "none", passport: ["US", "US"] }, expect: { product: "nif-only", quantity: 1, totalCents: 14900 } },
  { name: "2 / both / none", answers: { applicants: "two", hasNif: [true, true], bank: "none", passport: ["US", "US"] }, expect: { exit: "nothing-to-buy" } },

  // Exits that short circuit
  { name: "lives in Portugal", answers: { residence: "PT" }, expect: { exit: "portugal" } },
  { name: "more than two adults", answers: { applicants: "more" }, expect: { exit: "too-many" } },
  { name: "two separate accounts", answers: { applicants: "two", bank: "separate" }, expect: { exit: "separate-accounts" } },

  // The bank's gates
  { name: "non EEA, no visa, wants account", answers: { visa: "none" }, expect: { product: "nif-only", quantity: 1 } },
  { name: "non EEA, no visa, has NIF, wants account", answers: { hasNif: [true], visa: "none" }, expect: { exit: "nothing-to-buy" } },
  { name: "2 / nobody / joint, non EEA, no visa", answers: { applicants: "two", hasNif: [false, false], bank: "joint", passport: ["US", "BR"], visa: "none" }, expect: { product: "nif-only", quantity: 2 } },
  { name: "EEA passport, no visa, wants account", answers: { passport: ["DE"], visa: "none" }, expect: { product: "bundle" } },
  { name: "EEA passport, visa unanswered (step skipped)", answers: { passport: ["DE"], visa: undefined }, expect: { product: "bundle" } },
];

describe("recommend: decision matrix", () => {
  for (const row of MATRIX) {
    it(row.name, () => {
      const rec = recommend({ ...base, ...row.answers });
      if ("exit" in row.expect) {
        expect(rec.kind).toBe("exit");
        if (rec.kind === "exit") expect(rec.exit).toBe(row.expect.exit);
        return;
      }
      expect(rec.kind).toBe("product");
      if (rec.kind !== "product") return;
      for (const [key, value] of Object.entries(row.expect)) {
        expect(rec[key as keyof typeof rec], key).toEqual(value);
      }
    });
  }
});

describe("recommend: valid alternatives and preselection", () => {
  it("lists the recommendation first, then the other coherent products", () => {
    const rec = recommend(base);
    expect(rec.kind === "product" && rec.valid).toEqual(["bundle", "nif-only"]);
  });

  it("never offers bank-only to someone without a NIF", () => {
    const rec = recommend({ ...base, preselected: "bank-only" });
    expect(rec.kind === "product" && rec.valid).not.toContain("bank-only");
    expect(rec.kind === "product" && rec.preselected).toBeUndefined();
  });

  it("never offers couple to a single applicant", () => {
    const rec = recommend({ ...base, preselected: "couple" });
    expect(rec.kind === "product" && rec.preselected).toBeUndefined();
  });

  it("keeps a valid preselection that differs from the recommendation", () => {
    const rec = recommend({ ...base, preselected: "nif-only" });
    expect(rec.kind === "product" && rec.preselected).toBe("nif-only");
  });

  it("drops the preselection when it equals the recommendation", () => {
    const rec = recommend({ ...base, preselected: "bundle" });
    expect(rec.kind === "product" && rec.preselected).toBeUndefined();
  });

  it("keeps bank products as alternatives when the bank is unlikely", () => {
    const rec = recommend({ ...base, visa: "none", preselected: "bundle" });
    expect(rec.kind === "product" && rec.product).toBe("nif-only");
    expect(rec.kind === "product" && rec.preselected).toBe("bundle");
  });
});

describe("recommend: notes", () => {
  it("flags tax representation as required for residents outside the EEA", () => {
    const rec = recommend(base);
    expect(rec.notes).toContain("taxRepRequired");
    expect(rec.notes).not.toContain("taxRepOptional");
  });

  it("flags tax representation as optional for EEA residents, read off residence not passport", () => {
    const rec = recommend({ ...base, residence: "DE", passport: ["US"] });
    expect(rec.notes).toContain("taxRepOptional");
  });

  it("adds no tax representation note to a bank-only order", () => {
    const rec = recommend({ ...base, hasNif: [true] });
    expect(rec.notes).not.toContain("taxRepRequired");
    expect(rec.notes).not.toContain("taxRepOptional");
  });

  it("carries the children flag, including into exits", () => {
    expect(recommend({ ...base, childrenNifs: true }).notes).toContain("childrenNifs");
    expect(recommend({ ...base, hasNif: [true], bank: "none", childrenNifs: true }).notes).toContain("childrenNifs");
  });

  it("explains why the bank was dropped", () => {
    expect(recommend({ ...base, visa: "none" }).notes).toContain("bankUnlikely");
    expect(recommend(base).notes).not.toContain("bankUnlikely");
  });
});

describe("recommend: reasons", () => {
  const reasonsOf = (a: Answers) => {
    const rec = recommend(a);
    return rec.kind === "product" ? rec.reasons : [];
  };

  it("sequenced only appears when both a NIF and an account are on the order", () => {
    expect(reasonsOf(base)).toContain("sequenced");
    expect(reasonsOf({ ...base, bank: "none" })).not.toContain("sequenced");
    expect(reasonsOf({ ...base, hasNif: [true] })).not.toContain("sequenced");
  });

  it("names the partner when only the partner needs a NIF", () => {
    const rec = recommend({ ...base, applicants: "two", hasNif: [true, false], bank: "joint", passport: ["US", "US"] });
    expect(rec.kind === "product" && rec.reasons).toContain("partnerNeedsNif");
  });
});

describe("prices and countries", () => {
  it("PRICE_CENTS matches the display prices", () => {
    expect(formatEuro(PRICE_CENTS.nifOnly)).toBe(PRICES.nifOnly);
    expect(formatEuro(PRICE_CENTS.bundle)).toBe(PRICES.bundle);
    expect(formatEuro(PRICE_CENTS.bankOnly)).toBe(PRICES.bankOnly);
    expect(formatEuro(PRICE_CENTS.couple)).toBe(PRICES.couple);
    expect(formatEuro(PRICE_CENTS.renewal)).toBe(PRICES.renewal);
    expect(formatEuro(PRICE_CENTS.strategyCredit)).toBe(PRICES.strategyCredit);
  });

  it("country list is sorted, unique and free of dashes", () => {
    const names = COUNTRIES.map((c) => c.name);
    expect([...names].sort((a, b) => a.localeCompare(b, "en"))).toEqual(names);
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    expect(names.some((n) => /[—–]/.test(n))).toBe(false);
  });

  it("EEA is the EU 27 plus Iceland, Liechtenstein and Norway", () => {
    expect(COUNTRIES.filter((c) => c.eea)).toHaveLength(30);
    expect(isEea("PT")).toBe(true);
    expect(isEea("NO")).toBe(true);
    expect(isEea("CH")).toBe(false);
    expect(isEea("GB")).toBe(false);
    expect(isEea(undefined)).toBe(false);
  });
});
