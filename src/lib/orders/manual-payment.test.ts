import { describe, expect, it } from "vitest";

import { MANUAL_PAYMENT_LIVE_NOTE, MANUAL_PAYMENT_TEST_NOTE, manualPaymentNote, secondStageKey } from "./manual-payment";

/**
 * Which stage a payment moves an order to. The same answer
 * src/lib/orders/mark-paid.ts gets from the database with `position = 2`.
 */

const stage = (key: string, position: number) => ({ key, position });

describe("secondStageKey", () => {
  it("takes the stage at position 2", () => {
    const stages = [stage("awaiting_payment", 1), stage("documents", 2), stage("submitted", 3)];
    expect(secondStageKey(stages)).toBe("documents");
  });

  it("does not depend on the order the rows arrive in", () => {
    const stages = [stage("submitted", 3), stage("documents", 2), stage("awaiting_payment", 1)];
    expect(secondStageKey(stages)).toBe("documents");
  });

  it("falls back to the second stage in position order when none is numbered 2", () => {
    const stages = [stage("awaiting_payment", 10), stage("documents", 20), stage("submitted", 30)];
    expect(secondStageKey(stages)).toBe("documents");
  });

  it("answers null for a service with fewer than two stages", () => {
    expect(secondStageKey([])).toBeNull();
    expect(secondStageKey([stage("awaiting_payment", 1)])).toBeNull();
  });
});

describe("manualPaymentNote", () => {
  it("says where the payment was recorded, and only the live note counts as real money", () => {
    expect(manualPaymentNote(true)).toBe(MANUAL_PAYMENT_LIVE_NOTE);
    expect(manualPaymentNote(false)).toBe(MANUAL_PAYMENT_TEST_NOTE);
    expect(MANUAL_PAYMENT_LIVE_NOTE).not.toBe(MANUAL_PAYMENT_TEST_NOTE);
    // Rows of 2026-09-22 carry this note; it must stay apart from the live one.
    expect(MANUAL_PAYMENT_LIVE_NOTE).not.toBe("Paid outside the platform, recorded by the admin");
  });
});
