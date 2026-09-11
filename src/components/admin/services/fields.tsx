import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

/**
 * The form primitives of the service editor: a label above, the control,
 * an optional hint and the inline message below. The same navy on white
 * treatment as the login form, with softer corners because a dense editor
 * with forty controls reads better squared than pill shaped.
 *
 * Every control takes `error` and wires `aria-invalid` and
 * `aria-describedby` itself, so the editor only passes the message.
 */

export const inputClass = cn(
  "block w-full rounded-xs border bg-white px-3.5 text-[0.92rem] text-navy placeholder:text-navy-muted/60 transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-paper read-only:text-navy-soft",
);

export const labelClass = "block text-[0.72rem] font-medium uppercase tracking-[0.16em] text-navy-muted";

type Wrap = {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
};

function Messages({ id, hint, error }: Pick<Wrap, "id" | "hint" | "error">) {
  return (
    <>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-[0.8rem] leading-relaxed text-navy-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[0.8rem] leading-relaxed text-clay">
          {error}
        </p>
      )}
    </>
  );
}

function describedBy(id: string, hint: React.ReactNode | undefined, error: string | undefined): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type TextFieldProps = Wrap & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className">;

export function TextField({ id, label, hint, error, className, ...props }: TextFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(inputClass, "mt-1.5 h-11", error && "border-clay/60")}
        {...props}
      />
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

type TextAreaFieldProps = Wrap & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "className">;

export function TextAreaField({ id, label, hint, error, className, rows = 3, ...props }: TextAreaFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(inputClass, "mt-1.5 py-2.5 leading-relaxed", error && "border-clay/60")}
        {...props}
      />
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

type SelectFieldProps = Wrap &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "className"> & {
    options: readonly { value: string; label: string }[];
  };

export function SelectField({ id, label, hint, error, className, options, ...props }: SelectFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(inputClass, "mt-1.5 h-11", error && "border-clay/60")}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

type CheckboxFieldProps = {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

export function CheckboxField({ id, label, hint, checked, onChange, disabled, className }: CheckboxFieldProps) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-2.5", disabled && "cursor-not-allowed opacity-60", className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 shrink-0 accent-gold"
      />
      <span className="text-[0.9rem] leading-snug text-navy">
        {label}
        {hint && <span className="mt-0.5 block text-[0.8rem] text-navy-muted">{hint}</span>}
      </span>
    </label>
  );
}

/** A section of the editor: heading, one line of context, then the fields. */
export function FieldGroup({
  title,
  intro,
  children,
  actions,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-navy/10 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-navy">{title}</h2>
          {intro && <p className="mt-1.5 max-w-prose text-[0.88rem] leading-relaxed text-navy-soft">{intro}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** A list level message, above the rows it is about. */
export function ListError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mb-4 rounded-xs border border-clay/30 bg-clay/5 px-3.5 py-2.5 text-[0.85rem] text-clay">
      {message}
    </p>
  );
}
