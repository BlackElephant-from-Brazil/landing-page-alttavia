import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LegalPage } from "@/components/bank/legal-page";
import { SITE_URL } from "@/content/bank-nif";
import {
  PRIVACY_BLOCKS,
  PRIVACY_DESCRIPTION,
  PRIVACY_PATH,
  PRIVACY_TITLE,
  PRIVACY_UPDATED,
} from "@/content/privacy";

/**
 * Unlike /en/service-terms, this page is indexed and listed in the sitemap:
 * a privacy notice is something people search for, and robots.ts does not
 * disallow it. The canonical is /en/privacy itself; the PT and ES routes
 * only redirect here, so they never compete with it. Its own Open Graph and
 * Twitter lines, so a shared link describes the notice and not the landing
 * the layout's defaults describe.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: PRIVACY_TITLE,
  description: PRIVACY_DESCRIPTION,
  alternates: { canonical: PRIVACY_PATH },
  robots: { index: true, follow: true },
  openGraph: {
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    url: PRIVACY_PATH,
    siteName: "Alttavia Relocation",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
  },
};

type Props = { params: Promise<{ locale: string }> };

/**
 * The privacy notice for this site and the client area, published on
 * 2026-09-28 with the owner's approval. The text lives in
 * src/content/privacy.ts; docs/legal/privacy-proposal.md lists every choice
 * made for it, for the firm's review after launch.
 */
export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") redirect(PRIVACY_PATH);

  return <LegalPage title={PRIVACY_TITLE} updated={PRIVACY_UPDATED} blocks={PRIVACY_BLOCKS} />;
}
