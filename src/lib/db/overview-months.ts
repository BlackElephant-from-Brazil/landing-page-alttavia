/**
 * The month buckets behind the overview's two monthly charts. Pure, so the
 * zero fill and the bucketing are unit tested without a database; getOverview
 * in admin-queries.ts feeds it the rows it read.
 *
 * Months are `YYYY-MM` keys in UTC, the last `MONTHS_ON_CHART` including the
 * current one, oldest first. A paid order counts in the month of `paid_at`
 * (its revenue too); an unpaid order counts as `open` in the month of
 * `created_at`. Rows outside the window are ignored.
 */

export const MONTHS_ON_CHART = 6;

export type MonthBucket = {
  month: string;
  /** Orders paid in the month, any stage. */
  paid: number;
  /** Orders created in the month with `paid_at` still null. */
  open: number;
  /** Sum of `total_cents` over the paid orders of the month. */
  revenueCents: number;
};

/** `YYYY-MM` in UTC. */
export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The first day of the month `MONTHS_ON_CHART - 1` months before `now`, in UTC. */
export function chartStart(now: Date, months = MONTHS_ON_CHART): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
}

/** The month keys the chart shows, oldest first. */
export function chartMonths(now: Date, months = MONTHS_ON_CHART): string[] {
  const start = chartStart(now, months);
  return Array.from({ length: months }, (_, i) =>
    monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1))),
  );
}

/**
 * One bucket per month in `months`, zero filled, with the paid rows and the
 * open rows counted into them.
 */
export function bucketByMonth(
  months: string[],
  paidRows: { paid_at: string | null; total_cents: number }[],
  openRows: { created_at: string }[],
): MonthBucket[] {
  const byMonth = new Map(months.map((month) => [month, { month, paid: 0, open: 0, revenueCents: 0 }]));

  for (const row of paidRows) {
    if (!row.paid_at) continue;
    const entry = byMonth.get(monthKey(new Date(row.paid_at)));
    if (!entry) continue;
    entry.paid += 1;
    entry.revenueCents += row.total_cents;
  }

  for (const row of openRows) {
    const entry = byMonth.get(monthKey(new Date(row.created_at)));
    if (!entry) continue;
    entry.open += 1;
  }

  return [...byMonth.values()];
}
