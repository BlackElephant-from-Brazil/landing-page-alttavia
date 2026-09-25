import type { DocumentStatus } from "@/lib/db/types";
import { DOCUMENTS_STAGE } from "@/lib/documents/stage";
import { isAgreementTemplate } from "@/lib/documents/templates";

/**
 * Which controls a document slot shows, decided once from what the slot
 * knows, so the rule can be read and tested apart from the component
 * (document-slot.tsx) that draws it.
 *
 *   paper              what the client signs before sending: nothing, a deed
 *                      this slot generates, or the order's service agreement
 *   changeable         a file waiting for review that may be replaced or removed
 *   showInput          the file input is there
 *   awaitingAgreement  the signed agreement slot, open, with no agreement to
 *                      sign yet: it says where to start instead of taking a file
 *   uploadLabel        the words on the file input
 *
 * Files are sent while the order sits on the documents stage and only then;
 * an approved file is final. The signed agreement slot (0013) adds one rule:
 * it takes no file before the agreement exists, since there is nothing to
 * sign yet.
 */

export type SlotPaper = "none" | "deed" | "agreement";

export type SlotControls = {
  paper: SlotPaper;
  changeable: boolean;
  showInput: boolean;
  awaitingAgreement: boolean;
  uploadLabel: string;
};

export const UPLOAD_LABELS = {
  choose: "Choose file",
  replace: "Replace file",
  signed: "Upload the signed copy",
} as const;

export function slotControls(input: {
  template: string | null;
  /** The order's service agreement has been prepared. Read by the agreement slot only. */
  contractReady: boolean;
  orderStage: string;
  /** The status of the upload the slot shows, if any. */
  status: DocumentStatus | undefined;
  /** An upload just finished on this slot, before the page refreshed. */
  finished: boolean;
}): SlotControls {
  const paper: SlotPaper = isAgreementTemplate(input.template) ? "agreement" : input.template !== null ? "deed" : "none";
  const open = input.orderStage === DOCUMENTS_STAGE;
  const changeable = open && input.status === "uploaded";
  const acceptsFile = open && input.status !== "approved" && !input.finished;
  const awaitingAgreement = paper === "agreement" && !input.contractReady && acceptsFile;

  return {
    paper,
    changeable,
    showInput: acceptsFile && !awaitingAgreement,
    awaitingAgreement,
    // "Replace file" belongs to a file waiting for review. A slot the client
    // signs keeps its own wording while it waits for the signed copy,
    // rejected or not, and an upload that never finished is not a file to
    // replace.
    uploadLabel: changeable ? UPLOAD_LABELS.replace : paper === "none" ? UPLOAD_LABELS.choose : UPLOAD_LABELS.signed,
  };
}
