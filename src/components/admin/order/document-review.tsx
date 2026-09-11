"use client";

import { Check, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { requestJson } from "../lib/request";
import { dangerActionClass, fieldClass, outlineActionClass, primaryActionClass, smallLabelClass, useAction } from "./use-action";

/**
 * Approve or reject one uploaded document. Approve is one click; Reject
 * opens a reason field first, because the route refuses a rejection
 * without one and the client reads the reason on their dashboard and in
 * the email.
 */
export function DocumentReview({ documentId, label }: { documentId: string; label: string }) {
  const { pending, error, run, clear } = useAction();
  const reasonId = useId();
  const reasonHintId = `${reasonId}-hint`;
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  function approve() {
    void run(() =>
      requestJson(`/api/admin/documents/${documentId}/review`, { method: "POST", body: { decision: "approve" } }),
    );
  }

  function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = reason.trim();
    if (!text) return;
    void run(() =>
      requestJson(`/api/admin/documents/${documentId}/review`, {
        method: "POST",
        body: { decision: "reject", reason: text },
      }),
    );
  }

  return (
    <div className="mt-3" aria-busy={pending || undefined}>
      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={approve} disabled={pending} className={primaryActionClass}>
            <Check className="size-4" aria-hidden />
            Approve
          </button>
          <button
            type="button"
            onClick={() => {
              clear();
              setRejecting(true);
            }}
            disabled={pending}
            className={dangerActionClass}
          >
            <X className="size-4" aria-hidden />
            Reject
          </button>
        </div>
      ) : (
        <form onSubmit={reject}>
          <label htmlFor={reasonId} className={smallLabelClass}>
            Reason for rejecting {label}
          </label>
          <textarea
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            rows={3}
            maxLength={2000}
            disabled={pending}
            autoFocus
            aria-describedby={reasonHintId}
            placeholder="What is wrong with the file and what to send instead."
            className={`${fieldClass} mt-1.5`}
          />
          <p id={reasonHintId} className="mt-1.5 text-[0.8rem] leading-relaxed text-navy-muted">
            The client reads this word for word, on their dashboard and by email.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" disabled={pending || !reason.trim()} className={dangerActionClass}>
              Reject and notify
            </button>
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setReason("");
                clear();
              }}
              disabled={pending}
              className={outlineActionClass}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <p aria-live="polite" className="mt-2 min-h-5 text-[0.82rem] leading-5 text-clay">
        {error ?? ""}
      </p>
    </div>
  );
}
