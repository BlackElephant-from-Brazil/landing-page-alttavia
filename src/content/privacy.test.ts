import { describe, expect, it } from "vitest";

import { CHECKOUT_KEY, NAME_KEY } from "@/components/apply/checkout-storage";
import { STORAGE_KEY } from "@/lib/apply/storage";

import {
  ACCOUNT_PRIVACY_NOTE,
  PRIVACY_BLOCKS,
  PRIVACY_LINK_TEXT,
  PRIVACY_PATH,
  PRIVACY_UPDATED,
  privacyText,
} from "./privacy";

/**
 * The published privacy notice: nothing left over from the proposal in
 * docs/legal/privacy-proposal.md reaches the page, it keeps the house rules
 * of src/content/bank-nif.ts, and the facts most likely to drift from the
 * code stay pinned to it.
 */

/** The house rules shared with src/content/bank-nif.ts and terms-version.test.ts. */
const BANNED = [/\bproblems?\b/i, /\btraps?\b/i, /\bfree\b/i, /\brefunds?\b/i, /money back/i, /video call/i, /run by lawyers/i];

/** An em dash, an en dash, or a hyphen standing alone between words. */
const DASH = /[—–]|\s-\s/;

/** What the proposal used to mark open points. None may be published. */
const MARKERS = [/\[/, /\]/, /TO CONFIRM/i, /PROPOSAL/i, /\[N\]/];

const text = privacyText();
const all = text.join("\n");

describe("privacy notice", () => {
  it("carries no marker from the proposal", () => {
    for (const line of text) {
      for (const marker of MARKERS) expect(line, line).not.toMatch(marker);
    }
  });

  it("keeps the house rules", () => {
    for (const line of text) {
      for (const rule of BANNED) expect(line, line).not.toMatch(rule);
      expect(line, line).not.toMatch(DASH);
    }
  });

  it("never says data is deleted automatically", () => {
    const sentences = text.flatMap((line) => line.split(/(?<=\.)\s+/)).filter((s) => /automatic/i.test(s));
    expect(sentences).toEqual(["Nothing on our platform deletes your data automatically."]);
  });

  it("names the controller with its registered office", () => {
    expect(all).toContain("ALTTAVIA RELOCATION, Unipessoal Lda., NIPC 518 856 984");
    expect(all).toContain("Av. António Augusto Aguiar, 24, 1st floor right, Office 3, 1050-016 Lisbon, Portugal");
    expect(all).not.toMatch(/Elias Garcia/);
    expect(all).not.toMatch(/data protection officer/i);
  });

  it("lists the session storage keys the apply wizard writes", () => {
    for (const key of [STORAGE_KEY, CHECKOUT_KEY, NAME_KEY]) expect(all).toContain(key);
  });

  it("does not mention local storage, which the site does not use", () => {
    expect(all).not.toMatch(/local storage|localStorage/i);
  });

  it("names WhatsApp only among the messages, not among the providers", () => {
    const heading = PRIVACY_BLOCKS.findIndex((b) => b.kind === "heading" && b.text.startsWith("Service providers"));
    expect(heading).toBeGreaterThan(-1);
    const providers = PRIVACY_BLOCKS[heading + 1];
    expect(providers?.kind).toBe("list");
    if (providers?.kind === "list") {
      for (const item of providers.items) expect(item).not.toMatch(/WhatsApp/);
    }
  });

  it("dates the notice the day it was published", () => {
    expect(PRIVACY_UPDATED).toBe("Last updated: 28 September 2026");
  });

  it("gives the email step a short line and the link words", () => {
    expect(PRIVACY_PATH).toBe("/en/privacy");
    expect(PRIVACY_LINK_TEXT).toBe("Privacy notice");
    expect(ACCOUNT_PRIVACY_NOTE.length).toBeLessThanOrEqual(90);
  });
});
