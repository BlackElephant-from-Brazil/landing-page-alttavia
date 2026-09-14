"use client";

import { useRouter } from "next/navigation";
import { Download, FileText, Upload } from "lucide-react";
import { useId, useState, type ChangeEvent } from "react";

import { cn } from "@/lib/cn";
import type { DocumentStatus, PoaTemplate, UserServiceApplicantRow } from "@/lib/db/types";
import { acceptedTypesMessage, mimeForFileName, sizeLimitMessage } from "@/lib/r2/keys";

import { ApplicantDetailsForm } from "./applicant-details-form";

/**
 * One document slot on the dashboard: the label and note from `service_docs`,
 * a status pill, and a file input when the slot still accepts a file.
 *
 * The upload is three steps, all from here: POST /api/documents/upload-url
 * for a presigned URL, a PUT of the file straight to the bucket (XHR, so the
 * progress bar can move), then POST /api/documents/confirm. On success the
 * page refreshes and the server passes the new row back as `current`; the
 * parent keys this component on that row, so a fresh slot mounts clean.
 *
 * A deed slot (`template` set) adds a row above the upload control: the
 * primary "Download to sign" and, once the principal's details exist, a
 * quiet "Edit your details". Download with no `applicant` row opens the
 * details dialog first and starts the download once they are saved; with a
 * row it fetches /api/orders/[id]/poa/[docId] and hands the PDF to the
 * browser through a temporary download link, so the page stays and a JSON
 * refusal never replaces it: 409 `details_missing` opens the dialog, any
 * other refusal shows its one line in the message line. The signed copy
 * then goes through the same upload as any other slot, labelled "Upload the
 * signed copy". The deed row shows only while the slot still accepts a
 * file: once the signed copy is uploaded or approved there is nothing left
 * to download or edit. Contract (docs/documents-contract.md) section 3,
 * "Client UI".
 *
 * Nothing moves when state changes: the progress bar and the message line
 * are always in the layout, at zero width and empty, so the card keeps its
 * height from the first render to the last.
 */

export type SlotDocument = {
  id: string;
  status: DocumentStatus;
  fileName: string;
  rejectionReason: string | null;
};

type Props = {
  userServiceId: string;
  serviceDocId: string;
  applicantIndex: 0 | 1;
  label: string;
  note?: string | null;
  acceptedMime: readonly string[];
  maxBytes: number;
  current?: SlotDocument;
  /** Set on a deed slot: the power of attorney this slot generates for the client to sign. */
  template?: PoaTemplate | null;
  /** The principal's details entered for this slot's applicant, when they exist. */
  applicant?: UserServiceApplicantRow | null;
  /** "You" or "Your partner" on a couple order, for the buttons' accessible names. */
  applicantLabel?: string;
};

/** Which dialog is open and what follows a save: a download, or only a refresh. */
type Details = "download" | "edit" | null;

type Phase =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "requesting" }
  | { kind: "uploading"; percent: number }
  | { kind: "confirming" }
  | { kind: "done"; fileName: string }
  | { kind: "error"; message: string };

const FALLBACK_ERROR = "Something did not work. Try again.";
const UPLOAD_FAILED = "The upload did not finish. Try again.";
const DETAILS_MISSING = "details_missing";
const DEED_FILE_NAME = "power-of-attorney.pdf";

const deedCopy = {
  download: "Download to sign",
  edit: "Edit your details",
  saveAndDownload: "Save and download",
  uploadSigned: "Upload the signed copy",
  preparing: "Preparing your deed",
} as const;

type PillKind = "waiting" | "uploaded" | "approved" | "rejected";

const PILL: Record<PillKind, { label: string; className: string }> = {
  waiting: { label: "Waiting for file", className: "bg-navy/5 text-navy-soft" },
  uploaded: { label: "Uploaded", className: "bg-gold/15 text-[#7A5A12]" },
  approved: { label: "Approved", className: "bg-navy text-white" },
  rejected: { label: "Rejected", className: "bg-clay/10 text-[#B52D25]" },
};

function pillFor(status: DocumentStatus | undefined): PillKind {
  if (status === "uploaded" || status === "approved" || status === "rejected") return status;
  return "waiting";
}

export function DocumentSlot({
  userServiceId,
  serviceDocId,
  applicantIndex,
  label,
  note,
  acceptedMime,
  maxBytes,
  current,
  template = null,
  applicant = null,
  applicantLabel,
}: Props) {
  const router = useRouter();
  const inputId = useId();
  const messageId = useId();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [details, setDetails] = useState<Details>(null);

  const deed = template !== null;
  const deedUrl = `/api/orders/${userServiceId}/poa/${serviceDocId}?applicant=${applicantIndex}`;
  const forWhom = applicantLabel ? ` (${applicantLabel})` : "";

  const busy =
    phase.kind === "preparing" || phase.kind === "requesting" || phase.kind === "uploading" || phase.kind === "confirming";

  /**
   * Fetches the deed and hands it to the browser as a download. A refusal
   * stays on the page: `details_missing` opens the details dialog, anything
   * else shows the route's one line. A session that lapsed meanwhile is
   * redirected by the route; the page follows it to login.
   */
  async function downloadDeed() {
    setPhase({ kind: "preparing" });
    let response: Response;
    try {
      response = await fetch(deedUrl, { headers: { Accept: "application/pdf" } });
    } catch {
      setPhase({ kind: "error", message: FALLBACK_ERROR });
      return;
    }
    if (response.redirected) {
      window.location.assign(response.url);
      return;
    }
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const error = data && typeof data.error === "string" ? data.error : FALLBACK_ERROR;
      if (response.status === 409 && error === DETAILS_MISSING) {
        setPhase({ kind: "idle" });
        setDetails("download");
      } else {
        setPhase({ kind: "error", message: error });
      }
      return;
    }
    try {
      const blob = await response.blob();
      saveBlob(blob, fileNameFrom(response.headers.get("content-disposition")) ?? DEED_FILE_NAME);
      setPhase({ kind: "idle" });
    } catch {
      setPhase({ kind: "error", message: FALLBACK_ERROR });
    }
  }

  function handleDownload() {
    if (applicant) void downloadDeed();
    else setDetails("download");
  }

  function handleSaved() {
    const follow = details;
    setDetails(null);
    router.refresh();
    if (follow === "download") void downloadDeed();
  }
  const pill = phase.kind === "done" ? "uploaded" : pillFor(current?.status);
  // A rejected file is replaced; a pending one is an upload that never
  // finished, and the server decides whether its slot is open again.
  const acceptsFile = !current || current.status === "rejected" || current.status === "pending";
  const showInput = acceptsFile && phase.kind !== "done";
  const viewable = current && current.status !== "pending";
  const fileName = phase.kind === "done" ? phase.fileName : current?.fileName;
  const percent = phase.kind === "uploading" ? phase.percent : phase.kind === "confirming" || phase.kind === "done" ? 100 : 0;

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be picked again after an error.
    event.target.value = "";
    if (!file) return;

    const mimeType = (file.type || mimeForFileName(file.name) || "").toLowerCase();
    if (!acceptedMime.includes(mimeType)) {
      setPhase({ kind: "error", message: acceptedTypesMessage(acceptedMime) });
      return;
    }
    if (file.size > maxBytes) {
      setPhase({ kind: "error", message: sizeLimitMessage(maxBytes) });
      return;
    }
    if (file.size === 0) {
      setPhase({ kind: "error", message: "This file is empty." });
      return;
    }

    try {
      setPhase({ kind: "requesting" });
      const ticket = await postJson<{ documentId: string; url: string }>("/api/documents/upload-url", {
        userServiceId,
        serviceDocId,
        applicantIndex,
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
      });

      setPhase({ kind: "uploading", percent: 0 });
      await putFile(ticket.url, file, mimeType, (p) => setPhase({ kind: "uploading", percent: p }));

      setPhase({ kind: "confirming" });
      await postJson<{ document: unknown }>("/api/documents/confirm", { documentId: ticket.documentId });

      setPhase({ kind: "done", fileName: file.name });
      router.refresh();
    } catch (error) {
      setPhase({ kind: "error", message: error instanceof Error ? error.message : FALLBACK_ERROR });
    }
  }

  const message =
    phase.kind === "error"
      ? phase.message
      : phase.kind === "preparing"
        ? deedCopy.preparing
        : phase.kind === "requesting"
          ? "Preparing"
          : phase.kind === "uploading"
            ? `Uploading ${phase.percent}%`
            : phase.kind === "confirming"
              ? "Checking"
              : phase.kind === "done"
                ? "Received"
                : "";

  return (
    <li
      className="rounded-lg border border-navy/10 bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6"
      aria-busy={busy || undefined}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg leading-snug text-navy">{label}</p>
          {note && <p className="mt-1 text-[0.85rem] leading-relaxed text-navy-muted">{note}</p>}
        </div>
        <span
          className={cn(
            "inline-flex h-7 shrink-0 items-center rounded-full px-3 text-[0.72rem] font-medium uppercase tracking-[0.14em]",
            PILL[pill].className,
          )}
        >
          {PILL[pill].label}
        </span>
      </div>

      {current?.status === "rejected" && phase.kind !== "done" && (
        <p className="mt-3 rounded-sm border border-clay/20 bg-clay/5 px-3.5 py-2.5 text-[0.88rem] leading-relaxed text-navy">
          {current.rejectionReason || "Please send this file again."}
        </p>
      )}

      {deed && showInput && (
        <div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            aria-label={`${deedCopy.download}: ${label}${forWhom}`}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-medium text-white transition-colors duration-200",
              "hover:bg-gold hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white",
              "disabled:cursor-wait disabled:opacity-50 disabled:hover:bg-navy disabled:hover:text-white",
            )}
          >
            <Download className="size-4" aria-hidden />
            {deedCopy.download}
          </button>
          {applicant && (
            <button
              type="button"
              onClick={() => setDetails("edit")}
              disabled={busy}
              aria-label={`${deedCopy.edit}: ${label}${forWhom}`}
              className="rounded-sm text-sm font-medium text-navy underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-wait disabled:opacity-50"
            >
              {deedCopy.edit}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
        {showInput && (
          <label
            htmlFor={inputId}
            className={cn(
              "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-navy/20 px-5 text-sm font-medium text-navy transition-colors duration-200",
              "hover:border-navy hover:bg-navy hover:text-white",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-white",
              busy && "cursor-wait opacity-50 hover:border-navy/20 hover:bg-transparent hover:text-navy",
            )}
          >
            <input
              id={inputId}
              type="file"
              accept={acceptedMime.join(",")}
              onChange={handleChange}
              disabled={busy}
              aria-describedby={messageId}
              className="sr-only"
            />
            <Upload className="size-4" aria-hidden />
            {current ? "Replace file" : deed ? deedCopy.uploadSigned : "Choose file"}
          </label>
        )}

        {fileName && (
          <span className="inline-flex min-w-0 max-w-full items-center gap-2 text-sm text-navy-soft">
            <FileText className="size-4 shrink-0 text-gold-dark" aria-hidden />
            <span className="truncate">{fileName}</span>
          </span>
        )}

        {viewable && (
          <a
            href={`/api/documents/${current.id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${label}`}
            className="rounded-sm text-sm font-medium text-navy underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            View
          </a>
        )}
      </div>

      <div
        className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-navy/5"
        role="progressbar"
        aria-label={`${label} upload`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-hidden={percent === 0 || undefined}
      >
        <div
          className="h-full bg-gold transition-[width] duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <p
        id={messageId}
        aria-live="polite"
        className={cn(
          "mt-2 min-h-5 text-[0.82rem] leading-5",
          phase.kind === "error" ? "text-clay" : "text-navy-muted",
        )}
      >
        {message}
      </p>

      {deed && details !== null && (
        <ApplicantDetailsForm
          userServiceId={userServiceId}
          applicantIndex={applicantIndex}
          initial={applicant}
          submitLabel={details === "download" ? deedCopy.saveAndDownload : undefined}
          onClose={() => setDetails(null)}
          onSaved={handleSaved}
        />
      )}
    </li>
  );
}

/** The quoted file name of a `Content-Disposition: attachment; filename="…"` header, or null. */
function fileNameFrom(header: string | null): string | null {
  const match = header ? /filename="([^"]+)"/i.exec(header) : null;
  return match ? match[1] : null;
}

/** Hands a blob to the browser as a download through a temporary link, then frees the object URL. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next tick: some browsers start the save after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** POST a JSON body and return the JSON reply, or throw with the server's one line message. */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(FALLBACK_ERROR);
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // no body
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : FALLBACK_ERROR;
    throw new Error(message);
  }
  return data as T;
}

/**
 * PUT the file to the presigned URL. XMLHttpRequest rather than fetch because
 * only XHR reports upload progress. Content-Type has to be exactly the type
 * the URL was signed for; the browser adds Content-Length itself.
 */
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
