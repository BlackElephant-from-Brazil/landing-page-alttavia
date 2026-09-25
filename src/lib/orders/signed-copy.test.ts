import { describe, expect, it } from "vitest";

import { SIGNED_COPY_SENT_NOTE, signedCopyClaimWins, signedCopyDue } from "./signed-copy";

/**
 * Once per review round: the rule that keeps a client from posting the team
 * inbox one signed copy per upload.
 */

describe("signedCopyDue", () => {
  it("sends the first signed copy of an order", () => {
    expect(signedCopyDue([], [])).toBe(true);
    expect(signedCopyDue([null, undefined], [])).toBe(true);
  });

  it("sends nothing more in the same round, however many copies follow", () => {
    expect(signedCopyDue(["2026-09-25T10:00:05.000Z"], [])).toBe(false);
  });

  it("sends again once the firm rejected a copy after the last one went out", () => {
    expect(signedCopyDue(["2026-09-25T10:00:05.000Z"], ["2026-09-25T11:30:00.000Z"])).toBe(true);
  });

  it("does not count a rejection that came before the last copy was sent", () => {
    expect(signedCopyDue(["2026-09-25T12:00:00.000Z"], ["2026-09-25T11:30:00.000Z"])).toBe(false);
  });

  it("compares the newest of each, in any order", () => {
    const sent = ["2026-09-25T12:00:00.000Z", "2026-09-25T09:00:00.000Z"];
    expect(signedCopyDue(sent, ["2026-09-25T10:00:00.000Z", "2026-09-25T12:30:00.000Z"])).toBe(true);
    expect(signedCopyDue(sent, ["2026-09-25T10:00:00.000Z", null])).toBe(false);
  });

  it("ignores a timestamp it cannot read", () => {
    expect(signedCopyDue(["not a date"], [])).toBe(true);
    expect(signedCopyDue(["2026-09-25T12:00:00.000Z"], ["not a date"])).toBe(false);
  });

  it("records a note written the house way", () => {
    expect(SIGNED_COPY_SENT_NOTE).not.toMatch(/[–—]|\s-\s/);
  });
});

describe("signedCopyClaimWins", () => {
  const A = { id: "aaaa", created_at: "2026-09-25T10:00:00.100Z" };
  const B = { id: "bbbb", created_at: "2026-09-25T10:00:00.250Z" };

  it("gives the round to the earliest claim, whichever call asks", () => {
    expect(signedCopyClaimWins([B, A], [], A.id)).toBe(true);
    expect(signedCopyClaimWins([B, A], [], B.id)).toBe(false);
  });

  it("lets a call that sees only its own claim win, and the later caller, who sees both, lose", () => {
    expect(signedCopyClaimWins([A], [], A.id)).toBe(true);
    expect(signedCopyClaimWins([A, B], [], B.id)).toBe(false);
  });

  it("breaks a tie on the timestamp by id, the same way for both callers", () => {
    const twin = { id: "0000", created_at: A.created_at };
    expect(signedCopyClaimWins([A, twin], [], twin.id)).toBe(true);
    expect(signedCopyClaimWins([twin, A], [], A.id)).toBe(false);
  });

  it("counts only the claims since the firm's latest rejection", () => {
    const rejected = ["2026-09-25T10:00:00.200Z"];
    // A is the previous round's send; B opens the new round.
    expect(signedCopyClaimWins([A, B], rejected, B.id)).toBe(true);
    const C = { id: "cccc", created_at: "2026-09-25T10:00:00.300Z" };
    expect(signedCopyClaimWins([A, B, C], rejected, C.id)).toBe(false);
  });

  it("counts a claim written at the moment of the rejection in the new round, as signedCopyDue does", () => {
    const rejected = [A.created_at];
    expect(signedCopyClaimWins([A, B], rejected, A.id)).toBe(true);
    expect(signedCopyDue([A.created_at], rejected)).toBe(false);
  });

  it("never gives the round to a claim whose time cannot be read, or that is not there", () => {
    expect(signedCopyClaimWins([{ id: "x", created_at: null }], [], "x")).toBe(false);
    expect(signedCopyClaimWins([{ id: "x", created_at: "not a date" }], [], "x")).toBe(false);
    expect(signedCopyClaimWins([A], [], "missing")).toBe(false);
  });
});
