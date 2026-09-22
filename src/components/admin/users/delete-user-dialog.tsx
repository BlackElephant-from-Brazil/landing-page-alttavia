"use client";

import { useEffect, useId, useState, type FormEvent } from "react";

import { cn } from "@/lib/cn";
import type { AdminUserCounts } from "@/lib/db/types";

import { messageFor, requestJson } from "../lib/request";
import { fieldClass, smallLabelClass, useAction } from "../order/use-action";
import { usersCopy } from "./copy";
import { AdminDialog, DialogForm } from "./dialog";
import { getJson } from "./fetch-json";
import { describeDeletion } from "./summary";
import type { UserSummary } from "./types";

/**
 * "Delete this client": the account and everything stored under it.
 *
 * On open it reads GET /api/admin/users/[id] and says what goes, in words
 * ("3 orders, 14 files and 1 agreement"), because the count is the only
 * warning that means anything. Counts that cannot be read do not stop the
 * deletion; the line says so instead.
 *
 * Then the admin types the email. The button stays disabled until it
 * matches, and the typed address is sent with the request, so the server
 * checks it too: a click on the wrong row is caught twice.
 *
 * DELETE /api/admin/users/[id] removes the files in the bucket first, then
 * the rows, then the account. It refuses an administrator and the account
 * the admin is signed in with.
 */

export function DeleteUserDialog({ user, onClose }: { user: UserSummary; onClose: () => void }) {
  const id = useId();
  const emailId = `${id}-email`;
  const summaryId = `${id}-summary`;
  const { pending, error, run } = useAction();
  const [counts, setCounts] = useState<AdminUserCounts | null>(null);
  const [countsFailed, setCountsFailed] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    getJson<{ counts: AdminUserCounts }>(`/api/admin/users/${user.id}`, controller.signal)
      .then((data) => setCounts(data.counts))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error(`delete dialog: counts for ${user.id} could not be read: ${messageFor(err)}`);
        setCountsFailed(true);
      });
    return () => controller.abort();
  }, [user.id]);

  const matches = typed.trim().toLowerCase() === user.email.toLowerCase();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !matches) return;
    const ok = await run(() =>
      requestJson(`/api/admin/users/${user.id}`, { method: "DELETE", body: { email: typed.trim() } }),
    );
    if (ok) onClose();
  }

  const summary = counts ? describeDeletion(counts) : countsFailed ? usersCopy.remove.countsUnknown : usersCopy.remove.counting;

  return (
    <AdminDialog title={usersCopy.remove.title} lead={usersCopy.remove.lead} busy={pending} onClose={onClose}>
      <DialogForm
        onSubmit={submit}
        onCancel={onClose}
        busy={pending}
        error={error ?? (typed.trim() && !matches ? usersCopy.remove.mismatch : null)}
        submitLabel={usersCopy.remove.submit}
        workingLabel={usersCopy.remove.working}
        cancelLabel={usersCopy.fields.cancel}
        submitDisabled={!matches}
        tone="danger"
      >
        <div className="rounded-sm border border-clay/25 bg-clay/5 px-4 py-3.5">
          <p className="font-medium text-navy">{user.email}</p>
          <p id={summaryId} aria-live="polite" className="mt-1 text-[0.85rem] leading-relaxed text-navy-soft">
            {summary}
          </p>
        </div>

        <div>
          <label htmlFor={emailId} className={smallLabelClass}>
            {usersCopy.remove.confirmLabel}
          </label>
          <input
            id={emailId}
            type="text"
            value={typed}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            onChange={(event) => setTyped(event.target.value)}
            aria-describedby={summaryId}
            className={cn(fieldClass, "mt-1.5")}
          />
        </div>
      </DialogForm>
    </AdminDialog>
  );
}
