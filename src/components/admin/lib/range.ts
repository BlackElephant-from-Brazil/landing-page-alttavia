/**
 * The date range the overview and the orders table read from the URL.
 * Contract (docs/admin-contract.md) section 7.
 *
 *   ?range=week|month|3m|6m|year      a rolling window ending today (default month)
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD    a custom window; both must be valid dates
 *
 * A custom window wins over a preset. The result is two bare dates that
 * src/lib/db/admin-queries.ts turns into `>= from` and `< to + 1 day`, so
 * `to` is inclusive of its whole day. Days are counted in UTC, which is at
 * most one hour off Lisbon and keeps the arithmetic simple.
 */

export const RANGE_KEYS = ["week", "month", "3m", "6m", "year"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const DEFAULT_RANGE: RangeKey = "month";

export const RANGE_LABELS: Record<RangeKey, string> = {
  week: "Last 7 days",
  month: "Last 30 days",
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  year: "Last 12 months",
};

/** Days in each window, the end day included. */
const RANGE_DAYS: Record<RangeKey, number> = {
  week: 7,
  month: 30,
  "3m": 91,
  "6m": 182,
  year: 365,
};

export type ResolvedRange = {
  /** The preset in use, or `custom` when `from` and `to` came from the URL. */
  key: RangeKey | "custom";
  /** Bare `YYYY-MM-DD`, inclusive. */
  from: string;
  /** Bare `YYYY-MM-DD`, inclusive. */
  to: string;
  /** What the range selector shows as the current choice. */
  label: string;
};

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isRangeKey(value: unknown): value is RangeKey {
  return typeof value === "string" && (RANGE_KEYS as readonly string[]).includes(value);
}

/** A bare date that also exists on the calendar (no 31 Feb). */
export function isBareDate(value: unknown): value is string {
  if (typeof value !== "string" || !BARE_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toBareDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBefore(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() - days);
  return copy;
}

type RangeParams = {
  range?: string | string[];
  from?: string | string[];
  to?: string | string[];
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The range the URL asks for, resolved against `now` (today by default). */
export function resolveRange(params: RangeParams, now: Date = new Date()): ResolvedRange {
  const from = one(params.from);
  const to = one(params.to);
  if (isBareDate(from) && isBareDate(to) && from <= to) {
    return { key: "custom", from, to, label: "Custom dates" };
  }

  const range = one(params.range);
  const key: RangeKey = isRangeKey(range) ? range : DEFAULT_RANGE;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    key,
    from: toBareDate(daysBefore(today, RANGE_DAYS[key] - 1)),
    to: toBareDate(today),
    label: RANGE_LABELS[key],
  };
}
