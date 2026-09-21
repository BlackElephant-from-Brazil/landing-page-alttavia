import { describe, expect, it } from "vitest";

import { FRESH_PAYMENT_MS, isFreshPayment } from "./fresh-payment";

const PAID_AT = "2026-09-21T10:00:00.000Z";
const paid = new Date(PAID_AT).getTime();

describe("isFreshPayment", () => {
  it("is fresh for fifteen minutes after the payment", () => {
    expect(isFreshPayment(PAID_AT, paid)).toBe(true);
    expect(isFreshPayment(PAID_AT, paid + 60_000)).toBe(true);
    expect(isFreshPayment(PAID_AT, paid + FRESH_PAYMENT_MS - 1)).toBe(true);
    expect(isFreshPayment(PAID_AT, paid + FRESH_PAYMENT_MS)).toBe(false);
    expect(isFreshPayment(PAID_AT, paid + 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("forgives a browser clock that runs behind the server", () => {
    expect(isFreshPayment(PAID_AT, paid - 2_000)).toBe(true);
    expect(isFreshPayment(PAID_AT, paid - FRESH_PAYMENT_MS)).toBe(false);
  });

  it("is never fresh without a payment or with a date that does not parse", () => {
    expect(isFreshPayment(null, paid)).toBe(false);
    expect(isFreshPayment(undefined, paid)).toBe(false);
    expect(isFreshPayment("", paid)).toBe(false);
    expect(isFreshPayment("not a date", paid)).toBe(false);
  });
});
