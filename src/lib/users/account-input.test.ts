import { describe, expect, it } from "vitest";

import { MAX_NAME_LENGTH, normalizeEmail, validateAccountPatch, validateNewAccount } from "./account-input";

/** What the admin may send when creating or editing a client account. */

describe("normalizeEmail", () => {
  it("trims and lower cases", () => {
    expect(normalizeEmail("  Ana@Example.COM ")).toBe("ana@example.com");
  });

  it("refuses what is not an address", () => {
    for (const raw of ["", "ana", "ana@", "@example.com", "ana@example", "a b@example.com", 7, null, undefined]) {
      expect(normalizeEmail(raw)).toBeNull();
    }
  });
});

describe("validateNewAccount", () => {
  it("takes an email, a name and an optional phone", () => {
    const result = validateNewAccount({ email: " Ana@Example.com ", fullName: " Ana Silva ", phone: " +351 900 000 000 " });
    expect(result).toEqual({ ok: true, value: { email: "ana@example.com", fullName: "Ana Silva", phone: "+351 900 000 000" } });
  });

  it("stores no phone as null", () => {
    const result = validateNewAccount({ email: "ana@example.com", fullName: "Ana", phone: "   " });
    expect(result.ok && result.value.phone).toBeNull();
  });

  it("accepts a row's own full_name key", () => {
    const result = validateNewAccount({ email: "ana@example.com", full_name: "Ana Silva" });
    expect(result.ok && result.value.fullName).toBe("Ana Silva");
  });

  it("names the first field that is wrong", () => {
    expect(validateNewAccount({ fullName: "Ana" })).toEqual({ ok: false, error: "Enter an email address." });
    expect(validateNewAccount({ email: "ana@example.com" })).toEqual({ ok: false, error: "Enter the client's name." });
    expect(validateNewAccount({ email: "ana@example.com", fullName: "a".repeat(MAX_NAME_LENGTH + 1) }).ok).toBe(false);
  });
});

describe("validateAccountPatch", () => {
  it("keeps only the keys the body carries", () => {
    expect(validateAccountPatch({ fullName: "Ana Silva" })).toEqual({ ok: true, value: { fullName: "Ana Silva" } });
    expect(validateAccountPatch({ email: "NEW@example.com" })).toEqual({ ok: true, value: { email: "new@example.com" } });
  });

  it("clears the phone when it is sent empty", () => {
    expect(validateAccountPatch({ phone: "" })).toEqual({ ok: true, value: { phone: null } });
  });

  it("refuses a patch that changes nothing", () => {
    expect(validateAccountPatch({})).toEqual({ ok: false, error: "Change something first." });
    expect(validateAccountPatch({ role: "admin" })).toEqual({ ok: false, error: "Change something first." });
  });

  it("refuses an empty name and a bad email", () => {
    expect(validateAccountPatch({ fullName: "  " })).toEqual({ ok: false, error: "Enter the client's name." });
    expect(validateAccountPatch({ email: "nope" })).toEqual({ ok: false, error: "Enter an email address." });
  });
});
