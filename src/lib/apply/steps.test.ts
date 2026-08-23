import { describe, expect, it } from "vitest";

import { isComplete, maxReachable, pruneAnswers, visibleSteps } from "./steps";
import type { Answers } from "./types";

describe("visibleSteps", () => {
  it("shows six screens to a non EEA single applicant who wants an account", () => {
    const a: Answers = { residence: "US", applicants: "one", hasNif: [false], bank: "yes", passport: ["US"] };
    expect(visibleSteps(a).map((s) => s.id)).toEqual(["residence", "who", "has-nif", "bank", "passport", "visa"]);
  });

  it("skips the visa screen when every passport is EEA", () => {
    const a: Answers = { residence: "US", applicants: "two", hasNif: [false, false], bank: "joint", passport: ["DE", "FR"] };
    expect(visibleSteps(a).map((s) => s.id)).not.toContain("visa");
  });

  it("asks the visa when one of two passports is non EEA", () => {
    const a: Answers = { residence: "US", applicants: "two", hasNif: [false, false], bank: "joint", passport: ["DE", "US"] };
    expect(visibleSteps(a).map((s) => s.id)).toContain("visa");
  });

  it("skips the visa screen when no account is wanted", () => {
    const a: Answers = { residence: "US", applicants: "one", hasNif: [false], bank: "none", passport: ["US"] };
    expect(visibleSteps(a).map((s) => s.id)).not.toContain("visa");
  });

  it("stops after 'who' for more than two adults", () => {
    expect(visibleSteps({ residence: "US", applicants: "more" }).map((s) => s.id)).toEqual(["residence", "who"]);
  });
});

describe("maxReachable and isComplete", () => {
  it("is 0 with no answers", () => {
    expect(maxReachable({})).toBe(0);
    expect(isComplete({})).toBe(false);
  });

  it("stops at the first unanswered visible step", () => {
    expect(maxReachable({ residence: "US", applicants: "two", hasNif: [false] })).toBe(2);
    expect(maxReachable({ residence: "US", applicants: "two", hasNif: [false, true] })).toBe(3);
  });

  it("rejects a bank answer that belongs to the other household size", () => {
    expect(maxReachable({ residence: "US", applicants: "one", hasNif: [false], bank: "joint" })).toBe(3);
  });

  it("is complete once every visible step is valid", () => {
    const a: Answers = { residence: "US", applicants: "one", hasNif: [false], bank: "yes", passport: ["US"], visa: "d7" };
    expect(isComplete(a)).toBe(true);
    expect(maxReachable(a)).toBe(6);
  });

  it("is complete without a visa for an EEA passport", () => {
    const a: Answers = { residence: "US", applicants: "one", hasNif: [false], bank: "yes", passport: ["PT"] };
    expect(isComplete(a)).toBe(true);
  });
});

describe("pruneAnswers", () => {
  it("drops the partner's answers after switching to a single applicant", () => {
    const a: Answers = { residence: "US", applicants: "one", hasNif: [false, true], bank: "joint", passport: ["US", "BR"], visa: "d7" };
    const p = pruneAnswers(a);
    expect(p.hasNif).toEqual([false]);
    expect(p.passport).toEqual(["US"]);
    expect(p.bank).toBeUndefined();
    expect(p.visa).toBeUndefined();
  });

  it("drops the visa once the account is no longer wanted", () => {
    const a: Answers = { residence: "US", applicants: "one", hasNif: [false], bank: "none", passport: ["US"], visa: "d7" };
    expect(pruneAnswers(a).visa).toBeUndefined();
  });

  it("keeps everything that still applies", () => {
    const a: Answers = { residence: "US", applicants: "two", hasNif: [false, false], bank: "joint", passport: ["US", "BR"], visa: "d8", childrenNifs: true };
    expect(pruneAnswers(a)).toEqual(a);
  });
});
