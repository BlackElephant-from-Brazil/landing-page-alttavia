"use client";

import { Check, FileText, Lock, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type MouseEvent, type SyntheticEvent } from "react";

import { RichText } from "@/components/bank/rich-text";
import { Button } from "@/components/ui/button";
import { formatEuro } from "@/content/bank-nif";
import { cn } from "@/lib/cn";
import type { ServiceRow } from "@/lib/db/types";

/**
 * The purchase drawer: a `<dialog>` panel on the right edge, full height,
 * that slides in with what the wizard's result screen shows for a product
 * (name, tagline, price, everything included, the timeline, the documents to
 * have ready) and ends on Confirm purchase.
 *
 * Confirm posts /api/orders for one unit of the service, then /api/checkout
 * for the order it made, and sends the browser to Stripe. The server prices
 * the order from the service row; the drawer only names the slug. The
 * button stays disabled after a successful request, since the page is about
 * to leave and a second click would open a second order.
 *
 * `showModal()` keeps focus inside natively and wires Esc, which arrives as
 * the `cancel` event and closes the same way the X and the backdrop do. The
 * parent owns "open" (which service) and gives focus back to the opener; the
 * drawer only animates out before telling the parent to unmount it, unless
 * the visitor prefers reduced motion, in which case it closes at once. The
 * dialog is `overflow-clip`, so only the inner body scrolls.
 */

const PENDING_LABEL = "Opening secure checkout";
const FALLBACK_ERROR = "Checkout could not be opened. Please try again.";
const SLIDE_MS = 300;

const copy = {
  eyebrow: "Add a service",
  included: "Everything included",
  timeline: "Timeline",
  documents: "Have ready after payment",
  noDocuments: "Nothing to upload for this service.",
  reassurance:
    "Secure payment through Stripe. Your order appears on this dashboard right away, and you upload your documents there.",
  confirm: "Confirm purchase",
  notNow: "Not now",
  close: "Close",
} as const;

export function PurchaseDrawer({
  service,
  docLabels,
  onClose,
}: {
  service: ServiceRow;
  docLabels: readonly string[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  const closing = useRef(false);
  const [entered, setEntered] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const errorId = useId();

  const price = formatEuro(service.price_cents);
  const includes = Array.isArray(service.includes) ? service.includes : [];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    const frame = window.requestAnimationFrame(() => setEntered(true));
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
    };
  }, []);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEntered(false);
    window.setTimeout(onClose, reduced ? 0 : SLIDE_MS);
  }, [onClose]);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (!pending) close();
  }

  function handleBackdropDown(event: MouseEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }

  function handleBackdrop(event: MouseEvent<HTMLDialogElement>) {
    const pressed = pressedOnBackdrop.current;
    pressedOnBackdrop.current = false;
    if (pressed && event.target === event.currentTarget && !pending) close();
  }

  async function confirm() {
    setPending(true);
    setError(null);

    let url: string | undefined;
    let message = FALLBACK_ERROR;
    try {
      const order = await postJson<{ userServiceId?: unknown }>("/api/orders", { serviceSlug: service.slug, quantity: 1 });
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
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onMouseDown={handleBackdropDown}
      onClick={handleBackdrop}
      className={cn(
        "m-0 ml-auto h-dvh max-h-dvh w-[min(32rem,100vw)] max-w-none overflow-clip border-l border-navy/10 bg-paper p-0 text-navy shadow-[var(--shadow-card)]",
        "backdrop:bg-navy/50 backdrop:backdrop-blur-[2px] backdrop:transition-opacity backdrop:duration-300 motion-reduce:backdrop:transition-none",
        "transition-transform duration-300 ease-out motion-reduce:transition-none",
        entered ? "translate-x-0 backdrop:opacity-100" : "translate-x-full backdrop:opacity-0",
      )}
    >
      <div className="flex h-dvh flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-navy/10 bg-white px-6 py-5 sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-gold-dark">{copy.eyebrow}</p>
            <h2 id={titleId} className="mt-1 font-serif text-xl leading-snug text-navy">
              {service.name}
            </h2>
            {service.tagline && <p className="mt-1 text-sm leading-snug text-navy-soft">{service.tagline}</p>}
          </div>
          <button
            type="button"
            onClick={close}
            disabled={pending}
            aria-label={copy.close}
            className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-navy-muted transition-colors duration-200 hover:bg-navy/5 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
          <p className="font-serif text-5xl leading-none text-navy">{price}</p>
          {service.timeline && (
            <p className="mt-3 text-[0.85rem] text-navy-muted">
              <span className="font-medium uppercase tracking-[0.14em] text-[0.68rem]">{copy.timeline}</span>
              <span className="mx-2" aria-hidden>
                ·
              </span>
              {service.timeline}
            </p>
          )}

          {includes.length > 0 && (
            <section className="mt-8" aria-label={copy.included}>
              <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-navy-muted">{copy.included}</h3>
              <ul className="mt-3 space-y-3">
                {includes.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-gold-dark" aria-hidden />
                    <span className="text-[0.92rem] leading-relaxed text-navy-soft">
                      <RichText text={feature} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-8" aria-label={copy.documents}>
            <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-navy-muted">{copy.documents}</h3>
            {docLabels.length === 0 ? (
              <p className="mt-3 text-[0.9rem] text-navy-soft">{copy.noDocuments}</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {docLabels.map((label) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-2 rounded-full border border-navy/10 bg-white px-3.5 py-1.5 text-[0.85rem] text-navy"
                  >
                    <FileText className="size-3.5 text-gold-dark" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-8 text-[0.85rem] leading-relaxed text-navy-muted">{copy.reassurance}</p>
        </div>

        <footer className="border-t border-navy/10 bg-white px-6 py-5 sm:px-8">
          <Button
            type="button"
            size="lg"
            variant="primary"
            onClick={confirm}
            disabled={pending}
            aria-busy={pending}
            aria-describedby={error ? errorId : undefined}
            className="w-full"
          >
            <Lock className="size-4" aria-hidden />
            {pending ? PENDING_LABEL : `${copy.confirm} · ${price}`}
          </Button>
          {error && (
            <p id={errorId} role="alert" className="mt-3 text-[0.85rem] leading-relaxed text-clay">
              {error}
            </p>
          )}
          <Button type="button" size="md" variant="ghost" onClick={close} disabled={pending} className="mt-2 w-full">
            {copy.notNow}
          </Button>
        </footer>
      </div>
    </dialog>
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
