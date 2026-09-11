"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

/**
 * Second screen of the email code login: the 6 digit code Supabase sent to
 * `email`. The field submits on its own the moment six digits are in, and a
 * Verify button covers paste or autofill that lands short. On success
 * @supabase/ssr has already written the session cookies, so the caller only
 * has to navigate (`onVerified`).
 *
 * The resend link waits 60 seconds after mount and after each resend, the
 * shortest interval Supabase accepts between two emails to one address.
 *
 * Renders heading, copy and form only, so it fits both the standalone
 * /en/login page and the last stages of the apply wizard.
 *
 * Usage:
 *
 *   <CodeStep
 *     email={email}
 *     onVerified={() => router.push(next)}
 *     onChangeEmail={() => setEmail(null)}   // back to <EmailStep />
 *     className="mt-8"                        // optional
 *   />
 *
 * Copy follows the house rules in src/content/bank-nif.ts.
 */

const SENDER = "hello@send.alttavia-relocation.com";
const RESEND_SECONDS = 60;
const CODE_LENGTH = 6;

const copy = {
  heading: "Check your email",
  sent: (email: string) => `We sent a 6 digit code to ${email}.`,
  spamHint: `Not in your inbox? Check your spam or junk folder. It comes from ${SENDER}.`,
  label: "6 digit code",
  placeholder: "000000",
  verify: "Verify",
  verifying: "Checking the code",
  resendIn: (seconds: number) => `Send a new code in ${seconds} s`,
  resend: "Send a new code",
  resent: "A new code is on its way.",
  changeEmail: "Use a different email",
  errors: {
    short: "Enter the 6 digits from the email.",
    /**
     * Supabase answers a wrong code and an expired one with the same
     * `otp_expired` error ("Token has expired or is invalid"), so one line
     * covers both rather than guessing which happened.
     */
    wrong: "That code is not right or has expired. Check the digits or ask for a new one.",
    rateLimited: "A code was sent a moment ago. Wait a minute before asking for another.",
    generic: "Something went wrong on our side. Try again in a moment.",
  },
} as const;

const inputClass = cn(
  "block h-14 w-full rounded-full border bg-white px-5 text-center font-serif text-[1.6rem] tracking-[0.5em] text-navy placeholder:text-navy-muted/40 transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const linkClass =
  "text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline disabled:cursor-default disabled:text-navy-muted disabled:no-underline";

export type CodeStepProps = {
  /** The address the code went to. Shown in the copy and sent back to Supabase. */
  email: string;
  /** The session is set; navigate or advance. */
  onVerified: () => void;
  /** The visitor wants to go back and type another address. */
  onChangeEmail: () => void;
  className?: string;
};

export function CodeStep({ email, onVerified, onChangeEmail, className }: CodeStepProps) {
  const id = useId();
  const inputId = `${id}-code`;
  const messageId = `${id}-code-message`;
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function verify(token: string) {
    if (submittingRef.current) return;
    if (token.length !== CODE_LENGTH) {
      setError(copy.errors.short);
      return;
    }

    submittingRef.current = true;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (authError) {
        const rejected =
          authError.code === "otp_expired" ||
          (authError.status !== undefined && authError.status >= 400 && authError.status < 500);
        setError(rejected ? copy.errors.wrong : copy.errors.generic);
        setCode("");
        inputRef.current?.focus();
        return;
      }
      onVerified();
    } catch {
      setError(copy.errors.generic);
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === CODE_LENGTH) void verify(digits);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void verify(code);
  }

  async function resend() {
    if (cooldown > 0 || resending || pending) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
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
      setCode("");
      setNotice(copy.resent);
      setCooldown(RESEND_SECONDS);
      inputRef.current?.focus();
    } catch {
      setError(copy.errors.generic);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className={className}>
      <h2 className="font-serif text-[clamp(1.6rem,3.3vw,2.25rem)] leading-tight text-balance text-navy">
        {copy.heading}
      </h2>
      <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-navy-soft">
        {copy.sent(email)}
      </p>
      <p className="mt-3 max-w-xl text-[0.85rem] leading-relaxed text-navy-muted">{copy.spamHint}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8" aria-busy={pending}>
        <label htmlFor={inputId} className="block text-xs uppercase tracking-wider text-navy-muted">
          {copy.label}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={CODE_LENGTH}
          required
          value={code}
          onChange={handleChange}
          placeholder={copy.placeholder}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || notice ? messageId : undefined}
          className={cn(inputClass, "mt-2", error && "border-clay/60")}
        />
        {error && (
          <p id={messageId} role="alert" className="mt-2 text-[0.85rem] leading-relaxed text-clay">
            {error}
          </p>
        )}
        {!error && notice && (
          <p id={messageId} role="status" className="mt-2 text-[0.85rem] leading-relaxed text-gold-dark">
            {notice}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={pending || code.length !== CODE_LENGTH}
          className="mt-6 w-full sm:w-auto sm:min-w-[11rem]"
        >
          {pending ? copy.verifying : copy.verify}
          {!pending && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </form>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={cooldown > 0 || resending || pending}
          aria-live="polite"
          className={linkClass}
        >
          {cooldown > 0 ? copy.resendIn(cooldown) : copy.resend}
        </button>
        <button type="button" onClick={onChangeEmail} disabled={pending} className={linkClass}>
          {copy.changeEmail}
        </button>
      </div>
    </div>
  );
}
