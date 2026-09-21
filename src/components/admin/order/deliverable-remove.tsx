"use client";

import { Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { requestJson } from "../lib/request";
import { dangerActionClass, outlineActionClass, useAction } from "./use-action";

/**
 * Remove for one returned file, for a file sent by mistake. One click asks
 * first, inline, because the client stops seeing the file and the copy in
 * the bucket goes with it; the answer DELETEs /api/admin/deliverables/[id]
 * and refreshes the modal, which then lists the file no more (the "Still to
 * send" line picks its template up again).
 *
 * It renders as children of the file's row, which wraps: a link sized
 * button beside Download, and while it asks, a full width block under the
 * row. A failure keeps the question open with the route's one line, so
 * "Yes, remove" can be pressed again.
 */

const copy = {
  action: "Remove",
  question: "Remove this file? The client stops seeing it.",
  confirm: "Yes, remove",
  working: "Removing",
  cancel: "Cancel",
} as const;

export function DeliverableRemove({ deliverableId, label }: { deliverableId: string; label: string }) {
  const { pending, error, run, clear } = useAction();
  const questionId = useId();
  const [confirming, setConfirming] = useState(false);

  function remove() {
    void run(() => requestJson(`/api/admin/deliverables/${deliverableId}`, { method: "DELETE" }));
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => {
          clear();
          setConfirming(true);
        }}
        aria-label={`${copy.action} ${label}`}
        className="inline-flex items-center gap-1 rounded-sm text-[0.85rem] font-medium text-clay underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        <Trash2 className="size-3.5" aria-hidden />
        {copy.action}
      </button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby={questionId}
      aria-busy={pending || undefined}
      className="mt-2 basis-full rounded-sm border border-clay/25 bg-clay/5 px-4 py-3.5"
    >
      <p id={questionId} className="text-[0.9rem] font-medium leading-relaxed text-navy">
        {copy.question}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={remove} disabled={pending} className={dangerActionClass}>
          {pending ? copy.working : copy.confirm}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            clear();
          }}
          disabled={pending}
          autoFocus
          className={outlineActionClass}
        >
          {copy.cancel}
        </button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-[0.82rem] leading-5 text-clay">
        {error ?? ""}
      </p>
    </div>
  );
}
