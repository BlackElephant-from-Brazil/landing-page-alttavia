"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { formatDate } from "@/components/admin/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

import { CodeField } from "./code-field";
import {
  CODE_LENGTH,
  TOTP_ISSUER,
  factorName,
  groupSecret,
  mfaCopy,
  mfaErrorLine,
  mfaErrors,
  qrImageSrc,
  unverifiedTotpIds,
  type EnrolledFactor,
} from "./mfa-helpers";

/**
 * The second factor card: a code from an authenticator app (Supabase Auth
 * TOTP) on top of the password. Rules in src/lib/supabase/admin-user.ts;
 * the database follows in supabase/migrations/0015_admin_mfa.sql.
 *
 * Two places render it:
 *
 *   /admin/settings    `factors` from the server. Without one: "Set up".
 *                      With one: "On since {date}" and "Turn off".
 *   /admin/login       `required`, when ADMIN_REQUIRE_MFA=1 and the admin
 *                      who just gave the password has no factor yet. Only
 *                      the set up, and `onEnabled` goes on to the admin.
 *
 * Everything runs in the browser against Supabase Auth with the cookie
 * client, the same session the server reads:
 *
 *   Set up    listFactors, drop any TOTP factor left unverified by an
 *             earlier try (Supabase refuses a second one otherwise), then
 *             enroll({ factorType: "totp", issuer }). The answer carries
 *             the QR code (an SVG) and the secret: shown, never stored or
 *             logged. The first code goes through challengeAndVerify, which
 *             marks the factor verified and raises this session to aal2;
 *             Supabase signs the account's other sessions out at that
 *             moment. Cancel removes the unverified factor.
 *   Turn off  the current code first (challengeAndVerify, which also
 *             proves the phone is at hand and gives the aal2 Supabase wants
 *             before it removes a verified factor), then unenroll every
 *             verified TOTP factor of the account.
 *
 * After either change `router.refresh()` renders the page again from the
 * server with the new cookies, and the card shows the new state at once
 * without waiting for it.
 *
 * The audit trail (2026-09-25). Neither change passes through /api/admin/*,
 * so once one is done the card posts it to POST /api/admin/mfa-event, which
 * checks it against the account and writes the `[admin]` log line every
 * other admin write leaves. Best effort, sent with `keepalive` so a page
 * that moves on at once still delivers it; a failure changes nothing here.
 */

/** Tells the server log what just changed. Never throws and never waits. */
function recordMfaEvent(action: "enrol" | "unenrol", factorId: string) {
  try {
    void fetch("/api/admin/mfa-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, factorId }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // The audit line is not worth an error on screen.
  }
}

type Phase =
  | { kind: "idle" }
  | { kind: "enrolling"; factorId: string; qr: string | null; secret: string }
  | { kind: "turning-off" };

export type MfaEnrolProps = {
  /** The account's verified TOTP factors, oldest first. Empty when there is none. */
  factors: EnrolledFactor[];
  /** The login's variant: set up only, a heading of its own, no turn off. */
  required?: boolean;
  /** Called once the factor is verified. Defaults to refreshing the page. */
  onEnabled?: () => void;
};

const linkClass =
  "text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline disabled:cursor-default disabled:text-navy-muted disabled:no-underline";

export function MfaEnrol({ factors, required = false, onEnabled }: MfaEnrolProps) {
  const router = useRouter();
  const id = useId();
  const codeId = `${id}-code`;
  const messageId = `${id}-message`;

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * What the last change on this screen left, shown until the refreshed
   * props arrive: "on" with its date, or "off". Tied to the factors it was
   * made against, so new props from the server win as soon as they differ.
   */
  const [changed, setChanged] = useState<{ on: boolean; since: string; basis: string } | null>(null);

  const basis = factors.map((factor) => factor.id).join(",");
  const serverOn = factors.length > 0;
  const pendingChange = changed && changed.basis === basis ? changed : null;
  const on = pendingChange ? pendingChange.on : serverOn;
  const since = pendingChange?.on ? pendingChange.since : (factors[0]?.createdAt ?? "");

  function reset(nextPhase: Phase = { kind: "idle" }) {
    setPhase(nextPhase);
    setCode("");
    setError(null);
  }

  async function removeUnverified(supabase: ReturnType<typeof createClient>, ids: string[]) {
    for (const factorId of ids) {
      // Best effort: a leftover that cannot be removed only matters if its
      // name clashes, and every set up gets a name of its own.
      await supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
    }
  }

  async function startSetUp() {
    if (pending) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = createClient();
      const listed = await supabase.auth.mfa.listFactors();
      if (listed.error) {
        setError(mfaErrorLine(listed.error));
        return;
      }
      await removeUnverified(supabase, unverifiedTotpIds(listed.data.all));

      const { data, error: enrolError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: factorName(),
        issuer: TOTP_ISSUER,
      });
      if (enrolError || !data) {
        setError(mfaErrorLine(enrolError));
        return;
      }
      reset({ kind: "enrolling", factorId: data.id, qr: qrImageSrc(data.totp.qr_code), secret: data.totp.secret });
    } catch {
      setError(mfaErrors.generic);
    } finally {
      setPending(false);
    }
  }

  async function cancelSetUp() {
    if (pending || phase.kind !== "enrolling") return;
    const factorId = phase.factorId;
    reset();
    try {
      await createClient().auth.mfa.unenroll({ factorId });
    } catch {
      // Left unverified; the next set up removes it first.
    }
  }

  async function confirmSetUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || phase.kind !== "enrolling") return;
    if (code.length !== CODE_LENGTH) {
      setError(mfaErrors.codeShort);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: phase.factorId, code });
      if (verifyError) {
        setError(mfaErrorLine(verifyError));
        setCode("");
        return;
      }
      recordMfaEvent("enrol", phase.factorId);
      reset();
      setChanged({ on: true, since: new Date().toISOString(), basis });
      setNotice(`${mfaCopy.enabled} ${mfaCopy.otherDevices}`);
      if (onEnabled) onEnabled();
      else router.refresh();
    } catch {
      setError(mfaErrors.generic);
    } finally {
      setPending(false);
    }
  }

  async function confirmTurnOff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (code.length !== CODE_LENGTH) {
      setError(mfaErrors.codeShort);
      return;
    }
    const first = factors[0];
    if (!first) {
      reset();
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: first.id, code });
      if (verifyError) {
        setError(mfaErrorLine(verifyError));
        setCode("");
        return;
      }
      for (const factor of factors) {
        const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removeError) {
          setError(mfaErrorLine(removeError));
          return;
        }
        recordMfaEvent("unenrol", factor.id);
      }
      reset();
      setChanged({ on: false, since: "", basis });
      setNotice(mfaCopy.disabled);
      router.refresh();
    } catch {
      setError(mfaErrors.generic);
    } finally {
      setPending(false);
    }
  }

  const message = (
    <p
      id={messageId}
      role={error ? "alert" : "status"}
      className={cn("mt-3 min-h-5 text-[0.85rem] leading-relaxed", error ? "text-clay" : notice ? "text-navy-soft" : "")}
    >
      {error ?? notice ?? ""}
    </p>
  );

  // --- Set up in progress: QR, key, first code ---------------------------------
  if (phase.kind === "enrolling") {
    return (
      <div className="max-w-xl">
        {required && <RequiredHeading />}
        <ol className="mt-2 space-y-5 text-[0.95rem] leading-relaxed text-navy-soft">
          <li>
            <p>{mfaCopy.scanStep}</p>
            {phase.qr && (
              // A data URL built from Supabase's SVG: next/image has nothing to optimise here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={phase.qr}
                alt={mfaCopy.qrAlt}
                width={192}
                height={192}
                className="mt-3 size-48 rounded-2xl border border-navy/10 bg-white p-3"
              />
            )}
          </li>
          <li>
            <p>{mfaCopy.manualStep}</p>
            <code
              className="mt-2 inline-block rounded-xl bg-white px-4 py-2 font-mono text-[0.95rem] tracking-wider break-all text-navy select-all"
            >
              {groupSecret(phase.secret)}
            </code>
          </li>
          <li>
            <p>{mfaCopy.codeStep}</p>
          </li>
        </ol>

        <form onSubmit={confirmSetUp} noValidate className="mt-4" aria-busy={pending}>
          <CodeField
            id={codeId}
            value={code}
            onChange={(value) => {
              setCode(value);
              if (error) setError(null);
            }}
            disabled={pending}
            invalid={Boolean(error)}
            describedBy={messageId}
            autoFocus
          />
          {message}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:min-w-[11rem]">
              {pending ? mfaCopy.checking : mfaCopy.turnOn}
            </Button>
            <button type="button" onClick={() => void cancelSetUp()} disabled={pending} className={linkClass}>
              {mfaCopy.cancel}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- The login variant, once it is on: the admin is on the way in ---------------
  if (on && required) {
    return <div className="max-w-xl">{message}</div>;
  }

  // --- On: date, and turn off behind the current code -------------------------
  if (on) {
    return (
      <div className="max-w-xl">
        <p className="flex items-center gap-2 text-[0.95rem] font-medium text-navy">
          <ShieldCheck className="size-5 text-gold-dark" aria-hidden />
          {mfaCopy.onSince(formatDate(since, "today"))}
        </p>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-navy-soft">{mfaCopy.onLead}</p>

        {phase.kind === "turning-off" && serverOn ? (
          <form onSubmit={confirmTurnOff} noValidate className="mt-6" aria-busy={pending}>
            <p className="text-[0.95rem] leading-relaxed text-navy-soft">{mfaCopy.turnOffLead}</p>
            <div className="mt-4">
              <CodeField
                id={codeId}
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (error) setError(null);
                }}
                disabled={pending}
                invalid={Boolean(error)}
                describedBy={messageId}
                autoFocus
              />
            </div>
            {message}
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button type="submit" size="lg" variant="outline" disabled={pending} className="w-full sm:w-auto sm:min-w-[11rem]">
                {pending ? mfaCopy.turningOff : mfaCopy.turnOff}
              </Button>
              <button type="button" onClick={() => reset()} disabled={pending} className={linkClass}>
                {mfaCopy.cancel}
              </button>
            </div>
          </form>
        ) : (
          <>
            {message}
            {serverOn && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNotice(null);
                  reset({ kind: "turning-off" });
                }}
                className="mt-2"
              >
                {mfaCopy.turnOff}
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  // --- Off: what it is and "Set up" ---------------------------------------------
  return (
    <div className="max-w-xl">
      {required ? (
        <RequiredHeading />
      ) : (
        <p className="text-[0.95rem] leading-relaxed text-navy-soft">{mfaCopy.offLead}</p>
      )}
      <p className="mt-2 text-[0.85rem] leading-relaxed text-navy-muted">{mfaCopy.appHint}</p>
      {message}
      <Button type="button" size="lg" onClick={() => void startSetUp()} disabled={pending} className="mt-2 w-full sm:w-auto sm:min-w-[11rem]">
        {pending ? mfaCopy.starting : mfaCopy.setUp}
      </Button>
    </div>
  );
}

function RequiredHeading() {
  return (
    <>
      <h2 className="font-serif text-xl text-navy">{mfaCopy.required.heading}</h2>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-navy-soft">{mfaCopy.required.lead}</p>
    </>
  );
}
