import { describe, expect, it } from "vitest";

import {
  cleanCode,
  factorName,
  groupSecret,
  mfaCopy,
  mfaErrorLine,
  mfaErrors,
  nextLoginStep,
  qrImageSrc,
  unverifiedTotpIds,
  verifiedTotpFactors,
} from "./mfa-helpers";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#000000" d="M0 0h1v1H0z"/></svg>';

describe("qrImageSrc", () => {
  it("re-encodes the data URL supabase-js builds, so a # cannot cut it short", () => {
    const src = qrImageSrc(`data:image/svg+xml;utf-8,${SVG}`);
    expect(src).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`);
    expect(src).not.toContain("#");
    expect(decodeURIComponent(src!.split(",").slice(1).join(","))).toBe(SVG);
  });

  it("takes the bare markup and an XML declaration too", () => {
    expect(qrImageSrc(SVG)).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`);
    const withDeclaration = `<?xml version="1.0" encoding="UTF-8"?>\n${SVG}`;
    expect(qrImageSrc(withDeclaration)).toBe(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(withDeclaration)}`);
  });

  it("answers null for anything that is not an SVG", () => {
    expect(qrImageSrc("")).toBeNull();
    expect(qrImageSrc(undefined)).toBeNull();
    expect(qrImageSrc(42)).toBeNull();
    expect(qrImageSrc("data:image/svg+xml;utf-8,<script>alert(1)</script>")).toBeNull();
    expect(qrImageSrc("javascript:alert(1)")).toBeNull();
    expect(qrImageSrc("<svgx>")).toBeNull();
  });
});

describe("cleanCode", () => {
  it("keeps six digits of whatever was typed or pasted", () => {
    expect(cleanCode("123456")).toBe("123456");
    expect(cleanCode("123 456")).toBe("123456");
    expect(cleanCode(" 12-34-56 ")).toBe("123456");
    expect(cleanCode("1234567")).toBe("123456");
    expect(cleanCode("abc")).toBe("");
  });
});

describe("groupSecret", () => {
  it("splits the key in groups of four", () => {
    expect(groupSecret("JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
    expect(groupSecret("ABCDEF")).toBe("ABCD EF");
    expect(groupSecret("AB CD")).toBe("ABCD");
    expect(groupSecret("")).toBe("");
  });
});

describe("factorName", () => {
  it("carries the minute of the set up, so two set ups never share a name", () => {
    expect(factorName(new Date("2026-09-25T09:41:07Z"))).toBe("Authenticator app 2026-09-25 09:41");
  });
});

describe("mfaErrorLine", () => {
  it("names a wrong code, a rate limit, a switched off feature and an ended session", () => {
    expect(mfaErrorLine({ code: "mfa_verification_failed", status: 422 })).toBe(mfaErrors.codeWrong);
    expect(mfaErrorLine({ code: "mfa_verification_rejected", status: 422 })).toBe(mfaErrors.codeWrong);
    expect(mfaErrorLine({ status: 400 })).toBe(mfaErrors.codeWrong);
    expect(mfaErrorLine({ code: "mfa_challenge_expired", status: 422 })).toBe(mfaErrors.expired);
    expect(mfaErrorLine({ code: "over_request_rate_limit", status: 429 })).toBe(mfaErrors.rateLimited);
    expect(mfaErrorLine({ status: 429 })).toBe(mfaErrors.rateLimited);
    expect(mfaErrorLine({ code: "mfa_totp_enroll_not_enabled", status: 422 })).toBe(mfaErrors.notEnabled);
    expect(mfaErrorLine({ code: "mfa_totp_verify_not_enabled", status: 422 })).toBe(mfaErrors.notEnabled);
    expect(mfaErrorLine({ code: "session_not_found", status: 403 })).toBe(mfaErrors.signIn);
    expect(mfaErrorLine({ status: 401 })).toBe(mfaErrors.signIn);
  });

  it("falls back to the generic line, never Supabase's own words", () => {
    expect(mfaErrorLine(null)).toBe(mfaErrors.generic);
    expect(mfaErrorLine({ status: 500 })).toBe(mfaErrors.generic);
    expect(mfaErrorLine({ code: "unexpected_failure", status: 500 })).toBe(mfaErrors.generic);
    expect(mfaErrorLine({ code: "insufficient_aal", status: 403 })).toBe(mfaErrors.generic);
  });
});

describe("verifiedTotpFactors and unverifiedTotpIds", () => {
  const factors = [
    { id: "b", factor_type: "totp", status: "verified", created_at: "2026-09-25T10:00:00Z" },
    { id: "a", factor_type: "totp", status: "verified", created_at: "2026-09-24T10:00:00Z" },
    { id: "c", factor_type: "totp", status: "unverified", created_at: "2026-09-25T11:00:00Z" },
    { id: "d", factor_type: "phone", status: "verified", created_at: "2026-09-20T10:00:00Z" },
    { id: 7, factor_type: "totp", status: "verified" },
    null,
    "totp",
  ];

  it("keeps the verified TOTP factors, oldest first", () => {
    expect(verifiedTotpFactors(factors)).toEqual([
      { id: "a", createdAt: "2026-09-24T10:00:00Z" },
      { id: "b", createdAt: "2026-09-25T10:00:00Z" },
    ]);
    expect(verifiedTotpFactors(undefined)).toEqual([]);
  });

  it("lists the set ups left halfway", () => {
    expect(unverifiedTotpIds(factors)).toEqual(["c"]);
    expect(unverifiedTotpIds(null)).toEqual([]);
  });
});

describe("nextLoginStep", () => {
  it("asks for the code when the account has a factor and the session is at aal1", () => {
    expect(nextLoginStep({ currentLevel: "aal1", nextLevel: "aal2" }, false)).toBe("code");
    expect(nextLoginStep({ currentLevel: "aal1", nextLevel: "aal2" }, true)).toBe("code");
  });

  it("goes on when there is no factor in soft mode, or when the session is already at aal2", () => {
    expect(nextLoginStep({ currentLevel: "aal1", nextLevel: "aal1" }, false)).toBe("continue");
    expect(nextLoginStep({ currentLevel: "aal2", nextLevel: "aal2" }, false)).toBe("continue");
    expect(nextLoginStep({ currentLevel: "aal2", nextLevel: "aal2" }, true)).toBe("continue");
    expect(nextLoginStep(null, true)).toBe("continue");
  });

  it("leads an admin without a factor to the set up when every admin must have one", () => {
    expect(nextLoginStep({ currentLevel: "aal1", nextLevel: "aal1" }, true)).toBe("enrol");
  });
});

describe("copy", () => {
  it("follows the house rules", () => {
    const lines = [
      ...Object.values(mfaErrors),
      ...Object.values(mfaCopy).flatMap((value) =>
        typeof value === "string" ? [value] : typeof value === "function" ? [value("25 Sep 2026")] : Object.values(value),
      ),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/[–—]/);
      expect(line).not.toMatch(/\b(problem|trap|free|refund|money back|video call)\b/i);
    }
  });
});
