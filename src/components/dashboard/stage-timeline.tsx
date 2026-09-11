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
 */
export function StageTimeline({ stages, currentKey }: { stages: ServiceStageRow[]; currentKey: string }) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return null;

  const currentIndex = Math.max(
    0,
    ordered.findIndex((s) => s.key === currentKey),
  );

  return (
    <section aria-labelledby="progress-heading">
      <h2 id="progress-heading" className="text-xs uppercase tracking-wider text-navy-muted">
        Progress
      </h2>
      <ol className="relative mt-5 grid gap-6">
        <span
          className="absolute bottom-4 left-[19px] top-4 w-px bg-gradient-to-b from-gold/50 via-gold/25 to-transparent"
          aria-hidden
        />
        {ordered.map((stage, index) => {
          const done = index < currentIndex;
          const current = index === currentIndex;
          return (
            <li key={stage.id} className="flex gap-5" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border font-serif text-base shadow-[var(--shadow-soft)]",
                  done && "border-navy bg-navy text-white",
                  current && "border-gold bg-gold text-white ring-4 ring-gold/20",
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
                <span className={cn("block font-serif text-lg", current ? "text-navy" : "text-navy-soft")}>
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
                    Final stage
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
