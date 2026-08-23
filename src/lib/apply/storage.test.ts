import { describe, expect, it } from "vitest";

import { sanitizeAnswers } from "./storage";

describe("sanitizeAnswers", () => {
  it("returns an empty object for garbage", () => {
    expect(sanitizeAnswers(null)).toEqual({});
    expect(sanitizeAnswers("x")).toEqual({});
    expect(sanitizeAnswers(42)).toEqual({});
  });

  it("keeps every valid field and normalises country codes", () => {
    const a = sanitizeAnswers({
      residence: "us",
      applicants: "two",
      childrenNifs: true,
      hasNif: [false, true],
      bank: "joint",
      passport: ["br", "DE"],
      visa: "d7",
      preselected: "couple",
    });
    expect(a).toEqual({
      residence: "US",
      applicants: "two",
      childrenNifs: true,
      hasNif: [false, true],
      bank: "joint",
      passport: ["BR", "DE"],
      visa: "d7",
      preselected: "couple",
    });
  });

  it("drops values that no longer exist in this build", () => {
    const a = sanitizeAnswers({
      residence: "ZZ",
      applicants: "three",
      hasNif: ["yes", false, true],
      bank: "maybe",
      passport: ["XX"],
      visa: "d99",
      preselected: "platinum",
      extra: "ignored",
    });
    expect(a).toEqual({ hasNif: [undefined, false], passport: [undefined] });
  });
});
