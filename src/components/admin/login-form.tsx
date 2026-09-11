"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

/**
 * The client island of /admin/login: email and password, then away.
 * Contract (docs/admin-contract.md) section 4.
 *
 * `signInWithPassword` through the browser client writes the session
 * cookies; `push` moves to `next` (already validated by the page: starts
 * with /admin, never the login page) and `refresh` makes the server render
 * it again with the new cookies, so the guard in src/app/admin/layout.tsx
 * sees a user. A client who signs in here is sent on by that same guard.
 *
 * The error copy is deliberately generic: a wrong email and a wrong
 * password read the same, and nothing from Supabase reaches the screen.
 */

const copy = {
  emailLabel: "Email address",
  emailPlaceholder: "you@alttavia-relocation.com",
  passwordLabel: "Password",
  submit: "Sign in",
  submitting: "Signing in",
  errors: {
    empty: "Enter your email and password.",
    mismatch: "That email and password do not match.",
    generic: "Something went wrong on our side.",
  },
} as const;

const inputClass = cn(
  "block h-12 w-full rounded-full border bg-white px-5 text-[0.95rem] text-navy placeholder:text-navy-muted/70 transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const labelClass = "block text-xs uppercase tracking-wider text-navy-muted";

export function AdminLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const id = useId();
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const errorId = `${id}-error`;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const address = email.trim().toLowerCase();
    if (!address || !password) {
      setError(copy.errors.empty);
      return;
    }

    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email: address, password });
      if (authError) {
        const rejected =
          authError.code === "invalid_credentials" ||
          (authError.status !== undefined && authError.status >= 400 && authError.status < 500);
        setError(rejected ? copy.errors.mismatch : copy.errors.generic);
        setPassword("");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 max-w-md" aria-busy={pending}>
      <div>
        <label htmlFor={emailId} className={labelClass}>
          {copy.emailLabel}
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder={copy.emailPlaceholder}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(inputClass, "mt-2", error && "border-clay/60")}
        />
      </div>

      <div className="mt-5">
        <label htmlFor={passwordId} className={labelClass}>
          {copy.passwordLabel}
        </label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(inputClass, "mt-2", error && "border-clay/60")}
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-3 text-[0.85rem] leading-relaxed text-clay">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" disabled={pending} className="mt-6 w-full sm:w-auto sm:min-w-[11rem]">
        {pending ? copy.submitting : copy.submit}
        {!pending && <ArrowRight className="size-4" aria-hidden />}
      </Button>
    </form>
  );
}
