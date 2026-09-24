/**
 * Test-database plumbing.
 *
 * Each database-backed test file gets its own PostgreSQL schema. Node's test
 * runner runs files in parallel, and a shared schema means one file's TRUNCATE
 * wipes another's fixtures mid-test -- a failure that only appears in the full
 * run and passes when you re-run the file alone, which is the worst kind.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { connect, type Database } from "../src/infra/postgres/db.js";

export const TEST_DATABASE_URL = process.env.DESI_NEXUS_TEST_DATABASE_URL;

/** node:test's `skip` takes a reason string, or false to run. */
export const skipWithoutDatabase: string | false = TEST_DATABASE_URL
  ? false
  : "set DESI_NEXUS_TEST_DATABASE_URL to run the database tests";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../../../../db/migrations");

export function migration(file: string): string {
  return readFileSync(resolve(migrationsDir, file), "utf8");
}

/** Tables holding transactional state, cleared between tests. */
export const TRANSACTIONAL_TABLES = [
  "users", "gigs", "applications", "escrows", "ledger_entries",
  "gig_transitions", "user_credentials", "host_profiles", "crew_profiles",
  "creator_profiles", "event_outbox", "reviews", "disputes", "enquiries",
];

/** Extensions 001_init.sql expects. They are cluster-wide, not per-schema. */
const EXTENSIONS = ["pgcrypto", "postgis", "pg_trgm", "citext"];

/**
 * Create the extensions once, under an advisory lock.
 *
 * `CREATE EXTENSION IF NOT EXISTS` is not safe to run concurrently: two
 * sessions both find it missing and both try to insert, and one loses on
 * pg_extension_name_index. Test files run in parallel and each applies the
 * migrations, so without this the suite fails in a way that never reproduces
 * when a file is run on its own.
 */
async function ensureExtensions(admin: Database): Promise<void> {
  await admin.withTransaction(async (tx) => {
    // An arbitrary but fixed key: every test process contends on this one lock,
    // and it is released when the transaction ends.
    await tx.query("SELECT pg_advisory_xact_lock($1)", [918_273_645]);
    for (const extension of EXTENSIONS) {
      await tx.query(`CREATE EXTENSION IF NOT EXISTS "${extension}" WITH SCHEMA public`);
    }
  });
}

/**
 * Build an isolated schema for one test file and run the migrations into it.
 * Extensions stay in `public`, which is why it remains on the search path.
 */
export async function createTestSchema(schema: string): Promise<Database> {
  if (!TEST_DATABASE_URL) throw new Error("no test database configured");

  // A short-lived admin connection does the DDL; the returned handle is scoped.
  const admin = connect({ connectionString: TEST_DATABASE_URL });
  try {
    await ensureExtensions(admin);
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.query(`CREATE SCHEMA ${schema}`);
  } finally {
    await admin.close();
  }

  const db = connect({
    connectionString: TEST_DATABASE_URL,
    searchPath: [schema, "public"],
  });
  // The schema migrations, in order. Every file that changes tables or
  // reference rows belongs here, because the repositories write whatever the
  // current schema has: leaving one out makes every profile save in every
  // other test file fail on a column that does not exist yet.
  //
  // 003 and 004 are deliberately not in this list. They grant privileges and
  // attach policies to cluster-wide roles rather than shaping this schema's
  // tables, and postgres.rls.test.ts applies them itself because exercising
  // them is that file's whole purpose.
  for (const file of [
    "001_init.sql",
    "002_seed_reference_data.sql",
    "005_vendor_public_profiles.sql",
    "006_enquiries.sql",
    "007_crew_event_links.sql",
    "008_metro_footprint.sql",
  ]) {
    await db.query(migration(file));
  }
  return db;
}

export async function truncateAll(db: Database): Promise<void> {
  await db.query(`TRUNCATE ${TRANSACTIONAL_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}
