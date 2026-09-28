import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LegalPage } from "@/components/bank/legal-page";
import {
  SERVICE_TERMS_BLOCKS,
  SERVICE_TERMS_DESCRIPTION,
  SERVICE_TERMS_PATH,
  SERVICE_TERMS_TITLE,
  SERVICE_TERMS_UPDATED,
} from "@/content/service-terms";

export const metadata: Metadata = {
  title: SERVICE_TERMS_TITLE,
  description: SERVICE_TERMS_DESCRIPTION,
  robots: { index: false, follow: true },
};

type Props = { params: Promise<{ locale: string }> };

/**
 * The service terms, a short summary of what the client buys, linked from
 * the line under every Pay button. The text, where it comes from and the
 * rule for changing it (bump TERMS_VERSION the same day) live in
 * src/content/service-terms.ts; service-terms.test.ts holds it to the house
 * rules and ties its date to TERMS_VERSION.
 */
export default async function ServiceTermsPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") redirect(SERVICE_TERMS_PATH);

  return <LegalPage title={SERVICE_TERMS_TITLE} updated={SERVICE_TERMS_UPDATED} blocks={SERVICE_TERMS_BLOCKS} />;
}
