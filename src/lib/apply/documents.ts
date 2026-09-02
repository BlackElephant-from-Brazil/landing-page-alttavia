import { includesBank, includesNif } from "./recommend";
import type { Answers, ProductId } from "./types";

/**
 * What the client has to send after paying, and what we have to ask them.
 *
 * The lists come from the firm and from the partner bank's own account opening
 * checklist for non resident foreign clients. They are requirements set by
 * Finanças and by the bank, not by us, so do not soften or trim an entry
 * without asking the firm first.
 *
 * Two details that look like copy but are not:
 *   - the NIF proof of address must be dated within 3 months, the bank's within
 *     6, so the same utility bill can satisfy one and fail the other;
 *   - the passport scan for the NIF has to show all four corners of the page.
 */

export type DocumentGroup = "identity" | "tax" | "address" | "employment" | "funds";

export type RequiredDocument = {
  id: string;
  group: DocumentGroup;
  /** What the client sees. */
  label: string;
  /** The condition or format the authority imposes, when there is one. */
  note?: string;
  /** True when it is needed from every applicant, not only the main one. */
  perApplicant: boolean;
};

/** Employment situation decides which proof of profession the bank accepts. */
export type EmploymentStatus = "employed" | "self-employed";

/** Documents Finanças requires to issue a NIF. */
export const NIF_DOCUMENTS: readonly RequiredDocument[] = [
  {
    id: "nif-passport",
    group: "identity",
    label: "Passport",
    note: "Photograph of the full page with all four corners visible.",
    perApplicant: true,
  },
  {
    id: "nif-address",
    group: "address",
    label: "Proof of address",
    note: "Utility bill, bank statement, landline, water, electricity or waste, issued within the last 3 months.",
    perApplicant: true,
  },
];

/** Documents the partner bank requires to open an account for a non resident. */
export const BANK_DOCUMENTS: readonly RequiredDocument[] = [
  {
    id: "bank-passport",
    group: "identity",
    label: "Passport",
    perApplicant: true,
  },
  {
    id: "bank-nif-pt",
    group: "tax",
    label: "Portuguese tax identification number",
    note: "Issued by the Portuguese tax administration. We supply it when the NIF is part of your order.",
    perApplicant: true,
  },
  {
    id: "bank-nif-origin",
    group: "tax",
    label: "Tax identification number from your country",
    note: "Issued by the tax authority where you live.",
    perApplicant: true,
  },
  {
    id: "bank-address",
    group: "address",
    label: "Proof of address",
    note: "Domestic bill issued within the last 6 months, for example water, electricity or telephone.",
    perApplicant: true,
  },
  {
    id: "bank-funds",
    group: "funds",
    label: "Bank statements or annual income statement",
    note: "The last 3 months of statements, or your annual income statement.",
    perApplicant: true,
  },
];

/** Proof of profession, which differs by employment situation. */
export const EMPLOYMENT_DOCUMENTS: Record<EmploymentStatus, readonly RequiredDocument[]> = {
  employed: [
    {
      id: "bank-employer-statement",
      group: "employment",
      label: "Employer statement or pay slip",
      note: "A statement on company letterhead attesting your profession, stamped and signed by HR, or a pay slip issued within the last 6 months.",
      perApplicant: true,
    },
  ],
  "self-employed": [
    {
      id: "bank-commercial-register",
      group: "employment",
      label: "Commercial register excerpt",
      note: "Or an equivalent public certificate.",
      perApplicant: true,
    },
    {
      id: "bank-tax-return",
      group: "employment",
      label: "Annual tax return",
      note: "Validated by the tax authorities.",
      perApplicant: true,
    },
    {
      id: "bank-proof-services",
      group: "employment",
      label: "Proof of services provided",
      note: "You may name yourself or an entity you invoice as the employer, for example your own receipts.",
      perApplicant: true,
    },
  ],
};

/**
 * Facts the bank needs in writing that are not documents. Collected as form
 * fields, not uploads.
 */
export const BANK_QUESTIONS = [
  { id: "parents-names", label: "Parents' names" },
  { id: "marital-status", label: "Marital status" },
  {
    id: "political-exposure",
    label: "Do you hold, or have you held, a political or public position?",
  },
  { id: "contacts", label: "Telephone and email" },
  { id: "account-purpose", label: "What the account will be used for" },
  {
    id: "funds-origin",
    label: "Origin of the funds that will be transferred",
    note: "Name of the bank and of the remitter.",
  },
] as const;

/**
 * The full checklist for an order.
 *
 * A bank account always needs the NIF papers too, because the bank asks for
 * the Portuguese tax number, so the identity and address documents are shared
 * rather than requested twice.
 */
export function requiredDocuments(
  product: ProductId,
  employment: EmploymentStatus = "employed",
): RequiredDocument[] {
  const documents: RequiredDocument[] = [];
  const seen = new Set<string>();

  const add = (list: readonly RequiredDocument[]) => {
    for (const doc of list) {
      const key = `${doc.group}:${doc.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      documents.push(doc);
    }
  };

  if (includesBank(product)) {
    add(BANK_DOCUMENTS);
    add(EMPLOYMENT_DOCUMENTS[employment]);
  }
  if (includesNif(product)) add(NIF_DOCUMENTS);

  return documents;
}

/** True when the order needs the bank's written questions answered. */
export function needsBankQuestions(product: ProductId): boolean {
  return includesBank(product);
}

/** How many people have to supply each per applicant document. */
export function applicantCount(answers: Answers): 1 | 2 {
  return answers.applicants === "two" ? 2 : 1;
}
