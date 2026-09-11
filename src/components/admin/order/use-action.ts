"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { messageFor } from "../lib/request";

/**
 * What every action in the order modal does after its request: refresh the
 * server components so the modal shows the new state, and keep "pending"
 * true until that refresh has landed, not just until the route answered.
 * The URL still carries `?order=`, so the modal stays open.
 *
 *   const { pending, error, run, clear } = useAction();
 *   run(() => requestJson(`/api/admin/orders/${id}/stage`, { method: "POST", body }));
 *
 * `run` resolves true on success and false on failure, with the route's one
 * line in `error`. A second call while pending is ignored.
 */
export function useAction() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (request: () => Promise<unknown>): Promise<boolean> => {
      if (requesting || refreshing) return false;
      setError(null);
      setRequesting(true);
      try {
        await request();
        startTransition(() => {
          router.refresh();
        });
        return true;
      } catch (err) {
        setError(messageFor(err));
        return false;
      } finally {
        setRequesting(false);
      }
    },
    [refreshing, requesting, router],
  );

  const clear = useCallback(() => setError(null), []);

  return { pending: requesting || refreshing, error, run, clear };
}

/** The shared look of a small action button in the modal. */
export const actionButtonClass =
  "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[0.82rem] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50";

export const primaryActionClass = `${actionButtonClass} border-navy bg-navy text-white hover:bg-gold hover:border-gold hover:text-navy disabled:hover:bg-navy disabled:hover:border-navy disabled:hover:text-white`;
export const outlineActionClass = `${actionButtonClass} border-navy/20 bg-white text-navy hover:border-navy hover:bg-navy hover:text-white disabled:hover:bg-white disabled:hover:text-navy disabled:hover:border-navy/20`;
export const dangerActionClass = `${actionButtonClass} border-clay/30 bg-white text-clay hover:border-clay hover:bg-clay hover:text-white disabled:hover:bg-white disabled:hover:text-clay disabled:hover:border-clay/30`;

export const fieldClass =
  "block w-full rounded-sm border border-navy/15 bg-white px-3.5 py-2.5 text-[0.9rem] text-navy placeholder:text-navy-muted/70 transition-colors duration-200 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60";

export const smallLabelClass = "block text-[0.7rem] font-medium uppercase tracking-[0.14em] text-navy-muted";
