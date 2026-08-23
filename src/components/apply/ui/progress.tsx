import { applyCopy } from "@/content/apply";
import { cn } from "@/lib/cn";

/**
 * Segmented progress bar. `total` counts only the screens that apply to this
 * visitor, so it can grow when a partner is added and shrink when the visa
 * screen is skipped. The result and exit screens are not counted.
 */
export function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div>
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-gold-dark">
        {applyCopy.nav.step(current, total)}
      </p>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i < current ? "bg-gold" : "bg-navy/10"
            )}
          />
        ))}
      </div>
    </div>
  );
}
