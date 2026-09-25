"use client";

import { RefreshCw } from "lucide-react";
import { useId, useState } from "react";

import { requestJson } from "../lib/request";
import { outlineActionClass, primaryActionClass, useAction } from "./use-action";

/**
 * "Regenerate and resend" for the order's service agreement. Design
 * (docs/agreement-contract.md) section 7.
 *
 * One click asks first, because the route prepares a new version from the
 * client's details as they are now and emails it to the client again; the
 * answer POSTs /api/admin/orders/[id]/contract (no body) and refreshes the
 * modal, which then shows the new version and when it was emailed. The line
 * under the button says whether the email went out, or shows the route's
 * one line (the client has not entered their details, the order is unpaid,
 * two regenerations raced).
 *
 * With `exists` false the order has no agreement yet although the client's
 * details are there (typed for a deed): the same route prepares the first
 * version, so the button reads "Prepare and send".
 *
 * With `couple` the agreement is the Couple package's one contract naming
 * both people, so the confirmation speaks of both sets of details; the
 * route refuses with its own line while the partner's are missing. Every
 * version is prepared with the firm's signature when the bucket holds it
 * (src/lib/contracts/ensure.ts), so regenerating an agreement prepared
 * before the signature arrived is how it gets signed.
 */

const copy = {
  regenerate: {
    action: "Regenerate and resend",
    title: "Regenerate and resend this agreement?",
    body: "A new version is prepared from the client's details as they are now and emailed to the client again. The version before it stays in storage.",
    coupleBody:
      "A new version is prepared from the details of the client and their partner as they are now and emailed to the client again. The version before it stays in storage.",
    confirm: "Yes, regenerate and resend",
  },
  first: {
    action: "Prepare and send",
    title: "Prepare and send the agreement?",
    body: "It is prepared from the details the client has entered and emailed to the client.",
    coupleBody: "It is prepared from the details the client has entered for both people and emailed to the client.",
    confirm: "Yes, prepare and send",
  },
  cancel: "Cancel",
  working: "Preparing",
  emailed: "Prepared and emailed to the client.",
  notEmailed: "Prepared, but the email did not go out. Try again in a moment.",
} as const;

type Props = {
  orderId: string;
  /** An agreement is on record: the action regenerates it. */
  exists: boolean;
  /** The service's model is `couple`: the agreement names the client and their partner. */
  couple?: boolean;
};

export function ContractActions({ orderId, exists, couple = false }: Props) {
  const { pending, error, run, clear } = useAction();
  const id = useId();
  const titleId = `${id}-title`;
  const bodyId = `${id}-body`;
  const [confirming, setConfirming] = useState(false);
  const [outcome, setOutcome] = useState<"emailed" | "not_emailed" | null>(null);
  const text = exists ? copy.regenerate : copy.first;
  const body = couple ? text.coupleBody : text.body;

  async function send() {
    let emailed = false;
    setOutcome(null);
    const ok = await run(async () => {
      const result = await requestJson<{ emailed?: unknown } | null>(`/api/admin/orders/${orderId}/contract`, {
        method: "POST",
      });
      emailed = result?.emailed === true;
    });
    setConfirming(false);
    if (ok) setOutcome(emailed ? "emailed" : "not_emailed");
  }

  return (
    <div className="mt-3" aria-busy={pending || undefined}>
      {confirming ? (
        <div
          role="alertdialog"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          className="rounded-sm border border-gold/40 bg-gold/10 px-4 py-3.5"
        >
          <p id={titleId} className="font-medium text-navy">
            {text.title}
          </p>
          <p id={bodyId} className="mt-1 max-w-prose text-[0.85rem] leading-relaxed text-navy-soft">
            {body}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={send} disabled={pending} className={primaryActionClass}>
              {pending ? copy.working : text.confirm}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              autoFocus
              className={outlineActionClass}
            >
              {copy.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            clear();
            setOutcome(null);
            setConfirming(true);
          }}
          disabled={pending}
          className={outlineActionClass}
        >
          <RefreshCw className="size-4" aria-hidden />
          {text.action}
        </button>
      )}
      <p aria-live="polite" className={`mt-2 min-h-5 text-[0.82rem] leading-5 ${error ? "text-clay" : "text-navy-muted"}`}>
        {error ?? (outcome === "emailed" ? copy.emailed : outcome === "not_emailed" ? copy.notEmailed : "")}
      </p>
    </div>
  );
}
