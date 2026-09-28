import { describe, expect, it } from "vitest";

import { REGISTERED_OFFICE } from "./bank-nif";
import { brand } from "./brand";
import { SERVICE_TERMS_BLOCKS, SERVICE_TERMS_PATH, SERVICE_TERMS_UPDATED, serviceTermsText } from "./service-terms";
import { TERMS_VERSION } from "./terms-version";

/**
 * The published service terms: they keep the house rules of
 * src/content/bank-nif.ts, the claims corrected on 2026-09-28 do not come
 * back, the page names the seller as the privacy notice does, and its date
 * is the day TERMS_VERSION names, so a reword without a version bump fails
 * here instead of recording the wrong version on paid orders.
 */

/** The house rules shared with src/content/bank-nif.ts, privacy.test.ts and terms-version.test.ts. */
const BANNED = [/\bproblems?\b/i, /\btraps?\b/i, /\bfree\b/i, /\brefunds?\b/i, /money back/i, /video call/i, /run by lawyers/i];

/** An em dash, an en dash, or a hyphen standing alone between words. */
const DASH = /[—–]|\s-\s/;

/** Claims the rewrite of 2026-09-28 removed because the platform does otherwise. */
const CORRECTED = [/uploaded at checkout/i, /debit card/i, /\bVAT\b/, /we act as your tax representative/i];

const text = serviceTermsText();
const all = text.join("\n");

/** "2026-09-28" as the page writes it: "28 September 2026". */
function longDate(isoDay: string): string {
  return new Date(`${isoDay}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

describe("service terms", () => {
  it("keep the house rules", () => {
    for (const line of text) {
      for (const rule of BANNED) expect(line, line).not.toMatch(rule);
      expect(line, line).not.toMatch(DASH);
    }
  });

  it("do not bring back a corrected claim", () => {
    for (const claim of CORRECTED) expect(all).not.toMatch(claim);
  });

  it("are dated the day TERMS_VERSION names", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(SERVICE_TERMS_UPDATED).toBe(`Last updated: ${longDate(TERMS_VERSION)}`);
  });

  it("name the seller and its registered office as the privacy notice does", () => {
    expect(all).toContain(`${brand.legalEntity}, NIPC 518 856 984, ${REGISTERED_OFFICE}.`);
    expect(all).not.toMatch(/Elias Garcia/);
  });

  it("say the service agreement prevails, and leave the withdrawal period to Annex I", () => {
    expect(all).toContain("Where this page and the agreement differ, the agreement prevails.");
    expect(all).toContain("within 14 days of concluding your agreement, as Annex I of your agreement sets out");
    expect(all).not.toMatch(/the day you paid/i);
  });

  it("open with a paragraph and keep every list item a full sentence", () => {
    expect(SERVICE_TERMS_BLOCKS[0]?.kind).toBe("paragraph");
    for (const block of SERVICE_TERMS_BLOCKS) {
      if (block.kind === "list") for (const item of block.items) expect(item.trim().endsWith(".")).toBe(true);
    }
  });

  it("live at the path the Pay line links to", () => {
    expect(SERVICE_TERMS_PATH).toBe("/en/service-terms");
  });
});
