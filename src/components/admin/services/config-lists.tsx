"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import type { PoaTemplate } from "@/lib/db/types";

import {
  ACCEPTED_MIME_OPTIONS,
  DELIVERABLE_KINDS,
  LIMITS,
  MAX_DOC_MB,
  POA_TEMPLATES,
  suggestKey,
  type DeliverableDraft,
  type DocDraft,
  type DraftErrors,
  type StageDraft,
} from "./editor-model";
import { CheckboxField, FieldGroup, ListError, SelectField, TextAreaField, TextField, labelClass } from "./fields";

/**
 * The three repeatable lists of the service editor: stages, documents and
 * deliverables. Each row edits one draft row; the parent owns the array and
 * passes `onChange(uid, patch)` and `onRemove(uid)`.
 *
 * Keys follow the label through `suggestKey` until the admin types in the
 * key field; saved rows show their key read only, because the API upserts
 * by key and a different key would be a new row, not a rename.
 */

const copy = {
  stages: {
    title: "Lifecycle stages",
    intro: "The order moves through these in position order. The first is always awaiting_payment; mark the last one as final.",
    add: "Add stage",
    empty: "No stages yet.",
  },
  docs: {
    title: "Required documents",
    intro: "One upload slot per document, per applicant when ticked. Notes appear under the slot on the client's dashboard.",
    add: "Add document",
    empty: "No documents. The client is asked for nothing after paying.",
  },
  deliverables: {
    title: "Deliverables",
    intro: "What the client receives when the order is complete.",
    add: "Add deliverable",
    empty: "No deliverables yet.",
  },
  key: "Key",
  keyHint: "Lower snake case. Follows the label until you edit it.",
  keySavedHint: "Saved keys stay fixed. A different key would create a new row.",
  label: "Label",
  position: "Position",
  description: "Description",
  descriptionHint: "Shown to the client while the order sits on this stage.",
  terminal: "Final stage",
  terminalHint: "Reaching it marks the order complete.",
  note: "Note",
  noteHint: "Under 200 characters.",
  fileTypes: "Accepted file types",
  maxMb: "Max size (MB)",
  maxMbHint: `Up to ${MAX_DOC_MB} MB.`,
  perApplicant: "One per applicant",
  perApplicantHint: "A couple order asks for two.",
  required: "Required",
  requiredHint: "Counted on the admin's documents column.",
  template: "Generated deed",
  templateHint: "The client downloads it filled with their passport details, signs it by hand and uploads the signed copy into this slot.",
  templateNone: "None",
  templates: {
    poa_nif: "Power of attorney (NIF)",
    poa_bank: "Power of attorney (bank account)",
  } satisfies Record<PoaTemplate, string>,
  kind: "Kind",
  remove: "Remove",
} as const;

const KIND_OPTIONS = DELIVERABLE_KINDS.map((kind) => ({ value: kind, label: kind === "document" ? "Document" : "Report" }));

/** "" stands for null in the select: a plain upload slot. */
const TEMPLATE_OPTIONS = [
  { value: "", label: copy.templateNone },
  ...POA_TEMPLATES.map((template) => ({ value: template, label: copy.templates[template] })),
];

function templateFromOption(value: string): PoaTemplate | null {
  return (POA_TEMPLATES as readonly string[]).includes(value) ? (value as PoaTemplate) : null;
}

type RowProps<T> = {
  row: T;
  errors: DraftErrors;
  disabled: boolean;
  onChange: (uid: string, patch: Partial<T>) => void;
  onRemove: (uid: string) => void;
};

function rowClass(index: number): string {
  return cn("relative rounded-sm border border-navy/10 p-5", index % 2 === 1 ? "bg-paper" : "bg-white");
}

function RemoveButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-medium text-navy-muted transition-colors hover:bg-clay/10 hover:text-clay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Trash2 className="size-3.5" aria-hidden />
      {copy.remove}
    </button>
  );
}

function KeyField({
  id,
  row,
  error,
  disabled,
  onChange,
}: {
  id: string;
  row: { key: string; saved: boolean };
  error?: string;
  disabled: boolean;
  onChange: (key: string) => void;
}) {
  return (
    <TextField
      id={id}
      label={copy.key}
      value={row.key}
      maxLength={LIMITS.key}
      readOnly={row.saved}
      disabled={disabled}
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      hint={row.saved ? copy.keySavedHint : copy.keyHint}
      error={error}
    />
  );
}

/** The label and key move together until the key is touched. */
function labelPatch(row: { keyTouched: boolean; saved: boolean }, label: string): { label: string; key?: string } {
  if (row.saved || row.keyTouched) return { label };
  return { label, key: suggestKey(label) };
}

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

function StageRow({ row, errors, disabled, onChange, onRemove, index }: RowProps<StageDraft> & { index: number }) {
  const id = useId();
  const at = (field: string) => errors[`stages.${row.uid}.${field}`];

  return (
    <li className={rowClass(index)}>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
        <TextField
          id={`${id}-label`}
          label={copy.label}
          value={row.label}
          maxLength={LIMITS.stageLabel}
          disabled={disabled}
          onChange={(e) => onChange(row.uid, labelPatch(row, e.target.value))}
          error={at("label")}
        />
        <KeyField
          id={`${id}-key`}
          row={row}
          disabled={disabled}
          error={at("key")}
          onChange={(key) => onChange(row.uid, { key, keyTouched: true })}
        />
        <TextField
          id={`${id}-position`}
          label={copy.position}
          value={row.position}
          inputMode="numeric"
          disabled={disabled}
          onChange={(e) => onChange(row.uid, { position: e.target.value })}
          error={at("position")}
        />
      </div>
      <TextAreaField
        id={`${id}-description`}
        label={copy.description}
        rows={2}
        value={row.description}
        maxLength={LIMITS.stageDescription}
        disabled={disabled}
        onChange={(e) => onChange(row.uid, { description: e.target.value })}
        hint={copy.descriptionHint}
        className="mt-4"
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <CheckboxField
          id={`${id}-terminal`}
          label={copy.terminal}
          hint={copy.terminalHint}
          checked={row.is_terminal}
          disabled={disabled}
          onChange={(is_terminal) => onChange(row.uid, { is_terminal })}
        />
        <RemoveButton onClick={() => onRemove(row.uid)} disabled={disabled} label={`Remove stage ${row.label || row.key || index + 1}`} />
      </div>
    </li>
  );
}

export function StagesList({
  rows,
  errors,
  disabled,
  onChange,
  onRemove,
  onAdd,
}: Omit<RowProps<StageDraft>, "row"> & { rows: StageDraft[]; onAdd: () => void }) {
  return (
    <FieldGroup
      title={copy.stages.title}
      intro={copy.stages.intro}
      actions={
        <Button type="button" variant="outline" onClick={onAdd} disabled={disabled}>
          <Plus className="size-4" aria-hidden />
          {copy.stages.add}
        </Button>
      }
    >
      <ListError id="stages-error" message={errors.stages} />
      {rows.length === 0 ? (
        <p className="text-[0.9rem] text-navy-muted">{copy.stages.empty}</p>
      ) : (
        <ol className="grid gap-4">
          {rows.map((row, index) => (
            <StageRow key={row.uid} row={row} index={index} errors={errors} disabled={disabled} onChange={onChange} onRemove={onRemove} />
          ))}
        </ol>
      )}
    </FieldGroup>
  );
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

function DocRow({ row, errors, disabled, onChange, onRemove, index }: RowProps<DocDraft> & { index: number }) {
  const id = useId();
  const at = (field: string) => errors[`docs.${row.uid}.${field}`];
  const mimeError = at("accepted_mime");

  function toggleMime(mime: string, checked: boolean) {
    const next = checked ? [...row.accepted_mime, mime] : row.accepted_mime.filter((m) => m !== mime);
    onChange(row.uid, { accepted_mime: Array.from(new Set(next)) });
  }

  return (
    <li className={rowClass(index)}>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_6rem]">
        <TextField
          id={`${id}-label`}
          label={copy.label}
          value={row.label}
          maxLength={LIMITS.docLabel}
          disabled={disabled}
          onChange={(e) => onChange(row.uid, labelPatch(row, e.target.value))}
          error={at("label")}
        />
        <KeyField
          id={`${id}-key`}
          row={row}
          disabled={disabled}
          error={at("key")}
          onChange={(key) => onChange(row.uid, { key, keyTouched: true })}
        />
        <TextField
          id={`${id}-position`}
          label={copy.position}
          value={row.position}
          inputMode="numeric"
          disabled={disabled}
          onChange={(e) => onChange(row.uid, { position: e.target.value })}
          error={at("position")}
        />
      </div>
      <TextAreaField
        id={`${id}-note`}
        label={copy.note}
        rows={2}
        value={row.note}
        maxLength={200}
        disabled={disabled}
        onChange={(e) => onChange(row.uid, { note: e.target.value })}
        hint={copy.noteHint}
        className="mt-4"
      />
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_8rem]">
        <fieldset aria-describedby={mimeError ? `${id}-mime-error` : undefined} aria-invalid={mimeError ? true : undefined}>
          <legend className={labelClass}>{copy.fileTypes}</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {ACCEPTED_MIME_OPTIONS.map((option) => (
              <CheckboxField
                key={option.mime}
                id={`${id}-mime-${option.label}`}
                label={option.label}
                checked={row.accepted_mime.includes(option.mime)}
                disabled={disabled}
                onChange={(checked) => toggleMime(option.mime, checked)}
              />
            ))}
          </div>
          {mimeError && (
            <p id={`${id}-mime-error`} role="alert" className="mt-1.5 text-[0.8rem] text-clay">
              {mimeError}
            </p>
          )}
        </fieldset>
        <TextField
          id={`${id}-max`}
          label={copy.maxMb}
          value={row.max_mb}
          inputMode="decimal"
          disabled={disabled}
          onChange={(e) => onChange(row.uid, { max_mb: e.target.value })}
          hint={copy.maxMbHint}
          error={at("max_mb")}
        />
      </div>
      <SelectField
        id={`${id}-template`}
        label={copy.template}
        value={row.template ?? ""}
        options={TEMPLATE_OPTIONS}
        disabled={disabled}
        onChange={(e) => onChange(row.uid, { template: templateFromOption(e.target.value) })}
        hint={copy.templateHint}
        error={at("template")}
        className="mt-4 sm:max-w-md"
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <CheckboxField
            id={`${id}-per-applicant`}
            label={copy.perApplicant}
            hint={copy.perApplicantHint}
            checked={row.per_applicant}
            disabled={disabled}
            onChange={(per_applicant) => onChange(row.uid, { per_applicant })}
          />
          <CheckboxField
            id={`${id}-required`}
            label={copy.required}
            hint={copy.requiredHint}
            checked={row.required}
            disabled={disabled}
            onChange={(required) => onChange(row.uid, { required })}
          />
        </div>
        <RemoveButton onClick={() => onRemove(row.uid)} disabled={disabled} label={`Remove document ${row.label || row.key || index + 1}`} />
      </div>
    </li>
  );
}

export function DocsList({
  rows,
  errors,
  disabled,
  onChange,
  onRemove,
  onAdd,
}: Omit<RowProps<DocDraft>, "row"> & { rows: DocDraft[]; onAdd: () => void }) {
  return (
    <FieldGroup
      title={copy.docs.title}
      intro={copy.docs.intro}
      actions={
        <Button type="button" variant="outline" onClick={onAdd} disabled={disabled}>
          <Plus className="size-4" aria-hidden />
          {copy.docs.add}
        </Button>
      }
    >
      <ListError id="docs-error" message={errors.docs} />
      {rows.length === 0 ? (
        <p className="text-[0.9rem] text-navy-muted">{copy.docs.empty}</p>
      ) : (
        <ol className="grid gap-4">
          {rows.map((row, index) => (
            <DocRow key={row.uid} row={row} index={index} errors={errors} disabled={disabled} onChange={onChange} onRemove={onRemove} />
          ))}
        </ol>
      )}
    </FieldGroup>
  );
}

// ---------------------------------------------------------------------------
// Deliverables
// ---------------------------------------------------------------------------

function DeliverableRow({ row, errors, disabled, onChange, onRemove, index }: RowProps<DeliverableDraft> & { index: number }) {
  const id = useId();
  const at = (field: string) => errors[`deliverables.${row.uid}.${field}`];

  return (
    <li className={rowClass(index)}>
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_8rem_6rem]">
        <TextField
          id={`${id}-label`}
          label={copy.label}
          value={row.label}
          maxLength={LIMITS.deliverableLabel}
          disabled={disabled}
          onChange={(e) => onChange(row.uid, labelPatch(row, e.target.value))}
          error={at("label")}
        />
        <KeyField
          id={`${id}-key`}
          row={row}
          disabled={disabled}
          error={at("key")}
          onChange={(key) => onChange(row.uid, { key, keyTouched: true })}
        />
        <SelectField
          id={`${id}-kind`}
          label={copy.kind}
          value={row.kind}
          options={KIND_OPTIONS}
          disabled={disabled}
          onChange={(e) => onChange(row.uid, { kind: e.target.value === "report" ? "report" : "document" })}
          error={at("kind")}
        />
        <TextField
          id={`${id}-position`}
          label={copy.position}
          value={row.position}
          inputMode="numeric"
          disabled={disabled}
          onChange={(e) => onChange(row.uid, { position: e.target.value })}
          error={at("position")}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <RemoveButton onClick={() => onRemove(row.uid)} disabled={disabled} label={`Remove deliverable ${row.label || row.key || index + 1}`} />
      </div>
    </li>
  );
}

export function DeliverablesList({
  rows,
  errors,
  disabled,
  onChange,
  onRemove,
  onAdd,
}: Omit<RowProps<DeliverableDraft>, "row"> & { rows: DeliverableDraft[]; onAdd: () => void }) {
  return (
    <FieldGroup
      title={copy.deliverables.title}
      intro={copy.deliverables.intro}
      actions={
        <Button type="button" variant="outline" onClick={onAdd} disabled={disabled}>
          <Plus className="size-4" aria-hidden />
          {copy.deliverables.add}
        </Button>
      }
    >
      <ListError id="deliverables-error" message={errors.deliverables} />
      {rows.length === 0 ? (
        <p className="text-[0.9rem] text-navy-muted">{copy.deliverables.empty}</p>
      ) : (
        <ol className="grid gap-4">
          {rows.map((row, index) => (
            <DeliverableRow key={row.uid} row={row} index={index} errors={errors} disabled={disabled} onChange={onChange} onRemove={onRemove} />
          ))}
        </ol>
      )}
    </FieldGroup>
  );
}
