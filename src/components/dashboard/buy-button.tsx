"use client";

import { useId, useState } from "react";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatEuro } from "@/content/bank-nif";
import { cn } from "@/lib/cn";

/**
 * The Buy button on a gallery card. Admin contract section 7, "Client
 * /en/dashboard/orders": POST /api/orders creates the order for the signed
 * in user, POST /api/checkout opens the Stripe session for it, and the
 * browser goes there. The server prices the order from the service row; the
 * button only says which service and, for NIF only, how many.
 *
 * `supportsQuantity` adds a 1 or 2 choice that changes the total shown on
 * the button. Stays disabled after a successful request: the page is about
 * to leave, and a second click would open a second order.
 */

const PENDING_LABEL = "Opening secure checkout";
const FALLBACK_ERROR = "Checkout could not be opened. Please try again.";

type Quantity = 1 | 2;

const QUANTITY_OPTIONS: { value: Quantity; label: string; hint: string }[] = [
  { value: 1, label: "One NIF", hint: "For you" },
  { value: 2, label: "Two NIFs", hint: "For you and your partner" },
];

export function BuyButton({
  serviceSlug,
  priceCents,
  supportsQuantity,
  className,
}: {
  serviceSlug: string;
  priceCents: number;
  supportsQuantity: boolean;
  className?: string;
}) {
  const [quantity, setQuantity] = useState<Quantity>(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const groupId = useId();

  const total = formatEuro(priceCents * quantity);

  async function buy() {
    setPending(true);
    setError(null);

    let url: string | undefined;
    let message = FALLBACK_ERROR;
    try {
      const order = await postJson<{ userServiceId?: unknown }>("/api/orders", {
        serviceSlug,
        quantity: supportsQuantity ? quantity : 1,
      });
      if (typeof order.userServiceId === "string") {
        const checkout = await postJson<{ url?: unknown }>("/api/checkout", { userServiceId: order.userServiceId });
        if (typeof checkout.url === "string") url = checkout.url;
      }
    } catch (err) {
      if (err instanceof Error && err.message) message = err.message;
    }

    if (!url) {
      setError(message);
      setPending(false);
      return;
    }

    window.location.assign(url);
  }

  return (
    <div className={cn("flex flex-col items-stretch", className)}>
      {supportsQuantity && (
        <fieldset className="mb-4" disabled={pending}>
          <legend id={groupId} className="text-[0.72rem] font-medium uppercase tracking-[0.18em] text-navy-muted">
            How many
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby={groupId}>
            {QUANTITY_OPTIONS.map((option) => {
              const checked = quantity === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-sm border px-3.5 py-2.5 transition-colors duration-200",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-white",
                    checked ? "border-navy bg-navy text-white" : "border-navy/15 bg-white text-navy hover:border-navy/40",
                    pending && "cursor-wait opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name={`${groupId}-quantity`}
                    value={option.value}
                    checked={checked}
                    onChange={() => setQuantity(option.value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className={cn("text-[0.78rem]", checked ? "text-white/70" : "text-navy-muted")}>
                    {option.hint} · {formatEuro(priceCents * option.value)}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <Button
        type="button"
        size="md"
        variant="primary"
        onClick={buy}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={error ? errorId : undefined}
        className="w-full"
      >
        <Lock className="size-4" aria-hidden />
        {pending ? PENDING_LABEL : `Buy for ${total}`}
      </Button>
      {error && (
        <p id={errorId} role="alert" className="mt-3 text-[0.85rem] leading-relaxed text-clay">
          {error}
        </p>
      )}
    </div>
  );
}

/** POST a JSON body and return the JSON reply, or throw with the server's one line message. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(FALLBACK_ERROR);
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // no body
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : FALLBACK_ERROR;
    throw new Error(message);
  }
  return (data ?? {}) as T;
}
