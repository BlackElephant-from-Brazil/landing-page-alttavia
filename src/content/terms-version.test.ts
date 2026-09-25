import { describe, expect, it } from "vitest";

import {
  SERVICE_TERMS_PATH,
  TERMS_ACCEPTANCE_LINE,
  TERMS_LINK_TEXT,
  TERMS_VERSION,
  acceptanceLineParts,
} from "./terms-version";

/**
 * The acceptance line under every Pay button: its link survives a reword,
 * it keeps the house rules of src/content/bank-nif.ts, and the version reads
 * as the day it took effect (it is stored on every order that accepts it).
 */

/** The house rules shared with src/content/bank-nif.ts. */
const BANNED = [/\bproblems?\b/i, /\btraps?\b/i, /\bfree\b/i, /\brefunds?\b/i, /money back/i, /video call/i, /run by lawyers/i];

/** An em dash, an en dash, or a hyphen standing alone between words. */
const DASH = /[—–]|\s-\s/;

describe("terms acceptance line", () => {
  it("is the approved wording", () => {
    expect(TERMS_ACCEPTANCE_LINE).toBe("By paying you accept the service terms and your service agreement.");
  });

  it("cuts around the service terms link and joins back to the same line", () => {
    const { before, link, after } = acceptanceLineParts();
    expect(before).toBe("By paying you accept the ");
    expect(link).toBe(TERMS_LINK_TEXT);
    expect(after).toBe(" and your service agreement.");
    expect(`${before}${link}${after}`).toBe(TERMS_ACCEPTANCE_LINE);
  });

  it("refuses a line that lost its link words", () => {
    expect(() => acceptanceLineParts("By paying you accept our terms.", TERMS_LINK_TEXT)).toThrow(/is not in/);
  });

  it("keeps the house rules", () => {
    for (const rule of BANNED) expect(TERMS_ACCEPTANCE_LINE).not.toMatch(rule);
    expect(TERMS_ACCEPTANCE_LINE).not.toMatch(DASH);
    expect(TERMS_ACCEPTANCE_LINE.length).toBeLessThanOrEqual(80);
  });

  it("links to the service terms page of the client area's locale", () => {
    expect(SERVICE_TERMS_PATH).toBe("/en/service-terms");
  });

  it("names the version by a calendar day", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(`${TERMS_VERSION}T00:00:00Z`))).toBe(false);
    expect(TERMS_VERSION).toBe("2026-09-25");
  });
});
