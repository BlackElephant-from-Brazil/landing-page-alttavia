import type { Metadata } from "next";

import { AnnouncementBar } from "@/components/bank/announcement-bar";
import { SiteHeader } from "@/components/bank/site-header";
import { Hero } from "@/components/bank/hero";
import { TrustBar } from "@/components/bank/trust-bar";
import { Requirement } from "@/components/bank/requirement";
import { Wedge } from "@/components/bank/wedge";
import { InlineCta } from "@/components/bank/inline-cta";
import { Solution } from "@/components/bank/solution";
import { HowItWorks } from "@/components/bank/how-it-works";
import { Pricing } from "@/components/bank/pricing";
import { Comparison } from "@/components/bank/comparison";
import { SocialProof } from "@/components/bank/social-proof";
import { Guarantees } from "@/components/bank/guarantees";
import { Faq } from "@/components/bank/faq";
import { FinalCta } from "@/components/bank/final-cta";
import { SiteFooter } from "@/components/bank/site-footer";
import { StickyCta } from "@/components/bank/sticky-cta";
import { StructuredData } from "@/components/bank/structured-data";
import { bankNif, SITE_URL, SEO_KEYWORDS } from "@/content/bank-nif";

/**
 * Section 0, plus the organic search plumbing.
 *
 * `absolute` on the title so the root layout's "%s · Alttavia Relocation"
 * template does not brand it twice, and a canonical pointing at /en so the
 * untranslated PT and ES routes never compete with it for the same terms.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { absolute: bankNif.meta.title },
  description: bankNif.meta.description,
  keywords: [...SEO_KEYWORDS],
  alternates: { canonical: "/en" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  openGraph: {
    title: bankNif.meta.title,
    description: bankNif.meta.description,
    url: "/en",
    siteName: "Alttavia Relocation",
    locale: "en_US",
    type: "website",
    images: [{ url: "/patricia.webp", width: 1600, height: 900, alt: bankNif.solution.portrait.alt }],
  },
  twitter: {
    card: "summary_large_image",
    title: bankNif.meta.title,
    description: bankNif.meta.description,
    images: ["/patricia.webp"],
  },
};

/**
 * The NIF + Portuguese bank account sales landing, sections 1 to 14 of the copy
 * document, in order, with two slim CTA bands threaded between them.
 *
 * This page is English only for now. The buyer of this product reads English,
 * and PT and ES come after the campaign proves out, so it renders the same copy
 * on every locale route while robots.ts keeps the other two out of the index.
 */
export default function BankNifLanding() {
  const { inlineCtas } = bankNif;

  return (
    <>
      <StructuredData />
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1 pb-20 lg:pb-0">
        <Hero />
        <TrustBar />
        <Requirement />
        <Wedge />
        <InlineCta {...inlineCtas.afterWedge} />
        <Solution />
        <HowItWorks />
        <Pricing />
        <Comparison />
        <InlineCta {...inlineCtas.afterComparison} />
        <SocialProof />
        <Guarantees />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <StickyCta />
    </>
  );
}
