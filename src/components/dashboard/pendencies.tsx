import { CircleAlert, CircleCheck } from "lucide-react";

import { RichText } from "@/components/bank/rich-text";
import type { UserServiceNoteRow } from "@/lib/db/types";

import { formatDate, splitNotes } from "./order-status";

/**
 * "Pending from you": the notes the firm posted for the client on this order.
 * Open ones first, each as a card with the date; resolved ones collapsed
 * under a <details>, so the history is there without crowding the page.
 * Nothing renders when there is no client note at all.
 *
 * The client cannot answer here: the note tells them what to send or do,
 * and the reply goes through the upload slots or WhatsApp, as the help box
 * below says. Admins resolve a note from their side.
 */
export function Pendencies({ notes }: { notes: readonly UserServiceNoteRow[] }) {
  const { open, resolved } = splitNotes(notes);
  if (open.length === 0 && resolved.length === 0) return null;

  return (
    <section aria-labelledby="pendencies-heading">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <h2 id="pendencies-heading" className="text-xs uppercase tracking-wider text-navy-muted">
          Pending from you
        </h2>
        <p className="text-sm text-navy-muted">
          {open.length === 0 ? "Nothing open" : open.length === 1 ? "1 open" : `${open.length} open`}
        </p>
      </div>

      {open.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {open.map((note) => (
            <li
              key={note.id}
              className="flex gap-3.5 rounded-lg border border-gold/40 bg-gold/10 px-5 py-4 shadow-[var(--shadow-soft)]"
            >
              <CircleAlert className="mt-1 size-4 shrink-0 text-gold-dark" aria-hidden />
              <div className="min-w-0">
                <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-navy">
                  <RichText text={note.body} />
                </p>
                <p className="mt-2 text-[0.78rem] text-navy-muted">Posted {formatDate(note.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-lg border border-navy/10 bg-white px-5 py-4 text-[0.95rem] text-navy-soft shadow-[var(--shadow-soft)]">
          Everything we asked for is settled.
        </p>
      )}

      {resolved.length > 0 && (
        <details className="group mt-4">
          <summary className="cursor-pointer list-none rounded-sm text-sm font-medium text-navy-soft underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
            <span className="group-open:hidden">Show settled ({resolved.length})</span>
            <span className="hidden group-open:inline">Hide settled</span>
          </summary>
          <ul className="mt-3 space-y-3">
            {resolved.map((note) => (
              <li
                key={note.id}
                className="flex gap-3.5 rounded-lg border border-navy/10 bg-white px-5 py-4 opacity-80"
              >
                <CircleCheck className="mt-1 size-4 shrink-0 text-navy-muted" aria-hidden />
                <div className="min-w-0">
                  <p className="whitespace-pre-line text-[0.92rem] leading-relaxed text-navy-soft">
                    <RichText text={note.body} />
                  </p>
                  <p className="mt-2 text-[0.78rem] text-navy-muted">
                    Posted {formatDate(note.created_at)}
                    {note.resolved_at && ` · settled ${formatDate(note.resolved_at)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
