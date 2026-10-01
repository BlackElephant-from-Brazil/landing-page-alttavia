import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { applyCopy, blockedCountryMessage, countryInSentence } from "@/content/apply";
import { COUNTRIES, countryByCode, isCountryCode } from "./countries";
import { buildSteps, SEED_QUESTIONS } from "./questions";
import { recommend } from "./recommend";
import {
  BANK_UNSUPPORTED_NATIONALITIES,
  BLOCKED_COUNTRIES,
  blockedCountriesIn,
  countryIssue,
  CRIMEA_COUNTRY,
  isBlockedCountry,
} from "./rules";
import { isComplete, maxReachable, pruneAnswers, STEPS, visibleSteps } from "./steps";
import { sanitizeAnswers } from "./storage";
import type { Answers } from "./types";

/**
 * The owner's country block list of 2026-10-01: the constant itself, the two
 * screens that ask for a country (address and passports), the deep link
 * clamp, the Crimea confirmation and the check the submit route runs.
 */

/** The owner's list as sent, in its order, Crimea aside. */
const OWNER_LIST = [
  "AF", "BY", "TD", "KP", "ER", "HT", "YE", "IR", "IQ", "LB", "LY", "ML", "MM", "CF", "CD", "CG",
  "RU", "SY", "SO", "SD", "SS", "ZW", "GQ", "NI", "TM", "BI", "TJ", "GW", "KH", "KG", "SZ", "SV",
];

const step = (id: string) => {
  const found = STEPS.find((s) => s.id === id);
  if (!found) throw new Error(`no step ${id}`);
  return found;
};

/** A single applicant up to the passport screen, with an allowed address. */
const single: Answers = { residence: "US", applicants: "one", hasNif: [false], bank: "none" };
/** Two adults up to the passport screen, joint account. */
const couple: Answers = { residence: "US", applicants: "two", hasNif: [false, false], bank: "joint" };

describe("BLOCKED_COUNTRIES", () => {
  it("holds the owner's 32 codes, once each", () => {
    expect(BLOCKED_COUNTRIES).toHaveLength(32);
    expect(new Set(BLOCKED_COUNTRIES).size).toBe(32);
    expect([...BLOCKED_COUNTRIES].sort()).toEqual([...OWNER_LIST].sort());
  });

  it("uses only upper case codes that exist in countries.ts", () => {
    for (const code of BLOCKED_COUNTRIES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(isCountryCode(code), code).toBe(true);
      expect(COUNTRIES.some((c) => c.code === code), code).toBe(true);
    }
  });

  it("does not list Ukraine, whose Crimea is handled by the confirmation", () => {
    expect(CRIMEA_COUNTRY).toBe("UA");
    expect(isCountryCode(CRIMEA_COUNTRY)).toBe(true);
    expect(BLOCKED_COUNTRIES).not.toContain("UA");
  });

  it("is a separate list from the bank's own nationality rule", () => {
    expect(BANK_UNSUPPORTED_NATIONALITIES).toEqual([]);
  });

  it("matches codes in any case and nothing else", () => {
    expect(isBlockedCountry("RU")).toBe(true);
    expect(isBlockedCountry("ru")).toBe(true);
    expect(isBlockedCountry("US")).toBe(false);
    expect(isBlockedCountry("UA")).toBe(false);
    expect(isBlockedCountry(undefined)).toBe(false);
    expect(isBlockedCountry(42)).toBe(false);
  });
});

describe("countryIssue", () => {
  it("blocks the address and the passports, and no other question", () => {
    expect(countryIssue("residence", "IR", {})).toBe("blocked");
    expect(countryIssue("passport", "IR", {})).toBe("blocked");
    expect(countryIssue("birthCountry", "IR", {})).toBeUndefined();
    expect(countryIssue("residence", "BR", {})).toBeUndefined();
  });

  it("asks for the Crimea confirmation on a Ukrainian address only", () => {
    expect(countryIssue("residence", "UA", {})).toBe("crimea");
    expect(countryIssue("residence", "ua", { notCrimea: false })).toBe("crimea");
    expect(countryIssue("residence", "UA", { notCrimea: true })).toBeUndefined();
    // A Ukrainian passport is not an address.
    expect(countryIssue("passport", "UA", {})).toBeUndefined();
  });
});

describe("the address screen", () => {
  const residence = step("residence");

  it("refuses a blocked country, so Continue stays off and the clamp stops there", () => {
    for (const code of BLOCKED_COUNTRIES) {
      const a: Answers = { ...single, residence: code, passport: ["US"] };
      expect(residence.isValid(a), code).toBe(false);
      expect(maxReachable(a), code).toBe(0);
      expect(isComplete(a), code).toBe(false);
    }
  });

  it("accepts an allowed country and moves on", () => {
    expect(residence.isValid({ residence: "BR" })).toBe(true);
    expect(maxReachable({ residence: "BR" })).toBe(1);
  });

  it("holds Ukraine until the Crimea box is ticked", () => {
    expect(residence.isValid({ residence: "UA" })).toBe(false);
    expect(maxReachable({ ...single, residence: "UA", passport: ["UA"] })).toBe(0);
    expect(residence.isValid({ residence: "UA", notCrimea: false })).toBe(false);
    expect(residence.isValid({ residence: "UA", notCrimea: true })).toBe(true);
    const ticked: Answers = { ...single, residence: "UA", notCrimea: true, passport: ["UA"] };
    expect(maxReachable(ticked)).toBe(visibleSteps(ticked).length);
    expect(isComplete(ticked)).toBe(true);
  });

  it("applies to steps built from database rows too", () => {
    const built = buildSteps(SEED_QUESTIONS);
    expect(built[0].isValid({ residence: "SY" })).toBe(false);
    expect(built[0].isValid({ residence: "UA" })).toBe(false);
    expect(built[0].isValid({ residence: "UA", notCrimea: true })).toBe(true);
  });
});

describe("the passport screen", () => {
  const passport = step("passport");
  const passportIndex = visibleSteps({ ...single, passport: ["US"] }).findIndex((s) => s.id === "passport");

  it("refuses a blocked passport for a single applicant", () => {
    const a: Answers = { ...single, passport: ["AF"] };
    expect(passport.isValid(a)).toBe(false);
    expect(maxReachable(a)).toBe(passportIndex);
    expect(isComplete(a)).toBe(false);
  });

  it("refuses the screen when one of two passports is blocked, either one", () => {
    for (const passports of [["RU", "US"], ["US", "RU"]]) {
      const a: Answers = { ...couple, passport: passports };
      expect(passport.isValid(a), passports.join()).toBe(false);
      expect(maxReachable(a), passports.join()).toBe(passportIndex);
      expect(isComplete(a), passports.join()).toBe(false);
    }
  });

  it("accepts allowed passports, Ukraine included", () => {
    expect(passport.isValid({ ...single, passport: ["UA"] })).toBe(true);
    const a: Answers = { ...couple, passport: ["US", "BR"], visa: "d7" };
    expect(passport.isValid(a)).toBe(true);
    expect(isComplete(a)).toBe(true);
  });

  it("forgets a blocked partner passport once the visitor applies alone", () => {
    const a = pruneAnswers({ ...couple, applicants: "one", hasNif: [false, false], passport: ["US", "RU"] });
    expect(a.passport).toEqual(["US"]);
    expect(blockedCountriesIn(a)).toEqual([]);
  });
});

describe("the Crimea confirmation in the stored answers", () => {
  it("survives sanitizing as a boolean only", () => {
    expect(sanitizeAnswers({ residence: "UA", notCrimea: true })).toEqual({ residence: "UA", notCrimea: true });
    expect(sanitizeAnswers({ residence: "UA", notCrimea: "yes" })).toEqual({ residence: "UA" });
  });

  it("is dropped once the address leaves Ukraine, so coming back asks again", () => {
    expect(pruneAnswers({ residence: "UA", notCrimea: true })).toEqual({ residence: "UA", notCrimea: true });
    expect(pruneAnswers({ residence: "PL", notCrimea: true })).toEqual({ residence: "PL" });
    expect(pruneAnswers({ notCrimea: true })).toEqual({});
  });
});

describe("blockedCountriesIn, the submit route's check", () => {
  it("is empty for allowed answers, Ukraine included", () => {
    expect(blockedCountriesIn({ ...single, passport: ["US"] })).toEqual([]);
    expect(blockedCountriesIn({ ...single, residence: "UA", passport: ["UA"] })).toEqual([]);
    expect(blockedCountriesIn({})).toEqual([]);
  });

  it("names every blocked address and passport once", () => {
    expect(blockedCountriesIn({ ...single, residence: "IR", passport: ["US"] })).toEqual(["IR"]);
    expect(blockedCountriesIn({ ...couple, passport: ["US", "KP"] })).toEqual(["KP"]);
    expect(blockedCountriesIn({ ...couple, residence: "RU", passport: ["RU", "BY"] })).toEqual(["RU", "BY"]);
  });

  it("catches answers the engine alone would have priced", () => {
    // recommend() does not know the list; the route checks it before calling it.
    const forged: Answers = { ...single, residence: "SY", passport: ["SY"] };
    expect(recommend(forged).kind).toBe("product");
    expect(blockedCountriesIn(forged)).toEqual(["SY"]);
  });
});

describe("the messages", () => {
  it("name the country as countries.ts spells it", () => {
    expect(blockedCountryMessage("residence", "RU")).toBe("This service is not available to residents of Russia.");
    expect(blockedCountryMessage("passport", "RU")).toBe(
      "This service is not available to holders of a passport from Russia.",
    );
    expect(countryInSentence("CF")).toBe("the Central African Republic");
    for (const code of BLOCKED_COUNTRIES) {
      expect(countryInSentence(code)).toContain(countryByCode(code)!.name);
    }
  });

  it("keep the house rules", () => {
    const lines = [
      ...BLOCKED_COUNTRIES.flatMap((code) => [
        blockedCountryMessage("residence", code),
        blockedCountryMessage("passport", code),
      ]),
      applyCopy.blocked.crimeaCheckbox,
      applyCopy.blocked.crimea,
      applyCopy.blocked.server,
      applyCopy.blocked.applyFirst,
      applyCopy.blocked.applyFirstLink,
      applyCopy.steps.passport.help,
    ];
    for (const line of lines) {
      // Guinea-Bissau keeps its hyphen; dashes as punctuation never appear.
      expect(line).not.toMatch(/—|–| - /);
      expect(line).not.toMatch(/\b(problem|trap|refund|free)\b/i);
      expect(line).not.toMatch(/money back/i);
    }
  });
});

/**
 * The passport screen reads its help line from public.questions, so the copy
 * in src/content/apply.ts reaches visitors only once
 * supabase/migrations/0020_passport_help.sql has run. This pins the two.
 */
describe("the passport help line", () => {
  const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
  const MIGRATION = join(ROOT, "supabase", "migrations", "0020_passport_help.sql");

  it("is the text the migration writes on the passport row", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    const written = /set help = '((?:[^']|'')*)'/.exec(sql)?.[1]?.replaceAll("''", "'");

    expect(written).toBe(applyCopy.steps.passport.help);
    expect(sql).toContain("where key = 'passport'");
  });

  it("no longer says the bank decides by nationality", () => {
    expect(applyCopy.steps.passport.help).not.toMatch(/depend on nationality|not by nationality/);
  });
});
