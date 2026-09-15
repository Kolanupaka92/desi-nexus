/**
 * The marketing pages describe the taxonomy a third time.
 *
 * It already exists twice -- as TypeScript constants the service matches on,
 * and as seeded rows the database's foreign keys enforce -- and schema-drift
 * checks those two against each other. The public pages under /hire are a third
 * copy, because marketing copy needs prose that the API taxonomy has no place
 * for.
 *
 * Three copies drift in two directions, and both are silent:
 *
 *   A speciality on a page that the service does not know is a page whose every
 *   link 404s, indexed and ranking.
 *
 *   A speciality the service knows that no page covers is a whole category with
 *   no way in from search -- which, for a marketplace whose acquisition channel
 *   is exactly these pages, is the more expensive of the two.
 *
 * This asserts both directions.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { CREW_SPECIALTIES, EVENT_TYPES } from "../src/domain/taxonomy.js";
import { TEXAS_METROS } from "../src/domain/geo.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/test -> services/api -> the repo root -> the web app's content.
const contentPath = resolve(here, "../../../../apps/web/content/seo.ts");
const content = readFileSync(contentPath, "utf8");

/** The file declares METROS and then SPECIALITIES; split so `code:` is unambiguous. */
const splitAt = content.indexOf("export const SPECIALITIES");
assert.notEqual(splitAt, -1, "seo.ts no longer declares SPECIALITIES");
const metroBlock = content.slice(0, splitAt);
const specialityBlock = content.slice(splitAt);

const codesIn = (block: string): string[] =>
  [...block.matchAll(/^\s*code:\s*"([a-z0-9_]+)"/gm)].map((match) => match[1] as string);

const slugsIn = (block: string): string[] =>
  [...block.matchAll(/^\s*slug:\s*"([a-z0-9-]+)"/gm)].map((match) => match[1] as string);

const pageMetroCodes = codesIn(metroBlock);
const pageSpecialityCodes = codesIn(specialityBlock);
const pageEventCodes = [
  ...new Set(
    [...specialityBlock.matchAll(/events:\s*\[([^\]]*)\]/g)].flatMap((match) =>
      [...(match[1] as string).matchAll(/"([a-z0-9_]+)"/g)].map((event) => event[1] as string),
    ),
  ),
];

test("the pages parse into something worth checking", () => {
  // Guards the regexes themselves: if the file's shape changes, every other
  // assertion here would pass vacuously on an empty list.
  assert.ok(pageMetroCodes.length > 0, "no metro codes parsed out of seo.ts");
  assert.ok(pageSpecialityCodes.length > 0, "no speciality codes parsed out of seo.ts");
  assert.ok(pageEventCodes.length > 0, "no event codes parsed out of seo.ts");
});

test("every metro the pages claim to serve is a real metro", () => {
  const known = new Set(TEXAS_METROS.map((metro) => metro.id));
  const unknown = pageMetroCodes.filter((code) => !known.has(code));
  assert.deepEqual(unknown, [], "on a public page but unknown to the service");
});

test("every metro the service serves has a page", () => {
  const covered = new Set(pageMetroCodes);
  const missing = TEXAS_METROS.map((metro) => metro.id).filter((id) => !covered.has(id));
  assert.deepEqual(missing, [], "bookable but unreachable from search");
});

test("every speciality the pages offer is a real speciality", () => {
  const known = new Set<string>(CREW_SPECIALTIES);
  const unknown = pageSpecialityCodes.filter((code) => !known.has(code));
  assert.deepEqual(unknown, [], "on a public page but unknown to the service");
});

test("every speciality the service matches has a page", () => {
  const covered = new Set(pageSpecialityCodes);
  const missing = CREW_SPECIALTIES.filter((code) => !covered.has(code));
  assert.deepEqual(missing, [], "bookable but unreachable from search");
});

test("every event type named on a page is a real event type", () => {
  const known = new Set<string>(EVENT_TYPES);
  const unknown = pageEventCodes.filter((code) => !known.has(code));
  assert.deepEqual(unknown, [], "named on a public page but unknown to the service");
});

test("slugs are unique, so no two pages claim the same URL", () => {
  for (const [labelText, block] of [
    ["metro", metroBlock],
    ["speciality", specialityBlock],
  ] as const) {
    const slugs = slugsIn(block);
    assert.equal(
      new Set(slugs).size,
      slugs.length,
      `duplicate ${labelText} slug: two pages would resolve to one URL`,
    );
  }
});
