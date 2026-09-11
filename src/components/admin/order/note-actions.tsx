"use client";

import { Check } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import type { NoteAudience } from "@/lib/db/types";

import { requestJson } from "../lib/request";
import { fieldClass, outlineActionClass, primaryActionClass, smallLabelClass, useAction } from "./use-action";

/**
 * The two writes on notes: post one (a pendency the client sees, or an
 * internal note only the firm sees) and resolve one. A client facing note
 * also sends the client an email, which the audience hint says.
 */
export function NoteForm({ orderId }: { orderId: string }) {
  const { pending, error, run } = useAction();
  const bodyId = useId();
  const audienceId = useId();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<NoteAudience>("client");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    const ok = await run(() =>
      requestJson(`/api/admin/orders/${orderId}/notes`, { method: "POST", body: { body: text, audience } }),
    );
    if (ok) setBody("");
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-lg border border-navy/10 bg-paper p-4" aria-busy={pending || undefined}>
      <label htmlFor={bodyId} className={smallLabelClass}>
        New note
      </label>
      <textarea
        id={bodyId}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={4000}
        required
        disabled={pending}
        placeholder="What the client needs to do, or a note for the firm."
        className={`${fieldClass} mt-1.5`}
      />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label htmlFor={audienceId} className={smallLabelClass}>
          Who sees it
          <select
            id={audienceId}
            value={audience}
            onChange={(e) => setAudience(e.target.value === "internal" ? "internal" : "client")}
            disabled={pending}
            className={`${fieldClass} mt-1 h-9 w-auto min-w-[14rem] py-0 normal-case tracking-normal`}
          >
            <option value="client">The client (they get an email)</option>
            <option value="internal">The firm only</option>
          </select>
        </label>
        <button type="submit" disabled={pending || !body.trim()} className={primaryActionClass}>
          {audience === "client" ? "Post and notify" : "Save note"}
        </button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-5 text-[0.82rem] leading-5 text-clay">
        {error ?? ""}
      </p>
    </form>
  );
}

export function ResolveNoteButton({ noteId }: { noteId: string }) {
  const { pending, error, run } = useAction();

  function resolve() {
    void run(() => requestJson(`/api/admin/notes/${noteId}/resolve`, { method: "POST" }));
  }

  return (
    <div className="shrink-0">
      <button type="button" onClick={resolve} disabled={pending} className={outlineActionClass} aria-busy={pending || undefined}>
        <Check className="size-4" aria-hidden />
        Resolve
      </button>
      {error && (
        <p role="alert" className="mt-1 max-w-[14rem] text-[0.78rem] leading-snug text-clay">
          {error}
        </p>
      )}
    </div>
  );
}
