import Link from "next/link";

import { cn } from "@/lib/cn";

import { RANGE_KEYS, RANGE_LABELS, type ResolvedRange } from "./lib/range";
import { hrefWith, type SearchParams } from "./lib/params";

/**
 * The one filter row above everything it scopes on the overview: the five
 * presets as links (so they work without JavaScript and show as the
 * current URL) and a GET form for a custom `from` and `to`. Every other
 * param on the page survives, except the open order, which closes.
 */
export function RangeControls({
  pathname,
  params,
  range,
}: {
  pathname: string;
  params: SearchParams;
  range: ResolvedRange;
}) {
  const kept = Object.entries(params).filter(
    ([key, value]) => !["range", "from", "to", "order", "page"].includes(key) && value !== undefined,
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <nav aria-label="Range">
        <ul className="flex flex-wrap gap-1.5">
          {RANGE_KEYS.map((key) => {
            const active = range.key === key;
            return (
              <li key={key}>
                <Link
                  href={hrefWith(pathname, params, { range: key, from: null, to: null, order: null, page: null })}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-3.5 text-[0.82rem] font-medium transition-colors duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                    active
                      ? "border-navy bg-navy text-white"
                      : "border-navy/15 bg-white text-navy-soft hover:border-navy/40 hover:text-navy",
                  )}
                >
                  {RANGE_LABELS[key]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action={pathname} className="flex flex-wrap items-end gap-2" aria-label="Custom dates">
        {kept.map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={Array.isArray(value) ? value[0] : value} />
        ))}
        <label className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-navy-muted">
          From
          <input
            type="date"
            name="from"
            defaultValue={range.key === "custom" ? range.from : ""}
            required
            className={dateInputClass}
          />
        </label>
        <label className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-navy-muted">
          To
          <input
            type="date"
            name="to"
            defaultValue={range.key === "custom" ? range.to : ""}
            required
            className={dateInputClass}
          />
        </label>
        <button type="submit" className={applyButtonClass}>
          Apply
        </button>
      </form>
    </div>
  );
}

export const dateInputClass = cn(
  "mt-1 block h-9 rounded-full border border-navy/15 bg-white px-3 text-[0.85rem] normal-case tracking-normal text-navy",
  "hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
);

export const applyButtonClass = cn(
  "inline-flex h-9 items-center rounded-full bg-navy px-4 text-[0.82rem] font-medium text-white transition-colors duration-200 hover:bg-gold hover:text-navy",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
);
