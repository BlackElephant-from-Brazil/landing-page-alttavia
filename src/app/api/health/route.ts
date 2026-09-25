import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/health: is the site up and can it reach its database. Public, no
 * session: an uptime monitor calls it every few minutes, and the Supabase
 * project on the free tier pauses after seven days without traffic, which
 * this also catches.
 *
 * 200 `{ ok: true, db: "ok", at }` after the cheapest read there is (one id
 * from `services`, the catalogue every page reads anyway), with the admin
 * client so row level security cannot turn an empty answer into a false
 * "up". 503 `{ ok: false, db: "down" }` when the read fails, throws or takes
 * longer than five seconds. The reason goes to the server log only: it can
 * name the project, a key or a table, and this route answers anyone.
 *
 * Never cached (`no-store`, and the handler is dynamic), so a monitor never
 * reads an answer older than its own request. It reads nothing from the
 * request and writes nothing.
 */

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 5000;

const HEADERS = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const { error } = await createAdminClient()
      .from("services")
      .select("id")
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error("GET /api/health: database read failed:", err);
    return Response.json({ ok: false, db: "down" }, { status: 503, headers: HEADERS });
  }

  return Response.json({ ok: true, db: "ok", at: new Date().toISOString() }, { status: 200, headers: HEADERS });
}
