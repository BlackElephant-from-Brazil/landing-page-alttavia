"use client";

import { useId, useState, type FormEvent } from "react";

import { requestJson } from "../lib/request";
import { fieldClass, primaryActionClass, smallLabelClass, useAction } from "./use-action";

/**
 * The final report: one textarea saved with PATCH /api/admin/orders/[id].
 * The client reads it on their dashboard once the order is complete.
 * Plain text with blank lines between paragraphs; `**bold**` and
 * `*italic*` are rendered on the client side.
 */
export function ReportForm({ orderId, initial }: { orderId: string; initial: string }) {
  const { pending, error, run } = useAction();
  const id = useId();
  const [report, setReport] = useState(initial);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const ok = await run(() => requestJson(`/api/admin/orders/${orderId}`, { method: "PATCH", body: { report } }));
    if (ok) setSaved(true);
  }

  const dirty = report !== initial;

  return (
    <form onSubmit={submit} aria-busy={pending || undefined}>
      <label htmlFor={id} className={smallLabelClass}>
        Report for the client
      </label>
      <textarea
        id={id}
        value={report}
        onChange={(e) => {
          setReport(e.target.value);
          setSaved(false);
        }}
        rows={8}
        maxLength={20000}
        disabled={pending}
        placeholder="What was done, what the client holds now, and what to keep in mind."
        className={`${fieldClass} mt-1.5 font-sans leading-relaxed`}
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || !dirty} className={primaryActionClass}>
          {pending ? "Saving" : "Save report"}
        </button>
        <p aria-live="polite" className={`min-h-5 text-[0.82rem] leading-5 ${error ? "text-clay" : "text-navy-muted"}`}>
          {error ?? (saved && !dirty ? "Saved." : "")}
        </p>
      </div>
    </form>
  );
}
