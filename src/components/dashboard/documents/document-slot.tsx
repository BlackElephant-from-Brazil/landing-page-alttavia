"use client";

import { useRouter } from "next/navigation";
import { Download, FileText, Upload } from "lucide-react";
import { useId, useState, type ChangeEvent } from "react";

import { cn } from "@/lib/cn";
import type { DocumentStatus, UserServiceApplicantRow } from "@/lib/db/types";
import type { DocTemplate } from "@/lib/documents/templates";
import { UPLOAD_FAILED, readFileBytes, sendBytes } from "@/lib/documents/upload-client";
import { jointDeedMissing } from "@/lib/poa/joint";
import { acceptedTypesMessage, mimeForFileName, sizeLimitMessage } from "@/lib/r2/keys";

import { ApplicantDetailsForm } from "./applicant-details-form";
import { slotControls } from "./slot-controls";

/**
 * One document slot on the dashboard: the label and note from `service_docs`,
 * a status pill, and a file input when the slot still accepts a file.
 *
 * The upload is four steps, all from here: the file's bytes are read in the
 * browser first, so a file it cannot read fails before any row exists; then
 * POST /api/documents/upload-url for a presigned URL; then those bytes go to
 * the bucket, or, when that request does not arrive, to
 * POST /api/documents/upload on our own origin, which writes them and
 * finishes the upload itself; then POST /api/documents/confirm, only when the
 * bucket took the file. The mechanics live in src/lib/documents/upload-client.ts.
 * On success the page refreshes and the server passes the new row back as
 * `current`; the parent keys this component on that row, so a fresh slot
 * mounts clean.
 *
 * The slot only takes a file while the order sits on the documents stage.
 * There, a file that is still waiting for review can be changed: "Replace
 * file" runs the same upload again and the older file is dropped once the new
 * one is confirmed, and "Remove" asks once and then calls
 * DELETE /api/documents/[id]. An approved file cannot be changed, and once
 * the order has moved on nothing can: an empty or rejected slot closes with
 * the rest, which is what the routes answer as well.
 *
 * A deed slot (`template` set) adds a row above the upload control: the
 * primary "Download to sign", a line about the signature, and, once the
 * principal's details exist, a quiet "Edit your details". Download with no
 * `applicant` row opens the details dialog first and starts the download once
 * they are saved; with a row it fetches /api/orders/[id]/poa/[docId] and
 * hands the PDF to the browser through a temporary download link, so the page
 * stays and a JSON refusal never replaces it: 409 `details_missing` opens the
 * dialog, any other refusal shows its one line in the message line. The
 * signed copy then goes through the same upload as any other slot, labelled
 * "Upload the signed copy". Contract (docs/documents-contract.md) section 3,
 * "Client UI".
 *
 * The signed agreement slot (`template` 'agreement', 0013) works the same
 * way with the order's service agreement instead of a deed (Patrícia's
 * answer of 2026-09-24): "Download to sign" is a link that opens
 * GET /api/orders/[id]/contract in a new tab, the PDF inline, so there is
 * no details dialog and no "Edit your details" here; the details belong to
 * the agreement card above the list. Until that card has prepared the
 * agreement (`contractReady`, a boolean the order view derives from its
 * contract row) the slot takes no file and says where to start instead.
 * The signature line is the deeds' one; on a couple order, where the slot
 * is one paper for both, it asks both of them to sign.
 *
 * The couple's joint bank deed (`joint`, isJointDeed in src/lib/poa/joint.ts,
 * migration 0016) is one deed naming both people, in one slot under "For both
 * of you". "Download to sign" fetches the deed without `?applicant` and needs
 * both sets of details: the slot opens the details dialog for the first
 * person missing (the account holder, then the partner, `partner` being
 * applicant 1's row) and downloads once both are saved; a 409
 * `details_missing` names the person in `applicant` and opens that one's
 * dialog. Each saved set gets its own "Edit" button, and the line under the
 * button asks both of them to sign.
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
  /** The order's stage: a file may only be replaced or removed on the documents stage. */
  orderStage: string;
  /**
   * Set on a slot the client signs before sending: a deed this slot
   * generates ('poa_nif', 'poa_bank'), or the order's service agreement
   * ('agreement').
   */
  template?: DocTemplate | null;
  /** The principal's details entered for this slot's applicant, when they exist. */
  applicant?: UserServiceApplicantRow | null;
  /** "You" or "Your partner" on a couple order, for the buttons' accessible names. */
  applicantLabel?: string;
  /** On the signed agreement slot: the order's agreement has been prepared and can be opened. */
  contractReady?: boolean;
  /** On the signed agreement slot of a couple order: one paper, both of them sign it. */
  bothSign?: boolean;
  /** The couple's joint bank deed: one deed naming both people, downloaded without `?applicant`. */
  joint?: boolean;
  /** Joint deed only: applicant 1's details on this order, when they exist. */
  partner?: UserServiceApplicantRow | null;
};

/**
 * Which dialog is open, for whom, and what follows a save: a download, or
 * only a refresh. `person` is the slot's own applicant, except on the joint
 * deed, which asks for both.
 */
type Details = { follow: "download" | "edit"; person: 0 | 1 } | null;

type Phase =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "requesting" }
  | { kind: "uploading"; percent: number }
  | { kind: "sending"; percent: number }
  | { kind: "confirming" }
  | { kind: "removing" }
  | { kind: "done"; fileName: string }
  | { kind: "error"; message: string };

const FALLBACK_ERROR = "Something did not work. Try again.";
const DETAILS_MISSING = "details_missing";
const DEED_FILE_NAME = "power-of-attorney.pdf";

const deedCopy = {
  download: "Download to sign",
  signature: "Sign exactly as you signed your passport.",
  edit: "Edit your details",
  editPartner: "Edit your partner's details",
  saveAndDownload: "Save and download",
  preparing: "Preparing your deed",
} as const;

const agreementCopy = {
  waiting: "Confirm your details first, above, and your agreement appears here.",
  newTab: "opens in a new tab",
} as const;

/** One paper both people sign: the couple's signed agreement and its joint bank deed. */
const SIGNATURE_BOTH = "Both of you sign it, each exactly as you signed your own passport.";

const primaryActionClass = cn(
  "inline-flex h-11 items-center gap-2 rounded-full bg-navy px-5 text-sm font-medium text-white transition-colors duration-200",
  "hover:bg-gold hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "disabled:cursor-wait disabled:opacity-50 disabled:hover:bg-navy disabled:hover:text-white",
);

// The file input's own words ("Choose file", "Replace file", "Upload the
// signed copy") live with the rule that picks them, in ./slot-controls.ts.
const changeCopy = {
  remove: "Remove",
  confirm: "Remove this file?",
  yes: "Yes, remove",
  cancel: "Cancel",
  removing: "Removing",
  sending: "Sending through our server",
} as const;

type PillKind = "waiting" | "uploaded" | "approved" | "rejected";

const PILL: Record<PillKind, { label: string; className: string }> = {
  waiting: { label: "Waiting for file", className: "bg-navy/5 text-navy-soft" },
  uploaded: { label: "Uploaded", className: "bg-gold/15 text-[#7A5A12]" },
  approved: { label: "Approved", className: "bg-navy text-white" },
  rejected: { label: "Rejected", className: "bg-clay/10 text-[#B52D25]" },
};

const quietActionClass =
  "rounded-sm text-sm font-medium text-navy underline-offset-4 transition-colors duration-200 hover:text-gold-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-wait disabled:opacity-50";

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
  orderStage,
  template = null,
  applicant = null,
  applicantLabel,
  contractReady = false,
  bothSign = false,
  joint = false,
  partner = null,
}: Props) {
  const router = useRouter();
  const inputId = useId();
  const messageId = useId();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [details, setDetails] = useState<Details>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  /** Joint deed: the rows the dialogs saved on this mount, newer than the props until the refresh lands. */
  const [savedFirst, setSavedFirst] = useState<UserServiceApplicantRow | null>(null);
  const [savedPartner, setSavedPartner] = useState<UserServiceApplicantRow | null>(null);

  // Files are sent while the order sits on the documents stage, and only
  // then: an empty or rejected slot closes with the rest once the order moves
  // on, which is the rule the routes answer to as well. A rejected file is
  // replaced; a pending one is an upload that never finished, and the server
  // takes its row over. The signed agreement slot also waits for the
  // agreement itself. The whole rule is ./slot-controls.ts.
  const { paper, changeable, showInput, awaitingAgreement, uploadLabel } = slotControls({
    template,
    contractReady,
    orderStage,
    status: current?.status,
    finished: phase.kind === "done",
  });
  // Two kinds of paper the client signs by hand: a deed this slot generates,
  // and the order's service agreement, which the agreement card prepares.
  const agreement = paper === "agreement";
  const deed = paper === "deed";
  const jointDeed = deed && joint;
  // The joint deed names both people whatever `?applicant` says, so it is asked for without one.
  const deedUrl = jointDeed
    ? `/api/orders/${userServiceId}/poa/${serviceDocId}`
    : `/api/orders/${userServiceId}/poa/${serviceDocId}?applicant=${applicantIndex}`;
  const first = savedFirst ?? applicant;
  const second = savedPartner ?? partner;
  const agreementUrl = `/api/orders/${userServiceId}/contract`;
  const forWhom = applicantLabel ? ` (${applicantLabel})` : "";

  const busy =
    phase.kind === "preparing" ||
    phase.kind === "requesting" ||
    phase.kind === "uploading" ||
    phase.kind === "sending" ||
    phase.kind === "confirming" ||
    phase.kind === "removing";

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
      const data = (await response.json().catch(() => null)) as { error?: unknown; applicant?: unknown } | null;
      const error = data && typeof data.error === "string" ? data.error : FALLBACK_ERROR;
      if (response.status === 409 && error === DETAILS_MISSING) {
        setPhase({ kind: "idle" });
        // The route names whose details it is missing; only the joint deed can name the partner.
        const person = jointDeed ? (data?.applicant === 1 ? 1 : 0) : applicantIndex;
        setDetails({ follow: "download", person });
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
    if (jointDeed) {
      const missing = jointDeedMissing(first, second);
      if (missing === null) void downloadDeed();
      else setDetails({ follow: "download", person: missing });
      return;
    }
    if (applicant) void downloadDeed();
    else setDetails({ follow: "download", person: applicantIndex });
  }

  function handleSaved(row: UserServiceApplicantRow) {
    const open = details;
    setDetails(null);
    router.refresh();
    if (!open) return;
    if (jointDeed) {
      if (open.person === 0) setSavedFirst(row);
      else setSavedPartner(row);
    }
    if (open.follow !== "download") return;
    if (jointDeed) {
      // Both people sign the one deed: after the first set, the partner's, then the download.
      const missing = jointDeedMissing(open.person === 0 ? row : first, open.person === 1 ? row : second);
      if (missing !== null) {
        setDetails({ follow: "download", person: missing });
        return;
      }
    }
    void downloadDeed();
  }
  const pill = phase.kind === "done" ? "uploaded" : pillFor(current?.status);
  const signatureLine = (agreement && bothSign) || jointDeed ? SIGNATURE_BOTH : deedCopy.signature;
  const viewable = current && current.status !== "pending";
  const fileName = phase.kind === "done" ? phase.fileName : current?.fileName;
  const percent =
    phase.kind === "uploading" || phase.kind === "sending"
      ? phase.percent
      : phase.kind === "confirming" || phase.kind === "done"
        ? 100
        : 0;

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be picked again after an error.
    event.target.value = "";
    if (!file) return;
    setConfirmRemove(false);

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
      // Read the file before anything else: a file the browser cannot read
      // (moved, renamed or synced away since the picker listed it) fails here,
      // with no row left behind waiting for bytes that will never come.
      setPhase({ kind: "requesting" });
      const bytes = await readFileBytes(file);

      const ticket = await postJson<{ documentId: string; url: string }>("/api/documents/upload-url", {
        userServiceId,
        serviceDocId,
        applicantIndex,
        fileName: file.name,
        mimeType,
        sizeBytes: bytes.byteLength,
      });

      setPhase({ kind: "uploading", percent: 0 });
      const sent = await sendBytes({
        url: ticket.url,
        fallbackUrl: `/api/documents/upload?documentId=${encodeURIComponent(ticket.documentId)}`,
        bytes,
        mimeType,
        maxBytes,
        onProgress: (p) =>
          setPhase((now) => (now.kind === "sending" ? { kind: "sending", percent: p } : { kind: "uploading", percent: p })),
        onFallback: () => setPhase({ kind: "sending", percent: 0 }),
      });

      if (sent.via === "bucket") {
        setPhase({ kind: "confirming" });
        await postJson<{ document: unknown }>("/api/documents/confirm", { documentId: ticket.documentId });
      }

      setPhase({ kind: "done", fileName: file.name });
      router.refresh();
    } catch (error) {
      setPhase({ kind: "error", message: error instanceof Error && error.message ? error.message : UPLOAD_FAILED });
    }
  }

  async function handleRemove() {
    if (!current) return;
    setConfirmRemove(false);
    setPhase({ kind: "removing" });
    try {
      await sendDelete(`/api/documents/${current.id}`);
      setPhase({ kind: "idle" });
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
            : phase.kind === "sending"
              ? changeCopy.sending
              : phase.kind === "confirming"
                ? "Checking"
                : phase.kind === "removing"
                  ? changeCopy.removing
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

      {agreement && showInput && (
        <div className="mt-4">
          <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
            {/* A link, not a fetch: the route streams the PDF inline, so the
                new tab shows the agreement at our own URL and the browser's
                viewer saves or prints it. */}
            <a
              href={agreementUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${deedCopy.download}: ${label}, ${agreementCopy.newTab}`}
              className={primaryActionClass}
            >
              <Download className="size-4" aria-hidden />
              {deedCopy.download}
            </a>
          </div>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-navy-soft">{signatureLine}</p>
        </div>
      )}

      {deed && showInput && (
        <div className="mt-4">
          <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={busy}
              aria-label={`${deedCopy.download}: ${label}${forWhom}`}
              className={primaryActionClass}
            >
              <Download className="size-4" aria-hidden />
              {deedCopy.download}
            </button>
            {(jointDeed ? first : applicant) && (
              <button
                type="button"
                onClick={() => setDetails({ follow: "edit", person: jointDeed ? 0 : applicantIndex })}
                disabled={busy}
                aria-label={`${deedCopy.edit}: ${label}${forWhom}`}
                className={quietActionClass}
              >
                {deedCopy.edit}
              </button>
            )}
            {jointDeed && second && (
              <button
                type="button"
                onClick={() => setDetails({ follow: "edit", person: 1 })}
                disabled={busy}
                aria-label={`${deedCopy.editPartner}: ${label}`}
                className={quietActionClass}
              >
                {deedCopy.editPartner}
              </button>
            )}
          </div>
          <p className="mt-2 text-[0.85rem] leading-relaxed text-navy-soft">{signatureLine}</p>
        </div>
      )}

      <div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2">
        {awaitingAgreement && (
          <p className="text-[0.85rem] leading-relaxed text-navy-soft">{agreementCopy.waiting}</p>
        )}

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
            {uploadLabel}
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

        {changeable &&
          phase.kind !== "done" &&
          (confirmRemove ? (
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy">
              {changeCopy.confirm}
              <button type="button" onClick={handleRemove} disabled={busy} className={quietActionClass}>
                {changeCopy.yes}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                disabled={busy}
                className="rounded-sm text-sm text-navy-muted underline-offset-4 transition-colors duration-200 hover:text-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-wait disabled:opacity-50"
              >
                {changeCopy.cancel}
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              disabled={busy}
              aria-label={`${changeCopy.remove}: ${label}${forWhom}`}
              className={quietActionClass}
            >
              {changeCopy.remove}
            </button>
          ))}
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
          // Keyed on the person: on the joint deed the partner's dialog follows
          // the first one's and must mount fresh, with its own fields.
          key={details.person}
          userServiceId={userServiceId}
          applicantIndex={details.person}
          initial={jointDeed ? (details.person === 1 ? second : first) : applicant}
          submitLabel={details.follow === "download" ? deedCopy.saveAndDownload : undefined}
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

/** DELETE one path, or throw with the server's one line message. */
async function sendDelete(path: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(path, { method: "DELETE" });
  } catch {
    throw new Error(FALLBACK_ERROR);
  }
  if (response.ok) return;
  const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
  throw new Error(data && typeof data.error === "string" ? data.error : FALLBACK_ERROR);
}
