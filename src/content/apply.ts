/**
 * Copy for the /en/apply wizard: the screens that qualify a visitor and pick
 * the right product for them before checkout.
 *
 * Same house rules as bank-nif.ts, and they apply to validation messages and
 * aria labels too:
 *
 *   1. No dashes as punctuation. Ranges spelled out, middot between fragments.
 *      Hyphens inside proper nouns (Guinea-Bissau) are fine.
 *   2. Never say the company is run or managed by lawyers.
 *   3. The words "problem" and "trap" do not appear.
 *   4. No money back promise, no "free", no refund wording.
 *   5. No VAT or IVA next to a price.
 *   6. No video call. The visitor writes on WhatsApp or pays and uploads.
 *   7. Short. One question per screen, one sentence of help at most.
 *
 * Prices and times are read from bank-nif.ts so the wizard can never disagree
 * with the landing. Emphasis uses **bold** rendered by <RichText />.
 */

import {
  bankNif,
  CHECKOUT_LINKS,
  CONTACT,
  formatEuro,
  PRICES,
  TIMES,
  TIMING_DISCLAIMER,
} from "@/content/bank-nif";
import { countryByCode } from "@/lib/apply/countries";
import { includesBank, includesNif } from "@/lib/apply/recommend";
import type {
  Answers,
  Applicants,
  BankChoice,
  ExitReason,
  NoteId,
  ProductId,
  ReasonId,
  Recommendation,
  Visa,
} from "@/lib/apply/types";

/** Where the landing sends people. The four cards carry their product. */
export const APPLY_PATH = "/en/apply";

export const applyCopy = {
  meta: {
    title: "Start my application",
    description: "Six quick questions, then the right NIF or bank account package for you.",
  },

  chrome: {
    back: "Back to the page",
    backAria: "Back to the main page",
  },

  nav: {
    back: "Back",
    next: "Continue",
    showResult: "See my package",
    step: (current: number, total: number) => `Step ${current} of ${total}`,
  },

  intro: {
    eyebrow: "Start my application",
    lead: "A few questions so we recommend the right package. No account to create, nothing to upload yet.",
  },

  steps: {
    residence: {
      heading: "Where is the address on your proof of address?",
      help: "The country on the bank statement or utility bill you will upload after payment.",
      label: "Country",
      placeholder: "Choose a country",
    },
    who: {
      heading: "Who is applying?",
      options: {
        one: { label: "Just me", hint: "One NIF, one account" },
        two: { label: "Me and my partner", hint: "Two NIFs, or a joint account" },
        more: { label: "More than two of us", hint: "We quote families and groups on WhatsApp" },
      } satisfies Record<Applicants, { label: string; hint: string }>,
      children: "Also NIFs for children",
      childrenHint: "Children's NIFs are quoted on request after the adults' order.",
    },
    hasNif: {
      heading: "Do you already have a Portuguese NIF?",
      headingCouple: "Does each of you already have a Portuguese NIF?",
      help: "A NIF is the nine digit Portuguese tax number. If you are not sure, you do not have one.",
      person: ["You", "Your partner"],
      yes: "Yes, I have one",
      no: "Not yet",
      yesPartner: "Yes",
      noPartner: "Not yet",
    },
    bank: {
      heading: "Do you need a Portuguese bank account?",
      help: `Needed for the D7 proof of funds. Opened with **Novo Banco** in ${TIMES.bank}.`,
      options: {
        yes: { label: "Yes, open one for me", hint: `IBAN, debit card and online banking in ${TIMES.bank}` },
        joint: { label: "A joint account for both of us", hint: "One account, two holders" },
        separate: { label: "Two separate accounts", hint: "We quote separate accounts on WhatsApp" },
        none: { label: "No account, just the NIF", hint: "You can add an account later" },
      } satisfies Record<BankChoice, { label: string; hint: string }>,
    },
    passport: {
      heading: "Which passport will you apply with?",
      headingCouple: "Which passports will you apply with?",
      help: "The bank's rules depend on nationality. We tell you now if yours is one we cannot serve.",
      person: ["Your passport", "Your partner's passport"],
      placeholder: "Choose a country",
    },
    visa: {
      heading: "Which visa are you applying for, or already hold?",
      help: "The bank asks for proof that a visa process is under way before it opens a file.",
      label: "Visa",
      placeholder: "Choose a visa",
      options: {
        d7: "D7 · Passive income",
        d8: "D8 · Digital nomad",
        d2: "D2 · Entrepreneur",
        d9: "D9 · Golden Visa",
        d1: "D1 · Work",
        d3: "D3 · Highly qualified worker",
        d4: "D4 · Student",
        d5: "D5 · Mobile student",
        d6: "D6 · Family reunification",
        "eu-family": "Family member of an EU citizen",
        none: "Not applying for a visa",
      } satisfies Record<Visa, string>,
    },
  },

  result: {
    eyebrow: "Your package",
    heading: "Here is what fits your answers.",
    whyTitle: "Why this one",
    totalLabel: "Total",
    cta: (total: string) => `Pay ${total} and start`,
    ctaHint: "Secure payment through Stripe. You upload your two documents right after, and that is the last thing we need from you.",
    /** Orders a Payment Link cannot take yet, so they go to WhatsApp instead. */
    ctaManual: (total: string) => `Order on WhatsApp · ${total}`,
    ctaManualHint: "Two NIFs on one order are arranged by message. We reply with a payment link the same business day.",
    docsTitle: "Have ready after payment",
    docs: {
      nif: ["Passport", "Proof of address"],
      bank: ["Proof of income or source of funds"],
      partner: "The same for your partner",
    },
    alternativesTitle: "Other options that fit your answers",
    divergence: (picked: string, better: string) =>
      `You picked **${picked}**. Based on your answers, **${better}** fits better.`,
    keepPicked: (picked: string, price: string) => `Keep ${picked} · ${price}`,
    footnote: TIMING_DISCLAIMER,
    startOver: "Start over",
  },

  exits: {
    portugal: {
      heading: "This page is for people who have not moved yet.",
      body: "If your proof of address is already Portuguese, the process is different and usually simpler. Write to us and we point you to the right one.",
      cta: "Write to us on WhatsApp",
      message: "Hi, my proof of address is already in Portugal. Which NIF or bank account process applies to me?",
    },
    "too-many": {
      heading: "Families and groups are quoted by hand.",
      body: "Three or more adults, or a family with children, get one quote with every NIF and account sequenced correctly. Tell us who is moving and we reply the same business day.",
      cta: "Get a quote on WhatsApp",
      message: "Hi, we are more than two adults moving to Portugal and need NIFs and a bank account. Could you quote us?",
    },
    "separate-accounts": {
      heading: "Two separate accounts are quoted by hand.",
      body: "The bank opens each account as its own file. Tell us whether either of you already holds a NIF and we send one quote for both.",
      cta: "Get a quote on WhatsApp",
      message: "Hi, my partner and I each need a separate Portuguese bank account. Could you quote us?",
    },
    "nothing-to-buy": {
      heading: "You already have what this page sells.",
      body: `With a NIF in hand and no account to open, there is nothing to order here. If your tax representation is due, renewal is ${PRICES.renewal} a year. For anything else, write to us.`,
      cta: "Write to us on WhatsApp",
      message: "Hi, I already have a Portuguese NIF. I would like to ask about tax representation renewal.",
    },
  } satisfies Record<ExitReason, { heading: string; body: string; cta: string; message: string }>,

  reasons: {
    needsNif: "You do not have a NIF yet, and nothing in Portugal moves without one.",
    partnerNeedsNif: "Your partner does not have a NIF yet, and a joint account needs one for each holder.",
    bothNeedNif: "Neither of you has a NIF yet, and the account needs one for each holder.",
    hasNif: "You already hold a NIF, so the account is the only thing left to open.",
    bothHaveNif: "You both hold a NIF, so the joint account is the only thing left to open.",
    wantsAccount: "You asked for a Portuguese bank account.",
    wantsJointAccount: "You asked for one joint account for the two of you.",
    noAccount: "You do not need a bank account right now.",
    sequenced: "NIF first, then the account: one order, handled in the right sequence.",
  } satisfies Record<ReasonId, string>,

  notes: {
    childrenNifs: "Children's NIFs on request. Tell us how many on WhatsApp and we add them to the order.",
    taxRepRequired: "12 months of tax representation are included, required while you live outside the EEA. Cancel once you are resident.",
    taxRepOptional: "You live inside the EEA, so tax representation is optional for you. It is included anyway, and you can drop it at any time.",
    bankUnlikely: "The bank asks for proof of a visa in progress before opening an account, and you told us you are not applying for one. We recommend the NIF now and the account once a visa process starts. Message us if your situation is different.",
    nationalityUnsupported: "The bank does not open accounts for one of the nationalities you entered. We recommend the NIF now and can look at other banks on WhatsApp.",
  } satisfies Record<NoteId, string>,
} as const;

/* -------------------------------------------------------------------------- */
/* Products                                                                    */
/* -------------------------------------------------------------------------- */

type Card = (typeof bankNif.pricing.cards)[number];

function card(id: Card["id"]): Card {
  const found = bankNif.pricing.cards.find((c) => c.id === id);
  if (!found) throw new Error(`Pricing card ${id} is missing from bank-nif.ts`);
  return found;
}

export type Product = {
  id: ProductId;
  name: string;
  summary: string;
  price: string;
  time: string;
  includes: readonly string[];
};

/**
 * The four products as the result screen shows them. Names, prices and
 * features come from the pricing cards so the wizard cannot drift from the
 * landing. The couple package has no card of its own, so it is spelled out.
 */
export const PRODUCTS: Record<ProductId, Product> = {
  "nif-only": {
    id: "nif-only",
    name: card("nif-only").name,
    summary: card("nif-only").summary,
    price: PRICES.nifOnly,
    time: `NIF in ${TIMES.nif}`,
    includes: card("nif-only").features,
  },
  bundle: {
    id: "bundle",
    name: card("bundle").name,
    summary: card("bundle").summary,
    price: PRICES.bundle,
    time: `NIF in ${TIMES.nif} · IBAN in ${TIMES.bank}`,
    includes: card("bundle").features,
  },
  "bank-only": {
    id: "bank-only",
    name: card("bank-only").name,
    summary: card("bank-only").summary,
    price: PRICES.bankOnly,
    time: `IBAN in ${TIMES.bank}`,
    includes: card("bank-only").features,
  },
  couple: {
    id: "couple",
    name: "Couple package",
    summary: "Two NIFs and one joint account, from one checkout.",
    price: PRICES.couple,
    time: `NIFs in ${TIMES.nif} · IBAN in ${TIMES.bank}`,
    includes: [
      "Two official NIFs, filed directly with Finanças",
      "12 months of tax representation **included** for both of you",
      "One joint account with **Novo Banco**, two holders",
      "Limited power of attorney and compliance file prepared for each of you",
    ],
  },
};

type ProductRecommendation = Extract<Recommendation, { kind: "product" }>;

/**
 * The feature list for this exact order. Joint orders and double NIF orders
 * are not the pricing card verbatim, so they are rewritten here.
 */
export function includesFor(rec: ProductRecommendation): readonly string[] {
  if (rec.product === "nif-only" && rec.quantity === 2) {
    return [
      "Two official NIFs, filed directly with Finanças",
      "12 months of tax representation **included** for both of you",
      "Every Finanças letter forwarded, Portal passwords included",
      `Renewal ${PRICES.renewal} a year each, optional, cancel once you are resident`,
    ];
  }
  if (rec.product === "bundle" && rec.joint) {
    return [
      "One official NIF for the holder who needs it, filed with Finanças",
      "12 months of tax representation **included**",
      "One joint account with **Novo Banco**, two holders",
      `NIF in ${TIMES.nif} · IBAN in ${TIMES.bank}`,
    ];
  }
  if (rec.product === "bank-only" && rec.joint) {
    return [
      "One joint account with **Novo Banco**, two holders",
      "Limited power of attorney prepared for each of you",
      "Compliance file built in Portuguese for both of you",
      "IBAN, debit card and online banking",
    ];
  }
  return PRODUCTS[rec.product].includes;
}

/** "NIF only · x2" when two are ordered. */
export function orderName(rec: ProductRecommendation): string {
  const name = PRODUCTS[rec.product].name;
  return rec.quantity === 2 ? `${name} · x2` : name;
}

export function orderTotal(rec: ProductRecommendation): string {
  return formatEuro(rec.totalCents);
}

/** Documents to have ready, derived from what the order contains. */
export function documentsFor(rec: ProductRecommendation, answers: Answers): string[] {
  const docs: string[] = [...applyCopy.result.docs.nif];
  if (includesBank(rec.product)) docs.push(...applyCopy.result.docs.bank);
  if (answers.applicants === "two" && (includesNif(rec.product) || rec.joint)) {
    docs.push(applyCopy.result.docs.partner);
  }
  return docs;
}

/* -------------------------------------------------------------------------- */
/* Checkout                                                                    */
/* -------------------------------------------------------------------------- */

const LINK_BY_PRODUCT: Record<ProductId, string> = {
  "nif-only": CHECKOUT_LINKS.nifOnly,
  bundle: CHECKOUT_LINKS.bundle,
  "bank-only": CHECKOUT_LINKS.bankOnly,
  couple: CHECKOUT_LINKS.couple,
};

/**
 * A short, readable tag that travels with the payment and shows up on the
 * Stripe payment, so an order can be read back to the answers that produced
 * it. Stripe accepts letters, digits, hyphens and underscores, up to 200
 * characters, and this stays far under that.
 *
 * It carries no personal data, because the wizard collects none.
 */
export function checkoutReference(rec: ProductRecommendation, answers: Answers): string {
  const parts = [
    rec.product,
    `q${rec.quantity}`,
    answers.residence ?? "xx",
    answers.applicants ?? "one",
    answers.visa ?? "na",
    answers.childrenNifs ? "kids" : "nokids",
    rec.joint ? "joint" : "single",
  ];
  return parts.join("-").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200);
}

/**
 * Where the buy button goes. Null when this order cannot be sold by a Payment
 * Link as it stands, which today is only two NIFs on one order: the link sells
 * one, and quantity adjustment is off. The result screen falls back to
 * WhatsApp for that case.
 */
export function checkoutUrl(rec: ProductRecommendation, answers: Answers): string | null {
  if (rec.quantity !== 1) return null;
  const base = LINK_BY_PRODUCT[rec.product];
  return `${base}?client_reference_id=${encodeURIComponent(checkoutReference(rec, answers))}`;
}

/* -------------------------------------------------------------------------- */
/* WhatsApp handoff                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Until checkout exists, the result screen hands the order to WhatsApp with
 * the package already written out, so the firm replies with a payment link.
 */
export function whatsappMessage(rec: ProductRecommendation, answers: Answers): string {
  const people = answers.applicants === "two" ? "2 applicants" : "1 applicant";
  const residence = countryByCode(answers.residence)?.name;
  const visa = answers.visa ? applyCopy.steps.visa.options[answers.visa] : undefined;
  const parts = [
    `Hi, I would like to order ${orderName(rec)} for ${orderTotal(rec)} (${people}).`,
    residence ? `Proof of address: ${residence}.` : undefined,
    visa ? `Visa: ${visa}.` : undefined,
    answers.childrenNifs ? "We also need NIFs for children." : undefined,
    "Could you send me the payment link?",
  ];
  return parts.filter(Boolean).join(" ");
}

export function whatsappUrl(message: string): string {
  return `https://wa.me/${CONTACT.phoneDigits}?text=${encodeURIComponent(message)}`;
}
