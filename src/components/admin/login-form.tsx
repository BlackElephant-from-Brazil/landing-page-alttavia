"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient as createSupabaseClient, isAuthRetryableFetchError } from "@supabase/supabase-js";

import { CodeField } from "@/components/admin/settings/code-field";
import { MfaEnrol } from "@/components/admin/settings/mfa-enrol";
import {
  CODE_LENGTH as APP_CODE_LENGTH,
  mfaErrorLine,
  mfaErrors,
  nextLoginStep,
  verifiedTotpFactors,
} from "@/components/admin/settings/mfa-helpers";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

/**
 * The client island of /admin/login. Contract (docs/admin-contract.md)
 * section 4. Five modes, all at the same URL so src/proxy.ts needs no
 * exception for any of them:
 *
 * 1. `signin`: email and password, then away. `signInWithPassword` through
 *    the browser client writes the session cookies (replacing a session an
 *    admin opened with an emailed code, which the admin area refuses);
 *    `push` moves to `next` (already validated by the page: starts with
 *    /admin, never the login page) and `refresh` makes the server render it
 *    again with the new cookies, so the guard in src/app/admin/layout.tsx
 *    sees a user. A client who signs in here is sent on by that same guard.
 *    The error copy is deliberately generic: a wrong email and a wrong
 *    password read the same, and nothing from Supabase reaches the screen.
 *    Before going on it asks `getAuthenticatorAssuranceLevel()` (read from
 *    the session just written, no request) what comes next; see 4 and 5.
 *
 * 2. `request`, behind "Forgot your password?": the email, then
 *    `resetPasswordForEmail`. Supabase sends the recovery email, whose
 *    template carries the 6 digit code (scripts/auth-config.mjs). Whatever
 *    Auth answers, the same line follows ("If this email has an account, a
 *    code is on its way."): Supabase is quiet about unknown addresses, but
 *    its rate limit and send errors only happen for real accounts, so
 *    showing them would tell a stranger which addresses exist. Only a
 *    network failure, which says nothing about the account, reads as an
 *    error.
 *
 * 3. `reset`: the code and a new password typed twice. `verifyOtp` with type
 *    `recovery` opens a recovery session (which the admin area would refuse
 *    anyway: admin powers need a password session), `updateUser` sets the
 *    password, and `signOut` with the global scope ends every session of the
 *    account, this one included. The form goes back to `signin` and asks
 *    for the new password. A code is used once, so after it is accepted a
 *    rejected password is retried without it. Leaving the mode after the
 *    code was accepted signs the recovery session out.
 *    An account with a second factor needs one more field: Supabase refuses
 *    a new password from an aal1 session when the account has a verified
 *    factor, and a recovery session is aal1. So once the emailed code is
 *    accepted, if the recovery session says nextLevel aal2, the form asks
 *    for the code from the authenticator app too and runs
 *    `challengeAndVerify` on the recovery client before `updateUser`. An
 *    account without a factor sees the same form as before.
 *
 * 4. `code` (2026-09-25): the account has a second factor (nextLevel aal2,
 *    currentLevel aal1), so the form asks for the 6 digit code from the
 *    authenticator app and runs `challengeAndVerify` with the account's
 *    TOTP factor. That raises the session to aal2 in the cookies, and only
 *    then does the form go on. A wrong code shows one line and the field
 *    empties for another try. Until the code is right the admin area
 *    refuses the session (src/lib/supabase/admin-user.ts: enrolled means
 *    required), so leaving this step halfway opens nothing; "Use another
 *    account" signs that session out.
 *
 * 5. `enrol` (2026-09-25): every admin must have a second factor
 *    (ADMIN_REQUIRE_MFA=1, passed in by the page as `requireSecondFactor`)
 *    and this account has none yet. The set up card of /admin/settings
 *    (MfaEnrol, `required`) runs here, then the form goes on.
 *
 * Steps 2 and 3 run on their own client (recoveryClient below), not on the
 * cookie client: implicit flow, session in memory only. Two reasons. The
 * cookie client uses PKCE, and Supabase refuses a recovery code sent in a
 * PKCE flow when it comes back through `verifyOtp` (tested 2026-09-21:
 * `otp_expired` on a fresh code; the same code sent in the implicit flow
 * verifies). And the recovery session never reaches the cookies, so
 * nothing is left behind if the tab is closed halfway.
 */

type Mode = "signin" | "request" | "reset" | "code" | "enrol";

type RecoveryClient = ReturnType<typeof createSupabaseClient>;

/**
 * The client for "Forgot your password?": publishable key, implicit flow,
 * nothing persisted or refreshed, its own storage key so it never meets
 * the cookie client's session.
 */
function recoveryClient(): RecoveryClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set. See .env.example.",
    );
  }
  return createSupabaseClient(url, key, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "alttavia-admin-recovery",
    },
  });
}

const SENDER = "hello@send.alttavia-relocation.com";
const CODE_LENGTH = 6;
const MIN_LENGTH = 12;
/** Supabase Auth refuses passwords longer than 72 characters (bcrypt). */
const MAX_LENGTH = 72;
const RESEND_SECONDS = 60;

const copy = {
  emailLabel: "Email address",
  emailPlaceholder: "you@alttavia-relocation.com",
  passwordLabel: "Password",
  submit: "Sign in",
  submitting: "Signing in",
  forgot: "Forgot your password?",
  request: {
    heading: "Reset your password",
    lead: "Enter the email you sign in with. We will email you a 6 digit code.",
    submit: "Send the code",
    submitting: "Sending",
  },
  reset: {
    heading: "Choose a new password",
    sent: "If this email has an account, a code is on its way.",
    spamHint: `Not in your inbox? Check your spam or junk folder. It comes from ${SENDER}.`,
    codeLabel: "6 digit code",
    codePlaceholder: "000000",
    codeAccepted: "Code accepted. Choose the new password.",
    newLabel: "New password",
    confirmLabel: "Type it again",
    hint: `At least ${MIN_LENGTH} characters. A short sentence works well.`,
    submit: "Set the new password",
    submitting: "Saving",
    resendIn: (seconds: number) => `Send a new code in ${seconds} s`,
    resend: "Send a new code",
    appCodeLabel: "Code from your authenticator app",
    appCodeNeeded: "Code accepted. Your account has a second factor, so enter the 6 digit code from your authenticator app too.",
  },
  code: {
    heading: "One more step",
    lead: "Enter the 6 digit code from your authenticator app.",
    submit: "Continue",
    submitting: "Checking",
    otherAccount: "Use another account",
  },
  back: "Back to sign in",
  done: "Password changed. Sign in with your new password.",
  errors: {
    empty: "Enter your email and password.",
    mismatch: "That email and password do not match.",
    emailEmpty: "Enter your email address.",
    codeShort: "Enter the 6 digits from the email.",
    codeWrong: "That code is not right or has expired. Check the digits or ask for a new one.",
    short: `Use at least ${MIN_LENGTH} characters.`,
    long: `Use at most ${MAX_LENGTH} characters.`,
    differ: "The two entries do not match.",
    weak: "Choose a password that is harder to guess.",
    same: "Choose a password different from the one you had.",
    rejected: "That password was not accepted. Try a longer one.",
    rateLimited: "Too many attempts. Wait a few minutes and try again.",
    generic: "Something went wrong on our side.",
  },
} as const;

const inputClass = cn(
  "block h-12 w-full rounded-full border bg-white px-5 text-[0.95rem] text-navy placeholder:text-navy-muted/70 transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const codeInputClass = cn(
  "block h-14 w-full rounded-full border bg-white px-5 text-center font-serif text-[1.6rem] tracking-[0.5em] text-navy placeholder:text-navy-muted/40 transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const labelClass = "block text-xs uppercase tracking-wider text-navy-muted";

const linkClass =
  "text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline disabled:cursor-default disabled:text-navy-muted disabled:no-underline";

type AuthErrorLike = { code?: string; status?: number };

function isRateLimited(error: AuthErrorLike): boolean {
  return (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  );
}

function isClientError(error: AuthErrorLike): boolean {
  return error.status !== undefined && error.status >= 400 && error.status < 500;
}

export type AdminLoginFormProps = {
  /** Where to go after signing in; validated by the page. */
  next: string;
  /** One line shown above the form, e.g. "Sign in with your password." */
  notice?: string;
  /** The email to start with, for an admin the page already knows. */
  defaultEmail?: string;
  /** ADMIN_REQUIRE_MFA=1: an admin without a second factor sets one up before going on. */
  requireSecondFactor?: boolean;
};

export function AdminLoginForm({
  next,
  notice: initialNotice,
  defaultEmail,
  requireSecondFactor = false,
}: AdminLoginFormProps) {
  const router = useRouter();
  const id = useId();
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const codeId = `${id}-code`;
  const newId = `${id}-new`;
  const confirmId = `${id}-confirm`;
  const messageId = `${id}-message`;

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  /** The recovery code was accepted: a recovery session is open and the code is spent. */
  const [verified, setVerified] = useState(false);
  /** The code from the authenticator app: the `code` step, and a reset for an account with a second factor. */
  const [appCode, setAppCode] = useState("");
  /** The reset needs the app code too (the recovery session said nextLevel aal2). */
  const [needsAppCode, setNeedsAppCode] = useState(false);
  /** The TOTP factor the `code` step verifies against. */
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  /** One recovery client per reset: verifyOtp opens the session updateUser and signOut then use. */
  const recoveryRef = useRef<RecoveryClient | null>(null);

  function recovery(): RecoveryClient {
    recoveryRef.current ??= recoveryClient();
    return recoveryRef.current;
  }

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function clearMessages() {
    if (error) setError(null);
  }

  function goTo(nextMode: Mode, message: string | null = null) {
    setMode(nextMode);
    setError(null);
    setNotice(message);
    setPassword("");
    setCode("");
    setAppCode("");
    setNeedsAppCode(false);
    setNewPassword("");
    setConfirm("");
  }

  /** On to the admin area, with the server rendering it again from the new cookies. */
  function continueToAdmin() {
    router.push(next);
    router.refresh();
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
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
      const { data: signedIn, error: authError } = await supabase.auth.signInWithPassword({ email: address, password });
      if (authError) {
        const rejected = authError.code === "invalid_credentials" || isClientError(authError);
        setError(isRateLimited(authError) ? copy.errors.rateLimited : rejected ? copy.errors.mismatch : copy.errors.generic);
        setPassword("");
        return;
      }

      // Read from the session just written; no request. If it cannot be
      // read, going on is safe: the admin area checks the level itself and
      // sends a session short of the code back here.
      const { data: levels } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const step = nextLoginStep(levels ?? null, requireSecondFactor);

      if (step === "code") {
        let totpId: string | null = verifiedTotpFactors(signedIn.user?.factors)[0]?.id ?? null;
        if (!totpId) {
          const listed = await supabase.auth.mfa.listFactors();
          totpId = listed.data?.totp[0]?.id ?? null;
        }
        if (!totpId) {
          // A verified factor of another kind: nothing this form can ask for.
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          setError(copy.errors.generic);
          setPassword("");
          return;
        }
        setFactorId(totpId);
        setEmail(address);
        goTo("code");
        return;
      }
      if (step === "enrol") {
        setEmail(address);
        goTo("enrol");
        return;
      }
      continueToAdmin();
    } catch {
      setError(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (appCode.length !== APP_CODE_LENGTH) {
      setError(mfaErrors.codeShort);
      return;
    }
    if (!factorId) {
      goTo("signin");
      return;
    }

    setError(null);
    setPending(true);
    try {
      const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: appCode });
      if (verifyError) {
        setError(mfaErrorLine(verifyError));
        setAppCode("");
        return;
      }
      continueToAdmin();
    } catch {
      setError(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  /**
   * Leaves the second step or the set up: the password session they hold
   * is signed out here (the admin area refuses it anyway), then back to the
   * email and password.
   */
  async function switchAccount() {
    if (pending) return;
    setPending(true);
    try {
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      // The cookie is cleared locally even when the call fails.
    } finally {
      setPending(false);
    }
    setFactorId(null);
    goTo("signin");
    router.refresh();
  }

  /**
   * Asks Supabase for a recovery email. Resolves true when the reset step
   * should show; see the file comment for why every Auth answer does.
   */
  async function sendCode(address: string): Promise<boolean> {
    try {
      const { error: authError } = await recovery().auth.resetPasswordForEmail(address);
      if (authError && isAuthRetryableFetchError(authError)) {
        setError(copy.errors.generic);
        return false;
      }
      return true;
    } catch {
      setError(copy.errors.generic);
      return false;
    }
  }

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const address = email.trim().toLowerCase();
    if (!address) {
      setError(copy.errors.emailEmpty);
      return;
    }

    setError(null);
    setPending(true);
    try {
      if (await sendCode(address)) {
        setEmail(address);
        setVerified(false);
        goTo("reset", copy.reset.sent);
        setCooldown(RESEND_SECONDS);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (pending || cooldown > 0 || verified) return;
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      if (await sendCode(email)) {
        setCode("");
        setNotice(copy.reset.sent);
        setCooldown(RESEND_SECONDS);
      }
    } finally {
      setPending(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    if (!verified && code.length !== CODE_LENGTH) {
      setError(copy.errors.codeShort);
      return;
    }
    if (newPassword.length < MIN_LENGTH) {
      setError(copy.errors.short);
      return;
    }
    if (newPassword.length > MAX_LENGTH) {
      setError(copy.errors.long);
      return;
    }
    if (newPassword !== confirm) {
      setError(copy.errors.differ);
      return;
    }

    setError(null);
    setPending(true);
    try {
      const supabase = recovery();

      if (!verified) {
        const { error: otpError } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
        if (otpError) {
          setError(
            isRateLimited(otpError)
              ? copy.errors.rateLimited
              : otpError.code === "otp_expired" || isClientError(otpError)
                ? copy.errors.codeWrong
                : copy.errors.generic,
          );
          setCode("");
          return;
        }
        setVerified(true);
        setNotice(copy.reset.codeAccepted);
      }

      // A recovery session is aal1, and Supabase refuses a new password from
      // an aal1 session when the account has a second factor. Read from the
      // session in memory; no request. Once the app code is accepted the
      // session is aal2, so a retry after a refused password skips this.
      const { data: levels } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (levels?.nextLevel === "aal2" && levels.currentLevel !== "aal2") {
        if (appCode.length !== APP_CODE_LENGTH) {
          if (needsAppCode) setError(mfaErrors.codeShort);
          else setNotice(copy.reset.appCodeNeeded);
          setNeedsAppCode(true);
          return;
        }
        const { data: current } = await supabase.auth.getSession();
        const totpId = verifiedTotpFactors(current.session?.user.factors)[0]?.id;
        if (!totpId) {
          setError(copy.errors.generic);
          return;
        }
        const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({ factorId: totpId, code: appCode });
        if (mfaError) {
          setError(mfaErrorLine(mfaError));
          setAppCode("");
          return;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(
          updateError.code === "weak_password"
            ? copy.errors.weak
            : updateError.code === "same_password"
              ? copy.errors.same
              : isRateLimited(updateError)
                ? copy.errors.rateLimited
                : isClientError(updateError)
                  ? copy.errors.rejected
                  : copy.errors.generic,
        );
        return;
      }

      // Every session of the account ends, this recovery one included: a
      // reset is often the answer to a password someone else may know.
      // signOut clears the local session even when the call itself fails.
      // The refresh lets the page see that a code session in the cookies
      // (if this browser had one for the account) is gone too.
      await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
      recoveryRef.current = null;
      setVerified(false);
      goTo("signin", copy.done);
      router.refresh();
    } catch {
      setError(copy.errors.generic);
    } finally {
      setPending(false);
    }
  }

  async function backToSignIn() {
    if (pending) return;
    if (verified && recoveryRef.current) {
      // End the recovery session on the server rather than leave it to expire.
      setPending(true);
      try {
        await recoveryRef.current.auth.signOut({ scope: "local" });
      } catch {
        // It lives in memory only; dropping the client below forgets it.
      } finally {
        setPending(false);
      }
    }
    recoveryRef.current = null;
    setVerified(false);
    goTo("signin");
  }

  function handleCodeChange(event: ChangeEvent<HTMLInputElement>) {
    setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH));
    clearMessages();
  }

  const message = (
    <p
      id={messageId}
      role={error ? "alert" : "status"}
      className={cn(
        "mt-3 min-h-5 text-[0.85rem] leading-relaxed",
        error ? "text-clay" : notice ? "text-gold-dark" : "",
      )}
    >
      {error ?? notice ?? ""}
    </p>
  );

  if (mode === "request") {
    return (
      <div className="mt-8 max-w-md">
        <h2 className="font-serif text-xl text-navy">{copy.request.heading}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-navy-soft">{copy.request.lead}</p>

        <form onSubmit={handleRequest} noValidate className="mt-6" aria-busy={pending}>
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
              clearMessages();
            }}
            placeholder={copy.emailPlaceholder}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={messageId}
            className={cn(inputClass, "mt-2", error && "border-clay/60")}
          />

          {message}

          <Button type="submit" size="lg" disabled={pending} className="mt-4 w-full sm:w-auto sm:min-w-[11rem]">
            {pending ? copy.request.submitting : copy.request.submit}
            {!pending && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </form>

        <div className="mt-8">
          <button type="button" onClick={() => void backToSignIn()} disabled={pending} className={linkClass}>
            {copy.back}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "reset") {
    return (
      <div className="mt-8 max-w-md">
        <h2 className="font-serif text-xl text-navy">{copy.reset.heading}</h2>
        <p className="mt-2 text-[0.85rem] leading-relaxed text-navy-muted">{copy.reset.spamHint}</p>

        <form onSubmit={handleReset} noValidate className="mt-6" aria-busy={pending}>
          {/* Lets a password manager file the new password under the right account. */}
          <input type="text" name="username" autoComplete="username" value={email} readOnly hidden />

          <div>
            <label htmlFor={codeId} className={labelClass}>
              {copy.reset.codeLabel}
            </label>
            <input
              id={codeId}
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              autoFocus
              value={code}
              onChange={handleCodeChange}
              placeholder={copy.reset.codePlaceholder}
              disabled={pending || verified}
              aria-invalid={error === copy.errors.codeWrong || error === copy.errors.codeShort ? true : undefined}
              aria-describedby={messageId}
              className={cn(codeInputClass, "mt-2")}
            />
          </div>

          <div className="mt-5">
            <label htmlFor={newId} className={labelClass}>
              {copy.reset.newLabel}
            </label>
            <input
              id={newId}
              name="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_LENGTH}
              maxLength={MAX_LENGTH}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                clearMessages();
              }}
              disabled={pending}
              aria-describedby={`${newId}-hint ${messageId}`}
              className={cn(inputClass, "mt-2")}
            />
            <p id={`${newId}-hint`} className="mt-2 text-[0.82rem] text-navy-muted">
              {copy.reset.hint}
            </p>
          </div>

          <div className="mt-5">
            <label htmlFor={confirmId} className={labelClass}>
              {copy.reset.confirmLabel}
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
              onChange={(e) => {
                setConfirm(e.target.value);
                clearMessages();
              }}
              disabled={pending}
              aria-describedby={messageId}
              className={cn(inputClass, "mt-2")}
            />
          </div>

          {needsAppCode && (
            <div className="mt-5">
              <CodeField
                id={`${id}-app-code`}
                label={copy.reset.appCodeLabel}
                value={appCode}
                onChange={(value) => {
                  setAppCode(value);
                  clearMessages();
                }}
                disabled={pending}
                invalid={error === mfaErrors.codeWrong || error === mfaErrors.codeShort}
                describedBy={messageId}
                autoFocus
              />
            </div>
          )}

          {message}

          <Button type="submit" size="lg" disabled={pending} className="mt-4 w-full sm:w-auto sm:min-w-[11rem]">
            {pending ? copy.reset.submitting : copy.reset.submit}
            {!pending && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </form>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          {!verified && (
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={pending || cooldown > 0}
              className={linkClass}
            >
              {cooldown > 0 ? copy.reset.resendIn(cooldown) : copy.reset.resend}
            </button>
          )}
          <button type="button" onClick={() => void backToSignIn()} disabled={pending} className={linkClass}>
            {copy.back}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "code") {
    return (
      <div className="mt-8 max-w-md">
        <h2 className="font-serif text-xl text-navy">{copy.code.heading}</h2>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-navy-soft">{copy.code.lead}</p>

        <form onSubmit={handleCode} noValidate className="mt-6" aria-busy={pending}>
          <CodeField
            id={`${id}-app-code`}
            value={appCode}
            onChange={(value) => {
              setAppCode(value);
              clearMessages();
            }}
            disabled={pending}
            invalid={Boolean(error)}
            describedBy={messageId}
            autoFocus
          />

          {message}

          <Button type="submit" size="lg" disabled={pending} className="mt-4 w-full sm:w-auto sm:min-w-[11rem]">
            {pending ? copy.code.submitting : copy.code.submit}
            {!pending && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </form>

        <div className="mt-8">
          <button type="button" onClick={() => void switchAccount()} disabled={pending} className={linkClass}>
            {copy.code.otherAccount}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "enrol") {
    return (
      <div className="mt-8">
        <MfaEnrol factors={[]} required onEnabled={continueToAdmin} />
        <div className="mt-8">
          <button type="button" onClick={() => void switchAccount()} disabled={pending} className={linkClass}>
            {copy.code.otherAccount}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-md">
      <form onSubmit={handleSignIn} noValidate aria-busy={pending}>
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
            autoFocus={!defaultEmail}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clearMessages();
            }}
            placeholder={copy.emailPlaceholder}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={messageId}
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
            autoFocus={Boolean(defaultEmail)}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clearMessages();
            }}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={messageId}
            className={cn(inputClass, "mt-2", error && "border-clay/60")}
          />
        </div>

        {message}

        <Button type="submit" size="lg" disabled={pending} className="mt-4 w-full sm:w-auto sm:min-w-[11rem]">
          {pending ? copy.submitting : copy.submit}
          {!pending && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </form>

      <div className="mt-8">
        <button type="button" onClick={() => goTo("request")} disabled={pending} className={linkClass}>
          {copy.forgot}
        </button>
      </div>
    </div>
  );
}
