import { bankNif, CONTACT, SITE_URL, googleProfileUrl, press } from "@/content/bank-nif";
import { brand } from "@/content/brand";

/**
 * JSON-LD for the landing.
 *
 * Three graphs, each doing a different job in organic search:
 *
 *   ProfessionalService  the entity panel, and the signal that this is a real
 *                        firm at a real Lisbon address rather than a form
 *   FAQPage              the questions are already written the way people type
 *                        them, so they are eligible for the answer boxes
 *   Product with offers  puts the three prices in the result itself, which
 *                        pre-qualifies the click and keeps the €79 crowd out
 *
 * Everything below reads from the same content module the page renders, so the
 * markup cannot drift away from what a visitor actually sees. Google treats
 * that mismatch as a manual action risk, which is why nothing here is hardcoded.
 */

const priceValue = (price: string) => price.replace(/[^\d.]/g, "");

export function StructuredData() {
  const organization = {
    "@type": "ProfessionalService",
    "@id": `${SITE_URL}/#organization`,
    name: brand.name,
    legalName: brand.legalEntity,
    url: SITE_URL,
    email: CONTACT.email,
    telephone: CONTACT.phone,
    image: `${SITE_URL}/patricia.webp`,
    logo: `${SITE_URL}/logo.svg`,
    description: bankNif.meta.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: brand.address.street,
      postalCode: brand.address.zip,
      addressLocality: "Lisboa",
      addressCountry: "PT",
    },
    areaServed: { "@type": "Country", name: "Portugal" },
    knowsLanguage: ["en", "pt", "es"],
    founder: {
      "@type": "Person",
      name: bankNif.solution.portrait.name,
      jobTitle: "Attorney",
      alumniOf: "Ordem dos Advogados",
    },
    sameAs: [googleProfileUrl, ...press.map((outlet) => outlet.href)],
  };

  const faq = {
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    mainEntity: bankNif.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  const product = {
    "@type": "Product",
    "@id": `${SITE_URL}/#service`,
    name: "Portuguese NIF and bank account, opened remotely",
    description: bankNif.meta.description,
    brand: { "@id": `${SITE_URL}/#organization` },
    offers: bankNif.pricing.cards.map((card) => ({
      "@type": "Offer",
      name: card.name,
      description: card.summary,
      price: priceValue(card.price),
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/en#pricing`,
    })),
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [organization, faq, product],
  };

  return (
    <script
      type="application/ld+json"
      // The payload is built from our own content module, never from user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
