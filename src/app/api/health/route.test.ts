import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GET /api/health against a stand in for the admin client: the answer when
 * the database reads, the answer when it does not, and that the reason
 * never reaches the caller.
 */

const { answer, reads, construct } = vi.hoisted(() => ({
  /** What the read resolves with, or rejects with when `reject` is set. */
  answer: { value: { data: [{ id: "x" }], error: null } as unknown, reject: null as Error | null },
  /** Every read the route made: table, columns, limit, and whether it carried a signal. */
  reads: [] as { table: string; columns: string; limit: number; signal: boolean }[],
  /** Replaced to make the client itself fail, as it does without its env vars. */
  construct: { fail: false },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (construct.fail) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set. See .env.example.");
    }
    return {
      from(table: string) {
        return {
          select(columns: string) {
            return {
              limit(limit: number) {
                return {
                  abortSignal(signal: AbortSignal) {
                    reads.push({ table, columns, limit, signal: signal instanceof AbortSignal });
                    return answer.reject ? Promise.reject(answer.reject) : Promise.resolve(answer.value);
                  },
                };
              },
            };
          },
        };
      },
    };
  },
}));

import { GET } from "./route";

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  answer.value = { data: [{ id: "11111111-1111-4111-8111-111111111111" }], error: null };
  answer.reject = null;
  construct.fail = false;
  reads.length = 0;
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
});

describe("GET /api/health", () => {
  it("answers 200 with the time after one cheap read of the catalogue", async () => {
    const before = Date.now();
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as { ok: boolean; db: string; at: string };
    expect(body).toEqual({ ok: true, db: "ok", at: expect.any(String) });
    expect(body.at).toBe(new Date(body.at).toISOString());
    expect(Date.parse(body.at)).toBeGreaterThanOrEqual(before - 1);
    expect(reads).toEqual([{ table: "services", columns: "id", limit: 1, signal: true }]);
    expect(logged).not.toHaveBeenCalled();
  });

  it("answers 200 on an empty catalogue: the database answered", async () => {
    answer.value = { data: [], error: null };

    expect((await GET()).status).toBe(200);
  });

  it("answers 503 when the database answers an error, without its text", async () => {
    answer.value = { data: null, error: { message: 'relation "public.services" does not exist', code: "42P01" } };

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ ok: false, db: "down" });
    expect(text).not.toMatch(/relation|services|42P01/);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("answers 503 when the read throws, as a timeout or a paused project does", async () => {
    answer.reject = new Error("The operation was aborted due to timeout");

    const response = await GET();

    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ ok: false, db: "down" });
    expect(text).not.toMatch(/abort|timeout/i);
  });

  it("answers 503 when the client cannot be built, without naming the variables", async () => {
    construct.fail = true;

    const response = await GET();

    expect(response.status).toBe(503);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ ok: false, db: "down" });
    expect(text).not.toMatch(/SUPABASE|env/);
    expect(logged).toHaveBeenCalledTimes(1);
  });
});
