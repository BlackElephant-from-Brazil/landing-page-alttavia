"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition, type DragEvent } from "react";

import { cn } from "@/lib/cn";

import { Pill } from "../data-table";
import { humanizeKey } from "../lib/format";
import { messageFor, requestJson } from "../lib/request";
import { outlineActionClass, primaryActionClass } from "../order/use-action";

import { groupByStage, type KanbanColumn } from "./kanban-model";

/**
 * The orders board: one column per stage of the catalogue, the filtered
 * orders as cards inside. Contract (docs/admin-contract.md) section 7.
 *
 * The whole card is a link to `?order=<id>`, the same href the table's rows
 * use, so the order modal opens from either view and the keyboard reaches
 * every card with one tab stop. The card itself is the drag source (the
 * link carries `draggable={false}`, so a drag started on it belongs to the
 * card), and dropping it on another column posts the stage move.
 *
 * Two rules the route also holds, kept here so the board does not ask for
 * what it knows will be refused: an unpaid order cannot leave its first
 * stage, so it is not draggable, and a drop on a terminal column asks
 * first, because landing there marks the order complete and may email the
 * client. The board cannot tell cheaply whether the order was completed
 * once before (that answer lives in `user_service_events`), so the question
 * is the neutral one and the order modal keeps the longer pair.
 *
 * A refusal from the route is shown as one line under the board and the
 * card stays where it was. A move that works is shown at once, from the
 * stage the route answered, and `router.refresh()` brings the real rows
 * behind it.
 *
 * That local move is remembered with the stage the card came from, not as
 * a flag to clear later: it only applies while the row still arrives on
 * that stage, so the moment the refreshed row carries anything else the
 * board reads the server again. Nothing is derived in an effect, and a row
 * changed by someone else in the meantime wins.
 */

export type KanbanCardData = {
  id: string;
  /** `?order=<id>` with the current filters, as the table's rows use. */
  href: string;
  stageKey: string;
  userEmail: string;
  userName: string | null;
  serviceName: string;
  /** Already formatted, so the board draws no money itself. */
  amount: string;
  paid: boolean;
  /** The payment date, formatted, or null while the order is unpaid. */
  paidOn: string | null;
  completed: boolean;
  /** "Created 3 Sep 2026" or "Paid 11 Sep 2026". */
  dateLabel: string;
  docsRequired: number;
  docsApproved: number;
  docsUploaded: number;
};

type Move = { cardId: string; column: KanbanColumn };

/** What the stage route answers. */
type StageAnswer = { stageKey: string; completed: boolean } | null;

/**
 * A move the board made: where the row stood before it (`from`) and where
 * the route put it (`to`). It applies only while the server row still
 * arrives on `from`, so it expires by itself.
 */
type Override = {
  from: string;
  fromCompleted: boolean;
  to: string;
  toCompleted: boolean;
};

/** Whether a move still stands: the server row has not moved off the stage it started from. */
function stillApplies(card: KanbanCardData, override: Override): boolean {
  return card.stageKey === override.from && card.completed === override.fromCompleted;
}

/** The card as the board draws it: the server row unless a live move says otherwise. */
function placedCard(card: KanbanCardData, override: Override | undefined): KanbanCardData {
  if (!override || !stillApplies(card, override)) return card;
  return { ...card, stageKey: override.to, completed: override.toCompleted };
}

/** The moves still standing, so a spent one is dropped instead of piling up. */
function live(overrides: Record<string, Override>, cards: KanbanCardData[]): Record<string, Override> {
  const kept: Record<string, Override> = {};
  for (const card of cards) {
    const override = overrides[card.id];
    if (override && stillApplies(card, override)) kept[card.id] = override;
  }
  return kept;
}

const DRAG_TYPE = "application/x-alttavia-order";

const copy = {
  confirmCompletion: "This marks the order complete. Continue?",
  confirm: "Confirm",
  cancel: "Cancel",
  empty: "No orders match these filters.",
  emptyColumn: "Nothing here.",
  notYet: "Not yet",
  completed: "Completed",
  toReview: "to review",
  open: (email: string) => `Open order for ${email}`,
  moved: (label: string) => `Moved to ${label}.`,
} as const;

export function KanbanBoard({ columns, cards }: { columns: KanbanColumn[]; cards: KanbanCardData[] }) {
  const router = useRouter();
  const confirmId = useId();
  const [refreshing, startTransition] = useTransition();
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Move | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  const pending = sending || refreshing;

  const placed = useMemo(() => cards.map((card) => placedCard(card, overrides[card.id])), [cards, overrides]);

  const groups = useMemo(
    () => groupByStage(columns, placed.map((card) => ({ ...card, stage_key: card.stageKey }))),
    [columns, placed],
  );

  const byId = useMemo(() => new Map(placed.map((card) => [card.id, card])), [placed]);

  // The rows as the server sent them: a move records the stage it started
  // from, which is what makes the local move expire on its own.
  const serverById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);

  function labelOf(column: KanbanColumn): string {
    return column.known ? column.label : humanizeKey(column.key);
  }

  function startDrag(event: DragEvent<HTMLElement>, card: KanbanCardData) {
    if (!card.paid) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_TYPE, card.id);
    event.dataTransfer.setData("text/plain", card.id);
    setDragging(card.id);
  }

  function endDrag() {
    setDragging(null);
    setOver(null);
  }

  function dragOver(event: DragEvent<HTMLElement>, column: KanbanColumn) {
    if (!dragging || pending) return;
    const card = byId.get(dragging);
    if (!card || card.stageKey === column.key) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (over !== column.key) setOver(column.key);
  }

  function dragLeave(event: DragEvent<HTMLElement>, column: KanbanColumn) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    if (over === column.key) setOver(null);
  }

  function drop(event: DragEvent<HTMLElement>, column: KanbanColumn) {
    event.preventDefault();
    const id = event.dataTransfer.getData(DRAG_TYPE) || event.dataTransfer.getData("text/plain") || dragging;
    endDrag();
    if (!id || pending) return;

    const card = byId.get(id);
    if (!card || !card.paid || card.stageKey === column.key) return;

    setError(null);
    setNotice(null);
    if (column.isTerminal) {
      setConfirming({ cardId: id, column });
      return;
    }
    void move({ cardId: id, column });
  }

  async function move({ cardId, column }: Move) {
    if (pending) return;
    setConfirming(null);
    setError(null);
    setNotice(null);
    setSending(true);
    try {
      const answer = await requestJson<StageAnswer>(`/api/admin/orders/${cardId}/stage`, {
        method: "POST",
        body: { stageKey: column.key },
      });
      // One batch: the card moves, the line appears and the refresh starts
      // together, so the board never shows the old column for a frame.
      const server = serverById.get(cardId);
      if (server) {
        const placement: Override = {
          from: server.stageKey,
          fromCompleted: server.completed,
          to: answer?.stageKey ?? column.key,
          toCompleted: answer?.completed ?? column.isTerminal,
        };
        setOverrides((current) => ({ ...live(current, cards), [cardId]: placement }));
      }
      setNotice(copy.moved(labelOf(column)));
      startTransition(() => {
        router.refresh();
      });
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setSending(false);
    }
  }

  const total = placed.length;

  return (
    <div aria-busy={pending || undefined}>
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-start gap-4">
          {groups.map(({ column, rows }) => {
            const label = labelOf(column);
            const active = over === column.key;
            return (
              <section
                key={column.key}
                aria-label={`${label}, ${rows.length} ${rows.length === 1 ? "order" : "orders"}`}
                onDragOver={(event) => dragOver(event, column)}
                onDragLeave={(event) => dragLeave(event, column)}
                onDrop={(event) => drop(event, column)}
                className={cn(
                  "flex w-72 shrink-0 flex-col rounded-lg border bg-white shadow-[var(--shadow-soft)] transition-colors duration-150",
                  active ? "border-gold ring-2 ring-gold/40" : "border-navy/10",
                )}
              >
                <header className="flex items-center justify-between gap-2 rounded-t-lg border-b border-navy/10 bg-paper px-4 py-3">
                  <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-navy-muted">{label}</h2>
                  <span className="text-[0.8rem] font-medium tabular-nums text-navy">{rows.length}</span>
                </header>

                {rows.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[0.82rem] text-navy-muted">{copy.emptyColumn}</p>
                ) : (
                  <ul className="max-h-[34rem] space-y-3 overflow-y-auto p-3">
                    {rows.map((card) => (
                      <li key={card.id}>
                        <Card card={card} dragging={dragging === card.id} onDragStart={startDrag} onDragEnd={endDrag} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {total === 0 && <p className="mt-4 rounded-lg border border-navy/10 bg-white px-4 py-8 text-center text-navy-muted">{copy.empty}</p>}

      {confirming && (
        <div role="alertdialog" aria-labelledby={confirmId} className="mt-4 rounded-sm border border-gold/40 bg-gold/10 px-4 py-3.5">
          <p id={confirmId} className="text-[0.9rem] font-medium leading-relaxed text-navy">
            {copy.confirmCompletion}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void move(confirming)} disabled={pending} className={primaryActionClass}>
              {copy.confirm}
            </button>
            <button type="button" onClick={() => setConfirming(null)} disabled={pending} autoFocus className={outlineActionClass}>
              {copy.cancel}
            </button>
          </div>
        </div>
      )}

      <p aria-live="polite" className={cn("mt-2 min-h-5 text-[0.82rem] leading-5", error ? "text-clay" : "text-navy-soft")}>
        {error ?? notice ?? ""}
      </p>
    </div>
  );
}

/**
 * One order. Everything on it is already formatted by the page; the card
 * only lays it out. The link on top spans the card, like the table's rows,
 * and carries `draggable={false}` so the drag belongs to the card around it.
 */
function Card({
  card,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  card: KanbanCardData;
  dragging: boolean;
  onDragStart: (event: DragEvent<HTMLElement>, card: KanbanCardData) => void;
  onDragEnd: () => void;
}) {
  return (
    <article
      draggable={card.paid}
      onDragStart={(event) => onDragStart(event, card)}
      onDragEnd={onDragEnd}
      className={cn(
        "relative rounded-sm border border-navy/10 bg-white p-3 transition-colors duration-150",
        "hover:border-navy/25 hover:bg-gold/5 has-[a:focus-visible]:bg-gold/10",
        card.paid && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50 ring-1 ring-gold",
      )}
    >
      <p className="truncate text-[0.85rem] font-medium text-navy">{card.userEmail}</p>
      {card.userName && <p className="truncate text-[0.78rem] text-navy-soft">{card.userName}</p>}

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="truncate text-[0.8rem] text-navy-soft">{card.serviceName}</p>
        <p className="shrink-0 text-[0.82rem] font-medium tabular-nums text-navy">{card.amount}</p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {card.paidOn ? (
          <Pill tone="green">
            <span className="normal-case tracking-normal">{card.paidOn}</span>
          </Pill>
        ) : (
          <Pill tone="amber">{copy.notYet}</Pill>
        )}
        {card.paid && card.docsUploaded > 0 && (
          <Pill tone="gold">
            {card.docsUploaded} {copy.toReview}
          </Pill>
        )}
        <span className="text-[0.75rem] tabular-nums text-navy-muted">
          {card.paid ? card.docsApproved : 0}/{card.docsRequired}
        </span>
        {card.completed && <Pill tone="navy">{copy.completed}</Pill>}
      </div>

      <p className="mt-2 text-[0.75rem] text-navy-muted">{card.dateLabel}</p>

      <Link
        href={card.href}
        scroll={false}
        draggable={false}
        aria-label={copy.open(card.userEmail)}
        className="absolute inset-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
      >
        <span className="sr-only">Open</span>
      </Link>
    </article>
  );
}
