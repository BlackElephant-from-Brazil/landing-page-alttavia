"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type SyntheticEvent,
} from "react";

import { lockBodyScroll } from "@/components/ui/scroll-lock";
import { cn } from "@/lib/cn";
import type { FeedbackPriority, FeedbackStatus } from "@/lib/email/feedback";

import { messageFor, requestJson } from "./lib/request";
import { fieldClass, outlineActionClass, primaryActionClass, smallLabelClass, useAction } from "./order/use-action";

/**
 * The admin feedback channel's two client pieces:
 *
 *   FeedbackDialog        the centred form the Feedback button opens
 *   FeedbackStatusSelect  the status control on each note at /admin/feedback
 *
 * The labels come from the server as props (`Choice[]`, built from
 * src/lib/email/feedback.ts, which this client module cannot import at
 * runtime), so the three priorities and four statuses are written once.
 *
 * FeedbackDialog works the way the other dialogs do (modal.tsx,
 * applicant-details-form.tsx): mounted means open, `showModal()` on mount
 * keeps focus inside and wires Esc, the counted scroll lock holds the page,
 * a click that starts and ends on the backdrop closes, and focus goes back
 * to the opener on unmount. While a note is being sent nothing closes it.
 * It posts to POST /api/admin/feedback and shows the route's one line on
 * failure; after a note is saved the form gives way to the thanks line.
 */

export type Choice<T extends string> = { value: T; label: string };

const MAX_TEXT = 2000;
const MAX_PAGE = 500;
const DEFAULT_PRIORITY: FeedbackPriority = "should_change";

const copy = {
  title: "Send feedback",
  lead: "Tell us what you noticed. One note per thing works best.",
  screen: "Which screen",
  screenHint: "The page you were on. Change it if the note is about another one.",
  expected: "What did you expect",
  happened: "What happened",
  answersHint: "Fill in at least one of the two.",
  priority: "How much does it matter",
  send: "Send",
  sending: "Sending",
  cancel: "Cancel",
  close: "Close",
  another: "Send another note",
  thanks: "Thanks. We read every note.",
  empty: "Tell us what you expected or what happened.",
} as const;

export function FeedbackDialog({
  initialPage,
  priorities,
  onClose,
  onSent,
}: {
  /** The screen the note is about, prefilled with the current path. */
  initialPage: string;
  priorities: Choice<FeedbackPriority>[];
  onClose: () => void;
  /** Called once per saved note. */
  onSent?: () => void;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const leadId = `${id}-lead`;
  const screenId = `${id}-screen`;
  const screenHintId = `${id}-screen-hint`;
  const expectedId = `${id}-expected`;
  const happenedId = `${id}-happened`;
  const answersHintId = `${id}-answers-hint`;
  const messageId = `${id}-message`;

  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pressedOnBackdrop = useRef(false);
  const expectedRef = useRef<HTMLTextAreaElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const [pageUrl, setPageUrl] = useState(initialPage.slice(0, MAX_PAGE));
  const [expected, setExpected] = useState("");
  const [happened, setHappened] = useState("");
  const [priority, setPriority] = useState<FeedbackPriority>(DEFAULT_PRIORITY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    // The screen is already filled in, so typing starts at the first answer.
    expectedRef.current?.focus();
    return () => {
      const previous = opener.current;
      if (previous && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => lockBodyScroll(), []);

  // After a note is saved the form is gone; focus lands on Close.
  useEffect(() => {
    if (sent) closeRef.current?.focus();
  }, [sent]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!expected.trim() && !happened.trim()) {
      setError(copy.empty);
      return;
    }
    setError(null);
    setPending(true);
    try {
      await requestJson("/api/admin/feedback", {
        method: "POST",
        body: { pageUrl, expected, happened, priority },
      });
    } catch (err) {
      setError(messageFor(err));
      setPending(false);
      return;
    }
    setPending(false);
    setSent(true);
    onSent?.();
  }

  function another() {
    setExpected("");
    setHappened("");
    setPriority(DEFAULT_PRIORITY);
    setError(null);
    setSent(false);
    requestAnimationFrame(() => expectedRef.current?.focus());
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (pending) return;
    onClose();
  }

  /** The element closed on its own (a second Esc in Chrome). Mid send, put it back. */
  function handleNativeClose() {
    const dialog = ref.current;
    if (pending) {
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
    if (pending) return;
    if (pressed && event.target === event.currentTarget) onClose();
  }

  function handleClose() {
    if (pending) return;
    onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={leadId}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onMouseDown={handleBackdropDown}
      onClick={handleBackdrop}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-clip rounded-lg border border-navy/10 bg-white p-0 text-navy shadow-[var(--shadow-card)] backdrop:bg-navy/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-navy/10 px-6 py-5 sm:px-8">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-serif text-xl leading-snug text-navy">
              {copy.title}
            </h2>
            <p id={leadId} className="mt-1.5 text-[0.9rem] leading-relaxed text-navy-soft">
              {copy.lead}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={pending}
            aria-label={copy.close}
            className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-navy-muted transition-colors duration-200 hover:bg-navy/5 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {sent ? (
          <div className="px-6 py-8 sm:px-8">
            <p role="status" className="font-serif text-xl leading-snug text-navy">
              {copy.thanks}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button ref={closeRef} type="button" onClick={onClose} className={primaryActionClass}>
                {copy.close}
              </button>
              <button type="button" onClick={another} className={outlineActionClass}>
                {copy.another}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate aria-busy={pending || undefined} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <fieldset disabled={pending} className="min-w-0 space-y-5">
                <div>
                  <label htmlFor={screenId} className={smallLabelClass}>
                    {copy.screen}
                  </label>
                  <input
                    id={screenId}
                    type="text"
                    value={pageUrl}
                    maxLength={MAX_PAGE}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setPageUrl(e.target.value)}
                    aria-describedby={screenHintId}
                    className={cn(fieldClass, "mt-1.5 font-mono text-[0.82rem]")}
                  />
                  <p id={screenHintId} className="mt-1.5 text-[0.78rem] text-navy-muted">
                    {copy.screenHint}
                  </p>
                </div>

                <div>
                  <label htmlFor={expectedId} className={smallLabelClass}>
                    {copy.expected}
                  </label>
                  <textarea
                    ref={expectedRef}
                    id={expectedId}
                    rows={3}
                    value={expected}
                    maxLength={MAX_TEXT}
                    onChange={(e) => {
                      setExpected(e.target.value);
                      if (error) setError(null);
                    }}
                    aria-describedby={`${answersHintId} ${messageId}`}
                    className={cn(fieldClass, "mt-1.5 resize-y")}
                  />
                </div>

                <div>
                  <label htmlFor={happenedId} className={smallLabelClass}>
                    {copy.happened}
                  </label>
                  <textarea
                    id={happenedId}
                    rows={3}
                    value={happened}
                    maxLength={MAX_TEXT}
                    onChange={(e) => {
                      setHappened(e.target.value);
                      if (error) setError(null);
                    }}
                    aria-describedby={`${answersHintId} ${messageId}`}
                    className={cn(fieldClass, "mt-1.5 resize-y")}
                  />
                  <p id={answersHintId} className="mt-1.5 text-[0.78rem] text-navy-muted">
                    {copy.answersHint}
                  </p>
                </div>

                <fieldset>
                  <legend className={smallLabelClass}>{copy.priority}</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {priorities.map((choice) => {
                      const checked = choice.value === priority;
                      return (
                        <label
                          key={choice.value}
                          className={cn(
                            "inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-[0.85rem] font-medium transition-colors duration-200",
                            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-white",
                            checked
                              ? "border-navy bg-navy text-white"
                              : "border-navy/20 bg-white text-navy hover:border-navy/50",
                          )}
                        >
                          <input
                            type="radio"
                            name={`${id}-priority`}
                            value={choice.value}
                            checked={checked}
                            onChange={() => setPriority(choice.value)}
                            className="sr-only"
                          />
                          {choice.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
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
                <button type="button" onClick={handleClose} disabled={pending} className={outlineActionClass}>
                  {copy.cancel}
                </button>
                <button type="submit" disabled={pending} className={primaryActionClass}>
                  {pending ? copy.sending : copy.send}
                </button>
              </div>
            </footer>
          </form>
        )}
      </div>
    </dialog>
  );
}

/**
 * The status of one note on /admin/feedback. Changing it PATCHes
 * /api/admin/feedback and refreshes the page (the counts in the filter move
 * with it); a refusal puts the previous value back and shows the route's
 * line under the select. The page keys this by id and status, so a refresh
 * that brings another status mounts a fresh one.
 */
export function FeedbackStatusSelect({
  noteId,
  status,
  options,
  label,
}: {
  noteId: string;
  status: FeedbackStatus;
  options: Choice<FeedbackStatus>[];
  /** The select's accessible name, naming the note. */
  label: string;
}) {
  const { pending, error, run } = useAction();
  const [value, setValue] = useState<FeedbackStatus>(status);

  async function change(raw: string) {
    const next = options.find((option) => option.value === raw)?.value;
    if (!next || next === value) return;
    const previous = value;
    setValue(next);
    const ok = await run(() =>
      requestJson("/api/admin/feedback", { method: "PATCH", body: { id: noteId, status: next } }),
    );
    if (!ok) setValue(previous);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        aria-label={label}
        value={value}
        disabled={pending}
        onChange={(e) => change(e.target.value)}
        className={cn(
          "h-9 rounded-full border border-navy/15 bg-white pl-3.5 pr-8 text-[0.82rem] font-medium text-navy transition-colors duration-200",
          "hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="max-w-[16rem] text-right text-[0.78rem] leading-5 text-clay">
          {error}
        </p>
      )}
    </div>
  );
}
