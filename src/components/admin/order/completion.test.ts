import { describe, expect, it } from "vitest";

import { completedBefore, completionGaps } from "./completion";

/**
 * completedBefore mirrors the stage route's test for the completion email
 * (firstCompletion in src/lib/orders/lifecycle.ts), so the confirmation line
 * in the order modal never promises an email the route will not send.
 */

const STAGES = [
  { key: "awaiting_payment", is_terminal: false },
  { key: "documents", is_terminal: false },
  { key: "delivery", is_terminal: false },
  { key: "completed", is_terminal: true },
];

const open = { completed_at: null };

describe("completedBefore", () => {
  it("is false for an order that never reached the terminal stage", () => {
    const events = [
      { to_stage: "awaiting_payment" },
      { to_stage: "documents" },
      { to_stage: "delivery" },
    ];
    expect(completedBefore(open, STAGES, events)).toBe(false);
  });

  it("is true once an event took the order to the terminal stage, even after moving back", () => {
    const events = [
      { to_stage: "awaiting_payment" },
      { to_stage: "documents" },
      { to_stage: "delivery" },
      { to_stage: "completed" },
      { to_stage: "delivery" },
    ];
    expect(completedBefore(open, STAGES, events)).toBe(true);
  });

  it("is true for an order that sits complete now", () => {
    expect(completedBefore({ completed_at: "2026-09-19T10:00:00.000Z" }, STAGES, [])).toBe(true);
  });

  it("is false with no history at all", () => {
    expect(completedBefore(open, STAGES, [])).toBe(false);
  });
});

describe("completionGaps", () => {
  it("is null when every file from the list is sent and the report is written", () => {
    expect(completionGaps([], true)).toBeNull();
  });

  it("names the one thing missing", () => {
    expect(completionGaps([], false)).toBe("Not sent yet: the report for the client.");
    expect(completionGaps(["Your Portuguese NIF"], true)).toBe("Not sent yet: Your Portuguese NIF.");
  });

  it("lists several with a final and", () => {
    expect(completionGaps(["Your Portuguese NIF", "Finanças access", "Your Portuguese IBAN"], false)).toBe(
      "Not sent yet: Your Portuguese NIF, Finanças access, Your Portuguese IBAN and the report for the client.",
    );
    expect(completionGaps(["Your Portuguese NIF", "Finanças access"], true)).toBe(
      "Not sent yet: Your Portuguese NIF and Finanças access.",
    );
  });
});
