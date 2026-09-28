/**
 * The marketplace rule, and removing the people who break it.
 *
 * The rule: a client or vendor met through Utsav is not taken off the platform
 * to avoid it. Anyone who does is suspended -- and a suspension has to mean
 * the person is actually gone from the app, not merely unable to sign in.
 *
 * Before this, `suspended_at` blocked sign-in and nothing else. A suspended
 * vendor's public page stayed live, and their pending applications stayed in
 * front of hosts, one click from being booked. Nothing could set the column,
 * and nothing recorded why.
 *
 * Every case runs against both stores. The in-memory store merges patches, so
 * a suspension cleared through a patch would silently clear nothing there --
 * exactly the kind of divergence between the two that has shipped before.
 */
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Database } from "../src/infra/postgres/db.js";
import { createTestSchema, skipWithoutDatabase, truncateAll } from "./db.js";
import { createPostgresStore } from "../src/infra/postgres/store.js";
import { createInMemoryStore, type Store } from "../src/infra/store.js";
import { RULES_VERSION } from "../src/domain/users.js";
import { harness, onboard, payoutReadyVendor, BRIEF, FRISCO, PLANO, type Harness } from "./helpers.js";

const skip = skipWithoutDatabase;
let db: Database;

before(async () => { if (!skip) db = await createTestSchema("test_suspension"); });
after(async () => { if (db) await db.close(); });
beforeEach(async () => { if (!skip) await truncateAll(db); });

const PASSWORD = "a-long-enough-passphrase";

/**
 * A real administrator. The admin role cannot be self-assigned at signup, so
 * one is promoted in the store -- how the first admin will be made in
 * production too -- and then signs in again, because roles travel in the token.
 */
async function administrator(h: Harness, email: string) {
  const person = await onboard(h, { email, roles: ["host"], homeBase: FRISCO });
  await h.deps.store.users.update(person.userId, { roles: ["host", "admin"] });
  const signedIn = await h.call("POST", "/v1/auth/login", { body: { email, password: PASSWORD } });
  assert.equal(signedIn.status, 200, JSON.stringify(signedIn.body));
  return { userId: person.userId, token: (signedIn.body as { accessToken: string }).accessToken };
}

const suspend = (h: Harness, token: string, userId: string, reason: unknown) =>
  h.call("POST", `/v1/admin/users/${userId}/suspend`, { token, body: { reason } });
const reinstate = (h: Harness, token: string, userId: string) =>
  h.call("POST", `/v1/admin/users/${userId}/reinstate`, { token });

for (const backing of ["memory", "postgres"] as const) {
  const gate = backing === "postgres" ? skip : false;
  const build = (): Store => (backing === "postgres" ? createPostgresStore(db) : createInMemoryStore());

  test(`[${backing}] a suspension is recorded with its reason, and blocks sign-in`, { skip: gate }, async () => {
    const h = harness(build());
    const admin = await administrator(h, `sus-admin-${backing}@frisco.test`);
    const vendor = await payoutReadyVendor(h, `sus-v1-${backing}@plano.test`);

    const done = await suspend(h, admin.token, vendor.userId, "Took a client met here to WhatsApp to avoid the fee");
    assert.equal(done.status, 200, JSON.stringify(done.body));

    const stored = await h.deps.store.users.byId(vendor.userId);
    assert.ok(stored?.suspendedAt, "suspendedAt must be set");
    assert.equal(stored.suspensionReason, "Took a client met here to WhatsApp to avoid the fee");
    assert.equal(stored.suspendedBy, admin.userId, "who suspended them is part of the record");

    const signIn = await h.call("POST", "/v1/auth/login", {
      body: { email: `sus-v1-${backing}@plano.test`, password: PASSWORD },
    });
    assert.equal(signIn.status, 403);
    assert.equal((signIn.body as { error: { code: string } }).error.code, "account_suspended");
  });

  test(`[${backing}] a suspended vendor's public page is gone, and returns on reinstatement`, { skip: gate }, async () => {
    const h = harness(build());
    const admin = await administrator(h, `sus-admin2-${backing}@frisco.test`);
    const vendor = await onboard(h, { email: `sus-pub-${backing}@plano.test`, roles: ["crew"], homeBase: PLANO });
    const slug = `sus-studio-${backing}`;
    const saved = await h.call("POST", "/v1/profiles/crew", {
      token: vendor.token,
      body: {
        specialties: ["mua"],
        culturalTags: ["telugu_traditional"],
        startingRateCents: 55_000,
        yearsExperience: 6,
        slug,
        businessName: "Suspension Studio",
        headline: "South Indian bridal makeup across Dallas-Fort Worth",
        about: "Twelve years of bridal work, mostly Telugu and Tamil ceremonies, with early call times.",
      },
    });
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    assert.equal((await h.call("POST", "/v1/profiles/crew/publish", { token: vendor.token })).status, 200);
    assert.equal((await h.call("GET", `/v1/vendors/${slug}`)).status, 200, "published and visible to start with");

    await suspend(h, admin.token, vendor.userId, "Repeatedly moved bookings off the platform");
    const hidden = await h.call("GET", `/v1/vendors/${slug}`);
    assert.equal(hidden.status, 404, "a suspended vendor's page must be gone");
    assert.equal(
      (hidden.body as { error: { code: string } }).error.code,
      "not_found",
      "and indistinguishable from a page that never existed -- the site does not announce bans",
    );

    // Visibility is filtered on read, never by editing the profile, so
    // reinstating restores the page with nothing to put back by hand.
    assert.equal((await reinstate(h, admin.token, vendor.userId)).status, 200);
    assert.equal((await h.call("GET", `/v1/vendors/${slug}`)).status, 200, "reinstated, the page is back");
  });

  test(`[${backing}] a suspended vendor's application is hidden from the host and cannot be booked`, { skip: gate }, async () => {
    /*
     * The case that depends on the new check alone. The host's applicant list
     * ranks with includeRejected, so the payout check that happens to hide a
     * suspended vendor from search does NOT hide them here -- they would be
     * listed with a score of 0, one click from a booking. Remove the
     * isSuspended filter in gigs.ts and this fails.
     */
    const h = harness(build());
    const admin = await administrator(h, `sus-admin3-${backing}@frisco.test`);
    const host = await onboard(h, { email: `sus-host-${backing}@frisco.test`, roles: ["host"], homeBase: FRISCO });
    const vendor = await payoutReadyVendor(h, `sus-app-${backing}@plano.test`);

    const created = await h.call("POST", "/v1/gigs", { token: host.token, body: BRIEF });
    const gigId = (created.body as { gig: { id: string } }).gig.id;
    await h.call("POST", `/v1/gigs/${gigId}/publish`, { token: host.token });
    const applied = await h.call("POST", `/v1/gigs/${gigId}/applications`, {
      token: vendor.token,
      body: { quotedRateCents: 50_000 },
    });
    assert.equal(applied.status, 201, JSON.stringify(applied.body));
    const applicationId = (applied.body as { application: { id: string } }).application.id;

    const before = await h.call("GET", `/v1/gigs/${gigId}/applications`, { token: host.token });
    assert.equal((before.body as { applications: unknown[] }).applications.length, 1, "listed before suspension");

    await suspend(h, admin.token, vendor.userId, "Asked the host to pay in cash to skip the platform");

    const after = await h.call("GET", `/v1/gigs/${gigId}/applications`, { token: host.token });
    assert.equal(after.status, 200);
    assert.equal(
      (after.body as { applications: unknown[] }).applications.length,
      0,
      "a suspended vendor's application must not be in front of the host",
    );

    // A host who loaded the list before the suspension can still press "book".
    const offer = await h.call("POST", `/v1/gigs/${gigId}/offer`, {
      token: host.token,
      body: { applicationId },
    });
    assert.equal(offer.status, 409, JSON.stringify(offer.body));
    assert.equal((offer.body as { error: { code: string } }).error.code, "vendor_unavailable");
  });

  test(`[${backing}] a suspended vendor drops out of search, and returns when reinstated`, { skip: gate }, async () => {
    const h = harness(build());
    const admin = await administrator(h, `sus-admin4-${backing}@frisco.test`);
    const host = await onboard(h, { email: `sus-srch-${backing}@frisco.test`, roles: ["host"], homeBase: FRISCO });
    const vendor = await payoutReadyVendor(h, `sus-found-${backing}@plano.test`);

    const search = async () => {
      const found = await h.call("POST", "/v1/search/crew", {
        token: host.token,
        body: { specialty: "mua", venue: FRISCO, culturalTags: ["telugu_traditional"] },
      });
      assert.equal(found.status, 200, JSON.stringify(found.body));
      return (found.body as { results: Array<{ userId: string }> }).results.map((r) => r.userId);
    };

    assert.ok((await search()).includes(vendor.userId), "found before suspension");
    await suspend(h, admin.token, vendor.userId, "Off-platform dealing");
    assert.ok(!(await search()).includes(vendor.userId), "a suspended vendor must not be found");
    await reinstate(h, admin.token, vendor.userId);
    assert.ok((await search()).includes(vendor.userId), "reinstated, they are found again");
  });

  test(`[${backing}] only an administrator can suspend, and never without a reason`, { skip: gate }, async () => {
    const h = harness(build());
    const admin = await administrator(h, `sus-admin5-${backing}@frisco.test`);
    const host = await onboard(h, { email: `sus-plain-${backing}@frisco.test`, roles: ["host"], homeBase: FRISCO });
    const vendor = await payoutReadyVendor(h, `sus-target-${backing}@plano.test`);

    const byHost = await suspend(h, host.token, vendor.userId, "I just don't like them");
    assert.equal(byHost.status, 403, "a host must not be able to remove a vendor");

    const blank = await suspend(h, admin.token, vendor.userId, "   ");
    assert.equal(blank.status, 400, "a suspension without a reason cannot be appealed");
    assert.equal((blank.body as { error: { code: string } }).error.code, "reason_required");

    const self = await suspend(h, admin.token, admin.userId, "testing");
    assert.equal(self.status, 400, "an admin suspending themselves locks out the one person who can undo it");

    assert.equal((await suspend(h, admin.token, vendor.userId, "The first, real reason")).status, 200);
    const again = await suspend(h, admin.token, vendor.userId, "A second reason that would overwrite it");
    assert.equal(again.status, 409);
    assert.equal(
      (await h.deps.store.users.byId(vendor.userId))?.suspensionReason,
      "The first, real reason",
      "the original reason is the record an appeal is judged on, and must survive a second attempt",
    );
  });

  test(`[${backing}] reinstating leaves no trace of the suspension on the account`, { skip: gate }, async () => {
    const h = harness(build());
    const admin = await administrator(h, `sus-admin6-${backing}@frisco.test`);
    const vendor = await payoutReadyVendor(h, `sus-back-${backing}@plano.test`);
    await suspend(h, admin.token, vendor.userId, "Mistaken identity");
    assert.equal((await reinstate(h, admin.token, vendor.userId)).status, 200);

    const user = await h.deps.store.users.byId(vendor.userId);
    assert.equal(user?.suspendedAt, undefined);
    assert.equal(user?.suspensionReason, undefined);
    assert.equal(user?.suspendedBy, undefined);
    const signIn = await h.call("POST", "/v1/auth/login", {
      body: { email: `sus-back-${backing}@plano.test`, password: PASSWORD },
    });
    assert.equal(signIn.status, 200, "a reinstated vendor can sign in again");
  });

  /** A published gig with two applicants; the host books the first. */
  async function bookedGig(h: Harness, tag: string) {
    const host = await onboard(h, { email: `bk-host-${tag}@frisco.test`, roles: ["host"], homeBase: FRISCO });
    const first = await payoutReadyVendor(h, `bk-first-${tag}@plano.test`);
    const second = await payoutReadyVendor(h, `bk-second-${tag}@plano.test`);
    const created = await h.call("POST", "/v1/gigs", { token: host.token, body: BRIEF });
    const gigId = (created.body as { gig: { id: string } }).gig.id;
    await h.call("POST", `/v1/gigs/${gigId}/publish`, { token: host.token });
    const apply = async (token: string) =>
      ((await h.call("POST", `/v1/gigs/${gigId}/applications`, { token, body: { quotedRateCents: 50_000 } }))
        .body as { application: { id: string } }).application.id;
    const firstApp = await apply(first.token);
    const secondApp = await apply(second.token);
    const offered = await h.call("POST", `/v1/gigs/${gigId}/offer`, { token: host.token, body: { applicationId: firstApp } });
    assert.equal(offered.status, 200, JSON.stringify(offered.body));
    return { host, first, second, gigId, firstApp, secondApp };
  }

  test(`[${backing}] a host whose booked vendor is suspended is told, and can book someone else`, { skip: gate }, async () => {
    /*
     * Found in a browser, not by a test: the host saw "Applicants (0)", no word
     * that their booking had gone, and every attempt to rebook was refused as
     * "already offered" because the gig still pointed at the removed vendor.
     */
    const h = harness(build());
    const admin = await administrator(h, `bk-admin-${backing}@frisco.test`);
    const b = await bookedGig(h, `told-${backing}`);

    await suspend(h, admin.token, b.first.userId, "Off-platform dealing");

    const list = await h.call("GET", `/v1/gigs/${b.gigId}/applications`, { token: b.host.token });
    const body = list.body as { applications: Array<{ application: { id: string } }>; bookedVendorRemoved: boolean };
    assert.equal(body.bookedVendorRemoved, true, "the host must be told their booked vendor is gone");
    assert.deepEqual(body.applications.map((r) => r.application.id), [b.secondApp], "only the remaining applicant is offered");

    const rebooked = await h.call("POST", `/v1/gigs/${b.gigId}/offer`, {
      token: b.host.token,
      body: { applicationId: b.secondApp },
    });
    assert.equal(rebooked.status, 200, `the host must be able to rebook: ${JSON.stringify(rebooked.body)}`);
    assert.equal((await h.deps.store.gigs.byId(b.gigId))?.acceptedOfferId, b.secondApp);
    assert.equal(
      (await h.deps.store.applications.byId(b.firstApp))?.status,
      "withdrawn",
      "the removed vendor's booking is withdrawn once the host rebooks",
    );
  });

  test(`[${backing}] a booked vendor who is NOT suspended still cannot be displaced`, { skip: gate }, async () => {
    // The release above must not become a way for a host to swap out a
    // vendor they have already booked.
    const h = harness(build());
    const b = await bookedGig(h, `stay-${backing}`);
    const swap = await h.call("POST", `/v1/gigs/${b.gigId}/offer`, {
      token: b.host.token,
      body: { applicationId: b.secondApp },
    });
    assert.equal(swap.status, 409);
    assert.equal((swap.body as { error: { code: string } }).error.code, "already_offered");
    assert.equal((await h.deps.store.gigs.byId(b.gigId))?.acceptedOfferId, b.firstApp, "the booking stands");
  });

  test(`[${backing}] once a deposit is held, rebooking waits for a person`, { skip: gate }, async () => {
    // What happens to held money when a vendor is removed is a refund, and a
    // refund is not decided by an automatic re-offer.
    const h = harness(build());
    const admin = await administrator(h, `bk-admin2-${backing}@frisco.test`);
    const b = await bookedGig(h, `deposit-${backing}`);
    const escrow = await h.call("POST", `/v1/gigs/${b.gigId}/escrow`, { token: b.host.token });
    assert.ok(escrow.status < 300, `escrow should be created: ${JSON.stringify(escrow.body)}`);

    await suspend(h, admin.token, b.first.userId, "Off-platform dealing");
    const rebook = await h.call("POST", `/v1/gigs/${b.gigId}/offer`, {
      token: b.host.token,
      body: { applicationId: b.secondApp },
    });
    assert.equal(rebook.status, 409);
    assert.equal((rebook.body as { error: { code: string } }).error.code, "booked_vendor_removed_deposit_held");
    assert.equal((await h.deps.store.gigs.byId(b.gigId))?.acceptedOfferId, b.firstApp, "nothing changed");
    assert.notEqual((await h.deps.store.applications.byId(b.firstApp))?.status, "withdrawn");
  });

  test(`[${backing}] reinstating before the host rebooks leaves the booking intact`, { skip: gate }, async () => {
    // Suspension destroys nothing on its own; only the host's rebooking does.
    const h = harness(build());
    const admin = await administrator(h, `bk-admin3-${backing}@frisco.test`);
    const b = await bookedGig(h, `undo-${backing}`);
    await suspend(h, admin.token, b.first.userId, "Mistaken report");
    await reinstate(h, admin.token, b.first.userId);

    const list = await h.call("GET", `/v1/gigs/${b.gigId}/applications`, { token: b.host.token });
    assert.equal((list.body as { bookedVendorRemoved: boolean }).bookedVendorRemoved, false);
    assert.equal((await h.deps.store.gigs.byId(b.gigId))?.acceptedOfferId, b.firstApp, "the original booking is back");
    assert.equal((await h.deps.store.applications.byId(b.firstApp))?.status, "accepted");
  });

  test(`[${backing}] an account cannot be created without agreeing to the rules`, { skip: gate }, async () => {
    const h = harness(build());
    const base = { password: PASSWORD, displayName: "New Host", roles: ["host"], homeBase: FRISCO };

    for (const acceptedRules of [undefined, false, "true", 1]) {
      const refused = await h.call("POST", "/v1/auth/register", {
        body: { ...base, email: `norules-${String(acceptedRules)}-${backing}@frisco.test`, acceptedRules },
      });
      assert.equal(refused.status, 400, `acceptedRules=${JSON.stringify(acceptedRules)} must be refused`);
      assert.equal((refused.body as { error: { code: string } }).error.code, "rules_not_accepted");
    }

    const person = await onboard(h, { email: `agreed-${backing}@frisco.test`, roles: ["host"], homeBase: FRISCO });
    const stored = await h.deps.store.users.byId(person.userId);
    assert.ok(stored?.rulesAcceptedAt, "when they agreed is recorded");
    assert.equal(stored.rulesVersion, RULES_VERSION, "and to which version of the rules");
  });
}
