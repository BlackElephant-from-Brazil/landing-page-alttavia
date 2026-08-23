import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/bank-nif";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Duplicate English content on the untranslated locale routes, a policy
      // page that exists for buyers rather than for search, and the apply wizard,
      // which is a checkout funnel and not a page anyone should land on cold.
      disallow: ["/pt", "/es", "/en/service-terms", "/en/apply"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
