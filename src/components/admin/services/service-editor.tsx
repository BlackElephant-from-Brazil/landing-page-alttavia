"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { isProductId } from "@/lib/apply/types";
import { cn } from "@/lib/cn";
import type { ServiceWithConfig } from "@/lib/db/types";

import { DeliverablesList, DocsList, StagesList } from "./config-lists";
import {
  LIMITS,
  bodyFromService,
  draftFromService,
  emptyDraft,
  newDeliverable,
  newDoc,
  newStage,
  nextPosition,
  suggestSlug,
  validateDraft,
  type DeliverableDraft,
  type DocDraft,
  type DraftErrors,
  type ServiceBody,
  type ServiceDraft,
  type StageDraft,
} from "./editor-model";
import { CheckboxField, FieldGroup, TextAreaField, TextField } from "./fields";
import { SERVICES_API_PATH, SERVICES_PATH } from "./paths";

/**
 * The service editor, one client island for /admin/services/new and
 * /admin/services/[id]. Contract (docs/admin-contract.md) sections 6 and 7.
 *
 * The draft lives in one useState; the pure model in ./editor-model.ts
 * validates it and builds the section 6 body. Save POSTs (new) or PATCHes
 * (existing) that body to /api/admin/services and, on success, goes back to
 * the list with a refresh so the server re-reads. A server message (409
 * with the orders count, 422, anything) is shown on one line above the
 * buttons; field messages sit next to their field.
 *
 * Deactivate and Reactivate send the saved service as it is with `active`
 * flipped, not the unsaved draft: a click on Deactivate should change one
 * thing. Deactivate asks first, because the service disappears from the
 * client gallery and the wizard the moment it lands.
 */

const copy = {
  newTitle: "New service",
  editTitle: "Edit service",
  back: "All services",
  basics: {
    title: "Service",
    intro: "What the client sees on the gallery, the checkout and the dashboard.",
  },
  name: "Name",
  slug: "Slug",
  slugHint: "Lower kebab case, unique. Follows the name until you edit it.",
  slugLockedHint: "This slug is one the wizard sells. It cannot change here.",
  priceLockedHint: "Prices of the four application form services change in code, not here.",
  tagline: "Tagline",
  description: "Description",
  descriptionHint: "Shown by Stripe at checkout.",
  price: "Price (euros)",
  currency: "Currency",
  position: "Position",
  positionHint: "Order in the gallery, lowest first.",
  timeline: "Timeline",
  timelineHint: "One line, for example NIF in 3 to 5 business days.",
  includes: "Includes",
  includesHint: "One item per line. **bold** is rendered.",
  supportsQuantity: "Can be ordered twice on one order",
  supportsQuantityHint: "Two NIFs, one checkout. Off for everything else.",
  stripe: {
    title: "Stripe",
    intro: "Test ids and links come from npm run stripe:setup; live ids from stripe:setup --live. Leave blank until the script prints them.",
  },
  priceIdTest: "Price id (test)",
  priceIdLive: "Price id (live)",
  linkTest: "Payment link (test)",
  linkLive: "Payment link (live)",
  status: {
    active: "Active",
    inactive: "Inactive",
    activeHint: "Shown in the client gallery and to the wizard.",
    inactiveHint: "Hidden from the gallery and the wizard. Orders keep their history.",
    deactivate: "Deactivate",
    reactivate: "Reactivate",
    confirmTitle: "Deactivate this service?",
    confirmBody: "It disappears from the gallery and the wizard at once. Existing orders keep their history. Unsaved edits on this page are not included.",
    confirm: "Yes, deactivate",
    cancel: "Keep it active",
  },
  save: "Save service",
  create: "Create service",
  saving: "Saving",
  fixFields: "Check the highlighted fields.",
  genericError: "Something went wrong on our side.",
} as const;

type Props = {
  initial?: ServiceWithConfig;
};

type Submission = { kind: "idle" } | { kind: "saving" } | { kind: "error"; message: string };

export function ServiceEditor({ initial }: Props) {
  const router = useRouter();
  const id = useId();
  const counter = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);

  const [draft, setDraft] = useState<ServiceDraft>(() => (initial ? draftFromService(initial) : emptyDraft()));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [submission, setSubmission] = useState<Submission>({ kind: "idle" });
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  // Bumped after a failed validation, once the field messages are rendered,
  // so the first invalid control takes focus.
  const [focusInvalid, setFocusInvalid] = useState(0);

  useEffect(() => {
    if (focusInvalid === 0) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [focusInvalid]);

  const busy = submission.kind === "saving";
  const slugLocked = initial !== undefined && isProductId(initial.slug);
  const errorId = `${id}-submit-error`;

  function uid(prefix: string): string {
    counter.current += 1;
    return `new-${prefix}-${counter.current}`;
  }

  function patch(changes: Partial<ServiceDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function patchRow<K extends "stages" | "docs" | "deliverables">(list: K, rowUid: string, changes: Partial<ServiceDraft[K][number]>) {
    setDraft((current) => ({
      ...current,
      [list]: (current[list] as ServiceDraft[K][number][]).map((row) => (row.uid === rowUid ? { ...row, ...changes } : row)),
    }));
  }

  function removeRow(list: "stages" | "docs" | "deliverables", rowUid: string) {
    setDraft((current) => ({ ...current, [list]: current[list].filter((row) => row.uid !== rowUid) }));
  }

  function clearError(field: string) {
    if (!(field in errors)) return;
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function send(body: ServiceBody): Promise<string | null> {
    const url = initial ? `${SERVICES_API_PATH}/${initial.id}` : SERVICES_API_PATH;
    const method = initial ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return null;
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      return typeof data.error === "string" && data.error ? data.error : copy.genericError;
    } catch {
      return copy.genericError;
    }
  }

  async function submitBody(body: ServiceBody) {
    setSubmission({ kind: "saving" });
    const message = await send(body);
    if (message) {
      setSubmission({ kind: "error", message });
      return;
    }
    router.push(SERVICES_PATH);
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const result = validateDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      setSubmission({ kind: "error", message: copy.fixFields });
      setFocusInvalid((n) => n + 1);
      return;
    }
    setErrors({});
    await submitBody(result.body);
  }

  async function setActive(active: boolean) {
    if (!initial || busy) return;
    setConfirmingDeactivate(false);
    await submitBody(bodyFromService(initial, active));
  }

  const submitError = submission.kind === "error" ? submission.message : null;

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={busy} className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href={SERVICES_PATH}
            className="inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-navy-muted transition-colors hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            {copy.back}
          </Link>
          <h1 className="mt-3 font-serif text-[clamp(1.8rem,4vw,2.5rem)] leading-tight text-navy">
            {initial ? copy.editTitle : copy.newTitle}
          </h1>
          {initial && <p className="mt-1 text-[0.9rem] text-navy-muted">{initial.name}</p>}
        </div>
        {initial && <StatusBadge active={initial.active} />}
      </header>

      <FieldGroup title={copy.basics.title} intro={copy.basics.intro}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id={`${id}-name`}
            label={copy.name}
            value={draft.name}
            disabled={busy}
            maxLength={LIMITS.name.max}
            autoComplete="off"
            onChange={(e) => {
              const name = e.target.value;
              patch(draft.slugTouched ? { name } : { name, slug: suggestSlug(name) });
              clearError("name");
            }}
            error={errors.name}
          />
          <TextField
            id={`${id}-slug`}
            label={copy.slug}
            value={draft.slug}
            disabled={busy}
            maxLength={LIMITS.slug.max}
            readOnly={slugLocked}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              patch({ slug: e.target.value, slugTouched: true });
              clearError("slug");
            }}
            hint={slugLocked ? copy.slugLockedHint : copy.slugHint}
            error={errors.slug}
          />
          <TextField
            id={`${id}-tagline`}
            label={copy.tagline}
            value={draft.tagline}
            disabled={busy}
            maxLength={LIMITS.tagline}
            onChange={(e) => patch({ tagline: e.target.value })}
            className="sm:col-span-2"
          />
          <TextAreaField
            id={`${id}-description`}
            label={copy.description}
            rows={2}
            value={draft.description}
            disabled={busy}
            maxLength={LIMITS.description}
            onChange={(e) => patch({ description: e.target.value })}
            hint={copy.descriptionHint}
            className="sm:col-span-2"
          />
          <div className="grid gap-5 sm:col-span-2 sm:grid-cols-3">
            <TextField
              id={`${id}-price`}
              label={copy.price}
              value={draft.price}
              inputMode="decimal"
              disabled={busy}
              readOnly={slugLocked}
              onChange={(e) => {
                patch({ price: e.target.value });
                clearError("price");
              }}
              hint={slugLocked ? copy.priceLockedHint : undefined}
              error={errors.price}
            />
            <TextField
              id={`${id}-currency`}
              label={copy.currency}
              value={draft.currency}
              disabled={busy}
              spellCheck={false}
              onChange={(e) => {
                patch({ currency: e.target.value });
                clearError("currency");
              }}
              error={errors.currency}
            />
            <TextField
              id={`${id}-position`}
              label={copy.position}
              value={draft.position}
              inputMode="numeric"
              disabled={busy}
              onChange={(e) => {
                patch({ position: e.target.value });
                clearError("position");
              }}
              hint={copy.positionHint}
              error={errors.position}
            />
          </div>
          <TextField
            id={`${id}-timeline`}
            label={copy.timeline}
            value={draft.timeline}
            disabled={busy}
            maxLength={LIMITS.timeline}
            onChange={(e) => patch({ timeline: e.target.value })}
            hint={copy.timelineHint}
            className="sm:col-span-2"
          />
          <TextAreaField
            id={`${id}-includes`}
            label={copy.includes}
            rows={5}
            value={draft.includes}
            disabled={busy}
            onChange={(e) => {
              patch({ includes: e.target.value });
              clearError("includes");
            }}
            hint={copy.includesHint}
            error={errors.includes}
            className="sm:col-span-2"
          />
          <CheckboxField
            id={`${id}-quantity`}
            label={copy.supportsQuantity}
            hint={copy.supportsQuantityHint}
            checked={draft.supports_quantity}
            disabled={busy}
            onChange={(supports_quantity) => patch({ supports_quantity })}
            className="sm:col-span-2"
          />
        </div>
      </FieldGroup>

      <FieldGroup title={copy.stripe.title} intro={copy.stripe.intro}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id={`${id}-price-test`}
            label={copy.priceIdTest}
            value={draft.stripe_price_id_test}
            disabled={busy}
            maxLength={LIMITS.stripeField}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              patch({ stripe_price_id_test: e.target.value });
              clearError("stripe_price_id_test");
            }}
            error={errors.stripe_price_id_test}
          />
          <TextField
            id={`${id}-price-live`}
            label={copy.priceIdLive}
            value={draft.stripe_price_id_live}
            disabled={busy}
            maxLength={LIMITS.stripeField}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              patch({ stripe_price_id_live: e.target.value });
              clearError("stripe_price_id_live");
            }}
            error={errors.stripe_price_id_live}
          />
          <TextField
            id={`${id}-link-test`}
            label={copy.linkTest}
            value={draft.stripe_payment_link_test}
            disabled={busy}
            maxLength={LIMITS.stripeField}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              patch({ stripe_payment_link_test: e.target.value });
              clearError("stripe_payment_link_test");
            }}
            error={errors.stripe_payment_link_test}
          />
          <TextField
            id={`${id}-link-live`}
            label={copy.linkLive}
            value={draft.stripe_payment_link_live}
            disabled={busy}
            maxLength={LIMITS.stripeField}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              patch({ stripe_payment_link_live: e.target.value });
              clearError("stripe_payment_link_live");
            }}
            error={errors.stripe_payment_link_live}
          />
        </div>
      </FieldGroup>

      <StagesList
        rows={draft.stages}
        errors={errors}
        disabled={busy}
        onChange={(rowUid, changes: Partial<StageDraft>) => patchRow("stages", rowUid, changes)}
        onRemove={(rowUid) => removeRow("stages", rowUid)}
        onAdd={() => patch({ stages: [...draft.stages, newStage(uid("stage"), nextPosition(draft.stages, 1))] })}
      />

      <DocsList
        rows={draft.docs}
        errors={errors}
        disabled={busy}
        onChange={(rowUid, changes: Partial<DocDraft>) => patchRow("docs", rowUid, changes)}
        onRemove={(rowUid) => removeRow("docs", rowUid)}
        onAdd={() => patch({ docs: [...draft.docs, newDoc(uid("doc"), nextPosition(draft.docs, 1))] })}
      />

      <DeliverablesList
        rows={draft.deliverables}
        errors={errors}
        disabled={busy}
        onChange={(rowUid, changes: Partial<DeliverableDraft>) => patchRow("deliverables", rowUid, changes)}
        onRemove={(rowUid) => removeRow("deliverables", rowUid)}
        onAdd={() =>
          patch({ deliverables: [...draft.deliverables, newDeliverable(uid("deliverable"), nextPosition(draft.deliverables, 1))] })
        }
      />

      {initial && (
        <FieldGroup
          title={initial.active ? copy.status.active : copy.status.inactive}
          intro={initial.active ? copy.status.activeHint : copy.status.inactiveHint}
        >
          {initial.active ? (
            confirmingDeactivate ? (
              <div role="alertdialog" aria-labelledby={`${id}-confirm-title`} aria-describedby={`${id}-confirm-body`} className="rounded-sm border border-clay/30 bg-clay/5 p-5">
                <p id={`${id}-confirm-title`} className="font-serif text-lg text-navy">
                  {copy.status.confirmTitle}
                </p>
                <p id={`${id}-confirm-body`} className="mt-1.5 max-w-prose text-[0.88rem] leading-relaxed text-navy-soft">
                  {copy.status.confirmBody}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button type="button" variant="primary" onClick={() => setActive(false)} disabled={busy} className="bg-clay hover:bg-clay/90 hover:text-white">
                    {copy.status.confirm}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmingDeactivate(false)} disabled={busy} autoFocus>
                    {copy.status.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => setConfirmingDeactivate(true)} disabled={busy}>
                {copy.status.deactivate}
              </Button>
            )
          ) : (
            <Button type="button" variant="outline" onClick={() => setActive(true)} disabled={busy}>
              {copy.status.reactivate}
            </Button>
          )}
        </FieldGroup>
      )}

      <div className="flex flex-col gap-3 border-t border-navy/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p id={errorId} role={submitError ? "alert" : undefined} className={cn("min-h-[1.5rem] text-[0.88rem] leading-relaxed", submitError ? "text-clay" : "text-transparent")}>
          {submitError ?? " "}
        </p>
        <Button type="submit" size="lg" disabled={busy} aria-describedby={submitError ? errorId : undefined} className="sm:min-w-[12rem]">
          <Save className="size-4" aria-hidden />
          {busy ? copy.saving : initial ? copy.save : copy.create}
        </Button>
      </div>
    </form>
  );
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-[0.72rem] font-medium uppercase tracking-[0.14em]",
        active ? "bg-navy text-white" : "bg-navy/5 text-navy-muted",
      )}
    >
      {active ? copy.status.active : copy.status.inactive}
    </span>
  );
}
