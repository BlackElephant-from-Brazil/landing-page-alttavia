"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ApplicantGender, UserServiceApplicantRow } from "@/lib/db/types";

/**
 * The principal's details a power of attorney is filled with, asked in a
 * centred `<dialog>` that a deed slot opens. Contract
 * (docs/documents-contract.md) section 3, "Client UI".
 *
 * Mounted means open, the way modal.tsx works: `showModal()` runs on mount,
 * Esc arrives as `cancel`, a click that starts and ends on the backdrop
 * closes, `body` scroll is locked while mounted, and the element that had
 * focus when the dialog opened (the slot's button) gets it back on unmount.
 * The dialog is `overflow-clip`; only the body scrolls.
 *
 * With `initial` (the row already on this order) the fields open filled
 * from it and nothing is fetched. Without it, the dialog asks
 * GET /api/orders/[id]/applicants/[index] while the fields sit disabled
 * under a "Loading" line: a 200 fills them from the row, a 404 from the
 * `prefill` the route found on another order of the same account, so a
 * second purchase never asks for the passport twice.
 *
 * Save PUTs the camelCase fields; a 422 shows the route's one line under
 * the form, a success hands the stored row to `onSaved` and the owner
 * decides whether a download follows.
 */

export type ApplicantFields = {
  fullName: string;
  gender: ApplicantGender | "";
  birthPlace: string;
  birthDate: string;
  passportNumber: string;
  passportIssuer: string;
  passportIssueDate: string;
  passportExpiryDate: string;
  taxAddress: string;
};

type Props = {
  userServiceId: string;
  applicantIndex: 0 | 1;
  /** The row on this order, when there is one: the form opens filled from it. */
  initial: UserServiceApplicantRow | null;
  /** The primary button. "Save" by default; the slot says "Save and download" when a download follows. */
  submitLabel?: string;
  onClose: () => void;
  onSaved: (row: UserServiceApplicantRow) => void;
};

const copy = {
  title: ["Your details for the power of attorney", "Your partner's details for the power of attorney"] as const,
  lead: "They are printed in the deed exactly as typed, so check them against the passport.",
  loading: "Loading",
  fullName: "Full name (as in the passport)",
  gender: ["The deed refers to you as", "The deed refers to your partner as"] as const,
  she: "She",
  he: "He",
  birthPlace: "Place of birth (city and country)",
  birthDate: "Date of birth",
  passportNumber: "Passport number",
  passportIssuer: "Issuing authority",
  passportIssueDate: "Date of issue",
  passportExpiryDate: "Expiry date",
  taxAddress: "Tax residence address (full address with postal code, city and country)",
  save: "Save",
  saving: "Saving",
  cancel: "Cancel",
  close: "Close",
  errors: {
    generic: "Something did not work. Try again.",
  },
} as const;

const inputClass = cn(
  "block w-full rounded-sm border bg-white px-4 text-[0.95rem] text-navy placeholder:text-navy-muted/70 transition-colors duration-200",
  "border-navy/15 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const labelClass = "block text-xs uppercase tracking-wider text-navy-muted";

const radioClass = cn(
  "inline-flex h-11 cursor-pointer items-center rounded-full border border-navy/20 px-5 text-sm font-medium text-navy transition-colors duration-200",
  "hover:border-navy has-[:checked]:border-navy has-[:checked]:bg-navy has-[:checked]:text-white",
  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-paper",
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
);

function blank(): ApplicantFields {
  return {
    fullName: "",
    gender: "",
    birthPlace: "",
    birthDate: "",
    passportNumber: "",
    passportIssuer: "",
    passportIssueDate: "",
    passportExpiryDate: "",
    taxAddress: "",
  };
}

/** The stored columns in the form's camelCase, the same keys the PUT accepts. */
function fromRow(row: UserServiceApplicantRow): ApplicantFields {
  return {
    fullName: row.full_name,
    gender: row.gender,
    birthPlace: row.birth_place,
    birthDate: row.birth_date,
    passportNumber: row.passport_number,
    passportIssuer: row.passport_issuer,
    passportIssueDate: row.passport_issued_on,
    passportExpiryDate: row.passport_expires_on,
    taxAddress: row.tax_address,
  };
}

function isRow(value: unknown): value is UserServiceApplicantRow {
  return !!value && typeof value === "object" && typeof (value as { full_name?: unknown }).full_name === "string";
}

function errorMessage(data: unknown): string {
  return data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
    ? (data as { error: string }).error
    : copy.errors.generic;
}

export function ApplicantDetailsForm({
  userServiceId,
  applicantIndex,
  initial,
  submitLabel = copy.save,
  onClose,
  onSaved,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pressedOnBackdrop = useRef(false);
  const id = useId();
  const titleId = `${id}-title`;
  const leadId = `${id}-lead`;
  const errorId = `${id}-error`;
  const field = (name: keyof ApplicantFields) => `${id}-${name}`;

  const [fields, setFields] = useState<ApplicantFields>(() => (initial ? fromRow(initial) : blank()));
  const [loading, setLoading] = useState(initial === null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const path = `/api/orders/${userServiceId}/applicants/${applicantIndex}`;

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

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Without a row on this order, ask the route: it answers with the row if
  // one appeared meanwhile, or with the newest one from another order.
  useEffect(() => {
    if (initial) return;
    const controller = new AbortController();
    (async () => {
      let found: UserServiceApplicantRow | null = null;
      try {
        const response = await fetch(path, { signal: controller.signal });
        const data = (await response.json().catch(() => null)) as
          | { applicant?: unknown; prefill?: unknown }
          | null;
        if (response.ok && isRow(data?.applicant)) found = data.applicant;
        else if (response.status === 404 && isRow(data?.prefill)) found = data.prefill;
      } catch {
        // No prefill is not an error: the form opens blank.
      }
      if (controller.signal.aborted) return;
      if (found) setFields(fromRow(found));
      setLoading(false);
    })();
    return () => controller.abort();
  }, [initial, path]);

  function update<K extends keyof ApplicantFields>(name: K, value: ApplicantFields[K]) {
    setFields((current) => ({ ...current, [name]: value }));
    if (error) setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || loading) return;
    setError(null);
    setPending(true);
    let response: Response;
    try {
      response = await fetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
    } catch {
      setError(copy.errors.generic);
      setPending(false);
      return;
    }
    const data = (await response.json().catch(() => null)) as { applicant?: unknown } | null;
    if (!response.ok || !isRow(data?.applicant)) {
      setError(response.ok ? copy.errors.generic : errorMessage(data));
      setPending(false);
      return;
    }
    // The owner unmounts this dialog; nothing to reset here.
    onSaved(data.applicant);
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    onClose();
  }

  function handleBackdropDown(event: MouseEvent<HTMLDialogElement>) {
    pressedOnBackdrop.current = event.target === event.currentTarget;
  }

  function handleBackdrop(event: MouseEvent<HTMLDialogElement>) {
    const pressed = pressedOnBackdrop.current;
    pressedOnBackdrop.current = false;
    if (pressed && event.target === event.currentTarget) onClose();
  }

  const disabled = loading || pending;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={leadId}
      onCancel={handleCancel}
      onMouseDown={handleBackdropDown}
      onClick={handleBackdrop}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(38rem,calc(100vw-2rem))] overflow-clip rounded-lg border border-navy/10 bg-paper p-0 text-navy shadow-[var(--shadow-card)] backdrop:bg-navy/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-navy/10 bg-white px-6 py-5 sm:px-8">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-serif text-xl leading-snug text-navy">
              {copy.title[applicantIndex]}
            </h2>
            <p id={leadId} className="mt-1.5 text-[0.9rem] leading-relaxed text-navy-soft">
              {copy.lead}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-navy-muted transition-colors duration-200 hover:bg-navy/5 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          noValidate
          aria-busy={disabled || undefined}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
            <p aria-live="polite" className="min-h-5 text-[0.82rem] leading-5 text-navy-muted">
              {loading ? copy.loading : ""}
            </p>

            <fieldset disabled={disabled} className="mt-2 space-y-5">
              <div>
                <label htmlFor={field("fullName")} className={labelClass}>
                  {copy.fullName}
                </label>
                <input
                  id={field("fullName")}
                  type="text"
                  autoComplete="name"
                  autoCapitalize="words"
                  maxLength={200}
                  value={fields.fullName}
                  onChange={(e) => update("fullName", e.target.value)}
                  className={cn(inputClass, "mt-2 h-12")}
                />
              </div>

              <fieldset>
                <legend className={labelClass}>{copy.gender[applicantIndex]}</legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  <label className={radioClass}>
                    <input
                      type="radio"
                      name={field("gender")}
                      value="f"
                      checked={fields.gender === "f"}
                      onChange={() => update("gender", "f")}
                      className="sr-only"
                    />
                    {copy.she}
                  </label>
                  <label className={radioClass}>
                    <input
                      type="radio"
                      name={field("gender")}
                      value="m"
                      checked={fields.gender === "m"}
                      onChange={() => update("gender", "m")}
                      className="sr-only"
                    />
                    {copy.he}
                  </label>
                </div>
              </fieldset>

              <div>
                <label htmlFor={field("birthPlace")} className={labelClass}>
                  {copy.birthPlace}
                </label>
                <input
                  id={field("birthPlace")}
                  type="text"
                  autoCapitalize="words"
                  maxLength={200}
                  value={fields.birthPlace}
                  onChange={(e) => update("birthPlace", e.target.value)}
                  className={cn(inputClass, "mt-2 h-12")}
                />
              </div>

              <div>
                <label htmlFor={field("birthDate")} className={labelClass}>
                  {copy.birthDate}
                </label>
                <input
                  id={field("birthDate")}
                  type="date"
                  autoComplete="bday"
                  value={fields.birthDate}
                  onChange={(e) => update("birthDate", e.target.value)}
                  className={cn(inputClass, "mt-2 h-12")}
                />
              </div>

              <div>
                <label htmlFor={field("passportNumber")} className={labelClass}>
                  {copy.passportNumber}
                </label>
                <input
                  id={field("passportNumber")}
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={40}
                  value={fields.passportNumber}
                  onChange={(e) => update("passportNumber", e.target.value)}
                  className={cn(inputClass, "mt-2 h-12")}
                />
              </div>

              <div>
                <label htmlFor={field("passportIssuer")} className={labelClass}>
                  {copy.passportIssuer}
                </label>
                <input
                  id={field("passportIssuer")}
                  type="text"
                  autoComplete="off"
                  maxLength={200}
                  value={fields.passportIssuer}
                  onChange={(e) => update("passportIssuer", e.target.value)}
                  className={cn(inputClass, "mt-2 h-12")}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor={field("passportIssueDate")} className={labelClass}>
                    {copy.passportIssueDate}
                  </label>
                  <input
                    id={field("passportIssueDate")}
                    type="date"
                    value={fields.passportIssueDate}
                    onChange={(e) => update("passportIssueDate", e.target.value)}
                    className={cn(inputClass, "mt-2 h-12")}
                  />
                </div>
                <div>
                  <label htmlFor={field("passportExpiryDate")} className={labelClass}>
                    {copy.passportExpiryDate}
                  </label>
                  <input
                    id={field("passportExpiryDate")}
                    type="date"
                    value={fields.passportExpiryDate}
                    onChange={(e) => update("passportExpiryDate", e.target.value)}
                    className={cn(inputClass, "mt-2 h-12")}
                  />
                </div>
              </div>

              <div>
                <label htmlFor={field("taxAddress")} className={labelClass}>
                  {copy.taxAddress}
                </label>
                <textarea
                  id={field("taxAddress")}
                  rows={3}
                  autoComplete="street-address"
                  maxLength={400}
                  value={fields.taxAddress}
                  onChange={(e) => update("taxAddress", e.target.value)}
                  className={cn(inputClass, "mt-2 py-3 leading-relaxed")}
                />
              </div>
            </fieldset>

            {error && (
              <p id={errorId} role="alert" className="mt-5 text-[0.88rem] leading-relaxed text-clay">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 bg-white px-6 py-4 sm:px-8">
            <Button type="submit" disabled={disabled} aria-describedby={error ? errorId : undefined}>
              {pending ? copy.saving : submitLabel}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              {copy.cancel}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
