import { describe, expect, it } from "vitest";

import { checkoutReference, checkoutUrl } from "@/content/apply";
import { CHECKOUT_LINKS, PRICE_CENTS } from "@/content/bank-nif";
import { recommend } from "./recommend";
import type { Answers } from "./types";

const base: Answers = {
  residence: "US",
  applicants: "one",
  hasNif: [false],
  bank: "yes",
  passport: ["US"],
  visa: "d7",
};

function product(a: Answers) {
  const rec = recommend(a);
  if (rec.kind !== "product") throw new Error("expected a product recommendation");
  return rec;
}

/**
 * The link for each product was read off the live Stripe checkout page on
 * 2026-08-28. Sending a buyer to the wrong one charges the wrong amount, so
 * the pairing is pinned here rather than trusted to review.
 */
describe("payment link routing", () => {
  const cases: [Answers, keyof typeof CHECKOUT_LINKS, number][] = [
    [base, "bundle", PRICE_CENTS.bundle],
    [{ ...base, bank: "none" }, "nifOnly", PRICE_CENTS.nifOnly],
    [{ ...base, hasNif: [true] }, "bankOnly", PRICE_CENTS.bankOnly],
    [
      { ...base, applicants: "two", hasNif: [false, false], bank: "joint", passport: ["US", "US"] },
      "couple",
      PRICE_CENTS.couple,
    ],
  ];

  for (const [answers, link, cents] of cases) {
    it(`sends a ${cents / 100} euro order to the ${link} link`, () => {
      const rec = product(answers);
      expect(rec.totalCents).toBe(cents);
      const url = checkoutUrl(rec, answers);
      expect(url).not.toBeNull();
      expect(url!.startsWith(CHECKOUT_LINKS[link])).toBe(true);
    });
  }

  it("has a distinct link per product", () => {
    const links = Object.values(CHECKOUT_LINKS);
    expect(new Set(links).size).toBe(links.length);
  });

  it("points every link at Stripe over https", () => {
    for (const link of Object.values(CHECKOUT_LINKS)) {
      expect(link.startsWith("https://buy.stripe.com/")).toBe(true);
    }
  });

  it("has no link for two NIFs on one order, so the screen falls back to WhatsApp", () => {
    const answers: Answers = {
      ...base,
      applicants: "two",
      hasNif: [false, false],
      bank: "none",
      passport: ["US", "US"],
    };
    const rec = product(answers);
    expect(rec.quantity).toBe(2);
    expect(checkoutUrl(rec, answers)).toBeNull();
  });
});

describe("checkout reference", () => {
  it("describes the order without carrying personal data", () => {
    const rec = product(base);
    expect(checkoutReference(rec, base)).toBe("bundle-q1-US-one-d7-nokids-single");
  });

  it("marks a joint account and children", () => {
    const answers: Answers = {
      ...base,
      applicants: "two",
      hasNif: [false, false],
      bank: "joint",
      passport: ["US", "US"],
      childrenNifs: true,
    };
    // The couple package is one unit, so quantity stays 1.
    expect(checkoutReference(product(answers), answers)).toBe("couple-q1-US-two-d7-kids-joint");
  });

  it("stays inside the characters and length Stripe accepts", () => {
    const answers: Answers = { ...base, visa: "eu-family", childrenNifs: true };
    const ref = checkoutReference(product(answers), answers);
    expect(ref).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(ref.length).toBeLessThanOrEqual(200);
  });

  it("survives answers that are still empty", () => {
    const answers: Answers = { applicants: "one", hasNif: [false], bank: "none" };
    const ref = checkoutReference(product(answers), answers);
    expect(ref).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
