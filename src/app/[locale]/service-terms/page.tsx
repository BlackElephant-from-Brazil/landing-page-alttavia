import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LegalPage } from "@/components/bank/legal-page";
import { CONTACT, PRICES, TIMES, TIMING_DISCLAIMER } from "@/content/bank-nif";

export const metadata: Metadata = {
  title: "Service terms",
  description:
    "What Alttavia Relocation delivers on a NIF or Portuguese bank account order, how long it takes, and where the timeline stops being ours.",
  robots: { index: false, follow: true },
};

type Props = { params: Promise<{ locale: string }> };

/**
 * A checkout needs a reachable statement of what the customer is buying, which
 * is what this page is. It is deliberately not a refund policy: the client
 * removed every money back promise from the product, so nothing here invents
 * one. What it does instead is say plainly where our turnaround ends and the
 * Portuguese public administration's begins.
 *
 * Nothing on this page promises more than the landing does, and nothing on the
 * landing promises more than this.
 */
export default async function ServiceTermsPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") redirect("/en/service-terms");

  return (
    <LegalPage
      title="Service terms"
      updated="Applies to all orders placed through this page"
      blocks={[
        {
          kind: "paragraph",
          text: "These terms cover the NIF, bank account and combined packages sold on this site. They exist so that you know, before paying, exactly what is being done for you and on what timeline.",
        },
        { kind: "heading", text: "What you are buying" },
        {
          kind: "list",
          items: [
            `NIF: we act as your tax representative in Portugal, file your application with Finanças, and send you the official document. Twelve months of tax representation are included, along with every letter Finanças sends and your Portal das Finanças access password. Renewal after the first year is ${PRICES.renewal} and is optional.`,
            "Bank account: we prepare a limited power of attorney, build your compliance file in Portuguese, and open an account with one of our banking partners. You receive an IBAN, a debit card and online banking access.",
            "Combined and couple packages: both of the above, sequenced so the NIF is issued before the bank file is submitted.",
          ],
        },
        { kind: "heading", text: "What we need from you" },
        {
          kind: "paragraph",
          text: "A valid passport and a proof of address, uploaded at checkout. For a bank account, proof of income or source of funds. There is no video call and no appointment. If a document is missing or unreadable we ask you once, in writing, and the timeline pauses until it arrives.",
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
          text: "A NIF is issued to any applicant with a valid passport and proof of address. A bank account depends on the bank's own compliance assessment, which is theirs to make and not ours to promise. Where your nationality or circumstances make an account unlikely, we tell you before you buy rather than after.",
        },
        { kind: "heading", text: "Cancellation" },
        {
          kind: "paragraph",
          text: "Tell us before we begin work on your file and the order is cancelled. Once your documents have been submitted to Finanças or to a bank, the work has been performed and cannot be withdrawn.",
        },
        { kind: "heading", text: "Your documents" },
        {
          kind: "paragraph",
          text: "Uploaded over an encrypted connection, handled under GDPR and professional confidentiality, used only for the service you ordered, and deleted after completion on request.",
        },
        { kind: "heading", text: "Statutory rights" },
        {
          kind: "paragraph",
          text: "Nothing in these terms limits the rights you hold under Portuguese and European Union consumer law. Where those rights give you more than this page does, they prevail.",
        },
        { kind: "heading", text: "Getting in touch" },
        {
          kind: "paragraph",
          text: `Write to ${CONTACT.email} or message ${CONTACT.phone} on WhatsApp, from the address or number used on the order. We reply within one business day.`,
        },
      ]}
    />
  );
}
