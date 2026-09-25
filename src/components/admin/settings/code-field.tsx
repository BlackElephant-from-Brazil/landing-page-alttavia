"use client";

import { cn } from "@/lib/cn";

import { CODE_LENGTH, cleanCode, mfaCopy } from "./mfa-helpers";

/**
 * The 6 digit field for the code from the authenticator app. Shared by the
 * set up card on /admin/settings and the second step of /admin/login, so
 * both read and behave the same: digits only, pasting "123 456" works,
 * `one-time-code` lets the phone offer the code, the numeric keypad opens
 * on a phone.
 */

const codeInputClass = cn(
  "block h-14 w-full max-w-[16rem] rounded-full border bg-white px-5 text-center font-serif text-[1.6rem] tracking-[0.5em] text-navy placeholder:text-navy-muted/40 transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const labelClass = "block text-xs uppercase tracking-wider text-navy-muted";

export type CodeFieldProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** The id of the message line under the form. */
  describedBy?: string;
  autoFocus?: boolean;
};

export function CodeField({
  id,
  value,
  onChange,
  label = mfaCopy.codeLabel,
  disabled,
  invalid,
  describedBy,
  autoFocus,
}: CodeFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name="totp-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={`[0-9]{${CODE_LENGTH}}`}
        maxLength={CODE_LENGTH + 2}
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(cleanCode(event.target.value))}
        placeholder={mfaCopy.codePlaceholder}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn(codeInputClass, "mt-2", invalid && "border-clay/60")}
      />
    </div>
  );
}
