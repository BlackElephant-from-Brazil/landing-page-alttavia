"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type MouseEvent, type SyntheticEvent } from "react";

import { Button } from "@/components/ui/button";
import { lockBodyScroll } from "@/components/ui/scroll-lock";
import { cn } from "@/lib/cn";
import { MAX_SIGNING_PLACE_LENGTH, parseSigningPlace } from "@/lib/contracts/signing-place";
import type { ApplicantGender, UserServiceApplicantRow } from "@/lib/db/types";
import { validateApplicantInput } from "@/lib/orders/applicant-rules";

/**
 * The principal's details a power of attorney is filled with, asked in a
 * centred `<dialog>` that a deed slot opens. Contract
 * (docs/documents-contract.md) section 3, "Client UI".
 *
 * Mounted means open, the way modal.tsx works: `showModal()` runs on mount,
 * Esc arrives as `cancel`, a click that starts and ends on the backdrop
 * closes, `body` scroll is locked while mounted, and the element that had
 * focus when the dialog opened (the slot's button) gets it back on unmount.
 * The dialog is `overflow-clip`; only the body scrolls. While a save is in
 * flight nothing closes it: Esc, the backdrop and the X button wait for the
 * request to finish (Chrome may close the element itself on a second Esc;
 * the `close` handler reopens it in that case).
 *
 * With `initial` (the row already on this order) the fields open filled
 * from it and nothing is fetched. Without it, the dialog asks
 * GET /api/orders/[id]/applicants/[index] while the fields sit disabled
 * under a "Loading" line: a 200 fills them from the row, a 404 from the
 * `prefill` the route found on an order for another service of the same
 * account, so a second purchase never asks for the passport twice. A second
 * order of the same service opens blank: it is for someone else, and the
 * copy for applicant 0 says so rather than "your".
 *
 * Save PUTs the camelCase fields; a 422 shows the route's one line under
 * the form, a success hands the stored row to `onSaved` and the owner
 * decides whether a download follows.
 *
 * `purpose: "contract"` is the same dialog asked by the service agreement
 * card right after the payment (docs/agreement-contract.md section 6): its
 * own title and lead, the same nine fields with the same prefill, a read
 * only line with the account's address, the optional "City and country you
 * are in today" and the button "Confirm and open my agreement". Submit opens
 * a blank tab first, inside the submit handler and before any await, so no
 * popup blocker steps in; then PUTs the details, POSTs
 * /api/orders/[id]/contract with the place, points the tab at the agreement
 * and tells the owner through `onPrepared`, which closes the dialog. Any
 * refusal closes the blank tab and shows its one line under the form. A
 * browser that refused the tab still finishes: `tabOpened` is false and the
 * card says where to open the agreement.
 *
 * Before anything is opened or sent, in both variants, the form runs the
 * route's own rules (src/lib/orders/applicant-rules.ts, and
 * src/lib/contracts/signing-place.ts for the place): lengths, She or He, real
 * dates, an adult, a current passport by Lisbon's calendar, letters the
 * documents can print. A failure shows the same one line the route would
 * answer, under the form, and no tab is opened. The route validates again.
 *
 * `body` scroll is locked through the shared counted lock
 * (src/components/ui/scroll-lock.ts), because this dialog opens inside the
 * order modal, which holds a lock of its own.
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

type BaseProps = {
  userServiceId: string;
  applicantIndex: 0 | 1;
  /** The row on this order, when there is one: the form opens filled from it. */
  initial: UserServiceApplicantRow | null;
  onClose: () => void;
};

/** The default: a deed slot asking for the principal's details. */
type DeedProps = BaseProps & {
  purpose?: "deed";
  /** The primary button. "Save" by default; the slot says "Save and download" when a download follows. */
  submitLabel?: string;
  onSaved: (row: UserServiceApplicantRow) => void;
};

/** The service agreement card asking for the same details, then preparing and opening the agreement. */
type ContractProps = BaseProps & {
  purpose: "contract";
  /** The account's address, shown read only: where the agreement is sent. */
  accountEmail: string;
  /** The agreement is ready. `tabOpened` is false when the browser refused the new tab or the client closed it. */
  onPrepared: (outcome: { tabOpened: boolean }) => void;
};

type Props = DeedProps | ContractProps;

/** The route's code for "applicant 0 has no details", which is not a sentence to show. */
const DETAILS_MISSING = "details_missing";

const copy = {
  title: ["Details for the power of attorney", "Your partner's details for the power of attorney"] as const,
  lead: [
    "They are printed in the deed as typed, so check them against the passport. Accents our documents cannot print are left out. If this order is for someone else, enter that person's details.",
    "They are printed in the deed as typed, so check them against the passport. Accents our documents cannot print are left out.",
  ] as const,
  loading: "Loading",
  fullName: "Full name (as in the passport)",
  gender: ["The deed refers to the person as", "The deed refers to your partner as"] as const,
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
  contract: {
    title: "Your details for the service agreement",
    lead: "They are printed in the agreement and in the power of attorney as typed, so check them against the passport. Accents our documents cannot print are left out. If this order is for someone else, enter that person's details.",
    gender: "The documents refer to the person as",
    sentTo: "Your agreement is sent to",
    place: "City and country you are in today",
    placeHint: "Optional. It is printed next to the date in the annex. Leave it blank to write it in by hand.",
    submit: "Confirm and open my agreement",
    preparing: "Preparing your agreement",
    tabTitle: "Your service agreement",
    tabBody: "Preparing your service agreement. It opens here in a moment.",
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

/**
 * What the route would refuse, refused in the browser first with the same one
 * line: the rules are one pure module both sides run (applicant-rules.ts, and
 * signing-place.ts for the agreement's optional place). Null when nothing is
 * wrong. The route still validates; this only spares a request and, for the
 * agreement, a blank tab that would open and close again.
 */
function predictedRefusal(fields: ApplicantFields, signingPlace: string | null): string | null {
  const details = validateApplicantInput(fields);
  if (!details.ok) return details.message;
  if (signingPlace === null) return null;
  const place = parseSigningPlace(signingPlace);
  return place.ok ? null : place.message;
}

/**
 * The blank tab the agreement lands in. It has to be opened while the submit
 * event is still the browser's user gesture, so before the first await; null
 * when the browser refused it. The tab forgets who opened it and says what
 * it is waiting for, since preparing the PDF takes a few seconds.
 */
function openPendingTab(): Window | null {
  let tab: Window | null = null;
  try {
    tab = window.open("", "_blank");
  } catch {
    return null;
  }
  if (!tab) return null;
  try {
    tab.opener = null;
    tab.document.title = copy.contract.tabTitle;
    tab.document.body.style.cssText = "margin:3rem;font:1rem/1.6 Georgia,serif;color:#0E2A47;background:#FAFAF7";
    tab.document.body.textContent = copy.contract.tabBody;
  } catch {
    // A tab that will not take the line still takes the agreement.
  }
  return tab;
}

function closeTab(tab: Window | null) {
  try {
    tab?.close();
  } catch {
    // Nothing to do: the tab is the browser's now.
  }
}

/** Points the waiting tab at the agreement. False when there is no tab to point: refused, or closed meanwhile. */
function showAgreementIn(tab: Window | null, userServiceId: string): boolean {
  if (!tab || tab.closed) return false;
  try {
    tab.location.replace(new URL(`/api/orders/${userServiceId}/contract`, window.location.origin).href);
    return true;
  } catch {
    closeTab(tab);
    return false;
  }
}

/** Asks the route to prepare the agreement. Null when it is ready, else the one line to show. */
async function prepareAgreement(userServiceId: string, signingPlace: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(`/api/orders/${userServiceId}/contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signingPlace: signingPlace.trim() }),
    });
  } catch {
    return copy.errors.generic;
  }
  if (response.ok) return null;
  const message = errorMessage(await response.json().catch(() => null));
  return message === DETAILS_MISSING ? copy.errors.generic : message;
}

export function ApplicantDetailsForm(props: Props) {
  const { userServiceId, applicantIndex, initial, onClose } = props;
  const forContract = props.purpose === "contract";
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const pressedOnBackdrop = useRef(false);
  const id = useId();
  const titleId = `${id}-title`;
  const leadId = `${id}-lead`;
  const errorId = `${id}-error`;
  const placeId = `${id}-signingPlace`;
  const placeHintId = `${id}-signingPlace-hint`;
  const field = (name: keyof ApplicantFields) => `${id}-${name}`;

  const [fields, setFields] = useState<ApplicantFields>(() => (initial ? fromRow(initial) : blank()));
  /** Contract only: Annex I's place, optional. */
  const [signingPlace, setSigningPlace] = useState("");
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

  // Counted with the order modal's own lock: this dialog opens inside it, and
  // when both unmount in one commit the page must end up scrolling again.
  useEffect(() => lockBodyScroll(), []);

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
    // Nothing is opened or sent for details the route is sure to refuse.
    const predicted = predictedRefusal(fields, props.purpose === "contract" ? signingPlace : null);
    if (predicted) {
      setError(predicted);
      return;
    }
    // Contract only, and before any await: a tab opened now still belongs to
    // the click, so no popup blocker steps in.
    const tab = props.purpose === "contract" ? openPendingTab() : null;
    const refuse = (message: string) => {
      closeTab(tab);
      setError(message);
      setPending(false);
    };

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
      refuse(copy.errors.generic);
      return;
    }
    const data = (await response.json().catch(() => null)) as { applicant?: unknown } | null;
    if (!response.ok || !isRow(data?.applicant)) {
      refuse(response.ok ? copy.errors.generic : errorMessage(data));
      return;
    }
    // From here on the owner unmounts this dialog; nothing to reset.
    if (props.purpose !== "contract") {
      props.onSaved(data.applicant);
      return;
    }

    const refusal = await prepareAgreement(userServiceId, signingPlace);
    if (refusal) {
      refuse(refusal);
      return;
    }
    props.onPrepared({ tabOpened: showAgreementIn(tab, userServiceId) });
  }

  /** Esc. Ignored while saving: only the request finishing closes the dialog. */
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (pending) return;
    onClose();
  }

  /**
   * The element closed on its own (Chrome closes on a second Esc whatever
   * `cancel` said). Mid save, put it back; otherwise treat it as a close.
   */
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

  const disabled = loading || pending;
  const title = forContract ? copy.contract.title : copy.title[applicantIndex];
  const lead = forContract ? copy.contract.lead : copy.lead[applicantIndex];
  const genderLegend = forContract ? copy.contract.gender : copy.gender[applicantIndex];
  const submitText =
    props.purpose === "contract"
      ? pending
        ? copy.contract.preparing
        : copy.contract.submit
      : pending
        ? copy.saving
        : (props.submitLabel ?? copy.save);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={leadId}
      onCancel={handleCancel}
      onClose={handleNativeClose}
      onMouseDown={handleBackdropDown}
      onClick={handleBackdrop}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(38rem,calc(100vw-2rem))] overflow-clip rounded-lg border border-navy/10 bg-paper p-0 text-navy shadow-[var(--shadow-card)] backdrop:bg-navy/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-navy/10 bg-white px-6 py-5 sm:px-8">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-serif text-xl leading-snug text-navy">
              {title}
            </h2>
            <p id={leadId} className="mt-1.5 text-[0.9rem] leading-relaxed text-navy-soft">
              {lead}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={pending}
            aria-label={copy.close}
            className="-mr-2 -mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full text-navy-muted transition-colors duration-200 hover:bg-navy/5 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-navy-muted"
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
                <legend className={labelClass}>{genderLegend}</legend>
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

              {props.purpose === "contract" && (
                <>
                  <p className="rounded-sm border border-navy/10 bg-white px-4 py-3 text-[0.9rem] leading-relaxed text-navy-soft">
                    {copy.contract.sentTo} <span className="break-words font-medium text-navy">{props.accountEmail}</span>
                  </p>

                  <div>
                    <label htmlFor={placeId} className={labelClass}>
                      {copy.contract.place}
                    </label>
                    <input
                      id={placeId}
                      type="text"
                      autoComplete="off"
                      autoCapitalize="words"
                      maxLength={MAX_SIGNING_PLACE_LENGTH}
                      value={signingPlace}
                      onChange={(e) => {
                        setSigningPlace(e.target.value);
                        if (error) setError(null);
                      }}
                      aria-describedby={placeHintId}
                      className={cn(inputClass, "mt-2 h-12")}
                    />
                    <p id={placeHintId} className="mt-2 text-[0.82rem] leading-relaxed text-navy-muted">
                      {copy.contract.placeHint}
                    </p>
                  </div>
                </>
              )}
            </fieldset>

            {error && (
              <p id={errorId} role="alert" className="mt-5 text-[0.88rem] leading-relaxed text-clay">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-navy/10 bg-white px-6 py-4 sm:px-8">
            <Button type="submit" disabled={disabled} aria-describedby={error ? errorId : undefined}>
              {submitText}
            </Button>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={pending}>
              {copy.cancel}
            </Button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
