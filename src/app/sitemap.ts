import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/bank-nif";
import { PRIVACY_PATH } from "@/content/privacy-link";

/**
 * Only the English landing is submitted. The PT and ES routes render the same
 * English copy for now, so listing them would ask Google to index three URLs
 * with identical content.
 *
 * The privacy notice is listed: it is indexable and robots.ts allows it.
 *
 * The service terms page is deliberately absent: it is marked noindex and
 * robots.ts disallows it, since it exists for Stripe and for buyers and has
 * nothing to win in search. Listing it would send Google a URL it is then
 * told not to index.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/en`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}${PRIVACY_PATH}`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
