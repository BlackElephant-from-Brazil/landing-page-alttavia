import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "@/lib/db/queries";

/**
 * The three account writes an admin can make, against a fake database and a
 * fake bucket. Deleting an account is the most destructive call in the
 * platform: it empties three bucket prefixes per order and then six tables,
 * so what is pinned here is the order of operations and every refusal that
 * stands in front of it.
 *
 * `steps` records each side effect as it happens. The files must go before a
 * single row does: a bucket that cannot be reached has to leave the account
 * whole, rather than leaving files nothing points at.
 */

type Row = Record<string, unknown>;

const { tables, steps, counts, fail, deleteOrderFiles, auth } = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  steps: [] as string[],
  counts: { value: null as unknown },
  /** What the next profile write answers, for the half finished create. */
  fail: { upsert: null as null | { code?: string; message: string } },
  deleteOrderFiles: vi.fn(),
  auth: {
    createUser: vi.fn(),
    updateUserById: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/r2/prefix", () => ({ deleteOrderFiles }));
vi.mock("@/lib/db/admin-queries", () => ({ getUserDeletionCounts: async () => counts.value }));

import { AccountError, createClientAccount, deleteClientAccount, isEmailTaken, updateClientAccount } from "./accounts";

const CLIENT = "11111111-1111-4111-8111-111111111111";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const ORDER_A = "44444444-4444-4444-8444-444444444444";
const ORDER_B = "55555555-5555-4555-8555-555555555555";

function fakeDb(): Db {
  return {
    auth: { admin: auth },
    from(table: string) {
      const filters: [string, unknown][] = [];
      let inFilter: [string, unknown[]] | null = null;
      let op: "select" | "delete" | "update" | "upsert" = "select";
      let values: Row = {};
      const rows = () => (tables[table] ??= []);
      const matching = () =>
        rows().filter(
          (row) =>
            filters.every(([column, value]) => row[column] === value) &&
            (!inFilter || inFilter[1].includes(row[inFilter[0]])),
        );
      const run = () => {
        if (op === "delete") {
          const hit = matching();
          tables[table] = rows().filter((row) => !hit.includes(row));
          steps.push(`delete ${table} ${hit.length}`);
          return { data: null, error: null };
        }
        if (op === "update") {
          const hit = matching();
          for (const row of hit) Object.assign(row, values);
          steps.push(`update ${table}`);
          return { data: hit.map((row) => ({ ...row })), error: null };
        }
        if (op === "upsert") {
          if (fail.upsert) return { data: null, error: fail.upsert };
          const existing = rows().find((row) => row.id === values.id);
          if (existing) Object.assign(existing, values);
          else rows().push({ ...values });
          steps.push(`upsert ${table}`);
          return { data: null, error: null };
        }
        return { data: matching().map((row) => ({ ...row })), error: null };
      };
      const query = {
        select() {
          return query;
        },
        update(next: Row) {
          op = "update";
          values = next;
          return query;
        },
        upsert(next: Row) {
          op = "upsert";
          values = next;
          return query;
        },
        delete() {
          op = "delete";
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return query;
        },
        in(column: string, list: unknown[]) {
          inFilter = [column, list];
          return query;
        },
        maybeSingle() {
          const answer = run();
          return Promise.resolve({ data: answer.data?.[0] ?? null, error: answer.error });
        },
        then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
          return Promise.resolve(run()).then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as Db;
}

function seed(role: "client" | "admin" = "client", orderIds: string[] = [ORDER_A, ORDER_B]) {
  tables.users = [{ id: CLIENT, email: "ana@example.com", role, full_name: "Ana", phone: null }];
  tables.user_services = orderIds.map((id) => ({ id, user_id: CLIENT }));
  tables.user_answers = [{ id: "answer-1", user_id: CLIENT }];
  tables.user_documents = orderIds.map((id) => ({ id: `doc-${id}`, user_service_id: id }));
}

function remove(options: Partial<{ actorId: string; confirmEmail: string | null }> = {}) {
  return deleteClientAccount(fakeDb(), CLIENT, {
    actorId: options.actorId ?? ACTOR,
    confirmEmail: options.confirmEmail === undefined ? "ana@example.com" : options.confirmEmail,
  });
}

beforeEach(() => {
  for (const key of Object.keys(tables)) delete tables[key];
  steps.length = 0;
  fail.upsert = null;
  counts.value = { orders: 2, paidOrders: 1, documents: 2, deliverables: 0, agreements: 0, answers: 1, files: 3 };
  deleteOrderFiles.mockReset();
  deleteOrderFiles.mockImplementation(async (orderId: string) => {
    steps.push(`files ${orderId}`);
    return 2;
  });
  auth.createUser.mockReset();
  auth.createUser.mockResolvedValue({ data: { user: { id: CLIENT } }, error: null });
  auth.updateUserById.mockReset();
  auth.updateUserById.mockResolvedValue({ data: { user: { id: CLIENT } }, error: null });
  auth.deleteUser.mockReset();
  auth.deleteUser.mockImplementation(async () => {
    steps.push("auth user");
    return { data: null, error: null };
  });
});

describe("isEmailTaken", () => {
  it("knows the address is registered by the code or the wording", () => {
    expect(isEmailTaken({ code: "email_exists" })).toBe(true);
    expect(isEmailTaken({ message: "A user with this email address has already been registered" })).toBe(true);
    expect(isEmailTaken({ message: "User already exists" })).toBe(true);
  });

  it("does not read every 422 as a taken address", () => {
    expect(isEmailTaken({ status: 422, message: "Signups not allowed for this instance" })).toBe(false);
    expect(isEmailTaken({ status: 500, message: "Database error" })).toBe(false);
    expect(isEmailTaken({})).toBe(false);
  });
});

describe("createClientAccount", () => {
  const input = { email: "ben@example.com", fullName: "Ben", phone: null };

  it("creates the auth user and writes the profile", async () => {
    tables.users = [];

    const created = await createClientAccount(fakeDb(), input);

    expect(created).toEqual({ userId: CLIENT });
    expect(tables.users[0]).toMatchObject({ email: "ben@example.com", full_name: "Ben", role: "client" });
  });

  it("answers 409 for an address that is already registered", async () => {
    auth.createUser.mockResolvedValue({ data: { user: null }, error: { code: "email_exists", status: 422 } });

    await expect(createClientAccount(fakeDb(), input)).rejects.toMatchObject({
      name: "AccountError",
      code: "email_taken",
      status: 409,
    });
  });

  it("takes the auth user back when the profile cannot be written", async () => {
    // Otherwise the address is registered to an account with no profile:
    // invisible in /admin, undeletable through the app, and a 409 for every
    // later attempt with the same address.
    tables.users = [];
    fail.upsert = { message: "connection terminated" };

    const failure = await createClientAccount(fakeDb(), input).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(auth.deleteUser).toHaveBeenCalledWith(CLIENT);
    expect(tables.users).toEqual([]);
  });

  it("takes the auth user back when the address is on another profile", async () => {
    tables.users = [];
    fail.upsert = { code: "23505", message: "duplicate key value violates unique constraint" };

    await expect(createClientAccount(fakeDb(), input)).rejects.toMatchObject({
      name: "AccountError",
      code: "email_taken",
      status: 409,
    });
    expect(auth.deleteUser).toHaveBeenCalledWith(CLIENT);
  });

  it("reports the profile failure even when the auth user cannot be taken back", async () => {
    tables.users = [];
    fail.upsert = { message: "connection terminated" };
    auth.deleteUser.mockResolvedValue({ data: null, error: { message: "service unavailable" } });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createClientAccount(fakeDb(), input)).rejects.toBeInstanceOf(Error);

    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("lets another Auth refusal through as a plain error", async () => {
    auth.createUser.mockResolvedValue({
      data: { user: null },
      error: { status: 422, message: "Signups not allowed for this instance" },
    });

    const failure = await createClientAccount(fakeDb(), input).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(AccountError);
  });
});

describe("updateClientAccount", () => {
  it("refuses an administrator account", async () => {
    seed("admin");

    await expect(updateClientAccount(fakeDb(), CLIENT, { email: "new@example.com" })).rejects.toMatchObject({
      code: "is_admin",
      status: 403,
    });
    expect(auth.updateUserById).not.toHaveBeenCalled();
  });

  it("changes the address in Auth before the profile", async () => {
    seed();

    const updated = await updateClientAccount(fakeDb(), CLIENT, { email: "ana2@example.com", fullName: "Ana Maria" });

    expect(auth.updateUserById).toHaveBeenCalledWith(CLIENT, { email: "ana2@example.com", email_confirm: true });
    expect(updated.email).toBe("ana2@example.com");
    expect(updated.full_name).toBe("Ana Maria");
  });
});

describe("deleteClientAccount", () => {
  it("empties the bucket before it deletes a single row, and takes the auth user last", async () => {
    seed();

    const removed = await remove();

    expect(removed.email).toBe("ana@example.com");
    expect(removed.filesDeleted).toBe(4);
    expect(steps.slice(0, 2)).toEqual([`files ${ORDER_A}`, `files ${ORDER_B}`]);
    expect(steps.filter((step) => step.startsWith("files")).length).toBe(2);
    expect(steps[steps.length - 1]).toBe("auth user");
    expect(steps.indexOf("delete users 1")).toBeGreaterThan(steps.indexOf("delete user_answers 1"));
    expect(tables.users).toEqual([]);
    expect(tables.user_services).toEqual([]);
    expect(tables.user_documents).toEqual([]);
  });

  it("refuses an administrator account", async () => {
    seed("admin");

    await expect(remove()).rejects.toMatchObject({ code: "is_admin", status: 403 });
    expect(steps).toEqual([]);
    expect(tables.users).toHaveLength(1);
  });

  it("refuses the account the admin is signed in with", async () => {
    seed();

    await expect(remove({ actorId: CLIENT })).rejects.toMatchObject({ code: "is_self", status: 403 });
    expect(steps).toEqual([]);
  });

  it("refuses a confirmation that does not match the account", async () => {
    seed();

    await expect(remove({ confirmEmail: "ben@example.com" })).rejects.toMatchObject({
      code: "email_mismatch",
      status: 409,
    });
    await expect(remove({ confirmEmail: null })).rejects.toMatchObject({ code: "email_mismatch" });
    expect(steps).toEqual([]);
    expect(tables.users).toHaveLength(1);
  });

  it("takes the confirmation whatever its case and spacing", async () => {
    seed();

    await expect(remove({ confirmEmail: "  Ana@Example.com " })).resolves.toMatchObject({ email: "ana@example.com" });
  });

  it("answers 404 for an account that is not on record", async () => {
    tables.users = [];

    await expect(remove()).rejects.toMatchObject({ code: "not_found", status: 404 });
  });

  it("keeps every row when the bucket cannot be emptied", async () => {
    seed();
    deleteOrderFiles.mockRejectedValue(new Error("bucket unreachable"));

    await expect(remove()).rejects.toThrow("bucket unreachable");
    expect(steps).toEqual([]);
    expect(tables.users).toHaveLength(1);
    expect(tables.user_services).toHaveLength(2);
    expect(auth.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes an account with no order at all", async () => {
    seed("client", []);

    const removed = await remove();

    expect(removed.filesDeleted).toBe(0);
    expect(deleteOrderFiles).not.toHaveBeenCalled();
    expect(tables.users).toEqual([]);
  });
});
