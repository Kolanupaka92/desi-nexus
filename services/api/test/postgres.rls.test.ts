/**
 * The whole API, driven through the role production actually connects as.
 *
 * Every other database test connects as the schema owner, and the owner
 * bypasses row-level security -- so the entire policy surface was untested, and
 * the service shipped unable to insert a gig, an escrow or a review as
 * desi_nexus_app. A green suite said nothing about it.
 *
 * This file closes that gap from both directions: the ordinary booking flow has
 * to complete as the restricted role, and a stranger has to be unable to read
 * or touch either party's rows.
 */
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { connect, routed, type Database } from "../src/infra/postgres/db.js";
import { createPostgresStore } from "../src/infra/postgres/store.js";
import { createTestSchema, migration, skipWithoutDatabase, truncateAll, TEST_DATABASE_URL } from "./db.js";
import { harness, onboard, payoutReadyVendor, postWebhook, BRIEF, FRISCO, type Harness } from "./helpers.js";

const skip = skipWithoutDatabase;
const SCHEMA = "test_rls";

let owner: Database;
let appDb: Database;
let systemDb: Database;
let store: ReturnType<typeof createPostgresStore>;

/** The same server and database, connecting as a different role. */
function urlAs(role: string, password: string): string {
  const url = new URL(TEST_DATABASE_URL as string);
  url.username = role;
  url.password = password;
  return url.toString();
}

before(async () => {
  if (skip) return;
  owner = await createTestSchema(SCHEMA);
  // 003 creates the application role, 004 the write policies and the system
  // role. Both resolve against current_schema(), which the search path pins to
  // this file's schema.
  await owner.query(migration("003_app_role.sql"));
  await owner.query(migration("004_rls_write_policies.sql"));
  // The migrations deliberately set no passwords; the secret manager issues
  // them in a real deployment. Here the test does.
  await owner.query(`ALTER ROLE desi_nexus_app WITH PASSWORD 'rls_app_pw'`);
  await owner.query(`ALTER ROLE desi_nexus_system WITH PASSWORD 'rls_sys_pw'`);

  const searchPath = [SCHEMA, "public"];
  appDb = connect({ connectionString: urlAs("desi_nexus_app", "rls_app_pw"), searchPath });
  systemDb = connect({ connectionString: urlAs("desi_nexus_system", "rls_sys_pw"), searchPath });
  store = createPostgresStore(routed(appDb, systemDb));
});

after(async () => {
  if (appDb) await appDb.close();
  if (systemDb) await systemDb.close();
  if (owner) await owner.close();
});

beforeEach(async () => {
  if (!skip) await truncateAll(owner);
});

function h(): Harness {
  return harness(store);
}

test("the role the service connects as does not own the tables", { skip }, async () => {
  // If it did, every policy below would be bypassed and this file would pass
  // while proving nothing.
  const rows = await owner.query<{ owner: string }>(
    `SELECT tableowner AS owner FROM pg_tables WHERE schemaname = $1 AND tablename = 'gigs'`,
    [SCHEMA],
  );
  assert.notEqual(rows[0]?.owner, "desi_nexus_app");
});

test("a host can post a gig as the restricted role", { skip }, async () => {
  // The regression this file exists for: before the write policies, this was a
  // flat 42501 and the marketplace could not take a booking in production.
  const harnessed = h();
  const host = await onboard(harnessed, { email: "rls.host@frisco.test", roles: ["host"], homeBase: FRISCO });

  const created = await harnessed.call("POST", "/v1/gigs", { token: host.token, body: BRIEF });
  assert.equal(created.status, 201, JSON.stringify(created.body));
});

test("the whole booking loop completes as the restricted role", { skip }, async () => {
  const harnessed = h();
  const host = await onboard(harnessed, { email: "rls.host2@frisco.test", roles: ["host"], homeBase: FRISCO });
  const vendor = await payoutReadyVendor(harnessed, "rls.mua@plano.test");

  const created = await harnessed.call("POST", "/v1/gigs", { token: host.token, body: BRIEF });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const gigId = (created.body as { gig: { id: string } }).gig.id;

  const published = await harnessed.call("POST", `/v1/gigs/${gigId}/publish`, { token: host.token });
  assert.equal(published.status, 200, JSON.stringify(published.body));

  // A vendor applying writes to the HOST's gig row (application_count), which
  // is why "only the host may update" would have been the wrong policy.
  const applied = await harnessed.call("POST", `/v1/gigs/${gigId}/applications`, {
    token: vendor.token,
    body: { quotedRateCents: 55_000 },
  });
  assert.equal(applied.status, 201, JSON.stringify(applied.body));
  const applicationId = (applied.body as { application: { id: string } }).application.id;

  const offered = await harnessed.call("POST", `/v1/gigs/${gigId}/offer`, {
    token: host.token,
    body: { applicationId },
  });
  assert.equal(offered.status, 200, JSON.stringify(offered.body));

  // Opening the escrow is the host's INSERT into a policied table.
  const escrowed = await harnessed.call("POST", `/v1/gigs/${gigId}/escrow`, { token: host.token });
  assert.equal(escrowed.status, 201, JSON.stringify(escrowed.body));
  const escrowId = (escrowed.body as { escrow: { id: string } }).escrow.id;

  // And the vendor, a different user, can read the booking they are party to.
  const vendorView = await harnessed.call("GET", `/v1/escrow/${escrowId}`, { token: vendor.token });
  assert.equal(vendorView.status, 200, JSON.stringify(vendorView.body));
});

test("the Stripe webhook records a capture, having no user to act as", { skip }, async () => {
  // The webhook is signature-authenticated and belongs to nobody. Without the
  // system connection the policies match no rows and a captured deposit is
  // silently never recorded -- the worst failure in the system, because Stripe
  // holds the money and the service does not know.
  const harnessed = h();
  const host = await onboard(harnessed, { email: "rls.host3@frisco.test", roles: ["host"], homeBase: FRISCO });
  const vendor = await payoutReadyVendor(harnessed, "rls.mua3@plano.test");

  const created = await harnessed.call("POST", "/v1/gigs", { token: host.token, body: BRIEF });
  const gigId = (created.body as { gig: { id: string } }).gig.id;
  await harnessed.call("POST", `/v1/gigs/${gigId}/publish`, { token: host.token });
  const applied = await harnessed.call("POST", `/v1/gigs/${gigId}/applications`, {
    token: vendor.token,
    body: { quotedRateCents: 55_000 },
  });
  await harnessed.call("POST", `/v1/gigs/${gigId}/offer`, {
    token: host.token,
    body: { applicationId: (applied.body as { application: { id: string } }).application.id },
  });
  const escrowed = await harnessed.call("POST", `/v1/gigs/${gigId}/escrow`, { token: host.token });
  assert.equal(escrowed.status, 201, JSON.stringify(escrowed.body));
  const body = escrowed.body as {
    escrow: { id: string };
    payment: { intentId: string };
    quote: { depositDue: number };
  };

  const delivered = await postWebhook(harnessed, {
    type: "payment_intent.succeeded",
    data: {
      object: {
        id: body.payment.intentId,
        escrowId: body.escrow.id,
        amount: body.quote.depositDue,
        leg: "deposit",
      },
    },
  });
  assert.equal(delivered.status, 200, JSON.stringify(delivered.body));
  assert.equal((delivered.body as { handled: boolean }).handled, true, "the capture must be recorded");
});

test("a stranger cannot read another host's draft gig", { skip }, async () => {
  const harnessed = h();
  const host = await onboard(harnessed, { email: "rls.host4@frisco.test", roles: ["host"], homeBase: FRISCO });
  const stranger = await onboard(harnessed, { email: "rls.nosy@frisco.test", roles: ["host"], homeBase: FRISCO });

  const created = await harnessed.call("POST", "/v1/gigs", { token: host.token, body: BRIEF });
  const gigId = (created.body as { gig: { id: string } }).gig.id;

  // Draft, so the "open gigs" arm of the SELECT policy does not apply and the
  // database itself refuses -- not merely the route's ownership check.
  const peeked = await harnessed.call("GET", `/v1/gigs/${gigId}`, { token: stranger.token });
  assert.equal(peeked.status, 404, JSON.stringify(peeked.body));
});

test("a stranger's own gig list never includes someone else's gigs", { skip }, async () => {
  const harnessed = h();
  const host = await onboard(harnessed, { email: "rls.host5@frisco.test", roles: ["host"], homeBase: FRISCO });
  const stranger = await onboard(harnessed, { email: "rls.nosy2@frisco.test", roles: ["host"], homeBase: FRISCO });
  await harnessed.call("POST", "/v1/gigs", { token: host.token, body: BRIEF });

  const mine = await harnessed.call("GET", "/v1/me/gigs", { token: stranger.token });
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  assert.deepEqual((mine.body as { gigs: unknown[] }).gigs, []);
});

test("the policies, not just the route guards, refuse a cross-tenant write", { skip }, async () => {
  // Go under the API and issue the UPDATE directly as the application role, so
  // this tests the database rather than the handler's ownership check.
  const harnessed = h();
  const host = await onboard(harnessed, { email: "rls.host6@frisco.test", roles: ["host"], homeBase: FRISCO });
  const stranger = await onboard(harnessed, { email: "rls.nosy3@frisco.test", roles: ["host"], homeBase: FRISCO });
  const created = await harnessed.call("POST", "/v1/gigs", { token: host.token, body: BRIEF });
  const gigId = (created.body as { gig: { id: string } }).gig.id;

  const asStranger = appDb.asUser(stranger.userId);
  const updated = await asStranger.query(
    `UPDATE gigs SET state = 'Cancelled' WHERE id = $1 RETURNING id`,
    [gigId],
  );
  assert.equal(updated.length, 0, "a stranger's UPDATE must match no rows");

  const stillDraft = await owner.query<{ state: string }>(`SELECT state FROM gigs WHERE id = $1`, [gigId]);
  assert.equal(stillDraft[0]?.state, "Draft");
});

test("a gig cannot be inserted under someone else's name", { skip }, async () => {
  const harnessed = h();
  const host = await onboard(harnessed, { email: "rls.host7@frisco.test", roles: ["host"], homeBase: FRISCO });
  const attacker = await onboard(harnessed, { email: "rls.bad@frisco.test", roles: ["host"], homeBase: FRISCO });

  // Without the WITH CHECK on the INSERT policy this succeeds, and the attacker
  // then reads it back through the "open gigs" arm of the SELECT policy.
  const asAttacker = appDb.asUser(attacker.userId);
  await assert.rejects(
    asAttacker.query(
      `INSERT INTO gigs (host_id, event_type_code, specialty_code, event_date, venue,
                         budget_min_cents, budget_max_cents)
       VALUES ($1, 'half_saree_function', 'mua', '2027-06-20',
               ST_MakePoint(-96.82, 33.15)::geography, 40000, 90000)`,
      [host.userId],
    ),
    /row-level security/,
  );
});

test("the system role's exemption widens rows, not operations", { skip }, async () => {
  // It may reach every row, and still may not delete one or rewrite the ledger.
  // If the exemption ever grew into a general-purpose superuser, this fails.
  const can = async (action: string, table: string): Promise<boolean> => {
    const rows = await owner.query<{ ok: boolean }>(
      `SELECT has_table_privilege('desi_nexus_system', $1, $2) AS ok`,
      [`${SCHEMA}.${table}`, action],
    );
    return rows[0]?.ok ?? false;
  };
  assert.equal(await can("SELECT", "escrows"), true);
  assert.equal(await can("UPDATE", "escrows"), true);
  assert.equal(await can("DELETE", "escrows"), false, "nothing is ever erased");
  assert.equal(await can("DELETE", "gigs"), false);
  assert.equal(await can("UPDATE", "ledger_entries"), false, "the ledger stays append-only");
  assert.equal(await can("UPDATE", "gig_transitions"), false);
});

test("every RLS table has a policy for every command the service runs", { skip }, async () => {
  // The original bug in one assertion: RLS enabled, SELECT policy written,
  // INSERT and UPDATE forgotten. Enabling RLS on a new table without policies
  // silently denies writes, so this guards the next table as well as these.
  const rows = await owner.query<{ relname: string; cmds: string[] }>(
    `SELECT c.relname,
            array_agg(DISTINCT p.polcmd::text) FILTER (WHERE p.polcmd IS NOT NULL) AS cmds
       FROM pg_class c
       LEFT JOIN pg_policy p ON p.polrelid = c.oid
      WHERE c.relnamespace = $1::regnamespace AND c.relkind = 'r' AND c.relrowsecurity
      GROUP BY c.relname`,
    [SCHEMA],
  );
  assert.ok(rows.length > 0, "expected some tables to have row-level security on");
  for (const row of rows) {
    const cmds = row.cmds ?? [];
    // '*' is FOR ALL, which covers every command on its own.
    const covered = (cmd: string) => cmds.includes(cmd) || cmds.includes("*");
    assert.ok(covered("r"), `${row.relname}: row-level security is on with no SELECT policy`);
    assert.ok(covered("a"), `${row.relname}: row-level security is on with no INSERT policy`);
  }
});
