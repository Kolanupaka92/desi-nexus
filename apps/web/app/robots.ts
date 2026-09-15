import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://desi-nexus.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Signed-in surfaces and anything carrying a gig id. None of it is
      // reachable without a session, but keeping it out of the crawl budget
      // means the pages that should rank are the ones being crawled.
      disallow: ["/dashboard", "/vendor", "/gigs/new", "/api/", "/login", "/register"],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
