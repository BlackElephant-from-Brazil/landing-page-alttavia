"use client";

import { useId, useState } from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The Pay button on the dashboard. Asks the server for a Stripe Checkout URL
 * for this order and sends the browser there. The server decides the price,
 * the quantity and the buyer's email; the button only knows which order.
 *
 * Stays disabled after a successful request: the page is about to leave, and
 * a second click would open a second session.
 */

const PENDING_LABEL = "Opening secure checkout";
const FALLBACK_ERROR = "Checkout could not be opened. Please try again.";

export function PayButton({
  userServiceId,
  label,
  className,
}: {
  userServiceId: string;
  label: string;
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
    <div className={cn("flex flex-col items-start", className)}>
      <Button
        type="button"
        size="lg"
        variant="primary"
        onClick={pay}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={error ? errorId : undefined}
        className="w-full sm:w-auto"
      >
        <Lock className="size-4" aria-hidden />
        {pending ? PENDING_LABEL : label}
      </Button>
      {error && (
        <p id={errorId} role="alert" className="mt-3 text-[0.85rem] leading-relaxed text-clay">
          {error}
        </p>
      )}
    </div>
  );
}
