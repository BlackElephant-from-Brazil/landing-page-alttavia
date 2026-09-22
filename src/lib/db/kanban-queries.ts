/**
 * The read behind the orders board. Contract (docs/admin-contract.md)
 * section 7: the board is the same list the table shows, with the same
 * filters, laid out by stage instead of by row.
 *
 * It has its own query because listOrders in admin-queries.ts is the
 * table's: it pages, and it caps a page at MAX_PAGE_SIZE (100), while a
 * board draws every matching order up to its own limit in one go. The
 * filters, the date column rule and the sort are copied from it on purpose,
 * so a filter set on one view means the same on the other. The two private
 * helpers below (`rangeEnd`, `emailNeedle`) are copies for the same reason;
 * admin-queries.ts does not export them.
 *
 * `total` is the count before the limit, so the page can say how many
 * orders the board is leaving out. Database errors are thrown, not
 * swallowed.
 */

import type { Db } from "./queries";
import type { AdminOrderRow, OrderFilters, UserRow } from "./types";

/** An order on the board: the table's row plus the client's name when the profile has one. */
export type KanbanOrderRow = AdminOrderRow & {
  user_name: string | null;
};

export type KanbanFilters = Omit<OrderFilters, "page" | "pageSize"> & {
  /** The most rows to read. Clamped to 1..MAX_BOARD_SIZE. */
  limit?: number;
};

const DEFAULT_BOARD_SIZE = 300;
const MAX_BOARD_SIZE = 500;

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(where: string, error: { message: string }): never {
  throw new Error(`${where}: ${error.message}`);
}

/** The day after a bare `YYYY-MM-DD`, so a `to` includes the whole of that day. */
function rangeEnd(to: string): { op: "lt" | "lte"; value: string } {
  if (!BARE_DATE.test(to)) return { op: "lte", value: to };
  const next = new Date(`${to}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return { op: "lt", value: next.toISOString().slice(0, 10) };
}

/** The email search, reduced to what an email can hold; PostgREST syntax and ILIKE wildcards are dropped. */
function emailNeedle(q: string): string {
  return q.trim().toLowerCase().replace(/[^a-z0-9@.+_-]/g, "");
}

/** The slice of a PostgREST filter builder the board chains on, as in admin-queries.ts. */
type Filterable = {
  is(column: string, value: null): Filterable;
  not(column: string, operator: string, value: unknown): Filterable;
  eq(column: string, value: unknown): Filterable;
  ilike(column: string, pattern: string): Filterable;
  gte(column: string, value: string): Filterable;
  filter(column: string, operator: "lt" | "lte", value: string): Filterable;
};

/**
 * The orders a board draws: filtered and ordered in the database, newest
 * first, capped at `limit`, with the client's name joined in a second read
 * (the `admin_order_summary` view carries the email, not the name).
 */
export async function listOrdersForBoard(
  db: Db,
  filters: KanbanFilters = {},
): Promise<{ rows: KanbanOrderRow[]; total: number }> {
  const status = filters.status ?? "all";
  const limit = Math.min(MAX_BOARD_SIZE, Math.max(1, Math.floor(filters.limit ?? DEFAULT_BOARD_SIZE)));
  const dateColumn = status === "paid" || status === "completed" ? "paid_at" : "created_at";

  function filtered<T>(query: T): T {
    let q = query as unknown as Filterable;
    if (status === "open") q = q.is("paid_at", null);
    if (status === "paid") q = q.not("paid_at", "is", null).is("completed_at", null);
    if (status === "completed") q = q.not("completed_at", "is", null);

    if (filters.serviceSlug) q = q.eq("service_slug", filters.serviceSlug);

    const needle = filters.q ? emailNeedle(filters.q) : "";
    if (needle) q = q.ilike("user_email", `%${needle}%`);

    if (filters.from) q = q.gte(dateColumn, filters.from);
    if (filters.to) {
      const end = rangeEnd(filters.to);
      q = q.filter(dateColumn, end.op, end.value);
    }
    return q as unknown as T;
  }

  const { data, error, count } = await filtered(db.from("admin_order_summary").select("*", { count: "exact" }))
    .order(dateColumn, { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("listOrdersForBoard", error);

  const orders = (data ?? []) as AdminOrderRow[];
  const names = await namesFor(db, orders);

  return {
    rows: orders.map((order) => ({ ...order, user_name: names.get(order.user_id) ?? null })),
    total: count ?? orders.length,
  };
}

/**
 * The full name of each client on the board, by profile id. One read for
 * the whole board; a failure here costs the names, never the board, so it
 * is logged and an empty map comes back.
 */
async function namesFor(db: Db, orders: AdminOrderRow[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(orders.map((order) => order.user_id))];
  if (ids.length === 0) return new Map();

  const { data, error } = await db.from("users").select("id, full_name").in("id", ids);
  if (error) {
    console.error(`listOrdersForBoard: names lookup failed: ${error.message}`);
    return new Map();
  }

  const names = new Map<string, string | null>();
  for (const row of (data ?? []) as Pick<UserRow, "id" | "full_name">[]) {
    const name = row.full_name?.trim();
    names.set(row.id, name ? name : null);
  }
  return names;
}
