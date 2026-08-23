import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A selectable card backed by a native radio input, so keyboard, screen reader
 * and form semantics come for free: arrow keys move between options, Space
 * selects, Enter submits the surrounding form.
 *
 * Visual language borrowed from the featured pricing card: navy fill and gold
 * ring when chosen, quiet border when not.
 */
export function OptionCard({
  name,
  value,
  checked,
  onChange,
  label,
  hint,
  compact,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
  hint?: string;
  /** Side by side yes/no pairs use less padding. */
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "group relative flex cursor-pointer items-start gap-4 rounded-sm border transition-all duration-200",
        compact ? "px-4 py-3.5" : "px-5 py-4 sm:px-6 sm:py-5",
        checked
          ? "border-navy bg-navy text-white shadow-[var(--shadow-card)] ring-2 ring-gold"
          : "border-navy/10 bg-white text-navy shadow-[var(--shadow-soft)] hover:border-navy/30",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-paper"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
          checked ? "border-gold bg-gold text-navy" : "border-navy/25 bg-white"
        )}
        aria-hidden
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={cn("block font-medium leading-snug", compact ? "text-[0.95rem]" : "text-base")}>
          {label}
        </span>
        {hint && (
          <span
            className={cn(
              "mt-0.5 block text-[0.82rem] leading-snug",
              checked ? "text-white/65" : "text-navy-muted"
            )}
          >
            {hint}
          </span>
        )}
      </span>
    </label>
  );
}
