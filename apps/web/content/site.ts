/**
 * The site's own origin, in one place.
 *
 * Canonical links, `sitemap.xml`, `robots.txt`, the Organization and WebSite
 * structured data and every OpenGraph URL are absolute, so each of them needs
 * to know where the site actually lives. Eight files worked that out
 * independently, and all eight hard-coded the same fallback:
 *
 *     process.env.NEXT_PUBLIC_SITE_URL ?? "https://desi-nexus.com"
 *
 * That fallback was load-bearing, because the environment variable is not set
 * in Vercel. Production served `<link rel="canonical" href="https://desi-nexus.com/hire/austin">`
 * against a domain nobody owns -- a canonical pointing at a host that does not
 * resolve tells a crawler the page it just read is a duplicate of nothing, and
 * it is the one tag with the authority to do that. After the rebrand it was
 * also the wrong name.
 *
 * This is the same class of mistake `brand.ts` was written to prevent, which
 * its own header admits it does not cover: "a rename is an edit to this file
 * plus the domain and the docs". This file is the domain.
 *
 * The fallback chain no longer contains a guess:
 *
 *   1. `NEXT_PUBLIC_SITE_URL` -- set this once a real domain is bought, and it
 *      wins. Nothing else needs to change.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` -- set by Vercel on every build to the
 *      project's own production hostname. Always correct, never invented, and
 *      it needs no configuration. It carries no scheme, so one is added.
 *   3. localhost, for `next dev` and for `next build` off a laptop.
 *
 * Note it resolves to the PRODUCTION host even inside a preview deployment.
 * That is deliberate: a preview must not advertise itself as canonical, or
 * every preview build competes with production for the same keywords.
 */
function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

/** Absolute origin, no trailing slash. Join with a leading-slash path. */
export const SITE_URL = resolveSiteUrl();
