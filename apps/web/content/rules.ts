/**
 * The version of the marketplace rules shown at /rules.
 *
 * It must equal RULES_VERSION in services/api/src/domain/users.ts, which is the
 * value recorded on every account at signup as "the rules this person agreed
 * to". If the page text changes and only one of the two is bumped, accounts
 * would be recorded as agreeing to a version they never saw -- which is the
 * whole thing the version exists to prevent. rules-version.test.ts in the API
 * fails the build when they differ.
 *
 * Bump both whenever the rules change in substance, not for a typo.
 */
export const RULES_VERSION = "2026-09-28";
