/**
 * Shapes shared by the /en/apply wizard, the recommendation engine and, later,
 * the checkout route that will run the same engine on the server.
 *
 * Everything here is plain data. No DOM, no React, so `recommend()` can be unit
 * tested and reused server side without change.
 */

/** The four things the landing sells. Ids match `bankNif.pricing.cards[].id`. */
export type ProductId = "nif-only" | "bundle" | "bank-only" | "couple";

export const PRODUCT_IDS: readonly ProductId[] = [
  "nif-only",
  "bundle",
  "bank-only",
  "couple",
] as const;

export function isProductId(value: unknown): value is ProductId {
  return typeof value === "string" && (PRODUCT_IDS as readonly string[]).includes(value);
}

/** How many adults are on the order. "more" is a WhatsApp exit. */
export type Applicants = "one" | "two" | "more";

/**
 * Bank account choice. Singles answer yes/no; couples choose joint, separate
 * (WhatsApp exit) or none. Stored as one field so the engine reads one value.
 */
export type BankChoice = "yes" | "joint" | "separate" | "none";

/** Visa categories, mirroring the consulate's D1 to D9 list. */
export type Visa =
  | "d1"
  | "d2"
  | "d3"
  | "d4"
  | "d5"
  | "d6"
  | "d7"
  | "d8"
  | "d9"
  | "eu-family"
  | "none";

/**
 * Everything the wizard collects. Every field is optional because the object
 * is built one screen at a time and persisted between screens.
 *
 * Per person arrays are indexed 0 = you, 1 = your partner.
 */
export type Answers = {
  /** ISO 3166-1 alpha-2 of the country on the proof of address. */
  residence?: string;
  applicants?: Applicants;
  childrenNifs?: boolean;
  hasNif?: (boolean | undefined)[];
  bank?: BankChoice;
  /** ISO 3166-1 alpha-2 of each passport. */
  passport?: (string | undefined)[];
  visa?: Visa;
  /** Product the visitor clicked on the landing, if any. */
  preselected?: ProductId;
};

export type ExitReason = "portugal" | "too-many" | "separate-accounts" | "nothing-to-buy";

export type NoteId =
  | "childrenNifs"
  | "taxRepOptional"
  | "taxRepRequired"
  | "bankUnlikely"
  | "nationalityUnsupported";

export type Recommendation =
  | {
      kind: "product";
      product: ProductId;
      quantity: 1 | 2;
      totalCents: number;
      /** True when the account on the order is a joint account. */
      joint: boolean;
      /** Products the visitor could buy with these answers, best first. */
      valid: ProductId[];
      /** Keys into the "Why this one" copy. */
      reasons: ReasonId[];
      notes: NoteId[];
      /** The landing's preselection, kept only when it is a valid alternative. */
      preselected?: ProductId;
    }
  | {
      kind: "exit";
      exit: ExitReason;
      notes: NoteId[];
    };

export type ReasonId =
  | "needsNif"
  | "partnerNeedsNif"
  | "bothNeedNif"
  | "hasNif"
  | "bothHaveNif"
  | "wantsAccount"
  | "wantsJointAccount"
  | "noAccount"
  | "sequenced";
