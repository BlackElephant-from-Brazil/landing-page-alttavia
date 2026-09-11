import { Check, Flag } from "lucide-react";

import { cn } from "@/lib/cn";
import type { ServiceStageRow } from "@/lib/db/types";

/**
 * The order's lifecycle as one vertical list: every stage of the service in
 * `position` order, the ones already passed ticked, the current one
 * highlighted and named for assistive technology with `aria-current="step"`,
 * the terminal one marked with a flag.
 *
 * "Passed" means a lower position than the current stage. The table keeps no
 * per stage timestamps, and the audit trail is not needed for this view.
 * An unknown `stage_key` (a service whose stages were edited after the order)
 * falls back to the first stage so the list still renders.
 *
 * `completed` is the order's `completed_at`: when set, every stage including
 * the last one is ticked and the heading says so, rather than leaving the
 * terminal stage looking like one more step to wait for.
 */
export function StageTimeline({
  stages,
  currentKey,
  completed = false,
}: {
  stages: ServiceStageRow[];
  currentKey: string;
  completed?: boolean;
}) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return null;

  const currentIndex = Math.max(
    0,
    ordered.findIndex((s) => s.key === currentKey),
  );

  return (
    <section aria-labelledby="progress-heading">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 id="progress-heading" className="text-xs uppercase tracking-wider text-navy-muted">
          Progress
        </h2>
        {completed && (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-navy px-3 text-[0.72rem] font-medium uppercase tracking-[0.14em] text-white">
            <Check className="size-3.5 text-gold-light" aria-hidden />
            Completed
          </span>
        )}
      </div>
      <ol className="relative mt-5 grid gap-6">
        <span
          className={cn(
            "absolute bottom-4 left-[19px] top-4 w-px",
            completed ? "bg-navy/30" : "bg-gradient-to-b from-gold/50 via-gold/25 to-transparent",
          )}
          aria-hidden
        />
        {ordered.map((stage, index) => {
          const done = completed || index < currentIndex;
          const current = !completed && index === currentIndex;
          return (
            <li key={stage.id} className="flex gap-5" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border font-serif text-base shadow-[var(--shadow-soft)]",
                  done && "border-navy bg-navy text-white",
                  current && "border-gold bg-gold text-navy ring-4 ring-gold/20",
                  !done && !current && "border-navy/15 bg-white text-navy-muted",
                )}
              >
                {done ? (
                  <Check className="size-4" aria-hidden />
                ) : stage.is_terminal ? (
                  <Flag className="size-4" aria-hidden />
                ) : (
                  index + 1
                )}
              </span>
              <span className="min-w-0 pt-2">
                <span
                  className={cn(
                    "block font-serif text-lg",
                    current || (completed && stage.is_terminal) ? "text-navy" : "text-navy-soft",
                  )}
                >
                  {stage.label}
                  {done && <span className="sr-only"> (done)</span>}
                  {current && <span className="sr-only"> (current stage)</span>}
                </span>
                {current && stage.description && (
                  <span className="mt-1 block max-w-prose text-[0.92rem] leading-relaxed text-navy-soft">
                    {stage.description}
                  </span>
                )}
                {stage.is_terminal && (
                  <span className="mt-1.5 block text-[0.72rem] font-medium uppercase tracking-[0.18em] text-gold-dark">
                    {completed ? "Done" : "Final stage"}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
