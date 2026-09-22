"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type FormEvent, type MouseEvent, type ReactNode, type SyntheticEvent } from "react";

import { lockBodyScroll } from "@/components/ui/scroll-lock";
import { cn } from "@/lib/cn";

import { outlineActionClass, primaryActionClass } from "../order/use-action";

/**
 * The dialog the users screens open: new user, edit, assign a purchase and
 * delete. It works the way the others in the admin do
 * (src/components/admin/modal.tsx, feedback-dialog.tsx): mounted means
 * open, `showModal()` on mount keeps focus inside and wires Esc, the
 * counted scroll lock holds the page, a click that starts and ends on the
 * backdrop closes, and focus goes back to the opener on unmount. While
 * something is being saved nothing closes it.
 *
 * `showModal()` puts it in the browser's top layer, so one of these opened
 * from inside the user modal lands above that modal rather than behind it.
 *
 * DialogForm is the body every one of them shares: the fields scroll, the
 * footer holds the message line and the two buttons. The buttons sit at the
 * end of the row, the one that acts on the right and the one that steps
 * back on its left, which is the order the rest of the admin uses.
 */

export function AdminDialog({
  title,
  lead,
  busy,
  onClose,
  children,
}: {
  title: string;
  lead?: string;
  /** True while a request is in flight: nothing closes the dialog. */
  busy?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const leadId = `${id}-lead`;
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => {
      const previous = opener.current;
      if (previous && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => lockBodyScroll(), []);

  function close() {
    if (busy) return;
    onClose();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    close();
  }

  /** The element closed on its own (a second Esc in Chrome). Mid save, put it back. */
  function handleNativeClose() {
    const dialog = ref.current;
    if (busy) {
      if (dialog && !dialog.open) dialog.showModal();
      return;
    }
    onClose();
  }

  function handleBackdropDown(event: MouseEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }

  function handleBackdrop(event: MouseEvent<HTMLDialogElement>) {
    const pressed = pressedOnBackdrop.current;
    pressedOnBackdrop.current = false;
    if (busy) return;
    if (pressed && event.target === event.currentTarget) onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={lead ? leadId : undefined}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onMouseDown={handleBackdropDown}
      onClick={handleBackdrop}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-clip rounded-lg border border-navy/10 bg-white p-0 text-left text-navy shadow-[var(--shadow-card)] backdrop:bg-navy/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-navy/10 px-6 py-5 sm:px-8">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-serif text-xl leading-snug text-navy">
              {title}
            </h2>
            {lead && (
              <p id={leadId} className="mt-1.5 text-[0.9rem] leading-relaxed text-navy-soft">
                {lead}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            aria-label="Close"
            className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-navy-muted transition-colors duration-200 hover:bg-navy/5 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}

export function DialogForm({
  onSubmit,
  onCancel,
  busy,
  error,
  submitLabel,
  workingLabel,
  cancelLabel,
  submitDisabled,
  tone = "primary",
  children,
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
  submitLabel: string;
  workingLabel: string;
  cancelLabel: string;
  submitDisabled?: boolean;
  /** `danger` for the delete dialog's own button. */
  tone?: "primary" | "danger";
  children: ReactNode;
}) {
  const id = useId();
  const messageId = `${id}-message`;

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={busy || undefined} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        <fieldset disabled={busy} className="min-w-0 space-y-5">
          {children}
        </fieldset>
      </div>
      <footer className="border-t border-navy/10 px-6 py-4 sm:px-8">
        <p
          id={messageId}
          role={error ? "alert" : undefined}
          aria-live="polite"
          className={cn("min-h-5 text-[0.82rem] leading-5", error ? "text-clay" : "text-navy-muted")}
        >
          {error ?? ""}
        </p>
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={outlineActionClass}>
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={busy || submitDisabled}
            className={cn(
              primaryActionClass,
              tone === "danger" &&
                "border-clay bg-clay text-white hover:border-clay/80 hover:bg-clay/90 hover:text-white disabled:hover:border-clay disabled:hover:bg-clay",
            )}
          >
            {busy ? workingLabel : submitLabel}
          </button>
        </div>
      </footer>
    </form>
  );
}
