import { FileWarning } from "lucide-react";

import type { RejectedSlot } from "./order-status";
import { slotName } from "./order-status";

/**
 * The callout above the documents section when one or more files were
 * rejected and not replaced yet: which document, whose, and the reason the
 * reviewer wrote. The slot itself, further down, repeats the reason and
 * takes the replacement; this box exists so the client sees what is needed
 * before scrolling through slots that are fine.
 */
export function RejectedCallout({ slots, applicants }: { slots: readonly RejectedSlot[]; applicants: number }) {
  if (slots.length === 0) return null;

  return (
    <div
      role="status"
      className="rounded-lg border border-clay/25 bg-clay/5 px-5 py-4 shadow-[var(--shadow-soft)]"
    >
      <div className="flex gap-3.5">
        <FileWarning className="mt-0.5 size-4 shrink-0 text-clay" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg leading-tight text-navy">
            {slots.length === 1 ? "One file needs to be sent again" : `${slots.length} files need to be sent again`}
          </p>
          <ul className="mt-3 space-y-2.5">
            {slots.map((slot) => (
              <li key={`${slot.docId}:${slot.applicantIndex}`} className="text-[0.92rem] leading-relaxed">
                <span className="font-medium text-navy">{slotName(slot, applicants)}</span>
                <span className="text-navy-soft">: {slot.reason || "please send this file again."}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.85rem] leading-relaxed text-navy-muted">
            Use the Replace file button on the slot below. The earlier file stays on record.
          </p>
        </div>
      </div>
    </div>
  );
}
