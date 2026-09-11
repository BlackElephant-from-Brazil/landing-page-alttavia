"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import type { ServiceStageRow } from "@/lib/db/types";

import { requestJson } from "../lib/request";
import { fieldClass, outlineActionClass, primaryActionClass, smallLabelClass, useAction } from "./use-action";

/**
 * Back, Forward and a jump select for the order's stage. Every move posts
 * to /api/admin/orders/[id]/stage and refreshes the modal. The warning
 * line about unapproved required documents is shown while the order sits
 * on the documents stage; moving on still works, as the contract says.
 * An unpaid order stays on its first stage: Forward and the jump form are
 * disabled, matching the 409 the route would answer.
 */
export function StageControls({
  orderId,
  stages,
  currentKey,
  paid,
  unapprovedRequired,
}: {
  orderId: string;
  stages: ServiceStageRow[];
  currentKey: string;
  /** `paid_at` is set. Until then the order cannot leave its first stage. */
  paid: boolean;
  /** Required document slots without an approved file. */
  unapprovedRequired: number;
}) {
  const { pending, error, run } = useAction();
  const selectId = useId();
  const [target, setTarget] = useState(currentKey);

  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((s) => s.key === currentKey);
  const canBack = index > 0;
  const canForward = paid && index >= 0 && index < ordered.length - 1;
  const canJump = paid;
  const onDocuments = currentKey === "documents";

  function move(direction: "forward" | "back") {
    void run(() => requestJson(`/api/admin/orders/${orderId}/stage`, { method: "POST", body: { direction } }));
  }

  function jump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canJump || !target || target === currentKey) return;
    void run(() => requestJson(`/api/admin/orders/${orderId}/stage`, { method: "POST", body: { stageKey: target } }));
  }

  return (
    <div aria-busy={pending || undefined}>
      <div className="flex flex-wrap items-end gap-3">
        <button type="button" onClick={() => move("back")} disabled={pending || !canBack} className={outlineActionClass}>
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>
        <button type="button" onClick={() => move("forward")} disabled={pending || !canForward} className={primaryActionClass}>
          Forward
          <ArrowRight className="size-4" aria-hidden />
        </button>

        <form onSubmit={jump} className="flex flex-wrap items-end gap-2">
          <label htmlFor={selectId} className={smallLabelClass}>
            Jump to
            <select
              id={selectId}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              disabled={pending || !canJump}
              className={`${fieldClass} mt-1 h-9 w-auto min-w-[12rem] py-0 normal-case tracking-normal`}
            >
              {ordered.map((stage) => (
                <option key={stage.key} value={stage.key}>
                  {stage.label}
                  {stage.key === currentKey ? " (current)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={pending || !canJump || target === currentKey} className={outlineActionClass}>
            Go
          </button>
        </form>
      </div>

      {!paid && <p className="mt-3 text-[0.85rem] leading-relaxed text-navy-soft">Stages open once the order is paid.</p>}

      {onDocuments && unapprovedRequired > 0 && (
        <p className="mt-3 rounded-sm border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[0.85rem] leading-relaxed text-navy">
          {unapprovedRequired === 1
            ? "One required document is not approved yet. Moving on still works."
            : `${unapprovedRequired} required documents are not approved yet. Moving on still works.`}
        </p>
      )}

      <p aria-live="polite" className="mt-2 min-h-5 text-[0.82rem] leading-5 text-clay">
        {error ?? ""}
      </p>
    </div>
  );
}
