import type { MetadataRoute } from "next";
import { SITE_URL } from "@/content/site";

const BASE = SITE_URL;

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
