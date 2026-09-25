"use client";

import { useId, useState } from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { PayTermsNote } from "./pay-terms-note";

/**
 * The Pay button on the dashboard. Asks the server for a Stripe Checkout URL
 * for this order and sends the browser there. The server decides the price
 * and the buyer's email; the button only knows which order.
 *
 * Paying accepts the service terms and the service agreement (Patrícia,
 * 2026-09-24: accepted before paying). The line saying so sits under the
 * button (pay-terms-note.tsx), and the request carries
 * `{ userServiceId, acceptTerms: true }`: POST /api/checkout refuses one
 * without it (422) and records the acceptance on the order before it hands
 * out the URL.
 *
 * Stays disabled after a successful request: the page is about to leave, and
 * a second click would open a second session.
 *
 * Two shapes, one behaviour: the order view's payment section (large, full
 * width on a phone, aligned left, the terms line right under the button) and
 * the "In progress" card, which sits it next to See more in a row aligned
 * right (`size="md"`, `align="end"`, `wide={false}`) and renders the terms
 * line itself under that row, passing its id as `termsNoteId` so the button
 * still points at it. Any refusal is shown under the button either way.
 */

const PENDING_LABEL = "Opening secure checkout";
const FALLBACK_ERROR = "Checkout could not be opened. Please try again.";

export function PayButton({
  userServiceId,
  label,
  size = "lg",
  align = "start",
  wide = true,
  termsNoteId,
  className,
}: {
  userServiceId: string;
  label: string;
  size?: "md" | "lg";
  /** Which edge the button and its message sit on. */
  align?: "start" | "end";
  /** Full width below `sm`, as the order page's payment section wants it. */
  wide?: boolean;
  /**
   * The id of a terms line the caller renders elsewhere (the card's, under
   * its button row). Without it the button renders the line under itself.
   */
  termsNoteId?: string;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const ownNoteId = useId();
  const noteId = termsNoteId ?? ownNoteId;

  async function pay() {
    setPending(true);
    setError(null);

    let url: string | undefined;
    let message = FALLBACK_ERROR;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The click is the acceptance of the line under the button.
        body: JSON.stringify({ userServiceId, acceptTerms: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
      if (res.ok && typeof data.url === "string") {
        url = data.url;
      } else if (typeof data.error === "string" && data.error) {
        message = data.error;
      }
    } catch {
      // Network failure: the fallback message stands.
    }

    if (!url) {
      setError(message);
      setPending(false);
      return;
    }

    window.location.assign(url);
  }

  return (
    <div className={cn("flex flex-col", align === "end" ? "items-end" : "items-start", className)}>
      <Button
        type="button"
        size={size}
        variant="primary"
        onClick={pay}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={error ? `${errorId} ${noteId}` : noteId}
        className={wide ? "w-full sm:w-auto" : undefined}
      >
        <Lock className="size-4" aria-hidden />
        {pending ? PENDING_LABEL : label}
      </Button>
      {error && (
        <p
          id={errorId}
          role="alert"
          className={cn("mt-3 text-[0.85rem] leading-relaxed text-clay", align === "end" && "text-right")}
        >
          {error}
        </p>
      )}
      {!termsNoteId && <PayTermsNote id={ownNoteId} align={align} className="mt-2.5" />}
    </div>
  );
}
