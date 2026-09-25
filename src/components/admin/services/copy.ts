/**
 * Every line the services screens show Patrícia: the editor, its three
 * repeatable lists and the services table. Kept apart from the components so
 * copy.test.ts can hold all of it to the house rules and keep developer
 * words (scripts, slugs, kebab or snake case, the wizard) off the screen.
 *
 * The field level validation messages live next to the rules that raise
 * them, in `messages` of ./editor-model.ts; the same test reads those too.
 *
 * Admin UI stays English. House rules: short sentences, no dashes used as
 * punctuation, none of the banned words listed in src/content/bank-nif.ts.
 */

import type { DocTemplate } from "@/lib/db/types";

import { FIRST_STAGE_KEY, MAX_DOC_MB } from "./editor-model";

/** The service editor (./service-editor.tsx). */
export const editorCopy = {
  newTitle: "New service",
  editTitle: "Edit service",
  back: "All services",
  basics: {
    title: "Service",
    intro: "What the client sees on the Services page of their account, at checkout and on their dashboard.",
  },
  name: "Name",
  slug: "Short code",
  slugHint: "A short fixed name, for example nif-only. Lower case letters, numbers and hyphens. It follows the name until you change it.",
  slugLockedHint: "The application form sells this service under this code, so it stays as it is.",
  priceHint: "Changing the price here does not change what Stripe charges. A new price needs a new Stripe price id below.",
  priceLockedHint: "The landing page and the application form show this price, so it changes with a site update, not here.",
  tagline: "Tagline",
  description: "Description",
  descriptionHint: "For the team. Clients do not see it. Stripe keeps its own product description.",
  price: "Price (euros)",
  currency: "Currency",
  position: "Position",
  positionHint: "Order on the client's Services page, lowest first.",
  timeline: "Timeline",
  timelineHint: "One line, for example NIF in 3 to 5 business days.",
  contract: "Service contract",
  contractNone: "None",
  contractHint:
    "The agreement the client confirms their details for and receives right after paying. The Couple package agreement names both people, so it waits for the partner's details too. With None, nothing is prepared or asked.",
  includes: "Includes",
  includesHint: "One item per line. Put two asterisks on each side of words to show them in bold, for example **included**.",
  stripe: {
    title: "Stripe",
    intro:
      "To find a price id in Stripe, open Product catalog, click the product, then click its price and copy the id that starts with price_. Test mode and live mode each have their own.",
  },
  priceIdTest: "Stripe price id (test)",
  priceIdTestHint: "Copied with Stripe in test mode. Used for trial payments.",
  priceIdLive: "Stripe price id (live)",
  priceIdLiveHint: "Copied with Stripe in live mode. Used for real payments.",
  linkTest: "Stripe payment link (test)",
  linkLive: "Stripe payment link (live)",
  linkHint: "Optional backup, used only when the price id is empty. Starts with https://buy.stripe.com.",
  status: {
    active: "Active",
    inactive: "Inactive",
    activeHint: "Shown on the client's Services page and in the application form.",
    inactiveHint: "Hidden from the client's Services page and the application form. Orders keep their history.",
    deactivate: "Deactivate",
    reactivate: "Reactivate",
    confirmTitle: "Deactivate this service?",
    confirmBody:
      "It disappears from the Services page and the application form at once. Existing orders keep their history. Unsaved edits on this page are not included.",
    confirm: "Yes, deactivate",
    cancel: "Keep it active",
  },
  save: "Save service",
  create: "Create service",
  saving: "Saving",
  fixFields: "Check the highlighted fields.",
  genericError: "Something went wrong on our side.",
} as const;

/** The stages, documents and deliverables lists (./config-lists.tsx). */
export const listsCopy = {
  stages: {
    title: "Lifecycle stages",
    intro: `The order moves through these in position order. The first is always Awaiting payment, with the code ${FIRST_STAGE_KEY}. Mark the last one as final.`,
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
  key: "Code",
  keyHint: "A short fixed name, for example proof_of_address. Lower case letters, numbers and underscores. It follows the label until you change it.",
  keySavedHint: "Saved codes stay fixed. A new code would add a new item, not rename this one.",
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
  requiredHint: "Counted in the Documents column of the orders list.",
  template: "Document to sign",
  templateHint:
    "The client downloads it, signs it by hand and uploads the signed copy into this slot. A power of attorney is filled with their passport details. The service agreement is the order's own.",
  templateNone: "None",
  templates: {
    poa_nif: "Power of attorney (NIF)",
    poa_bank: "Power of attorney (bank account)",
    agreement: "Signed service agreement",
  } satisfies Record<DocTemplate, string>,
  kind: "Kind",
  kinds: { document: "Document", report: "Report" },
  remove: "Remove",
} as const;

/** The services table (./service-table.tsx). */
export const tableCopy = {
  name: "Service",
  slug: "Code",
  price: "Price",
  status: "Status",
  orders: "Orders",
  stages: "Stages",
  docs: "Documents",
  edit: "Edit",
  empty: "No services yet. Create the first one.",
  agreement: "Agreement",
  oneDeed: "1 deed",
  deeds: "deeds",
} as const;
