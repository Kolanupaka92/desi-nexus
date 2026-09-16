/**
 * The brand's name, in one place.
 *
 * Every user-visible occurrence of the name reads from here: the header, the
 * footer, page titles, the Organization structured data, the logo lockup. A
 * rename is an edit to this file plus the domain and the docs -- not a search
 * across the codebase, and specifically not a search that would also catch the
 * things that must never change.
 *
 * That distinction is the reason this file exists. `desi_nexus_app` and
 * `desi_nexus_system` are PostgreSQL roles: cluster-wide, named inside the
 * row-level security policies in 004 and 006, with credentials issued against
 * them and deployment docs referring to them. `DESI_NEXUS_TOKEN_SECRET` and
 * its siblings are environment variables set in Vercel and in CI. None of
 * those is brand. Renaming them buys nothing and risks an outage, so a rebrand
 * must not touch them -- and a global find-and-replace on "desi_nexus" would.
 *
 * Of the 112 occurrences of the name in this repository, 26 are brand.
 */
export const BRAND = {
  /** As it appears in running text and in the <title>. */
  name: "DESI-NEXUS",
  /**
   * As it is set in the logo lockup.
   *
   * Split so the separator can be styled without a hyphen character sitting in
   * the accessible name -- a screen reader should say the name, not spell the
   * punctuation, and search results should not show a stray glyph.
   *
   * One entry per word, and the length is the word count: `["UTSAV"]` is a
   * one-word name and draws no separator. Do not pad it to two entries.
   */
  wordmark: ["DESI", "NEXUS"] as const,
  /** One line, for meta descriptions and the footer. */
  tagline: "South Asian event talent in Texas",
} as const;
