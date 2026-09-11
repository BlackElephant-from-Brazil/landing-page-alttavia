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
 * Renders heading, lead and form only, so it fits both the standalone
 * /en/login page and the last stages of the apply wizard. Layout, chrome and
 * navigation belong to the caller.
 *
 * Usage:
 *
 *   <EmailStep
 *     onSent={(email) => setEmail(email)}
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
  label: "Email address",
  placeholder: "you@example.com",
  submit: "Continue",
  sending: "Sending the code",
  errors: {
    invalid: "Enter a valid email address.",
    rateLimited: "A code was sent a moment ago. Wait a minute before asking for another.",
    generic: "We could not send the code. Check the address and try again in a moment.",
  },
} as const;

/** Enough to catch typos before the request; Supabase validates for real. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const inputClass = cn(
  "block h-12 w-full rounded-full border bg-white px-5 text-[0.95rem] text-navy placeholder:text-navy-muted/70 transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export type EmailStepProps = {
  /** Called once Supabase has accepted the request and the code is on its way. */
  onSent: (email: string) => void;
  heading?: string;
  lead?: string;
  submitLabel?: string;
  className?: string;
};

export function EmailStep({
  onSent,
  heading = copy.heading,
  lead = copy.lead,
  submitLabel = copy.submit,
  className,
}: EmailStepProps) {
  const id = useId();
  const inputId = `${id}-email`;
  const errorId = `${id}-email-error`;
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError(copy.errors.invalid);
      return;
    }

    setError(null);
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
      onSent(address);
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
        <label htmlFor={inputId} className="block text-xs uppercase tracking-wider text-navy-muted">
          {copy.label}
        </label>
        <input
          id={inputId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          autoFocus
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
