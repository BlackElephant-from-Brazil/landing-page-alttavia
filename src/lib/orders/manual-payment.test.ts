import { describe, expect, it } from "vitest";

import { secondStageKey } from "./manual-payment";

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
