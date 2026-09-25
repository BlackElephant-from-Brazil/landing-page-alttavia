"use client";

import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import { MAX_SIGNING_PLACE_LENGTH, parseSigningPlace } from "@/lib/contracts/signing-place";
import type { ApplicantIndex } from "@/lib/contracts/state";
import { contractPersons } from "@/lib/contracts/templates";
import type { ContractTemplate, UserServiceApplicantRow } from "@/lib/db/types";

import { ApplicantDetailsForm } from "../documents/applicant-details-form";
import { formatDate } from "../order-status";
import { retryAgreementEmail } from "./email-retry";
import { isFreshPayment } from "./fresh-payment";
import { closeTab, openPendingTab, requestAgreement, showAgreementIn } from "./prepare-agreement";

/**
 * The service agreement card of a paid order, right under the "Payment
 * received" notice. Design (docs/agreement-contract.md) section 6, amended
 * for the Couple package on 2026-09-25.
 *
 * Two states, decided by the server and passed in:
 *
 *   no agreement yet   one line and "Confirm my details", which opens the
 *                      details dialog (applicant-details-form.tsx with
 *                      `purpose: "contract"`). The dialog saves the details,
 *                      asks the route for the agreement and opens it in a
 *                      new tab; a copy goes out by email from the server.
 *   agreement ready    "Prepared on {date}" with View (a new tab, shown by
 *                      the browser) and Download (the same URL with
 *                      `?download=1`, saved instead). This is the download
 *                      that stays on the order for good.
 *
 * The Couple package (`template` "couple") gets one agreement naming both
 * people, so it needs two sets of details before the route prepares it. The
 * card asks for them in turn with the same dialog in its save only variant,
 * titled for the agreement (`wording: "agreement"`), the account holder's
 * (applicant 0) and then the partner's (applicant 1), each saved on its
 * own, and once both are on the order it offers the optional place and
 * "Open your agreement", a button of its own that does what the one person
 * dialog does on submit: a blank tab opened inside the click, before any
 * await, then the POST, then the tab pointed at the agreement
 * (prepare-agreement.ts). When the route answers 409 with `{ applicant }`
 * (a set of details that is not on the order after all) the card opens that
 * person's dialog. Details already on the order, typed for a deed, count:
 * the card then goes straight to the button, with "Check the details" to
 * walk the two dialogs again.
 *
 * Right after the payment the dialog opens by itself: once per mount, and
 * only while `paidAt` is less than fifteen minutes old, so the return from
 * Stripe lands on the form and a visit the next day shows the card without
 * anything jumping out. For the couple it is the first of the two dialogs,
 * and only while their details are not both on the order. It opens from a
 * timer, a beat after mount, never in the first render: inside the order
 * modal this dialog is nested in another `<dialog>`, a child's effects run
 * before its parent's, and a nested dialog shown before the modal around it
 * would sit under it in the top layer.
 *
 * When the agreement is reported ready, the card turns to the ready state at
 * once and the route refreshes behind it, so the server's row replaces the
 * local date a moment later. A browser that refused the new tab gets one
 * line pointing at View.
 *
 * An agreement on record whose email did not go out (`emailed` false) is
 * sent again from here: once per mount the card POSTs the same route, which
 * is idempotent and only retries the email, and refreshes when it answers
 * ok. Nothing is shown either way (email-retry.ts).
 *
 * Only what the card prints crosses from the server: the date and whether
 * the email went out, never the contract row with its printed variables.
 */

type Props = {
  orderId: string;
  /** The order's `paid_at`: the dialog opens by itself while the payment is fresh. */
  paidAt: string | null;
  /** The account's address: where the agreement is sent. */
  accountEmail: string;
  /** Applicant 0's details on this order, when they exist: the form opens filled from them. */
  applicant: UserServiceApplicantRow | null;
  /** `generated_at` of the agreement, or null while there is none. */
  preparedAt: string | null;
  /** The email with the agreement went out. */
  emailed: boolean;
  /** The service's contract model. "couple" asks for both people's details; anything else, or nothing, for one. */
  template?: ContractTemplate | null;
  /** Couple package only: applicant 1's details on this order, when they exist. */
  partner?: UserServiceApplicantRow | null;
};

/** Long enough for the modal around the card to open first and for the eye to land on "Payment received". */
const AUTO_OPEN_DELAY_MS = 300;

const copy = {
  title: "Your service agreement",
  pending: (email: string) =>
    `Confirm your details and we prepare it. It opens in a new tab and a copy goes to ${email}.`,
  confirm: "Confirm my details",
  prepared: (date: string) => `Prepared on ${date}.`,
  emailed: (email: string) => `A copy was sent to ${email}.`,
  view: "View",
  viewLabel: "View your service agreement in a new tab",
  download: "Download",
  downloadLabel: "Download your service agreement",
  tabRefused: "Your agreement is ready. Open it below.",
  couple: {
    pending: (email: string) =>
      `Confirm your details and your partner's details and we prepare it. It opens in a new tab and a copy goes to ${email}.`,
    confirm: "Confirm the details",
    next: "Continue",
    saved: (email: string) =>
      `Your details and your partner's details are saved. Open the agreement to finish. It opens in a new tab and a copy goes to ${email}.`,
    place: "City and country you are in today",
    placeHint: "Optional. It is printed next to the date in the annex. Leave it blank to write it in by hand.",
    open: "Open your agreement",
    preparing: "Preparing your agreement",
    check: "Check the details",
  },
} as const;

const actionClass =
  "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60";
const primaryClass = cn(actionClass, "bg-navy text-white hover:bg-gold hover:text-navy");
const outlineClass = cn(actionClass, "border border-navy/20 text-navy hover:border-navy hover:bg-navy hover:text-white");
const inputClass = cn(
  "block h-12 w-full rounded-sm border bg-white px-4 text-[0.95rem] text-navy placeholder:text-navy-muted/70 transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export function ContractGate({
  orderId,
  paidAt,
  accountEmail,
  applicant,
  preparedAt,
  emailed,
  template = null,
  partner = null,
}: Props) {
  const router = useRouter();
  const headingId = useId();
  const placeId = useId();
  const placeHintId = useId();
  const errorId = useId();
  const viewRef = useRef<HTMLAnchorElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  /** The silent email retry ran on this mount. */
  const emailRetried = useRef(false);
  /** Set when the partner's dialog saved: the button that asks for the agreement takes the focus next. */
  const focusOpenNext = useRef(false);
  /** Which details dialog is open: applicant 0's (the only one outside the couple) or the partner's. */
  const [step, setStep] = useState<ApplicantIndex | null>(null);
  /** Couple only: the rows the dialogs saved on this mount, newer than the props until the next refresh. */
  const [savedFirst, setSavedFirst] = useState<UserServiceApplicantRow | null>(null);
  const [savedPartner, setSavedPartner] = useState<UserServiceApplicantRow | null>(null);
  /** Couple only: Annex I's optional place, the pending request and its refusal. */
  const [signingPlace, setSigningPlace] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the agreement is reported ready, until the refresh brings the server's date. */
  const [justPreparedAt, setJustPreparedAt] = useState<string | null>(null);
  const [tabRefused, setTabRefused] = useState(false);

  const couple = contractPersons(template) === 2;
  const first = savedFirst ?? applicant;
  const second = savedPartner ?? partner;
  const bothSaved = couple && first !== null && second !== null;
  /** As the server rendered it: both sets on the order before anything was typed here. */
  const bothOnRecord = couple && applicant !== null && partner !== null;
  const readyAt = preparedAt ?? justPreparedAt;
  const url = `/api/orders/${orderId}/contract`;

  useEffect(() => {
    if (preparedAt !== null || bothOnRecord || !isFreshPayment(paidAt, Date.now())) return;
    const timer = window.setTimeout(() => setStep(0), AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [paidAt, preparedAt, bothOnRecord]);

  // An agreement on record whose email never went out: ask the route once per
  // mount to send the stored file again, saying nothing. The ref survives
  // StrictMode's second run of this effect, and retryAgreementEmail itself
  // never has two requests out for one order.
  useEffect(() => {
    if (preparedAt === null || emailed || emailRetried.current) return;
    emailRetried.current = true;
    void retryAgreementEmail(orderId).then((ok) => {
      if (ok) router.refresh();
    });
  }, [preparedAt, emailed, orderId, router]);

  // The button that opened the dialog is gone once the agreement is ready,
  // so focus moves to what replaced it.
  useEffect(() => {
    if (justPreparedAt) viewRef.current?.focus();
  }, [justPreparedAt]);

  // Couple: the partner's dialog closed on a save and gave the focus back to
  // a button that is gone; the one that asks for the agreement takes it.
  useEffect(() => {
    if (!focusOpenNext.current || step !== null || !openRef.current) return;
    focusOpenNext.current = false;
    openRef.current.focus();
  });

  function handlePrepared({ tabOpened }: { tabOpened: boolean }) {
    setStep(null);
    setJustPreparedAt(new Date().toISOString());
    setTabRefused(!tabOpened);
    router.refresh();
  }

  function closeDialog() {
    setStep(null);
  }

  function startCoupleDetails() {
    setError(null);
    setStep(0);
  }

  async function handleOpenAgreement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preparing) return;
    // The route's own rule, so no tab opens for a place it is sure to refuse.
    const place = parseSigningPlace(signingPlace);
    if (!place.ok) {
      setError(place.message);
      return;
    }
    // Before any await: a tab opened now still belongs to the click, so no popup blocker steps in.
    const tab = openPendingTab();
    setError(null);
    setPreparing(true);
    const answer = await requestAgreement(orderId, signingPlace);
    setPreparing(false);
    if (answer.kind === "ready") {
      handlePrepared({ tabOpened: showAgreementIn(tab, orderId) });
      return;
    }
    closeTab(tab);
    // A set of details the card counted is not on the order: ask for it again.
    if (answer.kind === "details") setStep(answer.applicant);
    else setError(answer.message);
  }

  const pendingLine = couple
    ? bothSaved
      ? copy.couple.saved(accountEmail)
      : copy.couple.pending(accountEmail)
    : copy.pending(accountEmail);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-lg border border-navy/10 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6"
    >
      <div className="flex items-start gap-3">
        <FileText className="mt-1 size-5 shrink-0 text-gold-dark" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="font-serif text-lg leading-snug text-navy">
            {copy.title}
          </h2>
          <p className="mt-1 break-words text-[0.9rem] leading-relaxed text-navy-soft">
            {readyAt
              ? [copy.prepared(formatDate(readyAt)), emailed ? copy.emailed(accountEmail) : null].filter(Boolean).join(" ")
              : pendingLine}
          </p>
        </div>
      </div>

      {readyAt ? (
        <div className="mt-4 flex min-h-11 flex-wrap items-center gap-3">
          <a
            ref={viewRef}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={copy.viewLabel}
            className={primaryClass}
          >
            <ExternalLink className="size-4" aria-hidden />
            {copy.view}
          </a>
          <a
            href={`${url}?download=1`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={copy.downloadLabel}
            className={outlineClass}
          >
            <Download className="size-4" aria-hidden />
            {copy.download}
          </a>
        </div>
      ) : bothSaved ? (
        <form onSubmit={handleOpenAgreement} noValidate aria-busy={preparing || undefined} className="mt-4">
          <label htmlFor={placeId} className="block text-xs uppercase tracking-wider text-navy-muted">
            {copy.couple.place}
          </label>
          <input
            id={placeId}
            type="text"
            autoComplete="off"
            autoCapitalize="words"
            maxLength={MAX_SIGNING_PLACE_LENGTH}
            value={signingPlace}
            disabled={preparing}
            onChange={(e) => {
              setSigningPlace(e.target.value);
              if (error) setError(null);
            }}
            aria-describedby={error ? `${placeHintId} ${errorId}` : placeHintId}
            className={cn(inputClass, "mt-2 max-w-md")}
          />
          <p id={placeHintId} className="mt-2 text-[0.82rem] leading-relaxed text-navy-muted">
            {copy.couple.placeHint}
          </p>
          {error && (
            <p id={errorId} role="alert" className="mt-3 text-[0.88rem] leading-relaxed text-clay">
              {error}
            </p>
          )}
          <div className="mt-4 flex min-h-11 flex-wrap items-center gap-3">
            <button ref={openRef} type="submit" disabled={preparing} className={primaryClass}>
              {preparing ? copy.couple.preparing : copy.couple.open}
            </button>
            <button type="button" onClick={startCoupleDetails} disabled={preparing} className={outlineClass}>
              {copy.couple.check}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex min-h-11 flex-wrap items-center gap-3">
          <button type="button" onClick={couple ? startCoupleDetails : () => setStep(0)} className={primaryClass}>
            {couple ? copy.couple.confirm : copy.confirm}
          </button>
        </div>
      )}

      {/* Always mounted so a screen reader hears the line arrive; empty, it takes no room. */}
      <p aria-live="polite" className={cn("text-[0.88rem] leading-relaxed text-navy", tabRefused && "mt-3")}>
        {tabRefused ? copy.tabRefused : ""}
      </p>

      {!readyAt && !couple && step === 0 && (
        <ApplicantDetailsForm
          purpose="contract"
          userServiceId={orderId}
          applicantIndex={0}
          initial={applicant}
          accountEmail={accountEmail}
          onClose={closeDialog}
          onPrepared={handlePrepared}
        />
      )}

      {/* Couple: the same dialog twice, each saving its own person; the card asks for the agreement after. */}
      {!readyAt && couple && step === 0 && (
        <ApplicantDetailsForm
          userServiceId={orderId}
          applicantIndex={0}
          initial={first}
          wording="agreement"
          submitLabel={copy.couple.next}
          onClose={closeDialog}
          onSaved={(row) => {
            setSavedFirst(row);
            setStep(1);
          }}
        />
      )}
      {!readyAt && couple && step === 1 && (
        <ApplicantDetailsForm
          userServiceId={orderId}
          applicantIndex={1}
          initial={second}
          wording="agreement"
          submitLabel={copy.couple.next}
          onClose={closeDialog}
          onSaved={(row) => {
            setSavedPartner(row);
            focusOpenNext.current = true;
            setStep(null);
          }}
        />
      )}
    </section>
  );
}
