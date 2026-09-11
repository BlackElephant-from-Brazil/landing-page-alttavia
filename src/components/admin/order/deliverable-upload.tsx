"use client";

import { Upload } from "lucide-react";
import { useId, useState, type ChangeEvent, type FormEvent } from "react";

import type { ServiceDeliverableRow } from "@/lib/db/types";
import { extensionFor, formatBytes, mimeForFileName } from "@/lib/r2/keys";

import { requestJson } from "../lib/request";
import { fieldClass, primaryActionClass, smallLabelClass, useAction } from "./use-action";

/**
 * Uploads one deliverable to the order, the same three steps as the
 * client's document slot: POST /api/admin/deliverables/upload-url for a
 * pending row and a presigned URL, a PUT of the file straight to the
 * bucket (XHR, so the bar can move), then POST /api/admin/deliverables/confirm.
 * On success the modal refreshes and the file shows in the list above with
 * its download link.
 *
 * The label is what the client reads; picking a template fills it in and
 * links the file to that deliverable of the service.
 */

const MAX_BYTES = 20 * 1024 * 1024;
const UPLOAD_FAILED = "The upload did not finish. Try again.";

type Phase = { kind: "idle" } | { kind: "uploading"; percent: number } | { kind: "done"; fileName: string };

export function DeliverableUpload({
  orderId,
  templates,
}: {
  orderId: string;
  templates: ServiceDeliverableRow[];
}) {
  const { pending, error, run, clear } = useAction();
  const labelId = useId();
  const templateId = useId();
  const fileId = useId();
  const messageId = useId();
  const [label, setLabel] = useState("");
  const [template, setTemplate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  function pickTemplate(value: string) {
    setTemplate(value);
    const chosen = templates.find((t) => t.id === value);
    if (chosen && !label.trim()) setLabel(chosen.label);
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null;
    setLocalError(null);
    clear();
    setPhase({ kind: "idle" });
    if (!next) {
      setFile(null);
      return;
    }
    const mime = (next.type || mimeForFileName(next.name) || "").toLowerCase();
    if (!extensionFor(mime)) {
      setLocalError("This file type is not accepted. Use PDF, JPG, PNG, WebP, DOC or DOCX.");
      setFile(null);
      event.target.value = "";
      return;
    }
    if (next.size === 0) {
      setLocalError("This file is empty.");
      setFile(null);
      event.target.value = "";
      return;
    }
    if (next.size > MAX_BYTES) {
      setLocalError(`This file is too large. The limit is ${formatBytes(MAX_BYTES)}.`);
      setFile(null);
      event.target.value = "";
      return;
    }
    setFile(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = label.trim();
    if (!file || !text) return;
    const mimeType = (file.type || mimeForFileName(file.name) || "").toLowerCase();
    const chosen = file;

    const ok = await run(async () => {
      const ticket = await requestJson<{ deliverableId?: string; id?: string; url: string }>(
        "/api/admin/deliverables/upload-url",
        {
          method: "POST",
          body: {
            userServiceId: orderId,
            label: text,
            serviceDeliverableId: template || undefined,
            fileName: chosen.name,
            mimeType,
            sizeBytes: chosen.size,
          },
        },
      );
      const deliverableId = ticket.deliverableId ?? ticket.id;
      if (!deliverableId || !ticket.url) throw new Error(UPLOAD_FAILED);

      setPhase({ kind: "uploading", percent: 0 });
      await putFile(ticket.url, chosen, mimeType, (p) => setPhase({ kind: "uploading", percent: p }));

      await requestJson("/api/admin/deliverables/confirm", { method: "POST", body: { deliverableId } });
      setPhase({ kind: "done", fileName: chosen.name });
    });

    if (ok) {
      setLabel("");
      setTemplate("");
      setFile(null);
      const input = document.getElementById(fileId) as HTMLInputElement | null;
      if (input) input.value = "";
    } else {
      setPhase({ kind: "idle" });
    }
  }

  const percent = phase.kind === "uploading" ? phase.percent : phase.kind === "done" ? 100 : 0;
  const message =
    localError ??
    error ??
    (phase.kind === "uploading"
      ? `Uploading ${phase.percent}%`
      : phase.kind === "done"
        ? `${phase.fileName} received.`
        : "");

  return (
    <form onSubmit={submit} className="mt-4 rounded-lg border border-navy/10 bg-paper p-4" aria-busy={pending || undefined}>
      <p className="font-serif text-base text-navy">Upload a file for the client</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {templates.length > 0 && (
          <label htmlFor={templateId} className={smallLabelClass}>
            Deliverable
            <select
              id={templateId}
              value={template}
              onChange={(e) => pickTemplate(e.target.value)}
              disabled={pending}
              className={`${fieldClass} mt-1 h-10 py-0 normal-case tracking-normal`}
            >
              <option value="">Other file</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label htmlFor={labelId} className={smallLabelClass}>
          Label the client sees
          <input
            id={labelId}
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
            maxLength={120}
            disabled={pending}
            placeholder="NIF certificate"
            className={`${fieldClass} mt-1 h-10 py-0 normal-case tracking-normal`}
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label
          htmlFor={fileId}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-navy/20 bg-white px-4 text-[0.82rem] font-medium text-navy transition-colors duration-200 hover:border-navy hover:bg-navy hover:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-paper"
        >
          <input
            id={fileId}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
            onChange={pickFile}
            disabled={pending}
            aria-describedby={messageId}
            className="sr-only"
          />
          <Upload className="size-4" aria-hidden />
          {file ? "Change file" : "Choose file"}
        </label>
        {file && <span className="truncate text-[0.85rem] text-navy-soft">{file.name}</span>}
        <button type="submit" disabled={pending || !file || !label.trim()} className={primaryActionClass}>
          {pending ? "Uploading" : "Upload"}
        </button>
      </div>

      <div
        className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-navy/5"
        role="progressbar"
        aria-label="Deliverable upload"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-hidden={percent === 0 || undefined}
      >
        <div className="h-full bg-gold transition-[width] duration-200 ease-out" style={{ width: `${percent}%` }} />
      </div>
      <p
        id={messageId}
        aria-live="polite"
        className={`mt-2 min-h-5 text-[0.82rem] leading-5 ${localError || error ? "text-clay" : "text-navy-muted"}`}
      >
        {message}
      </p>
    </form>
  );
}

/** PUT the file to the presigned URL with progress; XHR because fetch reports none. */
function putFile(url: string, file: File, mimeType: string, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(UPLOAD_FAILED));
    };
    xhr.onerror = () => reject(new Error(UPLOAD_FAILED));
    xhr.onabort = () => reject(new Error(UPLOAD_FAILED));
    xhr.ontimeout = () => reject(new Error(UPLOAD_FAILED));
    xhr.send(file);
  });
}
