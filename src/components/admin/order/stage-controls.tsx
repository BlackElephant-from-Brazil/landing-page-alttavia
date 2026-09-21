"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
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
 *
 * A move onto the terminal stage (Forward from the stage before it, or a
 * jump to it) asks first, inline, because it marks the order complete and
 * the route emails the client the first time. The question says which:
 * `completedBefore` (an earlier event already took the order to the
 * terminal stage, the route's own test) turns it into "no email goes out".
 * After it the line under the
 * controls says "Order completed.", and adds that the email could not be
 * sent only when the route answers `emailed: false`. The route leaves
 * `emailed` out when the order had been complete before, so nothing is
 * said about an email then.
 */

type Move = { direction: "forward" | "back" } | { stageKey: string };

/** The route's answer; `emailed` is there only when the completion email was due. */
type StageAnswer = { stageKey: string; completed: boolean; emailed?: boolean } | null;

type Outcome = "completed" | "completed_not_emailed";

const copy = {
  confirmCompletion: "This marks the order complete and emails the client. Continue?",
  confirmCompletionAgain:
    "This marks the order complete. The client was emailed the first time, so no email goes out. Continue?",
  confirm: "Confirm",
  cancel: "Cancel",
  outcome: {
    completed: "Order completed.",
    completed_not_emailed: "Order completed. The email to the client could not be sent.",
  } satisfies Record<Outcome, string>,
} as const;

/**
 * The outcome of the last move, by order id, for the instance that mounts
 * after it. The modal keys this component by the order's stage, so a move
 * that succeeds unmounts the instance that made it and mounts a fresh one
 * on the new stage, and local state would go with the old one. The fresh
 * instance reads its line from here as it mounts, and an effect removes the
 * entry right after, so reopening the order later shows nothing stale.
 */
const outcomes = new Map<string, { stageKey: string; outcome: Outcome }>();

function outcomeOf(answer: StageAnswer): Outcome | null {
  if (!answer?.completed) return null;
  return answer.emailed === false ? "completed_not_emailed" : "completed";
}

export function StageControls({
  orderId,
  stages,
  currentKey,
  paid,
  unapprovedRequired,
  completedBefore,
}: {
  orderId: string;
  stages: ServiceStageRow[];
  currentKey: string;
  /** `paid_at` is set. Until then the order cannot leave its first stage. */
  paid: boolean;
  /** Required document slots without an approved file. */
  unapprovedRequired: number;
  /** The order reached its terminal stage before, so completing it again sends no email. */
  completedBefore: boolean;
}) {
  const { pending, error, run, clear } = useAction();
  const selectId = useId();
  const confirmId = useId();
  const [target, setTarget] = useState(currentKey);
  const [confirming, setConfirming] = useState<Move | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(() => {
    const saved = outcomes.get(orderId);
    return saved && saved.stageKey === currentKey ? saved.outcome : null;
  });

  // Read once by the initializer above; dropped here so it is never shown twice.
  useEffect(() => {
    outcomes.delete(orderId);
  }, [orderId, currentKey]);

  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((s) => s.key === currentKey);
  const canBack = index > 0;
  const canForward = paid && index >= 0 && index < ordered.length - 1;
  const canJump = paid;
  const onDocuments = currentKey === "documents";
  const busy = pending || confirming !== null;

  /** Whether the move lands on the terminal stage, the one that asks first. */
  function completes(next: Move): boolean {
    const stage =
      "stageKey" in next
        ? ordered.find((s) => s.key === next.stageKey)
        : next.direction === "forward" && index >= 0
          ? ordered[index + 1]
          : undefined;
    return !!stage && stage.is_terminal && stage.key !== currentKey;
  }

  function request(next: Move) {
    if (completes(next)) {
      clear();
      setOutcome(null);
      setConfirming(next);
      return;
    }
    void send(next);
  }

  async function send(next: Move) {
    setOutcome(null);
    let result: Outcome | null = null;
    const ok = await run(async () => {
      const answer = await requestJson<StageAnswer>(`/api/admin/orders/${orderId}/stage`, { method: "POST", body: next });
      result = outcomeOf(answer);
      // Before run() refreshes: the instance that mounts on the new stage reads it.
      if (answer && result) outcomes.set(orderId, { stageKey: answer.stageKey, outcome: result });
    });
    setConfirming(null);
    if (ok) setOutcome(result);
  }

  function jump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canJump || !target || target === currentKey) return;
    request({ stageKey: target });
  }

  return (
    <div aria-busy={pending || undefined}>
      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={() => request({ direction: "back" })}
          disabled={busy || !canBack}
          className={outlineActionClass}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back
        </button>
        <button
          type="button"
          onClick={() => request({ direction: "forward" })}
          disabled={busy || !canForward}
          className={primaryActionClass}
        >
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
              disabled={busy || !canJump}
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
          <button type="submit" disabled={busy || !canJump || target === currentKey} className={outlineActionClass}>
            Go
          </button>
        </form>
      </div>

      {confirming && (
        <div
          role="alertdialog"
          aria-labelledby={confirmId}
          className="mt-3 rounded-sm border border-gold/40 bg-gold/10 px-4 py-3.5"
        >
          <p id={confirmId} className="text-[0.9rem] font-medium leading-relaxed text-navy">
            {completedBefore ? copy.confirmCompletionAgain : copy.confirmCompletion}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void send(confirming)} disabled={pending} className={primaryActionClass}>
              {copy.confirm}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(null)}
              disabled={pending}
              autoFocus
              className={outlineActionClass}
            >
              {copy.cancel}
            </button>
          </div>
        </div>
      )}

      {!paid && <p className="mt-3 text-[0.85rem] leading-relaxed text-navy-soft">Stages open once the order is paid.</p>}

      {onDocuments && unapprovedRequired > 0 && (
        <p className="mt-3 rounded-sm border border-gold/40 bg-gold/10 px-3.5 py-2.5 text-[0.85rem] leading-relaxed text-navy">
          {unapprovedRequired === 1
            ? "One required document is not approved yet. Moving on still works."
            : `${unapprovedRequired} required documents are not approved yet. Moving on still works.`}
        </p>
      )}

      <p
        aria-live="polite"
        className={cn(
          "mt-2 min-h-5 text-[0.82rem] leading-5",
          error || outcome === "completed_not_emailed" ? "text-clay" : "text-navy-soft",
        )}
      >
        {error ?? (outcome ? copy.outcome[outcome] : "")}
      </p>
    </div>
  );
}
