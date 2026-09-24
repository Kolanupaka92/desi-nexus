/**
 * The taxonomy exists twice: as TypeScript constants the service matches on,
 * and as seeded reference rows the database's foreign keys enforce. If they
 * drift, a gig posted with a perfectly valid event type fails its insert in
 * production and nowhere else. This test compares the two.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { CREW_SPECIALTIES, CULTURAL_TAGS, EVENT_TYPES, LANGUAGES } from "../src/domain/taxonomy.js";
import { GIG_STATES } from "../src/domain/gig.js";
import { SERVICE_METROS } from "../src/domain/geo.js";

const here = dirname(fileURLToPath(import.meta.url));
// dist/test -> up to services/api, then to the repo's desi-nexus root.
const seedPath = resolve(here, "../../../../db/migrations/002_seed_reference_data.sql");
const seed = readFileSync(seedPath, "utf8");
// The footprint moved out of 002 alone when the service grew past Texas: 008
// adds the North Carolina and California metros and deactivates four Texas
// ones. Reading only 002 would report six metros missing from the database and
// four unknown to the code, all six and four of them wrong.
const footprintPath = resolve(here, "../../../../db/migrations/008_metro_footprint.sql");
const footprint = readFileSync(footprintPath, "utf8");

/** Pull the first column of every VALUES tuple in one INSERT block. */
function seededCodes(table: string): Set<string> {
  const start = seed.indexOf(`INSERT INTO ${table} `);
  assert.notEqual(start, -1, `no seed block for ${table}`);
  const end = seed.indexOf("ON CONFLICT", start);
  const block = seed.slice(start, end);
  return new Set([...block.matchAll(/\(\s*'([a-z0-9_]+)'/g)].map((match) => match[1] as string));
}

function assertSameSet(label: string, code: readonly string[], sql: Set<string>): void {
  const missingFromSql = code.filter((value) => !sql.has(value));
  const missingFromCode = [...sql].filter((value) => !code.includes(value));
  assert.deepEqual(missingFromSql, [], `${label}: in TypeScript but not seeded into the database`);
  assert.deepEqual(missingFromCode, [], `${label}: seeded into the database but unknown to TypeScript`);
}

test("every event type the service accepts exists as a seeded row", () => {
  assertSameSet("event_types", EVENT_TYPES, seededCodes("event_types"));
});

test("every crew speciality the service accepts exists as a seeded row", () => {
  assertSameSet("crew_specialties", CREW_SPECIALTIES, seededCodes("crew_specialties"));
});

test("every cultural tag the service accepts exists as a seeded row", () => {
  assertSameSet("cultural_tags", CULTURAL_TAGS, seededCodes("cultural_tags"));
});

test("every language the service accepts exists as a seeded row", () => {
  assertSameSet("languages", LANGUAGES, seededCodes("languages"));
});

/**
 * The metros the database considers live, across both migrations.
 *
 * 002 seeds eight, 008 adds six and marks four inactive. `is_active` has been
 * on the table since 001 and nothing read it; this is the first thing that
 * does, which is the only reason the column is worth keeping.
 *
 * Deactivating rather than deleting is deliberate -- users.metro_code and
 * gigs.metro_code both reference metros(code) with no ON DELETE clause, so a
 * DELETE fails on the first row pointing at it -- and it means "seeded" and
 * "served" are no longer the same set. This computes the second.
 */
function activeMetroCodes(): Set<string> {
  const live = seededCodes("metros");
  for (const match of footprint.matchAll(/\(\s*'([a-z0-9_]+)',\s*'[^']+',\s*ST_MakePoint/g)) {
    live.add(match[1] as string);
  }
  const off = footprint.match(/UPDATE metros SET is_active = FALSE WHERE code IN \(([^)]*)\)/);
  assert.ok(off, "008 no longer deactivates any metro; this parser needs revisiting");
  for (const code of (off[1] as string).matchAll(/'([a-z0-9_]+)'/g)) {
    live.delete(code[1] as string);
  }
  return live;
}

test("every served metro exists as an active row, and every active row is served", () => {
  assertSameSet(
    "metros",
    SERVICE_METROS.map((metro) => metro.id),
    activeMetroCodes(),
  );
});

test("the deactivated metros are still present as rows", () => {
  // Their foreign keys have to keep resolving. If a later migration ever
  // deletes them instead, this says so before a gig in El Paso 500s.
  const seeded = seededCodes("metros");
  for (const code of ["elp", "rgv", "cc", "lbb"]) {
    assert.ok(seeded.has(code), `${code} was removed from the seed rather than deactivated`);
  }
});

test("the tag-affinity table only references tags that exist", () => {
  const affinity = seededCodes("cultural_tag_affinity");
  const tags = new Set<string>(CULTURAL_TAGS);
  for (const code of affinity) {
    assert.ok(tags.has(code), `affinity row references unknown tag: ${code}`);
  }
});

test("the gig state machine's states match the database enum exactly", () => {
  const schema = readFileSync(resolve(here, "../../../../db/migrations/001_init.sql"), "utf8");
  const block = schema.slice(schema.indexOf("CREATE TYPE gig_state"));
  const enumValues = [...block.slice(0, block.indexOf(");")).matchAll(/'([A-Za-z]+)'/g)].map(
    (match) => match[1] as string,
  );
  assert.deepEqual([...enumValues].sort(), [...GIG_STATES].sort());
});
