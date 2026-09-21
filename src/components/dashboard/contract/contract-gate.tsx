"use client";

import { useRouter } from "next/navigation";
import { Download, ExternalLink, FileText } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import type { UserServiceApplicantRow } from "@/lib/db/types";

import { ApplicantDetailsForm } from "../documents/applicant-details-form";
import { formatDate } from "../order-status";
import { retryAgreementEmail } from "./email-retry";
import { isFreshPayment } from "./fresh-payment";

/**
 * The service agreement card of a paid order, right under the "Payment
 * received" notice. Design (docs/agreement-contract.md) section 6.
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
 * Right after the payment the dialog opens by itself: once per mount, and
 * only while `paidAt` is less than fifteen minutes old, so the return from
 * Stripe lands on the form and a visit the next day shows the card without
 * anything jumping out. It opens from a timer, a beat after mount, never in
 * the first render: inside the order modal this dialog is nested in another
 * `<dialog>`, a child's effects run before its parent's, and a nested dialog
 * shown before the modal around it would sit under it in the top layer.
 *
 * When the dialog reports the agreement ready, the card turns to the ready
 * state at once and the route refreshes behind it, so the server's row
 * replaces the local date a moment later. A browser that refused the new tab
 * gets one line pointing at View.
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
} as const;

const actionClass =
  "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white";
const primaryClass = cn(actionClass, "bg-navy text-white hover:bg-gold hover:text-navy");
const outlineClass = cn(actionClass, "border border-navy/20 text-navy hover:border-navy hover:bg-navy hover:text-white");

export function ContractGate({ orderId, paidAt, accountEmail, applicant, preparedAt, emailed }: Props) {
  const router = useRouter();
  const headingId = useId();
  const viewRef = useRef<HTMLAnchorElement>(null);
  /** The silent email retry ran on this mount. */
  const emailRetried = useRef(false);
  const [open, setOpen] = useState(false);
  /** Set when the dialog reports the agreement ready, until the refresh brings the server's date. */
  const [justPreparedAt, setJustPreparedAt] = useState<string | null>(null);
  const [tabRefused, setTabRefused] = useState(false);

  const readyAt = preparedAt ?? justPreparedAt;
  const url = `/api/orders/${orderId}/contract`;

  useEffect(() => {
    if (preparedAt !== null || !isFreshPayment(paidAt, Date.now())) return;
    const timer = window.setTimeout(() => setOpen(true), AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [paidAt, preparedAt]);

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

  function handlePrepared({ tabOpened }: { tabOpened: boolean }) {
    setOpen(false);
    setJustPreparedAt(new Date().toISOString());
    setTabRefused(!tabOpened);
    router.refresh();
  }

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
              : copy.pending(accountEmail)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex min-h-11 flex-wrap items-center gap-3">
        {readyAt ? (
          <>
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
          </>
        ) : (
          <button type="button" onClick={() => setOpen(true)} className={primaryClass}>
            {copy.confirm}
          </button>
        )}
      </div>

      {/* Always mounted so a screen reader hears the line arrive; empty, it takes no room. */}
      <p aria-live="polite" className={cn("text-[0.88rem] leading-relaxed text-navy", tabRefused && "mt-3")}>
        {tabRefused ? copy.tabRefused : ""}
      </p>

      {open && !readyAt && (
        <ApplicantDetailsForm
          purpose="contract"
          userServiceId={orderId}
          applicantIndex={0}
          initial={applicant}
          accountEmail={accountEmail}
          onClose={() => setOpen(false)}
          onPrepared={handlePrepared}
        />
      )}
    </section>
  );
}
