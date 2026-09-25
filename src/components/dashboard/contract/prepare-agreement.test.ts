import { describe, expect, it, vi } from "vitest";

import { PREPARE_GENERIC, readPrepareAnswer, requestAgreement } from "./prepare-agreement";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

function answer(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("readPrepareAnswer", () => {
  it("reads an ok answer as ready, whatever the body", () => {
    expect(readPrepareAnswer({ ok: true, status: 200 }, { status: "ready" })).toEqual({ kind: "ready" });
    expect(readPrepareAnswer({ ok: true, status: 200 }, null)).toEqual({ kind: "ready" });
  });

  it("reads 409 details_missing as the person whose dialog opens next", () => {
    expect(readPrepareAnswer({ ok: false, status: 409 }, { error: "details_missing", applicant: 0 })).toEqual({
      kind: "details",
      applicant: 0,
    });
    expect(readPrepareAnswer({ ok: false, status: 409 }, { error: "details_missing", applicant: 1 })).toEqual({
      kind: "details",
      applicant: 1,
    });
    // An answer without the index, or with one the card does not know, is about the account holder.
    for (const applicant of [undefined, 2, "1", null]) {
      expect(readPrepareAnswer({ ok: false, status: 409 }, { error: "details_missing", applicant })).toEqual({
        kind: "details",
        applicant: 0,
      });
    }
  });

  it("shows the route's one line for anything else, never the code", () => {
    expect(readPrepareAnswer({ ok: false, status: 409 }, { error: "Payment first." })).toEqual({
      kind: "refused",
      message: "Payment first.",
    });
    expect(readPrepareAnswer({ ok: false, status: 422 }, { error: "Keep the city and country under 120 characters." })).toEqual({
      kind: "refused",
      message: "Keep the city and country under 120 characters.",
    });
    expect(readPrepareAnswer({ ok: false, status: 400 }, { error: "details_missing" })).toEqual({
      kind: "refused",
      message: PREPARE_GENERIC,
    });
    expect(readPrepareAnswer({ ok: false, status: 500 }, null)).toEqual({ kind: "refused", message: PREPARE_GENERIC });
    expect(readPrepareAnswer({ ok: false, status: 500 }, { error: 42 })).toEqual({ kind: "refused", message: PREPARE_GENERIC });
  });
});

describe("requestAgreement", () => {
  it("POSTs the order's contract route with the trimmed place", async () => {
    const post = vi.fn(async () => answer(200, { status: "ready" }));

    expect(await requestAgreement(ORDER_ID, "  Lisbon, Portugal ", post)).toEqual({ kind: "ready" });

    expect(post).toHaveBeenCalledWith(`/api/orders/${ORDER_ID}/contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signingPlace: "Lisbon, Portugal" }),
    });
  });

  it("passes the missing person on", async () => {
    const post = vi.fn(async () => answer(409, { error: "details_missing", applicant: 1 }));
    expect(await requestAgreement(ORDER_ID, "", post)).toEqual({ kind: "details", applicant: 1 });
  });

  it("never throws: a network failure or a body that is not JSON is the generic line", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await requestAgreement(ORDER_ID, "", offline)).toEqual({ kind: "refused", message: PREPARE_GENERIC });

    const html = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token <");
      },
    }));
    expect(await requestAgreement(ORDER_ID, "", html)).toEqual({ kind: "refused", message: PREPARE_GENERIC });
  });
});
