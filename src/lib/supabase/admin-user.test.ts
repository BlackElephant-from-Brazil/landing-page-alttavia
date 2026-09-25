import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin guard against a fake Supabase client. No network: the cookie
 * bound server client is replaced with vi.mock before the module under test
 * loads, and `redirect` throws a marker the tests can catch, the way the
 * real one throws to stop rendering.
 *
 * The fake answers three calls: auth.getUser() (the validated user, with
 * its `factors`), auth.getClaims() (the verified claims, `amr` and `aal`
 * included) and from("users").select("role").eq("id", ...).maybeSingle().
 *
 * ADMIN_REQUIRE_MFA is stubbed per test (vi.stubEnv) and restored after
 * each one, so the machine's own environment never decides a result.
 */

const { state } = vi.hoisted(() => ({
  state: {
    user: null as { id: string; email?: string; factors?: unknown } | null,
    claims: null as Record<string, unknown> | null,
    claimsError: null as { message: string } | null,
    claimsThrows: false,
    role: null as string | null,
    getClaimsCalls: 0,
  },
}));

vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect(path: string): never {
    throw new Error(`REDIRECT ${path}`);
  },
}));

vi.mock("./server", () => ({
  createClient: async () => ({
    auth: {
      async getUser() {
        return { data: { user: state.user }, error: null };
      },
      async getClaims() {
        state.getClaimsCalls += 1;
        if (state.claimsThrows) throw new Error("network down");
        if (state.claimsError) return { data: null, error: state.claimsError };
        return { data: state.claims ? { claims: state.claims } : null, error: null };
      },
    },
    from(table: string) {
      if (table !== "users") throw new Error(`unexpected table ${table}`);
      let id: unknown = null;
      const query = {
        select() {
          return query;
        },
        eq(column: string, value: unknown) {
          if (column === "id") id = value;
          return query;
        },
        async maybeSingle() {
          const found = state.user && id === state.user.id && state.role !== null;
          return { data: found ? { role: state.role } : null, error: null };
        },
      };
      return query;
    },
  }),
}));

import {
  AdminAuthError,
  PASSWORD_REQUIRED,
  REQUIRE_MFA_ENV,
  SECOND_FACTOR_REQUIRED,
  adminAccess,
  adminErrorResponse,
  getUserWithRole,
  hasPasswordMethod,
  hasVerifiedFactor,
  mfaRequiredForAll,
  requireAdmin,
  requireAdminPage,
} from "./admin-user";

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = { id: ADMIN_ID, email: "info@alttavia-relocation.com" };

const passwordClaims = { sub: ADMIN_ID, aal: "aal1", amr: [{ method: "password", timestamp: 1_790_000_000 }] };
const codeClaims = { sub: ADMIN_ID, aal: "aal1", amr: [{ method: "otp", timestamp: 1_790_000_000 }] };
/** A password sign in followed by the authenticator code: Supabase adds the totp entry and raises aal. */
const passwordAndCodeClaims = {
  sub: ADMIN_ID,
  aal: "aal2",
  amr: [
    { method: "totp", timestamp: 1_790_000_060 },
    { method: "password", timestamp: 1_790_000_000 },
  ],
};
/** An emailed code followed by the authenticator code: aal2, and still no password. */
const codeAndTotpClaims = {
  sub: ADMIN_ID,
  aal: "aal2",
  amr: [
    { method: "totp", timestamp: 1_790_000_060 },
    { method: "otp", timestamp: 1_790_000_000 },
  ],
};

const VERIFIED_TOTP = { id: "f1", factor_type: "totp", status: "verified", created_at: "2026-09-25T09:00:00Z" };
const UNVERIFIED_TOTP = { id: "f2", factor_type: "totp", status: "unverified", created_at: "2026-09-25T09:00:00Z" };
const ENROLLED_ADMIN = { ...ADMIN, factors: [VERIFIED_TOTP] };

/** What getUserWithRole answers for an admin who may act as one. */
const asAdmin = { ...ADMIN, role: "admin", needsPassword: false, needsCode: false };
/** What it answers for an admin whose password session still needs the code. */
const needsCode = { ...ADMIN, role: "client", needsPassword: true, needsCode: true };

afterEach(() => {
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv(REQUIRE_MFA_ENV, "");
  state.user = null;
  state.claims = null;
  state.claimsError = null;
  state.claimsThrows = false;
  state.role = null;
  state.getClaimsCalls = 0;
});

describe("hasPasswordMethod", () => {
  it("accepts an amr claim that lists a password sign in", () => {
    expect(hasPasswordMethod([{ method: "password", timestamp: 1 }])).toBe(true);
    // A second factor adds its own entry next to the password one.
    expect(hasPasswordMethod([{ method: "totp", timestamp: 2 }, { method: "password", timestamp: 1 }])).toBe(true);
  });

  it("refuses every other method and every malformed claim", () => {
    for (const method of ["otp", "magiclink", "recovery", "email/signup", "invite", "oauth", "anonymous", "token_refresh"]) {
      expect(hasPasswordMethod([{ method, timestamp: 1 }])).toBe(false);
    }
    expect(hasPasswordMethod(undefined)).toBe(false);
    expect(hasPasswordMethod(null)).toBe(false);
    expect(hasPasswordMethod([])).toBe(false);
    expect(hasPasswordMethod("password")).toBe(false);
    expect(hasPasswordMethod(["password"])).toBe(false);
    expect(hasPasswordMethod([null, { method: "Password" }, { methods: "password" }])).toBe(false);
    expect(hasPasswordMethod({ method: "password" })).toBe(false);
  });
});

describe("getUserWithRole", () => {
  it("is null when signed out, and for a user without an email", async () => {
    expect(await getUserWithRole()).toBeNull();
    state.user = { id: ADMIN_ID };
    expect(await getUserWithRole()).toBeNull();
  });

  it("gives an admin signed in with a password the admin role", async () => {
    state.user = ADMIN;
    state.role = "admin";
    state.claims = passwordClaims;
    expect(await getUserWithRole()).toEqual(asAdmin);
  });

  it("treats an admin signed in with an emailed code as a client who needs the password", async () => {
    state.user = ADMIN;
    state.role = "admin";
    state.claims = codeClaims;
    expect(await getUserWithRole()).toEqual({
      ...ADMIN,
      role: "client",
      needsPassword: true,
      needsCode: false,
    });
  });

  it("fails closed when the claims cannot be verified, are missing or belong to someone else", async () => {
    state.user = ADMIN;
    state.role = "admin";

    state.claimsError = { message: "Invalid JWT signature" };
    expect(await getUserWithRole()).toMatchObject({ role: "client", needsPassword: true });

    state.claimsError = null;
    state.claims = null;
    expect(await getUserWithRole()).toMatchObject({ role: "client", needsPassword: true });

    state.claims = { ...passwordClaims, sub: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    expect(await getUserWithRole()).toMatchObject({ role: "client", needsPassword: true });

    state.claims = { sub: ADMIN_ID };
    expect(await getUserWithRole()).toMatchObject({ role: "client", needsPassword: true });

    state.claims = passwordClaims;
    state.claimsThrows = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await getUserWithRole()).toMatchObject({ role: "client", needsPassword: true });
    spy.mockRestore();
  });

  it("keeps a client a client whatever the sign in method, without reading the claims", async () => {
    state.user = { id: ADMIN_ID, email: "client@example.com" };
    state.role = "client";
    state.claims = passwordClaims;
    expect(await getUserWithRole()).toEqual({
      id: ADMIN_ID,
      email: "client@example.com",
      role: "client",
      needsPassword: false,
      needsCode: false,
    });

    state.role = null; // no profile row: nothing is granted by absence
    expect(await getUserWithRole()).toMatchObject({ role: "client", needsPassword: false });
    expect(state.getClaimsCalls).toBe(0);
  });
});

describe("requireAdmin", () => {
  async function statusOf(): Promise<{ status: number; error: string } | "admin"> {
    try {
      await requireAdmin();
      return "admin";
    } catch (error) {
      if (!(error instanceof AdminAuthError)) throw error;
      const response = adminErrorResponse(error);
      const body = (await response.json()) as { error: string };
      return { status: response.status, error: body.error };
    }
  }

  it("answers 401 signed out and 403 for a client", async () => {
    expect(await statusOf()).toEqual({ status: 401, error: "Sign in to continue." });
    state.user = { id: ADMIN_ID, email: "client@example.com" };
    state.role = "client";
    state.claims = passwordClaims;
    expect(await statusOf()).toEqual({ status: 403, error: "Not allowed." });
  });

  it("answers 403 with the password line for an admin signed in with a code", async () => {
    state.user = ADMIN;
    state.role = "admin";
    state.claims = codeClaims;
    expect(await statusOf()).toEqual({ status: 403, error: PASSWORD_REQUIRED });
    expect(PASSWORD_REQUIRED).toBe("Sign in with your password.");
  });

  it("returns the admin for a password session, with no extra fields", async () => {
    state.user = ADMIN;
    state.role = "admin";
    state.claims = passwordClaims;
    expect(await requireAdmin()).toEqual({ ...ADMIN, role: "admin" });
  });
});

describe("requireAdminPage", () => {
  it("sends a code session and a signed out visitor to /admin/login", async () => {
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT /admin/login");
    state.user = ADMIN;
    state.role = "admin";
    state.claims = codeClaims;
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT /admin/login");
  });

  it("lets a password session through", async () => {
    state.user = ADMIN;
    state.role = "admin";
    state.claims = passwordClaims;
    await expect(requireAdminPage()).resolves.toEqual({ ...ADMIN, role: "admin" });
  });
});

describe("hasVerifiedFactor", () => {
  it("is true when any factor is verified, whatever its type", () => {
    expect(hasVerifiedFactor([VERIFIED_TOTP])).toBe(true);
    expect(hasVerifiedFactor([UNVERIFIED_TOTP, VERIFIED_TOTP])).toBe(true);
    expect(hasVerifiedFactor([{ id: "p", factor_type: "phone", status: "verified" }])).toBe(true);
  });

  it("ignores a set up left halfway and every malformed value", () => {
    expect(hasVerifiedFactor([UNVERIFIED_TOTP])).toBe(false);
    expect(hasVerifiedFactor([])).toBe(false);
    expect(hasVerifiedFactor(undefined)).toBe(false);
    expect(hasVerifiedFactor(null)).toBe(false);
    expect(hasVerifiedFactor("verified")).toBe(false);
    expect(hasVerifiedFactor([null, "verified", { status: "Verified" }])).toBe(false);
  });
});

describe("mfaRequiredForAll", () => {
  it("is on for the exact value 1 only", () => {
    expect(mfaRequiredForAll({ [REQUIRE_MFA_ENV]: "1" })).toBe(true);
    for (const value of [undefined, "", "0", "true", "yes", " 1", "1 "]) {
      expect(mfaRequiredForAll({ [REQUIRE_MFA_ENV]: value })).toBe(false);
    }
  });
});

describe("adminAccess", () => {
  const base = { storedAdmin: true, password: true, aal2: false, enrolled: false, requireForAll: false };
  const admin = { role: "admin", needsPassword: false, needsCode: false };
  const code = { role: "client", needsPassword: true, needsCode: true };
  const password = { role: "client", needsPassword: true, needsCode: false };
  const client = { role: "client", needsPassword: false, needsCode: false };

  it("keeps a client a client, whatever the session holds", () => {
    expect(adminAccess({ ...base, storedAdmin: false, aal2: true, enrolled: true, requireForAll: true })).toEqual(client);
  });

  it("asks for the password first, second factor or not", () => {
    expect(adminAccess({ ...base, password: false })).toEqual(password);
    expect(adminAccess({ ...base, password: false, aal2: true, enrolled: true })).toEqual(password);
  });

  it("soft mode: a password is enough while the account has no factor", () => {
    expect(adminAccess(base)).toEqual(admin);
  });

  it("enrolled means required, even in soft mode", () => {
    expect(adminAccess({ ...base, enrolled: true })).toEqual(code);
    expect(adminAccess({ ...base, enrolled: true, aal2: true })).toEqual(admin);
  });

  it("ADMIN_REQUIRE_MFA=1 asks every admin for the code", () => {
    expect(adminAccess({ ...base, requireForAll: true })).toEqual(code);
    expect(adminAccess({ ...base, requireForAll: true, aal2: true })).toEqual(admin);
    expect(adminAccess({ ...base, requireForAll: true, enrolled: true, aal2: true })).toEqual(admin);
  });
});

describe("getUserWithRole with a second factor", () => {
  it("soft mode: accepts a password session at aal1 when the admin has no factor", async () => {
    state.user = ADMIN;
    state.role = "admin";
    state.claims = passwordClaims;
    expect(await getUserWithRole()).toEqual(asAdmin);
  });

  it("soft mode: a set up left halfway does not ask for the code", async () => {
    state.user = { ...ADMIN, factors: [UNVERIFIED_TOTP] };
    state.role = "admin";
    state.claims = passwordClaims;
    expect(await getUserWithRole()).toEqual(asAdmin);
  });

  it("soft mode: an enrolled admin at aal1 still needs the code", async () => {
    state.user = ENROLLED_ADMIN;
    state.role = "admin";
    state.claims = passwordClaims;
    expect(await getUserWithRole()).toEqual(needsCode);
  });

  it("gives an enrolled admin at aal2 with a password the admin role", async () => {
    state.user = ENROLLED_ADMIN;
    state.role = "admin";
    state.claims = passwordAndCodeClaims;
    expect(await getUserWithRole()).toEqual(asAdmin);
  });

  it("ADMIN_REQUIRE_MFA=1: a password session at aal1 needs the code, factor or not", async () => {
    vi.stubEnv(REQUIRE_MFA_ENV, "1");
    state.user = ADMIN;
    state.role = "admin";
    state.claims = passwordClaims;
    expect(await getUserWithRole()).toEqual(needsCode);

    state.user = ENROLLED_ADMIN;
    expect(await getUserWithRole()).toEqual(needsCode);
  });

  it("ADMIN_REQUIRE_MFA=1: aal2 with a password is an admin", async () => {
    vi.stubEnv(REQUIRE_MFA_ENV, "1");
    state.user = ENROLLED_ADMIN;
    state.role = "admin";
    state.claims = passwordAndCodeClaims;
    expect(await getUserWithRole()).toEqual(asAdmin);
  });

  it("reads any other value of ADMIN_REQUIRE_MFA as soft mode", async () => {
    vi.stubEnv(REQUIRE_MFA_ENV, "true");
    state.user = ADMIN;
    state.role = "admin";
    state.claims = passwordClaims;
    expect(await getUserWithRole()).toMatchObject({ role: "admin", needsCode: false });
  });

  it("keeps the password rule: an emailed code plus the app code is not an admin", async () => {
    vi.stubEnv(REQUIRE_MFA_ENV, "1");
    state.user = ENROLLED_ADMIN;
    state.role = "admin";
    state.claims = codeAndTotpClaims;
    expect(await getUserWithRole()).toEqual({
      ...ADMIN,
      role: "client",
      needsPassword: true,
      needsCode: false,
    });
  });

  it("fails closed on aal too: an aal2 claim that cannot be verified counts for nothing", async () => {
    state.user = ENROLLED_ADMIN;
    state.role = "admin";
    state.claims = passwordAndCodeClaims;
    state.claimsError = { message: "Invalid JWT signature" };
    expect(await getUserWithRole()).toMatchObject({ role: "client", needsPassword: true });

    state.claimsError = null;
    state.claims = { ...passwordAndCodeClaims, sub: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    expect(await getUserWithRole()).toMatchObject({ role: "client", needsPassword: true });

    state.claims = { ...passwordAndCodeClaims, aal: "AAL2" };
    expect(await getUserWithRole()).toMatchObject({ role: "client", needsCode: true });
  });

  it("never reports a client's factors", async () => {
    state.user = { id: ADMIN_ID, email: "client@example.com", factors: [VERIFIED_TOTP] };
    state.role = "client";
    state.claims = passwordAndCodeClaims;
    expect(await getUserWithRole()).toMatchObject({ role: "client", needsCode: false });
  });
});

describe("requireAdmin and requireAdminPage with a second factor", () => {
  it("answers 403 with the password and code line for an enrolled admin at aal1", async () => {
    state.user = ENROLLED_ADMIN;
    state.role = "admin";
    state.claims = passwordClaims;
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403, message: SECOND_FACTOR_REQUIRED });
    expect(SECOND_FACTOR_REQUIRED).toBe("Sign in with your password and your code.");
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT /admin/login");
  });

  it("answers 403 with the same line in enforced mode for an admin without a factor", async () => {
    vi.stubEnv(REQUIRE_MFA_ENV, "1");
    state.user = ADMIN;
    state.role = "admin";
    state.claims = passwordClaims;
    const response = adminErrorResponse(await requireAdmin().catch((error: unknown) => error));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: SECOND_FACTOR_REQUIRED });
  });

  it("lets an aal2 password session through, with no extra fields", async () => {
    vi.stubEnv(REQUIRE_MFA_ENV, "1");
    state.user = ENROLLED_ADMIN;
    state.role = "admin";
    state.claims = passwordAndCodeClaims;
    expect(await requireAdmin()).toEqual({ ...ADMIN, role: "admin" });
    await expect(requireAdminPage()).resolves.toEqual({ ...ADMIN, role: "admin" });
  });

  it("still answers the password line, not the code line, for an emailed code session", async () => {
    vi.stubEnv(REQUIRE_MFA_ENV, "1");
    state.user = ENROLLED_ADMIN;
    state.role = "admin";
    state.claims = codeClaims;
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403, message: PASSWORD_REQUIRED });
  });
});
