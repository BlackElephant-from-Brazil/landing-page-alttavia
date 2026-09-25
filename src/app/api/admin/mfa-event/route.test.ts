import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/admin/mfa-event: the audit line of a second factor turned on or
 * off. requireAdmin() is replaced by one that reads `session` and throws the
 * real AdminAuthError; Supabase Auth by a client whose getUser() answers
 * `auth.user`, so the route's own check (is the change really on the
 * account) runs for real.
 */

type Factor = { id: string; status: "verified" | "unverified"; factor_type: "totp" };

const { session, auth } = vi.hoisted(() => ({
  session: { user: null as { id: string; email: string; role: "client" | "admin" } | null },
  auth: {
    user: null as { id: string; factors?: Factor[] } | null,
    error: null as { message: string } | null,
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: auth.user }, error: auth.error }) },
  }),
}));
vi.mock("@/lib/supabase/admin-user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/admin-user")>();
  return {
    ...actual,
    requireAdmin: async () => {
      if (!session.user) throw new actual.AdminAuthError(401);
      if (session.user.role !== "admin") throw new actual.AdminAuthError(403);
      return { id: session.user.id, email: session.user.email, role: "admin" as const };
    },
  };
});

import { POST } from "./route";

const ADMIN = { id: "99999999-9999-4999-8999-999999999999", email: "info@alttavia-relocation.com", role: "admin" as const };
const CLIENT = { id: "11111111-1111-4111-8111-111111111111", email: "client@example.com", role: "client" as const };
const FACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function post(body: unknown) {
  return POST(
    new Request("http://localhost:3000/api/admin/mfa-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

let info: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  session.user = ADMIN;
  auth.user = { id: ADMIN.id, factors: [] };
  auth.error = null;
  info = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/admin/mfa-event", () => {
  it("writes the audit line of a factor the account now has, verified", async () => {
    auth.user = { id: ADMIN.id, factors: [{ id: FACTOR, status: "verified", factor_type: "totp" }] };

    const response = await post({ action: "enrol", factorId: FACTOR });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(info).toHaveBeenCalledWith(`[admin] ${ADMIN.id} mfa.enrol ${FACTOR}`);
  });

  it("writes the audit line of a factor the account no longer has", async () => {
    const response = await post({ action: "unenrol", factorId: FACTOR });

    expect(response.status).toBe(200);
    expect(info).toHaveBeenCalledWith(`[admin] ${ADMIN.id} mfa.unenrol ${FACTOR}`);
  });

  it("writes nothing when the account does not show the change", async () => {
    auth.user = { id: ADMIN.id, factors: [{ id: FACTOR, status: "unverified", factor_type: "totp" }] };
    const halfway = await post({ action: "enrol", factorId: FACTOR });
    expect(halfway.status).toBe(409);
    expect(await errorOf(halfway)).toBe("This change is not on your account.");

    auth.user = { id: ADMIN.id, factors: [{ id: FACTOR, status: "verified", factor_type: "totp" }] };
    const stillThere = await post({ action: "unenrol", factorId: FACTOR });
    expect(stillThere.status).toBe(409);

    auth.user = { id: ADMIN.id };
    expect((await post({ action: "enrol", factorId: FACTOR })).status).toBe(409);

    expect(info).not.toHaveBeenCalled();
  });

  it("refuses a body it cannot read, before Supabase is asked", async () => {
    for (const body of ["not json", [], { action: "delete", factorId: FACTOR }, { action: "enrol", factorId: "abc" }, {}]) {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(await errorOf(response)).toBe("Check the details and try again.");
    }
    expect(info).not.toHaveBeenCalled();
  });

  it("answers 401 signed out and 403 for a client, writing nothing", async () => {
    session.user = null;
    expect((await post({ action: "enrol", factorId: FACTOR })).status).toBe(401);

    session.user = CLIENT;
    expect((await post({ action: "enrol", factorId: FACTOR })).status).toBe(403);

    expect(info).not.toHaveBeenCalled();
  });

  it("answers 401 when the session behind the admin check is gone or is someone else's", async () => {
    auth.user = null;
    auth.error = { message: "Auth session missing!" };
    expect((await post({ action: "unenrol", factorId: FACTOR })).status).toBe(401);

    auth.user = { id: CLIENT.id, factors: [] };
    auth.error = null;
    expect((await post({ action: "unenrol", factorId: FACTOR })).status).toBe(401);

    expect(info).not.toHaveBeenCalled();
  });
});
