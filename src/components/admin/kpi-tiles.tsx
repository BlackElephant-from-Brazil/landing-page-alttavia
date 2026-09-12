import type { Overview } from "@/lib/db/types";

import { formatCount, formatEuro } from "./lib/format";

/**
 * The six numbers the overview leads with, as one row of stat tiles: a
 * label, a value in the sans (proportional figures, never the serif) and a
 * short caption that says what the number counts. No chart, because a
 * single current value is a tile, not a bar.
 *
 * Four tiles follow the range (open, paid, completed, revenue); the two
 * queues (in progress, documents to review) do not, and their captions say
 * so.
 */

type Tile = {
  label: string;
  value: string;
  caption: string;
};

export function KpiTiles({ kpis, rangeLabel }: { kpis: Overview["kpis"]; rangeLabel: string }) {
  const period = rangeLabel.toLowerCase();
  const tiles: Tile[] = [
    { label: "Open orders", value: formatCount(kpis.openOrders), caption: `Created, not paid, ${period}` },
    { label: "Paid", value: formatCount(kpis.paidOrders), caption: `Paid ${period}, any stage` },
    { label: "In progress", value: formatCount(kpis.inProgressOrders), caption: "Paid, not complete, any date" },
    { label: "Completed", value: formatCount(kpis.completedOrders), caption: `Paid ${period}, delivered` },
    { label: "Revenue", value: formatEuro(kpis.revenueCents), caption: `Paid ${period}` },
    {
      label: "Documents to review",
      value: formatCount(kpis.documentsAwaitingReview),
      caption: "Uploaded, waiting for a decision",
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Key figures">
      {tiles.map((tile) => (
        <li key={tile.label} className="rounded-lg border border-navy/10 bg-white px-4 py-4 shadow-[var(--shadow-soft)]">
          <p className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-navy-muted">{tile.label}</p>
          <p className="mt-2 text-[1.75rem] font-semibold leading-none text-navy">{tile.value}</p>
          <p className="mt-2 text-[0.75rem] leading-snug text-navy-muted">{tile.caption}</p>
        </li>
      ))}
    </ul>
  );
}
