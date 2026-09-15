import type { MetadataRoute } from "next";
import { METROS, SPECIALITIES } from "@/content/seo";

/**
 * Every indexable URL, generated from the same content the pages are.
 *
 * A hand-maintained sitemap drifts the first time a metro is added, and a
 * sitemap listing URLs that 404 is worse than none at all -- it is the clearest
 * signal available that the site does not know its own shape.
 */
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://desi-nexus.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const statics: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/hire`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/for-vendors`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
  ];

  const metros: MetadataRoute.Sitemap = METROS.map((metro) => ({
    url: `${BASE}/hire/${metro.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const pages: MetadataRoute.Sitemap = METROS.flatMap((metro) =>
    SPECIALITIES.map((speciality) => ({
      url: `${BASE}/hire/${metro.slug}/${speciality.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  );

  return [...statics, ...metros, ...pages];
}
