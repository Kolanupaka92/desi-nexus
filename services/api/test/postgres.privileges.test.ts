/**
 * The application role's privileges.
 *
 * Row-level security is bypassed by the table owner, so every policy in
 * 001_init.sql protects nothing unless the service connects as a role that does
 * not own the schema. 003_app_role.sql creates that role; this checks it grants
 * what it should and withholds what it should.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import type { Database } from "../src/infra/postgres/db.js";
import { createTestSchema, migration, skipWithoutDatabase } from "./db.js";

const skip = skipWithoutDatabase;
let db: Database;

before(async () => {
  if (skip) return;
  db = await createTestSchema("test_privs");
  await db.query(migration("003_app_role.sql"));
});

after(async () => {
  if (db) await db.close();
});

/** Ask PostgreSQL directly, rather than inferring from the migration text. */
async function may(action: string, table: string): Promise<boolean> {
  const rows = await db.query<{ ok: boolean }>(
    `SELECT has_table_privilege('desi_nexus_app', $1, $2) AS ok`,
    [table, action],
  );
  return rows[0]?.ok ?? false;
}

test("the application role exists after the migration", { skip }, async () => {
  const rows = await db.query(`SELECT 1 FROM pg_roles WHERE rolname = 'desi_nexus_app'`);
  assert.equal(rows.length, 1);
});

test("the role does not own the tables, so RLS actually binds it", { skip }, async () => {
  const rows = await db.query<{ owner: string }>(
    `SELECT tableowner AS owner FROM pg_tables
     WHERE schemaname = 'test_privs' AND tablename = 'gigs'`,
  );
  assert.notEqual(rows[0]?.owner, undefined, "the migration should have created gigs");
  assert.notEqual(rows[0]?.owner, "desi_nexus_app", "the app role must not own the tables it reads");
});

test("the role can read and write the operational tables", { skip }, async () => {
  for (const table of ["test_privs.users", "test_privs.gigs", "test_privs.escrows", "test_privs.applications"]) {
    assert.ok(await may("SELECT", table), `${table} should be readable`);
    assert.ok(await may("INSERT", table), `${table} should be insertable`);
  }
});

test("the role can never delete a user, a gig, a booking or a ledger row", { skip }, async () => {
  for (const table of [
    "test_privs.users",
    "test_privs.gigs",
    "test_privs.escrows",
    "test_privs.applications",
    "test_privs.ledger_entries",
    "test_privs.gig_transitions",
  ]) {
    assert.equal(await may("DELETE", table), false, `${table} must not be deletable by the service`);
  }
});

test("the append-only tables are insert-only for the service", { skip }, async () => {
  for (const table of ["test_privs.ledger_entries", "test_privs.gig_transitions"]) {
    assert.ok(await may("INSERT", table), `${table} should be insertable`);
    assert.equal(await may("UPDATE", table), false, `${table} must not be updatable`);
  }
});

test("reference data is read-only to the service; it changes by migration", { skip }, async () => {
  for (const table of ["test_privs.event_types", "test_privs.crew_specialties", "test_privs.cultural_tags", "test_privs.metros"]) {
    assert.ok(await may("SELECT", table), `${table} should be readable`);
    assert.equal(await may("INSERT", table), false, `${table} must not be writable at runtime`);
    assert.equal(await may("UPDATE", table), false, `${table} must not be writable at runtime`);
  }
});

test("join tables the service rewrites are deletable, because a set is replaced", { skip }, async () => {
  for (const table of [
    "test_privs.crew_specialty_links",
    "test_privs.crew_cultural_tags",
    "test_privs.gig_cultural_tags",
    "test_privs.gig_languages",
  ]) {
    assert.ok(await may("DELETE", table), `${table} must be replaceable`);
  }
});

/**
 * Enquiries: writable by the application, readable only by the system role.
 *
 * This table holds the contact details of people who never became users, which
 * makes it the most obviously valuable thing on the platform to steal. 006
 * revokes SELECT from the application role so that no session, no role and no
 * mistake in a route can turn into a read of it.
 *
 * The order here is the adversarial one on purpose. `createTestSchema` applies
 * 006, and then the `before` hook above applies 003 -- whose blanket
 * `GRANT SELECT, INSERT, UPDATE ON ALL TABLES` re-grants exactly what 006 took
 * away. Production runs the migrations the other way round and the revoke
 * stands, but an operator re-applying 003 would silently reopen the table, so
 * the privilege is not the thing worth depending on.
 *
 * The thing worth depending on is the policy. RLS is enabled and FORCEd on the
 * table and there is no SELECT policy for the application role, so a SELECT by
 * that role returns no rows whether or not it holds the privilege. Two
 * independent layers, and this asserts the one that survives.
 */
test("the application role can add an enquiry", { skip }, async () => {
  assert.ok(await may("INSERT", "test_privs.enquiries"), "the public form has to be able to write");
});

test("enquiries stay unreadable even when the privilege is granted back", { skip }, async () => {
  // Re-grant it, which is what a re-run of 003 does.
  await db.query(`GRANT SELECT ON test_privs.enquiries TO desi_nexus_app`);
  assert.ok(await may("SELECT", "test_privs.enquiries"), "the privilege is back");

  const policyRows = await db.query<{ policies: number }>(
    `SELECT count(*)::int AS policies
       FROM pg_policies
      WHERE schemaname = 'test_privs'
        AND tablename = 'enquiries'
        AND cmd IN ('SELECT', 'ALL')
        AND (roles = '{public}' OR 'desi_nexus_app' = ANY(roles))`,
  );
  assert.equal(
    policyRows[0]?.policies,
    0,
    "no SELECT policy may reach the application role; without one, RLS returns no rows to it however the privileges are set",
  );

  const forcedRows = await db.query<{ forced: boolean }>(
    `SELECT relrowsecurity AND relforcerowsecurity AS forced
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'test_privs' AND c.relname = 'enquiries'`,
  );
  assert.equal(forcedRows[0]?.forced, true, "RLS must be enabled and forced, or the owner reads straight through it");
});
