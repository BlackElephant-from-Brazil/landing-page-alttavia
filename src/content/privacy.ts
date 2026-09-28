import type { LegalBlock } from "@/components/bank/legal-page";
import { CONTACT, REGISTERED_OFFICE } from "@/content/bank-nif";
import { brand } from "@/content/brand";

import {
  ACCOUNT_PRIVACY_NOTE,
  DETAILS_PRIVACY_NOTE,
  LOGIN_PRIVACY_NOTE,
  PRIVACY_LINK_TEXT,
  PRIVACY_PATH,
} from "./privacy-link";

export { ACCOUNT_PRIVACY_NOTE, DETAILS_PRIVACY_NOTE, LOGIN_PRIVACY_NOTE, PRIVACY_LINK_TEXT, PRIVACY_PATH };

/**
 * The privacy notice published at /en/privacy on 2026-09-28.
 *
 * Source: docs/legal/privacy-proposal.md, section "The notice", with every
 * [TO CONFIRM] and PROPOSAL marker resolved on the owner's approval of
 * 2026-09-28. Each resolution is listed item by item in that file, section
 * "Published on 2026-09-28", for Patrícia Viana's review after launch. Change
 * a sentence here and log the change there.
 *
 * Every statement describes what the platform does in the code on this
 * branch. Where the code could not prove a marker, the sentence was left out
 * rather than guessed. Three rules the text keeps on purpose:
 *
 * - Deletion is by hand. Nothing in the platform deletes data on a schedule,
 *   so the notice never says it happens automatically.
 * - The cookie and storage names are the ones the code writes: @supabase/ssr
 *   (src/lib/supabase/*, src/proxy.ts) and the apply wizard's sessionStorage
 *   keys (src/lib/apply/storage.ts, src/components/apply/checkout-storage.ts).
 *   privacy.test.ts checks the wizard keys against those modules.
 * - The house rules of src/content/bank-nif.ts apply, and privacy.test.ts
 *   also refuses any marker left over from the proposal.
 *
 * LegalPage has paragraphs, headings and lists only, so each category of
 * data opens with its label as a short first sentence, and the proposal's
 * two tables are lists.
 */

export const PRIVACY_TITLE = "Privacy notice";

/** The line under the title, in the same place /en/service-terms has its own. */
export const PRIVACY_UPDATED = "Last updated: 28 September 2026";

export const PRIVACY_DESCRIPTION =
  "How Alttavia Relocation collects, uses, stores and protects your personal data when you order a Portuguese NIF or bank account, and what you can ask of us.";

/** The Supabase project whose name the session cookies carry. */
const AUTH_COOKIE = "sb-dgdbrnvgrpixsslgvmns-auth-token";

export const PRIVACY_BLOCKS: LegalBlock[] = [
  {
    kind: "paragraph",
    text: "This notice covers the personal data we collect through this site and your client area. It explains why we need it, who handles it and how long we keep it. It also explains what you can ask of us.",
  },

  { kind: "heading", text: "Who we are" },
  {
    kind: "paragraph",
    text: `${brand.legalEntity}, ${CONTACT.nipc}, with registered office at ${REGISTERED_OFFICE}.`,
  },
  {
    kind: "paragraph",
    text: "We decide how your data is used. Under the GDPR, that makes us the controller.",
  },
  {
    kind: "paragraph",
    text: `For anything in this notice, write to ${CONTACT.email}.`,
  },

  { kind: "heading", text: "What we collect and why" },
  {
    kind: "paragraph",
    text: "The application form. The country on your proof of address, how many adults are applying, whether children also need a NIF (yes or no, nothing else), whether each adult already has a NIF, the bank account you want, the country of each passport, and your visa type. Until you confirm your sign in code and your order is saved, these answers stay in your browser tab. We use them to suggest a service and prepare your order. Legal basis: steps you ask for before a contract (GDPR Article 6(1)(b)).",
  },
  {
    kind: "paragraph",
    text: "Your account. Your first name and your email address. Your account is created when you ask for your first sign in code, even if you never enter it. Our team can also open an account for you, with your name, your email address and, if you give it, your phone number. We use your name and email to open your client area and send your sign in codes. Legal basis: contract (Article 6(1)(b)).",
  },
  {
    kind: "paragraph",
    text: "Your payment. The service, the price, the payment date and Stripe's payment references. We also record when you accepted the service terms, and which version you accepted. We give Stripe your email address and our order and account references, so the payment matches your order. You enter your card details on Stripe's page. We never see or store them. Legal basis: contract, and our legal duty to keep accounting and tax records (Article 6(1)(c)).",
  },
  {
    kind: "paragraph",
    text: "Your documents. Depending on the service: passport, proof of address, the tax number from your country, bank statements or an annual income statement, proof of your profession, your Portuguese NIF document (if you buy the Bank Account only service), the powers of attorney you sign and your signed service agreement. We use them to apply for your NIF or open your account. Legal basis: contract.",
  },
  {
    kind: "paragraph",
    text: "Your details for the documents we prepare. Full name, whether the documents should refer to you as she or he, place and date of birth, passport number, issuing authority, issue and expiry dates, tax residence address and, if you give it, the city and country you are in when you confirm them. We print them on your powers of attorney. We also print them on your service agreement, except whether we refer to you as she or he. The city and country you give appear only on the agreement. We keep a copy of the agreement as it was prepared. Legal basis: contract.",
  },
  {
    kind: "paragraph",
    text: "What we deliver. Depending on the service: your NIF document, your Portal das Finanças access, your IBAN confirmation and a closing report. For a bank account, the bank may also give us cards, access codes or online banking credentials for you, and we pass them on. Legal basis: contract.",
  },
  {
    kind: "paragraph",
    text: "Your order history. We record each step of your order: when it happened and who on our team made it. For each file you upload we keep its name, type and size, when you sent it, and our review. When we ask for a new file, we keep the reason and the earlier file too. We use this to run your order and to show you where it stands. Legal basis: contract.",
  },
  {
    kind: "paragraph",
    text: "Details about your partner. Some orders cover your partner. This happens when you apply together, when you buy the Couple package, or when you buy a second NIF for them from your client area. When you apply together, you give us their answers to the form. For any order that covers them, you give us their documents and their details for the documents we prepare. We use them in the same way and keep them for the same time. Everything about that order reaches you, through your account and your email. Please show them this notice before you share their data.",
  },
  {
    kind: "paragraph",
    text: "Details about your children. The form asks only whether your children also need a NIF, yes or no. Children's NIFs are arranged on request, outside this platform: you tell us how many on WhatsApp and we quote them separately.",
  },
  {
    kind: "paragraph",
    text: "Messages. Emails between us, and WhatsApp messages if you choose to write to us there. If you write to us on WhatsApp, WhatsApp carries and stores those messages under its own terms. Legal basis: contract, or steps before a contract.",
  },
  {
    kind: "paragraph",
    text: "Technical records. Our host receives the IP address and browser of every visit. Our database and sign in provider, and our file storage, also receive them when your browser signs in, uploads a file or downloads one. Our database keeps the IP address and browser of each sign in. We keep a record each time our team opens, reviews or changes a file or a step of your order: who, what and when. Our server logs can include your email address or your account ID. When our team writes a note about how the platform works, the note records the screen address, which can include your email address or the reference of your order. When something fails on our server or a payment cannot be recorded, an alert is emailed to our team and to the developer. It holds the page address, which can include the reference of your order or account, and the error, with email addresses removed. For a payment, it also holds the order reference and Stripe's references. We use these records to keep the service secure and working. Legal basis: our legitimate interest (Article 6(1)(f)).",
  },
  {
    kind: "paragraph",
    text: "We do not sell your data and we do not use it for advertising.",
  },
  {
    kind: "paragraph",
    text: "A person, not a computer, makes every decision about you. The form uses your answers, including the country of each passport and your visa, to suggest a service. If you still need a NIF and your answers make a bank account unlikely, the form tells you and recommends the NIF first. You choose what to buy, you can still write to us, and our team reviews every document.",
  },
  {
    kind: "paragraph",
    text: "We do not rely on your consent for anything today. If we ever add analytics or marketing, we will ask first, and you can withdraw that consent at any time.",
  },
  {
    kind: "paragraph",
    text: "The details form in your client area accepts only people aged 18 or over.",
  },

  { kind: "heading", text: "Who receives your data" },
  {
    kind: "list",
    items: [
      "Finanças (Autoridade Tributária e Aduaneira), for your NIF, and the bank that reviews your account opening. Each acts under its own legal duties.",
      "Patrícia Soares Viana, attorney at law. Your powers of attorney appoint her to act for you before Finanças and the bank and, for a NIF, as your tax representative, so she receives Finanças notifications for you.",
      "Our team, bound by professional confidentiality.",
      "The service providers below. Except where this notice says otherwise, they handle data only on our instructions.",
    ],
  },

  { kind: "heading", text: "Service providers and where your data is stored" },
  {
    kind: "list",
    items: [
      "Supabase, our database and sign in provider: your account, answers, orders and their history, your details, our reviews and closing report, and the records of your documents and agreement. Stored in London, United Kingdom.",
      "Cloudflare R2, our file storage: your documents, signed powers of attorney, service agreements and the files we deliver. Stored in the European Union.",
      "Resend, which sends our emails. To you: sign in codes, password recovery codes, order updates and the reason when we ask for a new document. Your service agreement goes to you as a PDF attachment, with your passport and birth details. To our team: notices with your email address, the service, the amount and the order reference, which can carry the signed service agreement you upload as an attachment.",
      "Stripe, which takes your payment. We send it your email address, the service and our order and account references. You give your card details to Stripe directly.",
      "Netlify, which hosts this site, runs its server code and keeps its server logs.",
      "Google (Google Workspace), our mailbox at alttavia-relocation.com. It holds the emails you send us and our team's notices about your order.",
      "guyshore.com, the developer that builds and maintains the platform. The Supabase project above sits in its organization, and the Cloudflare account and the Netlify team above are held on its side, not ours. It can reach the data in all three directly. It also has access to our Stripe account. It has an administrator account on this platform for tests and support. It keeps backup copies of the database on its own computer. These copies can include your files.",
    ],
  },
  {
    kind: "paragraph",
    text: "Stripe also uses some payment data for its own purposes, such as fraud prevention, under its own privacy policy.",
  },
  {
    kind: "paragraph",
    text: "Supabase stores our database in London, United Kingdom, which the European Commission recognises as giving adequate protection. Where another provider handles data outside the European Economic Area, we rely on the safeguards the GDPR allows. Write to us for details.",
  },

  { kind: "heading", text: "How long we keep it" },
  {
    kind: "paragraph",
    text: "Nothing on our platform deletes your data automatically. When a period below ends, we delete the data by hand, in our systems and in our backup copies.",
  },
  {
    kind: "list",
    items: [
      "An account that never pays: your email, your first name, your answers and the unpaid order. Kept for 12 months after your last sign in, or after the account was created if you never signed in, then deleted. This also covers an email that asked for a sign in code and went no further.",
      "Your documents (except your signed service agreement), your details for the documents, and the files we deliver: kept until your service ends, plus 12 months, then deleted.",
      "Files we asked you to replace, and earlier versions of your agreement: deleted with the rest of your documents. A file you replace or remove yourself before our review is deleted when you do so.",
      "Your service agreement, as we prepared it and as you signed it, and the payment and order records of your paid orders: kept for 10 years, the period Portuguese law sets for accounting records. Your agreement shows your name, birth details, passport details and tax address, so these stay with it for the same period.",
      "Backup copies of our database: kept for 90 days, then deleted. Data we delete from the platform stays in older backups until those are deleted.",
      "Emails: we keep our copies for as long as we keep the order they belong to. You keep your own copies. The providers that send and hold our emails keep their own records for their own periods.",
      "Technical records: the sign in records in our database are kept for 12 months. Server logs are kept as long as our hosting, database and file storage providers keep them.",
    ],
  },

  { kind: "heading", text: "Your rights" },
  { kind: "paragraph", text: "You can ask us to:" },
  {
    kind: "list",
    items: [
      "show you the data we hold about you and send you a copy;",
      "correct it;",
      "delete it, unless a law requires us to keep it;",
      "limit how we use it, or stop a use based on our legitimate interest;",
      "send you the data you gave us in a common format.",
    ],
  },
  {
    kind: "paragraph",
    text: `Write to ${CONTACT.email} from the email address on your account. We answer within one month. You can correct the details for your documents yourself in your client area, until you upload the signed powers of attorney. If your service agreement was already prepared, write to us and we send you a corrected one. You can download your files, your service agreement and what we deliver at any time. While your order is collecting documents, you can remove a file yourself until we review it. To change your email address or close your account, write to us.`,
  },

  { kind: "heading", text: "Complaints" },
  {
    kind: "paragraph",
    text: "You can complain to the Portuguese data protection authority, the Comissão Nacional de Proteção de Dados (CNPD), at www.cnpd.pt, or to the data protection authority of the EU country where you live or work. We would like the chance to help first, so please write to us too.",
  },

  { kind: "heading", text: "Cookies and browser storage" },
  {
    kind: "paragraph",
    text: "This site sets only what it needs to work. There are no analytics or advertising cookies.",
  },
  {
    kind: "list",
    items: [
      `${AUTH_COOKIE}, a cookie sometimes split into ${AUTH_COOKIE}.0 and ${AUTH_COOKIE}.1. It keeps you signed in to your client area. Removed when you sign out; otherwise your browser keeps it for up to 400 days.`,
      `${AUTH_COOKIE}-code-verifier, ${AUTH_COOKIE}-flows-code-verifier and one ${AUTH_COOKIE}-flow-…-code-verifier for each recent code request, all cookies. They are used when we send you a sign in code. Removed when you sign out; otherwise your browser keeps them for up to 400 days.`,
      "alttavia_apply_v1, alttavia_apply_checkout_v1 and alttavia_apply_name_v1, kept in session storage, not cookies. They hold your form answers, the service you chose, the email address we sent your code to, and your first name, until your order is saved. Removed when your order is saved, when you start the form again, or when you close the tab.",
    ],
  },
  {
    kind: "paragraph",
    text: "Fonts are served from this site, so your browser does not contact Google for them. The payment page is Stripe's own site, under Stripe's cookie policy.",
  },
  {
    kind: "paragraph",
    text: "Because all of the above is strictly necessary, we do not ask for consent to it. The site can load Google Tag Manager for analytics. It is switched off today. Before we switch it on, we will add a banner that asks for your consent first.",
  },

  { kind: "heading", text: "Security" },
  {
    kind: "paragraph",
    text: "Every page and every upload uses an encrypted connection. Your files sit in private storage. You see only your own orders. The files you upload and the files we deliver open through links that expire after two minutes. Your service agreement and the powers of attorney we prepare open only in your client area, while you are signed in. Our team can open all of them in the admin area. So can the developer who maintains the platform, who can also reach the storage directly and keeps backup copies (see guyshore.com above). Our team signs in to the admin area with a password. We also send your service agreement to your email address as an attachment.",
  },

  { kind: "heading", text: "Changes" },
  {
    kind: "paragraph",
    text: "When what we do changes, we update this notice and the date at the top.",
  },
];

/** Every string of the page, for the checks in privacy.test.ts. */
export function privacyText(): string[] {
  const blocks = PRIVACY_BLOCKS.flatMap((block) => (block.kind === "list" ? block.items : [block.text]));
  return [
    PRIVACY_TITLE,
    PRIVACY_UPDATED,
    PRIVACY_DESCRIPTION,
    ACCOUNT_PRIVACY_NOTE,
    LOGIN_PRIVACY_NOTE,
    DETAILS_PRIVACY_NOTE,
    PRIVACY_LINK_TEXT,
    ...blocks,
  ];
}
