import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/bank-nif";

/**
 * Only the English landing is submitted. The PT and ES routes render the same
 * English copy for now, so listing them would ask Google to index three URLs
 * with identical content.
 *
 * The refund policy is deliberately absent: it is marked noindex, it exists for
 * Stripe and for buyers, and it has nothing to win in search.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/en`,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
