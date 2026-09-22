"use client";

import { useId, useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";

import { requestJson } from "../lib/request";
import { fieldClass, smallLabelClass, useAction } from "../order/use-action";
import { usersCopy } from "./copy";
import { AdminDialog, DialogForm } from "./dialog";
import type { UserSummary } from "./types";

/**
 * The two dialogs that write a profile:
 *
 *   NewUserDialog   POST /api/admin/users        the firm makes an account
 *   EditUserDialog  PATCH /api/admin/users/[id]  the firm corrects one
 *
 * Both post through `useAction`, so "saving" lasts until the page has
 * refreshed and the table shows the change, and a refusal shows the route's
 * one line under the fields. The dialog closes only on success.
 *
 * The edit dialog sends only what was changed, which is also what the route
 * expects: a patch with nothing in it is refused rather than saved as a
 * no-op.
 */

const MAX_EMAIL = 254;
const MAX_NAME = 120;
const MAX_PHONE = 40;

function Field({
  id,
  label,
  hint,
  value,
  onChange,
  type = "text",
  maxLength,
  autoComplete = "off",
  autoFocus,
  required,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  maxLength: number;
  autoComplete?: string;
  autoFocus?: boolean;
  required?: boolean;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className={smallLabelClass}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required={required}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hintId}
        className={cn(fieldClass, "mt-1.5")}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-[0.78rem] text-navy-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function NewUserDialog({ onClose }: { onClose: () => void }) {
  const id = useId();
  const { pending, error, run } = useAction();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const ok = await run(() =>
      requestJson("/api/admin/users", { method: "POST", body: { email, fullName, phone } }),
    );
    if (ok) onClose();
  }

  return (
    <AdminDialog title={usersCopy.create.title} lead={usersCopy.create.lead} busy={pending} onClose={onClose}>
      <DialogForm
        onSubmit={submit}
        onCancel={onClose}
        busy={pending}
        error={error}
        submitLabel={usersCopy.create.submit}
        workingLabel={usersCopy.create.working}
        cancelLabel={usersCopy.fields.cancel}
      >
        <Field
          id={`${id}-email`}
          label={usersCopy.fields.email}
          value={email}
          onChange={setEmail}
          type="email"
          maxLength={MAX_EMAIL}
          autoFocus
          required
        />
        <Field
          id={`${id}-name`}
          label={usersCopy.fields.name}
          value={fullName}
          onChange={setFullName}
          maxLength={MAX_NAME}
          required
        />
        <Field
          id={`${id}-phone`}
          label={usersCopy.fields.phone}
          hint={usersCopy.fields.phoneHint}
          value={phone}
          onChange={setPhone}
          type="tel"
          maxLength={MAX_PHONE}
        />
      </DialogForm>
    </AdminDialog>
  );
}

export function EditUserDialog({ user, onClose }: { user: UserSummary; onClose: () => void }) {
  const id = useId();
  const { pending, error, run } = useAction();
  const [email, setEmail] = useState(user.email);
  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    // Only what moved: the route refuses a patch that changes nothing, and
    // an unchanged email must not be sent to Auth again.
    const body: Record<string, string> = {};
    if (email.trim().toLowerCase() !== user.email.toLowerCase()) body.email = email;
    if (fullName.trim() !== (user.fullName ?? "")) body.fullName = fullName;
    if (phone.trim() !== (user.phone ?? "")) body.phone = phone;

    const ok = await run(() => requestJson(`/api/admin/users/${user.id}`, { method: "PATCH", body }));
    if (ok) onClose();
  }

  return (
    <AdminDialog title={usersCopy.edit.title} lead={usersCopy.edit.lead} busy={pending} onClose={onClose}>
      <DialogForm
        onSubmit={submit}
        onCancel={onClose}
        busy={pending}
        error={error}
        submitLabel={usersCopy.edit.submit}
        workingLabel={usersCopy.edit.working}
        cancelLabel={usersCopy.fields.cancel}
      >
        <Field
          id={`${id}-email`}
          label={usersCopy.fields.email}
          value={email}
          onChange={setEmail}
          type="email"
          maxLength={MAX_EMAIL}
          autoFocus
          required
        />
        <Field
          id={`${id}-name`}
          label={usersCopy.fields.name}
          value={fullName}
          onChange={setFullName}
          maxLength={MAX_NAME}
          required
        />
        <Field
          id={`${id}-phone`}
          label={usersCopy.fields.phone}
          hint={usersCopy.fields.phoneHint}
          value={phone}
          onChange={setPhone}
          type="tel"
          maxLength={MAX_PHONE}
        />
      </DialogForm>
    </AdminDialog>
  );
}
