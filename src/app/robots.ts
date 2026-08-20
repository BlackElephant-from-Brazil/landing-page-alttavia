import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/bank-nif";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Duplicate English content on the untranslated locale routes, and a
      // policy page that exists for buyers rather than for search.
      disallow: ["/pt", "/es", "/en/service-terms"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
