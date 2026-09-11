import { describe, expect, it } from "vitest";

import { alternativeFor, quantityFor } from "@/content/apply";
import { PRICE_CENTS } from "@/content/bank-nif";
import type { Rule } from "@/lib/db/types";
import { isCountryCode, isEea } from "./countries";
import { buildSteps, evaluateRule, SEED_QUESTIONS } from "./questions";
import { recommend } from "./recommend";
import {
  APPLICANT_OPTIONS,
  BANK_OPTIONS_COUPLE,
  BANK_OPTIONS_SINGLE,
  STEPS,
  VISA_OPTIONS,
} from "./steps";
import type { Answers, Applicants, BankChoice, ProductId, Visa } from "./types";

/* -------------------------------------------------------------------------- */
/* The oracle: the hardcoded steps as they were before the questions moved   */
/* to the database. Copied verbatim, not imported, so a change in the seed   */
/* or in buildSteps() that alters behaviour fails here.                       */
/* -------------------------------------------------------------------------- */

type OracleStep = {
  id: string;
  visibleWhen: (a: Answers) => boolean;
  isValid: (a: Answers) => boolean;
};

function peopleCount(a: Answers): 1 | 2 {
  return a.applicants === "two" ? 2 : 1;
}

function everyPerson(a: Answers, check: (i: number) => boolean): boolean {
  return Array.from({ length: peopleCount(a) }, (_, i) => i).every(check);
}

const ORACLE: readonly OracleStep[] = [
  {
    id: "residence",
    visibleWhen: () => true,
    isValid: (a) => isCountryCode(a.residence),
  },
  {
    id: "who",
    visibleWhen: () => true,
    isValid: (a) => a.applicants !== undefined && APPLICANT_OPTIONS.includes(a.applicants),
  },
  {
    id: "has-nif",
    visibleWhen: (a) => a.applicants !== "more",
    isValid: (a) => everyPerson(a, (i) => typeof a.hasNif?.[i] === "boolean"),
  },
  {
    id: "bank",
    visibleWhen: (a) => a.applicants !== "more",
    isValid: (a) => {
      const options = a.applicants === "two" ? BANK_OPTIONS_COUPLE : BANK_OPTIONS_SINGLE;
      return a.bank !== undefined && options.includes(a.bank);
    },
  },
  {
    id: "passport",
    visibleWhen: (a) => a.applicants !== "more" && a.bank !== "separate",
    isValid: (a) => everyPerson(a, (i) => isCountryCode(a.passport?.[i])),
  },
  {
    id: "visa",
    visibleWhen: (a) =>
      a.applicants !== "more" &&
      (a.bank === "yes" || a.bank === "joint") &&
      Array.from({ length: peopleCount(a) }, (_, i) => a.passport?.[i]).some((p) => !isEea(p)),
    isValid: (a) => a.visa !== undefined && VISA_OPTIONS.includes(a.visa),
  },
];

/* -------------------------------------------------------------------------- */
/* A broad set of answer objects: every combination of the values below,     */
/* including unanswered, plus a few values the wizard would never write.     */
/* -------------------------------------------------------------------------- */

const RESIDENCES = [undefined, "US", "DE", "PT", "ZZ"] as const;
const APPLICANTS = [undefined, "one", "two", "more", "three"] as const;
const HAS_NIF = [undefined, [], [true], [false], [true, false], [false, undefined], ["yes"]] as const;
const BANKS = [undefined, "yes", "joint", "separate", "none", "maybe"] as const;
const PASSPORTS = [undefined, [], ["US"], ["DE"], ["US", "DE"], ["DE", "FR"], [undefined, "US"], ["XX"]] as const;
const VISAS = [undefined, "d7", "none", "d99"] as const;

function* cases(): Generator<Answers> {
  for (const residence of RESIDENCES)
    for (const applicants of APPLICANTS)
      for (const hasNif of HAS_NIF)
        for (const bank of BANKS)
          for (const passport of PASSPORTS)
            for (const visa of VISAS) {
              const a: Record<string, unknown> = {};
              if (residence !== undefined) a.residence = residence;
              if (applicants !== undefined) a.applicants = applicants;
              if (hasNif !== undefined) a.hasNif = hasNif;
              if (bank !== undefined) a.bank = bank;
              if (passport !== undefined) a.passport = passport;
              if (visa !== undefined) a.visa = visa;
              yield a as Answers;
            }
}

describe("buildSteps(SEED_QUESTIONS) matches the hardcoded steps", () => {
  const built = buildSteps(SEED_QUESTIONS);

  it("produces the same six ids in the same order", () => {
    expect(built.map((s) => s.id)).toEqual(ORACLE.map((s) => s.id));
    expect(STEPS.map((s) => s.id)).toEqual(ORACLE.map((s) => s.id));
  });

  it("agrees on visibility and validity for every answer combination", () => {
    let count = 0;
    for (const a of cases()) {
      count += 1;
      for (let i = 0; i < ORACLE.length; i += 1) {
        const expected = { id: ORACLE[i].id, visible: ORACLE[i].visibleWhen(a), valid: ORACLE[i].isValid(a) };
        const actual = { id: built[i].id, visible: built[i].visibleWhen(a), valid: built[i].isValid(a) };
        if (expected.visible !== actual.visible || expected.valid !== actual.valid) {
          throw new Error(
            `Step ${ORACLE[i].id} disagrees for ${JSON.stringify(a)}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
          );
        }
      }
    }
    // Sanity: the table is broad, not a handful of rows.
    expect(count).toBeGreaterThan(20000);
  });

  it("carries the row on every step, with the seed's answer keys", () => {
    expect(built.map((s) => s.row.answer_key)).toEqual([
      "residence",
      "applicants",
      "hasNif",
      "bank",
      "passport",
      "visa",
    ]);
  });

  it("skips inactive rows and sorts by position", () => {
    const rows = [...SEED_QUESTIONS].reverse().map((r) => (r.key === "visa" ? { ...r, active: false } : r));
    expect(buildSteps(rows).map((s) => s.id)).toEqual(["residence", "who", "has-nif", "bank", "passport"]);
  });
});

/* -------------------------------------------------------------------------- */
/* Rule evaluator                                                              */
/* -------------------------------------------------------------------------- */

describe("evaluateRule", () => {
  const two: Answers = { applicants: "two", bank: "joint", passport: ["DE", "US"] };
  const one: Answers = { applicants: "one", bank: "none", passport: ["DE"] };

  it("null and undefined always pass", () => {
    expect(evaluateRule(null, {})).toBe(true);
    expect(evaluateRule(undefined, two)).toBe(true);
  });

  it("eq and neq", () => {
    expect(evaluateRule({ all: [{ field: "applicants", op: "eq", value: "two" }] }, two)).toBe(true);
    expect(evaluateRule({ all: [{ field: "applicants", op: "eq", value: "one" }] }, two)).toBe(false);
    expect(evaluateRule({ all: [{ field: "applicants", op: "neq", value: "more" }] }, two)).toBe(true);
    expect(evaluateRule({ all: [{ field: "applicants", op: "neq", value: "two" }] }, two)).toBe(false);
    // An unanswered field is not equal to anything, and not equal to everything.
    expect(evaluateRule({ all: [{ field: "visa", op: "eq", value: "d7" }] }, two)).toBe(false);
    expect(evaluateRule({ all: [{ field: "visa", op: "neq", value: "d7" }] }, two)).toBe(true);
  });

  it("in and notIn", () => {
    expect(evaluateRule({ all: [{ field: "bank", op: "in", value: ["yes", "joint"] }] }, two)).toBe(true);
    expect(evaluateRule({ all: [{ field: "bank", op: "in", value: ["yes", "joint"] }] }, one)).toBe(false);
    expect(evaluateRule({ all: [{ field: "bank", op: "notIn", value: ["yes", "joint"] }] }, one)).toBe(true);
    expect(evaluateRule({ all: [{ field: "bank", op: "notIn", value: ["none"] }] }, one)).toBe(false);
    expect(evaluateRule({ all: [{ field: "visa", op: "in", value: [] }] }, one)).toBe(false);
  });

  it("all requires every condition, any requires one", () => {
    const yes = { field: "applicants", op: "eq", value: "two" } as const;
    const no = { field: "bank", op: "eq", value: "none" } as const;
    expect(evaluateRule({ all: [yes, no] }, two)).toBe(false);
    expect(evaluateRule({ all: [yes] }, two)).toBe(true);
    expect(evaluateRule({ any: [yes, no] }, two)).toBe(true);
    expect(evaluateRule({ any: [no] }, two)).toBe(false);
    expect(evaluateRule({ all: [] }, two)).toBe(true);
    expect(evaluateRule({ any: [] }, two)).toBe(false);
  });

  it("pred anyNonEeaPassport", () => {
    const rule: Rule = { all: [{ pred: "anyNonEeaPassport" }] };
    expect(evaluateRule(rule, two)).toBe(true);
    expect(evaluateRule(rule, one)).toBe(false);
    expect(evaluateRule(rule, { applicants: "two", passport: ["DE", "FR"] })).toBe(false);
    // Only the first passport counts for a single applicant.
    expect(evaluateRule(rule, { applicants: "one", passport: ["DE", "US"] })).toBe(false);
    // Unanswered passports count as non EEA, like the hardcoded step did.
    expect(evaluateRule(rule, { applicants: "one" })).toBe(true);
  });

  it("tolerates a rule shape this build does not know", () => {
    expect(evaluateRule({ all: [{ pred: "somethingNew" } as never] }, two)).toBe(false);
    expect(evaluateRule({ all: [{ field: "bank", op: "gt", value: 1 } as never] }, two)).toBe(false);
    expect(evaluateRule({ nope: true } as never, two)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Seed sanity                                                                 */
/* -------------------------------------------------------------------------- */

describe("SEED_QUESTIONS", () => {
  it("has six active rows with unique keys, ids and positions", () => {
    expect(SEED_QUESTIONS).toHaveLength(6);
    expect(new Set(SEED_QUESTIONS.map((q) => q.key)).size).toBe(6);
    expect(new Set(SEED_QUESTIONS.map((q) => q.id)).size).toBe(6);
    expect(SEED_QUESTIONS.map((q) => q.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(SEED_QUESTIONS.every((q) => q.active)).toBe(true);
  });

  it("offers the same option values the engine understands", () => {
    const who = SEED_QUESTIONS.find((q) => q.key === "who")!;
    expect((who.options as { value: string }[]).map((o) => o.value)).toEqual<Applicants[]>(["one", "two", "more"]);
    const bank = SEED_QUESTIONS.find((q) => q.key === "bank")!;
    const household = bank.options as { one: { value: string }[]; two: { value: string }[] };
    expect(household.one.map((o) => o.value)).toEqual<BankChoice[]>(["yes", "none"]);
    expect(household.two.map((o) => o.value)).toEqual<BankChoice[]>(["joint", "separate", "none"]);
    const visa = SEED_QUESTIONS.find((q) => q.key === "visa")!;
    expect((visa.options as { value: string }[]).map((o) => o.value)).toEqual<Visa[]>([...VISA_OPTIONS]);
  });

  it("keeps the house rules in every string", () => {
    const text = JSON.stringify(SEED_QUESTIONS);
    expect(text).not.toMatch(/—|–/);
    expect(text).not.toMatch(/\b(problem|trap|refund|free)\b/i);
    expect(text).not.toMatch(/money back|video call/i);
  });
});

/* -------------------------------------------------------------------------- */
/* Alternatives carry the engine's quantity rule                              */
/* -------------------------------------------------------------------------- */

describe("alternativeFor: the quantity of an alternative product", () => {
  const couple: Answers = {
    residence: "US",
    applicants: "two",
    hasNif: [false, false],
    bank: "joint",
    passport: ["US", "US"],
    visa: "d7",
  };

  function product(a: Answers) {
    const rec = recommend(a);
    if (rec.kind !== "product") throw new Error("expected a product");
    return rec;
  }

  it("charges two NIFs when two adults without NIFs pick NIF only instead of the couple package", () => {
    const rec = product(couple);
    expect(rec.product).toBe("couple");
    const alt = alternativeFor(rec, "nif-only", couple);
    expect(alt.product).toBe("nif-only");
    expect(alt.quantity).toBe(2);
    expect(alt.totalCents).toBe(PRICE_CENTS.nifOnly * 2);
    expect(alt.joint).toBe(false);
  });

  it("charges one NIF when only one of two adults needs it", () => {
    const a: Answers = { ...couple, hasNif: [true, false] };
    const rec = product(a);
    expect(rec.product).toBe("bundle");
    const alt = alternativeFor(rec, "nif-only", a);
    expect(alt.quantity).toBe(1);
    expect(alt.totalCents).toBe(PRICE_CENTS.nifOnly);
  });

  it("marks the couple package joint when a double NIF order upgrades to it", () => {
    const a: Answers = { ...couple, visa: "none" };
    const rec = product(a);
    expect(rec.product).toBe("nif-only");
    expect(rec.quantity).toBe(2);
    const alt = alternativeFor(rec, "couple", a);
    expect(alt.quantity).toBe(1);
    expect(alt.joint).toBe(true);
    expect(alt.totalCents).toBe(PRICE_CENTS.couple);
  });

  it("reproduces the engine's own order for the recommended product", () => {
    const rows: Answers[] = [
      couple,
      { ...couple, hasNif: [true, false] },
      { ...couple, hasNif: [true, true] },
      { ...couple, bank: "none" },
      { ...couple, applicants: "one", hasNif: [false], passport: ["US"] },
      { ...couple, applicants: "one", hasNif: [false], bank: "none", passport: ["US"] },
      { ...couple, applicants: "one", hasNif: [true], passport: ["US"] },
      { ...couple, visa: "none" },
    ];
    for (const a of rows) {
      const rec = product(a);
      const same = alternativeFor(rec, rec.product, a);
      expect({ q: same.quantity, t: same.totalCents, j: same.joint }).toEqual({
        q: rec.quantity,
        t: rec.totalCents,
        j: rec.joint,
      });
    }
  });

  it("never builds a one NIF order for two adults without NIFs", () => {
    for (const bank of ["joint", "none"] as const) {
      const a: Answers = { ...couple, bank };
      expect(quantityFor("nif-only", a)).toBe(2);
      for (const id of ["bundle", "bank-only", "couple"] as ProductId[]) {
        expect(quantityFor(id, a)).toBe(1);
      }
    }
  });
});
