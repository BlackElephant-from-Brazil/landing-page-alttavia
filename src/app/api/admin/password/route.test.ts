import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/admin/password against a fake admin guard and fake Supabase
 * clients. No network: requireAdmin, createClient from
 * @supabase/supabase-js (the check's client) and the cookie bound server
 * client are replaced with vi.mock before the route loads. The fakes
 * record every call so the tests can see that the current password is
 * checked with the admin's own email, that the check's session is always
 * signed out, that nothing is updated after a failed check, and that the
 * update goes through the admin's own session (the one Supabase keeps
 * signed in after a password change).
 */

const { state, calls, AdminAuthError } = vi.hoisted(() => {
  class AdminAuthError extends Error {
    readonly status: 401 | 403;
    constructor(status: 401 | 403, message?: string) {
      super(message ?? (status === 401 ? "Sign in to continue." : "Not allowed."));
      this.status = status;
    }
  }
  return {
    AdminAuthError,
    state: {
      guard: null as InstanceType<typeof AdminAuthError> | null,
      signInError: null as { code?: string; status?: number; message: string } | null,
      signInUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      updateError: null as { code?: string; status?: number; message: string } | null,
    },
    calls: {
      signIn: [] as { email: string; password: string }[],
      probeUpdate: [] as { password?: string }[],
      update: [] as { password?: string }[],
      signOut: [] as { scope?: string }[],
      clientOptions: [] as unknown[],
      order: [] as string[],
    },
  };
});

const ADMIN = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "info@alttavia-relocation.com", role: "admin" as const };

vi.mock("@/lib/supabase/admin-user", () => ({
  AdminAuthError,
  async requireAdmin() {
    if (state.guard) throw state.guard;
    return ADMIN;
  },
  adminErrorResponse(error: unknown) {
    if (error instanceof AdminAuthError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Something went wrong on our side." }, { status: 500 });
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient(_url: string, _key: string, options: unknown) {
    calls.clientOptions.push(options);
    return {
      auth: {
        async signInWithPassword(credentials: { email: string; password: string }) {
          calls.signIn.push(credentials);
          calls.order.push("check");
          if (state.signInError) return { data: { user: null, session: null }, error: state.signInError };
          return { data: { user: { id: state.signInUserId }, session: {} }, error: null };
        },
        async updateUser(attributes: { password?: string }) {
          calls.probeUpdate.push(attributes);
          return { data: { user: null }, error: { message: "the check's client must not update" } };
        },
        async signOut(options: { scope?: string }) {
          calls.signOut.push(options);
          calls.order.push("check signed out");
          return { error: null };
        },
      },
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  async createClient() {
    return {
      auth: {
        async updateUser(attributes: { password?: string }) {
          calls.update.push(attributes);
          calls.order.push("update");
          return { data: { user: state.updateError ? null : { id: ADMIN.id } }, error: state.updateError };
        },
      },
    };
  },
}));

import { POST } from "./route";

const CURRENT = "the old password is long";
const NEW = "a brand new sentence here";

function post(body: unknown) {
  return POST(
    new Request("http://localhost:3000/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function answer(response: Response) {
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  state.guard = null;
  state.signInError = null;
  state.signInUserId = ADMIN.id;
  state.updateError = null;
  calls.signIn.length = 0;
  calls.probeUpdate.length = 0;
  calls.update.length = 0;
  calls.signOut.length = 0;
  calls.clientOptions.length = 0;
  calls.order.length = 0;
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/admin/password", () => {
  it("answers the guard's 403 to an admin signed in with a code, before reading anything", async () => {
    state.guard = new AdminAuthError(403, "Sign in with your password.");
    expect(await answer(await post({ currentPassword: CURRENT, newPassword: NEW }))).toEqual({
      status: 403,
      body: { error: "Sign in with your password." },
    });
    expect(calls.signIn).toHaveLength(0);
  });

  it("refuses a body without the two strings", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post({ newPassword: NEW })).status).toBe(400);
    expect((await post({ currentPassword: "", newPassword: NEW })).status).toBe(400);
    expect((await post({ currentPassword: CURRENT, newPassword: 123 })).status).toBe(400);
    expect(calls.signIn).toHaveLength(0);
  });

  it("checks the new password's length and that it differs, before any sign in", async () => {
    expect(await answer(await post({ currentPassword: CURRENT, newPassword: "short one" }))).toEqual({
      status: 422,
      body: { error: "Use at least 12 characters." },
    });
    expect((await answer(await post({ currentPassword: CURRENT, newPassword: "x".repeat(73) }))).body).toEqual({
      error: "Use at most 72 characters.",
    });
    expect((await answer(await post({ currentPassword: CURRENT, newPassword: CURRENT }))).body).toEqual({
      error: "Choose a password different from the current one.",
    });
    expect(calls.signIn).toHaveLength(0);
  });

  it("answers 422 to a wrong current password and updates nothing", async () => {
    state.signInError = { code: "invalid_credentials", status: 400, message: "Invalid login credentials" };
    expect(await answer(await post({ currentPassword: "not the one", newPassword: NEW }))).toEqual({
      status: 422,
      body: { error: "Your current password is not right." },
    });
    expect(calls.signIn).toEqual([{ email: ADMIN.email, password: "not the one" }]);
    expect(calls.update).toHaveLength(0);
  });

  it("answers 429 when Supabase rate limits the check", async () => {
    state.signInError = { code: "over_request_rate_limit", status: 429, message: "Too many requests" };
    expect((await post({ currentPassword: CURRENT, newPassword: NEW })).status).toBe(429);
    expect(calls.update).toHaveLength(0);
  });

  it("checks with a client that keeps nothing, signs the check out, then updates with the admin's own session", async () => {
    expect(await answer(await post({ currentPassword: CURRENT, newPassword: NEW }))).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(calls.clientOptions).toEqual([
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    ]);
    expect(calls.signIn).toEqual([{ email: ADMIN.email, password: CURRENT }]);
    expect(calls.signOut).toEqual([{ scope: "local" }]);
    expect(calls.probeUpdate).toHaveLength(0);
    expect(calls.update).toEqual([{ password: NEW }]);
    expect(calls.order).toEqual(["check", "check signed out", "update"]);
  });

  it("answers 401 when the admin's session ended before the update", async () => {
    state.updateError = { code: "session_not_found", status: 403, message: "Session from session_id claim in JWT does not exist" };
    expect(await answer(await post({ currentPassword: CURRENT, newPassword: NEW }))).toEqual({
      status: 401,
      body: { error: "Sign in to continue." },
    });
  });

  it("maps a weak password to one line, the check signed out already", async () => {
    state.updateError = { code: "weak_password", status: 422, message: "Password is known to be weak" };
    expect(await answer(await post({ currentPassword: CURRENT, newPassword: NEW }))).toEqual({
      status: 422,
      body: { error: "Choose a password that is harder to guess." },
    });
    expect(calls.signOut).toEqual([{ scope: "local" }]);
  });

  it("never updates when the check signed in as someone else", async () => {
    state.signInUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    expect(await answer(await post({ currentPassword: CURRENT, newPassword: NEW }))).toEqual({
      status: 500,
      body: { error: "Something went wrong on our side." },
    });
    expect(calls.update).toHaveLength(0);
    expect(calls.signOut).toEqual([{ scope: "local" }]);
  });

  it("never logs either password", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await post({ currentPassword: CURRENT, newPassword: NEW });
    state.updateError = { status: 500, message: "boom" };
    await post({ currentPassword: CURRENT, newPassword: NEW });
    const logged = JSON.stringify([...info.mock.calls, ...error.mock.calls]);
    expect(logged).not.toContain(CURRENT);
    expect(logged).not.toContain(NEW);
  });
});
