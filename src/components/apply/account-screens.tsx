"use client";

import { ArrowLeft, RotateCcw } from "lucide-react";

import { CodeStep } from "@/components/auth/code-step";
import { EmailStep } from "@/components/auth/email-step";
import { Button } from "@/components/ui/button";
import { EyebrowSolo } from "@/components/ui/eyebrow";
import { applyCopy } from "@/content/apply";

/**
 * The screens after the result: the email, the 6 digit code, and the short
 * wait while the order is written to the account. The forms themselves are
 * the shared auth components; this file only wraps them in the wizard's
 * chrome (eyebrow, lead, a way back) so /en/login and /en/apply read as one
 * product.
 */

const copy = applyCopy.account;

export function AccountEmailScreen({
  orderName,
  total,
  notice,
  onSent,
  onBack,
}: {
  orderName: string;
  total: string;
  /** Why the visitor is back here, when a session ended mid order. */
  notice?: string | null;
  onSent: (email: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
      {notice && (
        <p role="status" className="mt-4 rounded-sm border border-gold/40 bg-gold/10 px-4 py-3 text-[0.9rem] leading-relaxed text-navy">
          {notice}
        </p>
      )}
      <EmailStep
        className="mt-4"
        heading={copy.emailHeading}
        lead={copy.emailLead(orderName, total)}
        submitLabel={copy.emailSubmit}
        onSent={onSent}
      />
      <Button type="button" variant="ghost" size="md" onClick={onBack} className="mt-6 -ml-2 px-2">
        <ArrowLeft className="size-4" aria-hidden />
        {applyCopy.nav.back}
      </Button>
    </div>
  );
}

export function AccountCodeScreen({
  email,
  onVerified,
  onChangeEmail,
}: {
  email: string;
  onVerified: () => void;
  onChangeEmail: () => void;
}) {
  return (
    <div>
      <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
      <CodeStep className="mt-4" email={email} onVerified={onVerified} onChangeEmail={onChangeEmail} />
    </div>
  );
}

/** Shown while POST /api/apply/submit runs after the code, and when it fails. */
export function SavingScreen({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div aria-live="polite">
      <EyebrowSolo>{copy.eyebrow}</EyebrowSolo>
      <h2 className="mt-4 font-serif text-[clamp(1.6rem,3.3vw,2.25rem)] leading-tight text-balance text-navy">
        {copy.savingHeading}
      </h2>
      {error ? (
        <>
          <p role="alert" className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-clay">
            {error}
          </p>
          <Button type="button" size="lg" onClick={onRetry} className="mt-8">
            <RotateCcw className="size-4" aria-hidden />
            {copy.errors.retry}
          </Button>
        </>
      ) : (
        <>
          <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-navy-soft">{copy.savingLead}</p>
          <div className="mt-8 h-1 max-w-md overflow-hidden rounded-full bg-navy/10" aria-hidden>
            <div className="h-full w-1/3 animate-pulse rounded-full bg-gold" />
          </div>
        </>
      )}
    </div>
  );
}
