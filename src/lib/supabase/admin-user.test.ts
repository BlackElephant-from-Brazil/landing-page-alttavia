import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin guard against a fake Supabase client. No network: the cookie
 * bound server client is replaced with vi.mock before the module under test
 * loads, and `redirect` throws a marker the tests can catch, the way the
 * real one throws to stop rendering.
 *
 * The fake answers three calls: auth.getUser() (the validated user),
 * auth.getClaims() (the verified claims, `amr` included) and
 * from("users").select("role").eq("id", ...).maybeSingle().
 */

const { state } = vi.hoisted(() => ({
  state: {
    user: null as { id: string; email?: string } | null,
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
  adminErrorResponse,
  getUserWithRole,
  hasPasswordMethod,
  requireAdmin,
  requireAdminPage,
} from "./admin-user";

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = { id: ADMIN_ID, email: "info@alttavia-relocation.com" };

const passwordClaims = { sub: ADMIN_ID, amr: [{ method: "password", timestamp: 1_790_000_000 }] };
const codeClaims = { sub: ADMIN_ID, amr: [{ method: "otp", timestamp: 1_790_000_000 }] };

beforeEach(() => {
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
    expect(await getUserWithRole()).toEqual({ ...ADMIN, role: "admin", needsPassword: false });
  });

  it("treats an admin signed in with an emailed code as a client who needs the password", async () => {
    state.user = ADMIN;
    state.role = "admin";
    state.claims = codeClaims;
    expect(await getUserWithRole()).toEqual({ ...ADMIN, role: "client", needsPassword: true });
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
