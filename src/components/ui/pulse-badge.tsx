import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type PulseBadgeProps = {
  children: ReactNode;
  tone?: "gold" | "green" | "navy";
  className?: string;
};

/**
 * Live status pill: dot pulses, label sits next to it.
 * Used in nav, hero, contact section to signal "we are open / accepting / online".
 */
export function PulseBadge({
  children,
  tone = "gold",
  className,
}: PulseBadgeProps) {
  const palette = {
    gold: {
      wrap: "border-gold/40 bg-gold/10 text-gold-light",
      dot: "bg-gold pulse-dot",
    },
    green: {
      wrap: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
      dot: "bg-emerald-400 pulse-dot-green",
    },
    navy: {
      wrap: "border-navy/15 bg-navy/5 text-navy",
      dot: "bg-navy pulse-dot",
    },
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[0.68rem] font-medium uppercase tracking-[0.18em]",
        palette.wrap,
        className
      )}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", palette.dot)} aria-hidden />
      {children}
    </span>
  );
}
