import type { LegalBlock } from "@/components/bank/legal-page";
import { CONTACT, PRICES, REGISTERED_OFFICE, TIMES, TIMING_DISCLAIMER } from "@/content/bank-nif";
import { brand } from "@/content/brand";

import { SERVICE_TERMS_PATH } from "./terms-version";

/**
 * The service terms published at /en/service-terms: a short summary of what
 * the client buys, linked from the line under every Pay button ("By paying
 * you accept the service terms and your service agreement.",
 * src/content/terms-version.ts). The contract itself is the service
 * agreement, prepared from the firm's models after payment
 * (src/lib/contracts/*), and this page says so: where the two differ, the
 * agreement prevails (Patrícia, 2026-09-24).
 *
 * Rewritten on 2026-09-28 from docs/legal/service-terms-changes.md, sections
 * 1 and 2, with the owner's approval; Patrícia reviews it after launch. That
 * file records which proposal went in as written and which was adapted. It
 * stays silent on the questions still open there (4.2, 4.5, 4.8, 4.10): no
 * link to the blank models, no word on how the files travel at the end, no
 * word on what a withdrawal gives back, no complaints book or dispute body.
 * Where the record leaves a legal point open, the page points at the
 * agreement instead of settling it: who the tax representative is (the NIF
 * power of attorney names them) and when the 14 days start and end (Annex I).
 *
 * It is not a refund policy: the client removed every money back promise
 * from the product (house rule 4 of src/content/bank-nif.ts), and it says
 * nothing about VAT (house rule 5). The landing, the application form and
 * the service catalogue still carry some claims this page corrected; they
 * are listed in section 3 of that file.
 *
 * Whenever the wording here changes, bump TERMS_VERSION in
 * src/content/terms-version.ts and SERVICE_TERMS_UPDATED below on the same
 * day; service-terms.test.ts fails when the two name different days.
 */

export { SERVICE_TERMS_PATH };

export const SERVICE_TERMS_TITLE = "Service terms";

/** The line under the title. Its day is TERMS_VERSION's (service-terms.test.ts). */
export const SERVICE_TERMS_UPDATED = "Last updated: 28 September 2026";

export const SERVICE_TERMS_DESCRIPTION =
  "What Alttavia Relocation delivers on a NIF or Portuguese bank account order, how long it takes, and where the timeline stops being ours.";

export const SERVICE_TERMS_BLOCKS: LegalBlock[] = [
  {
    kind: "paragraph",
    text: "This page summarizes the NIF, bank account and package services sold on this site. Your service agreement is the contract between us. We prepare it from your details after payment. Where this page and the agreement differ, the agreement prevails.",
  },
  { kind: "heading", text: "Who you buy from" },
  {
    kind: "paragraph",
    text: `${brand.legalEntity}, ${CONTACT.nipc}, ${REGISTERED_OFFICE}.`,
  },
  { kind: "heading", text: "What you are buying" },
  {
    kind: "list",
    items: [
      `NIF: we file your application with Finanças and send you the official document. Your NIF power of attorney names your tax representative in Portugal. Twelve months of tax representation are included, counted from the day the NIF is assigned. Your tax representative receives Finanças letters for you and passes them on, and does not manage your assets. You also get your Portal das Finanças access. Renewal after the first year is ${PRICES.renewal} and is optional.`,
      "Bank account: we prepare a limited power of attorney, build your compliance file in Portuguese, and submit it to one of our banking partners. The bank decides after its own review. When it opens the account, we pass on your account details and the cards, codes and online banking access the bank gives us for you.",
      "NIF + Bank Account: both of the above, sequenced so the NIF is issued before the bank file is submitted.",
      "Couple package: the same for two people, with a NIF for each of you and one joint account. One service agreement names you both, and you both sign it. You also both sign one bank power of attorney.",
    ],
  },
  { kind: "heading", text: "Accepting these terms" },
  {
    kind: "paragraph",
    text: "The line under every Pay or Confirm purchase button says that by paying you accept these terms and your service agreement. Your order records when you accepted, and which version of these terms and of the agreement models applied.",
  },
  { kind: "heading", text: "What we need from you" },
  {
    kind: "paragraph",
    text: "After payment, you confirm your passport details in your client area. We print them on your service agreement and on the powers of attorney we prepare. Your agreement arrives by email and stays in your client area. Sign it by hand and upload the signed copy in the Signed service agreement slot.",
  },
  {
    kind: "paragraph",
    text: "You upload your documents in your client area too. For a NIF: your passport, a proof of address, and the NIF power of attorney, signed by hand. For a bank account: your passport, a proof of address, the tax number from your country and proof of your profession. Add bank statements or an annual income statement. Sign the bank power of attorney by hand. If you already have a NIF, add your NIF document. A package asks for both powers of attorney. Your client area shows the exact list for your order.",
  },
  {
    kind: "paragraph",
    text: "For a NIF, you do not need to travel to Portugal. For a bank account, the bank may ask to see you in person, and we tell you if it does. If Finanças or the bank asks for the power of attorney to be notarized or apostilled, that is done at your cost, and we tell you when it is needed.",
  },
  {
    kind: "paragraph",
    text: "If a file is unreadable or is not the right one, we tell you why in your client area and by email. Your client area always shows which documents are still missing. The timeline pauses until they arrive. After 30 days without them we may pause your file, and after 60 days we may close it, as your service agreement sets out.",
  },
  { kind: "heading", text: "Timelines" },
  {
    kind: "paragraph",
    text: `We work to ${TIMES.nif} for a NIF and ${TIMES.bank} for a bank account, counted from the day we hold everything we need from you.`,
  },
  {
    kind: "paragraph",
    text: TIMING_DISCLAIMER,
  },
  {
    kind: "paragraph",
    text: "In practice this means a filing queue at Finanças, a compliance review at a bank, or a service disruption at any Portuguese public body can extend a case beyond our own turnaround. We do not control those steps and we do not present them as if we did. What we commit to is working your file continuously and telling you where it stands whenever the position changes.",
  },
  { kind: "heading", text: "Approval" },
  {
    kind: "paragraph",
    text: "Finanças assigns the NIF, and the bank decides on the account after its own compliance review. Neither decision is ours, so we promise the work and not the outcome. Your fee pays for that work, whatever the decision. If our form finds an account unlikely while you still need a NIF, it tells you and suggests the NIF first.",
  },
  { kind: "heading", text: "Cancellation" },
  {
    kind: "paragraph",
    text: `If you buy as a consumer, you can withdraw within 14 days of concluding your agreement, as Annex I of your agreement sets out. You do not need to give a reason. Write to ${CONTACT.email}. Annex I also explains when the right to withdraw ends, what you pay if you withdraw after work has started, and includes a withdrawal form.`,
  },
  {
    kind: "paragraph",
    text: "You can also end your agreement at any time by writing to us, as your agreement sets out.",
  },
  { kind: "heading", text: "Your documents" },
  {
    kind: "paragraph",
    text: "You upload them in your client area over an encrypted connection. They are kept in private storage, handled under professional confidentiality, and used only for the service you ordered. Our privacy notice, linked at the foot of this page, explains who handles them, how long we keep them and how to ask for a copy or their deletion.",
  },
  { kind: "heading", text: "Statutory rights" },
  {
    kind: "paragraph",
    text: "Nothing in these terms limits the rights you hold under Portuguese and European Union consumer law. Where those rights give you more than this page does, they prevail.",
  },
  { kind: "heading", text: "Getting in touch" },
  {
    kind: "paragraph",
    text: `Write to ${CONTACT.email} from the email address on your account, or message ${CONTACT.phone} on WhatsApp. We reply on business days.`,
  },
];

/** Every string of the page, for the checks in service-terms.test.ts. */
export function serviceTermsText(): string[] {
  const blocks = SERVICE_TERMS_BLOCKS.flatMap((block) => (block.kind === "list" ? block.items : [block.text]));
  return [SERVICE_TERMS_TITLE, SERVICE_TERMS_UPDATED, SERVICE_TERMS_DESCRIPTION, ...blocks];
}
