"use client";

import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

/**
 * Change the signed in admin's password. Contract (docs/admin-contract.md)
 * section 7: `supabase.auth.updateUser({ password })` on the current
 * session, at least 12 characters, typed twice.
 *
 * The browser client updates the user and rotates the session cookies
 * itself; nothing goes through a route of ours. Errors from Supabase never
 * reach the screen as they are: a rejected password reads one line, and
 * anything else the generic one.
 */

const MIN_LENGTH = 12;

const copy = {
  newLabel: "New password",
  confirmLabel: "Type it again",
  hint: `At least ${MIN_LENGTH} characters. A short sentence works well.`,
  submit: "Change password",
  submitting: "Saving",
  success: "Password changed. Use it next time you sign in.",
  errors: {
    short: `Use at least ${MIN_LENGTH} characters.`,
    mismatch: "The two entries do not match.",
    weak: "That password was not accepted. Try a longer one.",
    generic: "Something went wrong on our side.",
  },
} as const;

const inputClass = cn(
  "block h-12 w-full rounded-full border bg-white px-5 text-[0.95rem] text-navy transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const labelClass = "block text-xs uppercase tracking-wider text-navy-muted";

export function PasswordForm() {
  const id = useId();
  const passwordId = `${id}-password`;
  const confirmId = `${id}-confirm`;
  const messageId = `${id}-message`;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setDone(false);

    if (password.length < MIN_LENGTH) {
      setError(copy.errors.short);
      return;
    }
    if (password !== confirm) {
      setError(copy.errors.mismatch);
      return;
    }

    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) {
        const rejected = authError.status !== undefined && authError.status >= 400 && authError.status < 500;
        setError(rejected ? copy.errors.weak : copy.errors.generic);
        return;
      }
      setPassword("");
      setConfirm("");
      setDone(true);
    } catch {
      setError(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-md" aria-busy={pending}>
      <div>
        <label htmlFor={passwordId} className={labelClass}>
          {copy.newLabel}
        </label>
        <input
          id={passwordId}
          name="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LENGTH}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={cn(inputClass, "mt-2", error && "border-clay/60")}
        />
        <p className="mt-2 text-[0.82rem] text-navy-muted">{copy.hint}</p>
      </div>

      <div className="mt-5">
        <label htmlFor={confirmId} className={labelClass}>
          {copy.confirmLabel}
        </label>
        <input
          id={confirmId}
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LENGTH}
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            if (error) setError(null);
          }}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={cn(inputClass, "mt-2", error && "border-clay/60")}
        />
      </div>

      <p
        id={messageId}
        role={error ? "alert" : "status"}
        className={cn("mt-3 min-h-5 text-[0.85rem] leading-5", error ? "text-clay" : "text-navy-soft")}
      >
        {error ?? (done ? copy.success : "")}
      </p>

      <Button type="submit" size="lg" disabled={pending} className="mt-4 w-full sm:w-auto sm:min-w-[11rem]">
        {pending ? copy.submitting : copy.submit}
      </Button>
    </form>
  );
}
