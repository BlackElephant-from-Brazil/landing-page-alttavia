import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export type SelectOption = { value: string; label: string };

/**
 * A native <select> dressed like the site's inputs. Native on purpose: it
 * works with the keyboard, screen readers and the iOS picker, and it never
 * opens underneath the fixed Back/Continue bar on phones.
 *
 * `error` prints one line under the field, the way the account screens do:
 * `role="alert"` announces it when it appears, and `aria-describedby` reads
 * it again whenever the select takes focus.
 */
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  autoFocus,
  className,
  error,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder: string;
  autoFocus?: boolean;
  className?: string;
  error?: string;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={cn("block", className)}>
      <label htmlFor={id} className="block text-xs uppercase tracking-wider text-navy-muted">
        {label}
      </label>
      <div className="relative mt-2">
        <select
          id={id}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "block h-12 w-full appearance-none rounded-full border bg-white pl-5 pr-12 text-[0.95rem] text-navy transition-colors duration-200",
            "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
            !value && "text-navy-muted",
            error && "border-clay/60 hover:border-clay/60"
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-5 top-1/2 size-4 -translate-y-1/2 text-navy-muted"
          aria-hidden
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 px-1 text-[0.85rem] leading-relaxed text-clay">
          {error}
        </p>
      )}
    </div>
  );
}
