"use client";

import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Change the signed in admin's password. Contract (docs/admin-contract.md)
 * section 7, amended 2026-09-21: the current password first, then the new
 * one, at least 12 characters, typed twice.
 *
 * The form posts to POST /api/admin/password, which checks the current
 * password with a sign in of its own before it sets the new one, so a
 * session left open on a shared screen is not enough to take the account
 * over. The route's `{ error }` lines are written for this screen and shown
 * as they are; anything without one reads the generic line.
 */

const MIN_LENGTH = 12;
/** Supabase Auth refuses passwords longer than 72 characters (bcrypt). */
const MAX_LENGTH = 72;

const copy = {
  currentLabel: "Current password",
  newLabel: "New password",
  confirmLabel: "Type it again",
  hint: `At least ${MIN_LENGTH} characters. A short sentence works well.`,
  submit: "Change password",
  submitting: "Saving",
  success: "Password changed. Use it next time you sign in.",
  errors: {
    current: "Enter your current password.",
    short: `Use at least ${MIN_LENGTH} characters.`,
    long: `Use at most ${MAX_LENGTH} characters.`,
    mismatch: "The two entries do not match.",
    same: "Choose a password different from the current one.",
    generic: "Something went wrong on our side.",
  },
} as const;

const inputClass = cn(
  "block h-12 w-full rounded-full border bg-white px-5 text-[0.95rem] text-navy transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const labelClass = "block text-xs uppercase tracking-wider text-navy-muted";

export function PasswordForm({ email }: { email?: string }) {
  const id = useId();
  const currentId = `${id}-current`;
  const passwordId = `${id}-password`;
  const confirmId = `${id}-confirm`;
  const hintId = `${id}-hint`;
  const messageId = `${id}-message`;

  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setDone(false);

    if (!current) {
      setError(copy.errors.current);
      return;
    }
    if (password.length < MIN_LENGTH) {
      setError(copy.errors.short);
      return;
    }
    if (password.length > MAX_LENGTH) {
      setError(copy.errors.long);
      return;
    }
    if (password !== confirm) {
      setError(copy.errors.mismatch);
      return;
    }
    if (password === current) {
      setError(copy.errors.same);
      return;
    }

    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: password }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        setError(typeof body?.error === "string" && body.error ? body.error : copy.errors.generic);
        if (res.status === 422 && body?.error === "Your current password is not right.") setCurrent("");
        return;
      }
      setCurrent("");
      setPassword("");
      setConfirm("");
      setDone(true);
    } catch {
      setError(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  function edit(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      if (error) setError(null);
      if (done) setDone(false);
    };
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-md" aria-busy={pending}>
      {/* Lets a password manager file the new password under the right account. */}
      {email && <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />}

      <div>
        <label htmlFor={currentId} className={labelClass}>
          {copy.currentLabel}
        </label>
        <input
          id={currentId}
          name="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => edit(setCurrent)(e.target.value)}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          className={cn(inputClass, "mt-2", error && "border-clay/60")}
        />
      </div>

      <div className="mt-5">
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
          maxLength={MAX_LENGTH}
          value={password}
          onChange={(e) => edit(setPassword)(e.target.value)}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${hintId} ${messageId}`}
          className={cn(inputClass, "mt-2", error && "border-clay/60")}
        />
        <p id={hintId} className="mt-2 text-[0.82rem] text-navy-muted">
          {copy.hint}
        </p>
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
          maxLength={MAX_LENGTH}
          value={confirm}
          onChange={(e) => edit(setConfirm)(e.target.value)}
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
