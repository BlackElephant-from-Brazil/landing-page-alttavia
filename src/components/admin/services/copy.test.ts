import { describe, expect, it } from "vitest";

import { editorCopy, listsCopy, tableCopy } from "./copy";
import { messages } from "./editor-model";

/**
 * The services screens speak Patrícia's language: no developer words, the
 * house rules for copy, and the Stripe fields named the way Stripe names
 * them. Every string of the three copy objects and the validation messages is
 * walked, so a new line is checked without being listed here.
 */

function strings(value: unknown, path = ""): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => strings(child, path ? `${path}.${key}` : key));
  }
  return [];
}

const ALL = [
  ...strings(editorCopy, "editorCopy"),
  ...strings(listsCopy, "listsCopy"),
  ...strings(tableCopy, "tableCopy"),
  ...strings(messages, "messages"),
];

/** Words a developer would use and Patrícia should not have to read. */
const JARGON = [/\bnpm\b/i, /stripe:setup/i, /--live/i, /\bkebab\b/i, /\bsnake\b/i, /\bslugs?\b/i, /\bwizard\b/i, /\bin code\b/i, /\bscript\b/i, /\brendered\b/i];

/** The house rules shared with src/content/bank-nif.ts. */
const BANNED = [/\bproblems?\b/i, /\btraps?\b/i, /\bfree\b/i, /\brefunds?\b/i, /money back/i, /video call/i, /run by lawyers/i];

/** An em dash, an en dash, or a hyphen standing alone between words. */
const DASH = /[—–]|\s-\s/;

describe("services admin copy", () => {
  it("has lines to check", () => {
    expect(ALL.length).toBeGreaterThan(60);
  });

  it("uses no developer jargon", () => {
    const offenders = ALL.filter(({ text }) => JARGON.some((re) => re.test(text)));
    expect(offenders).toEqual([]);
  });

  it("keeps to the house rules", () => {
    const offenders = ALL.filter(({ text }) => BANNED.some((re) => re.test(text)) || DASH.test(text));
    expect(offenders).toEqual([]);
  });

  it("names the Stripe price id fields the way Stripe does, test and live", () => {
    expect(editorCopy.priceIdTest).toBe("Stripe price id (test)");
    expect(editorCopy.priceIdLive).toBe("Stripe price id (live)");
    expect(editorCopy.stripe.intro).toMatch(/Product catalog/);
    expect(editorCopy.stripe.intro).toMatch(/price_/);
  });

  it("warns next to the price that a new price needs a new Stripe price id", () => {
    expect(editorCopy.priceHint).toMatch(/new Stripe price id/);
  });

  it("calls the slug and the row keys a code", () => {
    expect(editorCopy.slug).toBe("Short code");
    expect(listsCopy.key).toBe("Code");
    expect(tableCopy.slug).toBe("Code");
  });
});
