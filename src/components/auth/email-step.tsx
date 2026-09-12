"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

/**
 * First screen of the email code login: one email field and a Continue
 * button. On submit it asks Supabase to send a 6 digit code
 * (`signInWithOtp`, creating the account when the email is new) and hands the
 * address to `onSent`, whose owner then renders <CodeStep />.
 *
 * With `askName`, a required "First name" field sits above the email and is
 * passed as the second argument of `onSent`. The apply wizard asks (the
 * account is being created), the /en/login page does not.
 *
 * Renders heading, lead and form only, so it fits both the standalone
 * /en/login page and the last stages of the apply wizard. Layout, chrome and
 * navigation belong to the caller.
 *
 * Usage:
 *
 *   <EmailStep
 *     onSent={(email, name) => ...}
 *     askName                                 // optional, default false
 *     heading="Create your account"          // optional, defaults to "Sign in"
 *     lead="..."                              // optional
 *     submitLabel="Continue"                  // optional
 *     className="mt-8"                        // optional
 *   />
 *
 * Copy follows the house rules in src/content/bank-nif.ts: short, British
 * English, no dashes as punctuation, no internals in error messages.
 */

const copy = {
  heading: "Sign in",
  lead: "Enter your email and we will send you a 6 digit code. No password needed.",
  leadWithName: "Your name and email, then a 6 digit code. No password needed.",
  label: "Email address",
  placeholder: "you@example.com",
  nameLabel: "First name",
  namePlaceholder: "Ana",
  submit: "Continue",
  sending: "Sending the code",
  errors: {
    invalid: "Enter a valid email address.",
    name: "Enter your first name.",
    rateLimited: "A code was sent a moment ago. Wait a minute before asking for another.",
    generic: "We could not send the code. Check the address and try again in a moment.",
  },
} as const;

/** Enough to catch typos before the request; Supabase validates for real. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** 1 to 60 characters once trimmed; matches `NAME_MAX_LENGTH` in checkout-storage. */
const NAME_MAX_LENGTH = 60;

const inputClass = cn(
  "block h-12 w-full rounded-full border bg-white px-5 text-[0.95rem] text-navy placeholder:text-navy-muted/70 transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const labelClass = "block text-xs uppercase tracking-wider text-navy-muted";

export type EmailStepProps = {
  /**
   * Called once Supabase has accepted the request and the code is on its way.
   * `name` is the trimmed first name, present only when `askName` is set.
   */
  onSent: (email: string, name?: string) => void;
  /** Ask for a first name above the email. Off on the plain login page. */
  askName?: boolean;
  heading?: string;
  lead?: string;
  submitLabel?: string;
  className?: string;
};

export function EmailStep({
  onSent,
  askName = false,
  heading = copy.heading,
  lead = askName ? copy.leadWithName : copy.lead,
  submitLabel = copy.submit,
  className,
}: EmailStepProps) {
  const id = useId();
  const nameId = `${id}-name`;
  const nameErrorId = `${id}-name-error`;
  const inputId = `${id}-email`;
  const errorId = `${id}-email-error`;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const firstName = name.replace(/\s+/g, " ").trim().slice(0, NAME_MAX_LENGTH);
    const address = email.trim().toLowerCase();

    const nameMissing = askName && firstName.length === 0;
    const emailInvalid = !EMAIL_PATTERN.test(address);
    setNameError(nameMissing ? copy.errors.name : null);
    setError(emailInvalid ? copy.errors.invalid : null);
    if (nameMissing || emailInvalid) return;

    setPending(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true },
      });
      if (authError) {
        const limited =
          authError.code === "over_email_send_rate_limit" ||
          authError.code === "over_request_rate_limit" ||
          authError.status === 429;
        setError(limited ? copy.errors.rateLimited : copy.errors.generic);
        return;
      }
      onSent(address, askName ? firstName : undefined);
    } catch {
      setError(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <h2 className="font-serif text-[clamp(1.6rem,3.3vw,2.25rem)] leading-tight text-balance text-navy">
        {heading}
      </h2>
      {lead && <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-navy-soft">{lead}</p>}

      <form onSubmit={handleSubmit} noValidate className="mt-8" aria-busy={pending}>
        {askName && (
          <div className="mb-5">
            <label htmlFor={nameId} className={labelClass}>
              {copy.nameLabel}
            </label>
            <input
              id={nameId}
              name="given-name"
              type="text"
              autoComplete="given-name"
              autoCapitalize="words"
              required
              autoFocus
              maxLength={NAME_MAX_LENGTH}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(null);
              }}
              placeholder={copy.namePlaceholder}
              disabled={pending}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? nameErrorId : undefined}
              className={cn(inputClass, "mt-2", nameError && "border-clay/60")}
            />
            {nameError && (
              <p id={nameErrorId} role="alert" className="mt-2 text-[0.85rem] leading-relaxed text-clay">
                {nameError}
              </p>
            )}
          </div>
        )}

        <label htmlFor={inputId} className={labelClass}>
          {copy.label}
        </label>
        <input
          id={inputId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          autoFocus={!askName}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder={copy.placeholder}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(inputClass, "mt-2", error && "border-clay/60")}
        />
        {error && (
          <p id={errorId} role="alert" className="mt-2 text-[0.85rem] leading-relaxed text-clay">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="mt-6 w-full sm:w-auto sm:min-w-[11rem]">
          {pending ? copy.sending : submitLabel}
          {!pending && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </form>
    </div>
  );
}
