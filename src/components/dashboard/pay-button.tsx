"use client";

import { useId, useState } from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The Pay button on the dashboard. Asks the server for a Stripe Checkout URL
 * for this order and sends the browser there. The server decides the price
 * and the buyer's email; the button only knows which order.
 *
 * Stays disabled after a successful request: the page is about to leave, and
 * a second click would open a second session.
 *
 * Two shapes, one behaviour: the order view's payment section (large, full
 * width on a phone, aligned left) and the "In progress" card, which sits it
 * next to See more in a row aligned right (`size="md"`, `align="end"`,
 * `wide={false}`). Any refusal is shown under the button either way.
 */

const PENDING_LABEL = "Opening secure checkout";
const FALLBACK_ERROR = "Checkout could not be opened. Please try again.";

export function PayButton({
  userServiceId,
  label,
  size = "lg",
  align = "start",
  wide = true,
  className,
}: {
  userServiceId: string;
  label: string;
  size?: "md" | "lg";
  /** Which edge the button and its message sit on. */
  align?: "start" | "end";
  /** Full width below `sm`, as the order page's payment section wants it. */
  wide?: boolean;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();

  async function pay() {
    setPending(true);
    setError(null);

    let url: string | undefined;
    let message = FALLBACK_ERROR;
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userServiceId }),
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
        aria-describedby={error ? errorId : undefined}
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
    </div>
  );
}
