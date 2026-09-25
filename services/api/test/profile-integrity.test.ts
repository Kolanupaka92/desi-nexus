/**
 * What a profile save is allowed to touch.
 *
 * A vendor editing their profile submits the fields they own. Reputation and
 * payout state are the platform's, and the profile UPSERT used to overwrite
 * both from whatever object the caller happened to construct. The crew route
 * builds a fresh one with no Stripe id and hard-coded zeroes, so an ordinary
 * edit nulled the connected account and reset the vendor's rating -- returning
 * 201, so the vendor was told it had saved correctly.
 *
 * The account id is what canReceivePayouts checks, so losing it makes a
 * bookable vendor unbookable. Money was never at risk (the escrow guard fails
 * closed) but the vendor silently left the market.
 *
 * These run against both stores. The in-memory one had the same defect, and a
 * fix in only one of them would make the two disagree about a vendor's
 * reputation -- the exact divergence the PostgreSQL suite exists to catch.
 */
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Database } from "../src/infra/postgres/db.js";
import { createTestSchema, skipWithoutDatabase, truncateAll } from "./db.js";
import { createPostgresStore } from "../src/infra/postgres/store.js";
import { createInMemoryStore } from "../src/infra/store.js";
import type { Store } from "../src/infra/store.js";
import { harness, onboard, payoutReadyVendor, BRIEF, FRISCO, PLANO } from "./helpers.js";

const skip = skipWithoutDatabase;
let db: Database;

before(async () => { if (!skip) db = await createTestSchema("test_profile_integrity"); });
after(async () => { if (db) await db.close(); });
beforeEach(async () => { if (!skip) await truncateAll(db); });

/** An ordinary edit: the vendor adds a speciality and raises their rate. */
const editProfile = (h: ReturnType<typeof harness>, token: string) =>
  h.call("POST", "/v1/profiles/crew", {
    token,
    body: { specialties: ["mua", "hair_stylist"], startingRateCents: 60_000, culturalTags: ["telugu_traditional"] },
  });

async function bookThrough(h: ReturnType<typeof harness>, hostToken: string, vendorToken: string) {
  const created = await h.call("POST", "/v1/gigs", { token: hostToken, body: BRIEF });
  const gigId = (created.body as { gig: { id: string } }).gig.id;
  await h.call("POST", `/v1/gigs/${gigId}/publish`, { token: hostToken });
  const applied = await h.call("POST", `/v1/gigs/${gigId}/applications`, {
    token: vendorToken, body: { quotedRateCents: 50_000 },
  });
  await h.call("POST", `/v1/gigs/${gigId}/offer`, {
    token: hostToken, body: { applicationId: (applied.body as { application: { id: string } }).application.id },
  });
  return h.call("POST", `/v1/gigs/${gigId}/escrow`, { token: hostToken });
}

/** The same cases against each store, so the two cannot drift apart. */
for (const backing of ["memory", "postgres"] as const) {
  const gate = backing === "postgres" ? skip : false;
  const build = (): Store => (backing === "postgres" ? createPostgresStore(db) : createInMemoryStore());

  test(`[${backing}] editing a profile leaves the vendor bookable`, { skip: gate }, async () => {
    const h = harness(build());
    const host = await onboard(h, { email: `pi-host-${backing}@frisco.test`, roles: ["host"], homeBase: FRISCO });
    const vendor = await payoutReadyVendor(h, `pi-mua-${backing}@plano.test`);

    const before = await bookThrough(h, host.token, vendor.token);
    assert.equal(before.status, 201, "the vendor is bookable to begin with");

    assert.equal((await editProfile(h, vendor.token)).status, 201);

    const after = await bookThrough(h, host.token, vendor.token);
    assert.equal(
      after.status, 201,
      `a profile edit must not make a vendor unbookable (got ${after.status} ` +
      `${JSON.stringify((after.body as { error?: { code: string } }).error?.code)})`,
    );
  });

  test(`[${backing}] a profile edit keeps the event history it did not mention`, { skip: gate }, async () => {
    /*
     * Both stores, because they disagreed.
     *
     * The Postgres store only touches crew_event_links when the incoming
     * profile carries eventTypes; the in-memory store replaced the whole
     * object, so the same request that preserved a vendor's history against
     * the database erased it in development. Nothing failed either way -- the
     * save returned 201 and the vendor simply stopped matching the functions
     * they had spent time recording.
     *
     * editProfile below sends no eventTypes at all, which is exactly what any
     * client written before this field existed sends.
     */
    const h = harness(build());
    const vendor = await payoutReadyVendor(h, `pi-events-${backing}@plano.test`);

    const saved = await h.call("POST", "/v1/profiles/crew", {
      token: vendor.token,
      body: {
        specialties: ["mua"],
        startingRateCents: 60_000,
        culturalTags: ["telugu_traditional"],
        eventTypes: [{ eventType: "half_saree_function", claimedCount: 40 }],
      },
    });
    assert.equal(saved.status, 201);

    assert.equal((await editProfile(h, vendor.token)).status, 201);

    const after = await h.call("GET", `/v1/profiles/crew/${vendor.userId}`, { token: vendor.token });
    const profile = (after.body as { profile?: { eventTypes?: Array<{ eventType: string }> } }).profile;
    assert.ok(
      profile?.eventTypes?.some((entry) => entry.eventType === "half_saree_function"),
      "a save that did not mention event types erased them: " +
        JSON.stringify(profile?.eventTypes),
    );
  });

  test(`[${backing}] search ranks the vendor who has worked the function first`, { skip: gate }, async () => {
    /*
     * End to end through POST /v1/search/crew, and that matters more than it
     * looks.
     *
     * The unit tests call scoreCandidate with a Candidate built by hand, so
     * they pass whether or not toCandidate() actually passes eventTypes
     * through -- I deleted that line and every one of them still went green.
     * That is precisely how `payoutReady` stayed dead for every real search:
     * the rule was written, the tests exercised the rule, and the adapter
     * feeding it never set the field.
     *
     * This test goes through the route, so it fails if the wiring is cut.
     */
    const h = harness(build());
    const host = await onboard(h, { email: `ef-host-${backing}@frisco.test`, roles: ["host"], homeBase: FRISCO });

    const specialist = await payoutReadyVendor(h, `ef-spec-${backing}@plano.test`);
    await h.call("POST", "/v1/profiles/crew", {
      token: specialist.token,
      body: {
        specialties: ["mua"],
        startingRateCents: 55_000,
        culturalTags: ["telugu_traditional"],
        eventTypes: [{ eventType: "half_saree_function", claimedCount: 40 }],
      },
    });

    const generalist = await payoutReadyVendor(h, `ef-gen-${backing}@plano.test`);
    await h.call("POST", "/v1/profiles/crew", {
      token: generalist.token,
      body: {
        specialties: ["mua"],
        startingRateCents: 55_000,
        culturalTags: ["telugu_traditional"],
        eventTypes: [{ eventType: "corporate_offsite", claimedCount: 40 }],
      },
    });

    const found = await h.call("POST", "/v1/search/crew", {
      token: host.token,
      body: {
        specialty: "mua",
        eventType: "half_saree_function",
        venue: FRISCO,
        culturalTags: ["telugu_traditional"],
      },
    });
    assert.equal(found.status, 200, JSON.stringify(found.body));

    const results = (found.body as { results: Array<{ userId: string; score: number }> }).results;
    const spec = results.find((r) => r.userId === specialist.userId);
    const gen = results.find((r) => r.userId === generalist.userId);
    assert.ok(spec && gen, `both vendors should be returned, got ${JSON.stringify(results)}`);
    assert.ok(
      spec.score > gen.score,
      `the vendor who has worked half-saree functions (${spec.score}) must outrank ` +
        `the one who has not (${gen.score}); equal scores mean toCandidate is not ` +
        "passing eventTypes through",
    );
  });

  test(`[${backing}] a profile edit keeps the connected account`, { skip: gate }, async () => {
    const store = build();
    const h = harness(store);
    const vendor = await payoutReadyVendor(h, `pi-acct-${backing}@plano.test`);

    const linked = await store.profiles.crew(vendor.userId);
    assert.ok(linked?.stripeAccountId, "onboarding attached an account");

    await editProfile(h, vendor.token);

    const after = await store.profiles.crew(vendor.userId);
    assert.equal(after?.stripeAccountId, linked?.stripeAccountId, "the account id survives the edit");
    assert.deepEqual([...(after?.specialties ?? [])].sort(), ["hair_stylist", "mua"], "and the edit itself still applied");
    assert.equal(after?.startingRateCents, 60_000);
  });

  test(`[${backing}] a profile edit keeps reputation the platform wrote`, { skip: gate }, async () => {
    const store = build();
    const h = harness(store);
    const vendor = await onboard(h, {
      email: `pi-rep-${backing}@plano.test`, roles: ["crew"], homeBase: PLANO,
    });

    // Stand in for what a review flow will eventually write. Reviews are not
    // implemented, which is the only reason this defect has not already
    // destroyed real reputation data. Written on the profile's first save,
    // which is an insert: it is the update path that must not clobber it.
    await store.profiles.putCrew({
      userId: vendor.userId,
      specialties: ["mua"],
      culturalTags: ["telugu_traditional"],
      startingRateCents: 55_000,
      travelPolicy: { freeRadiusMiles: 25, perMileCents: 90, maxRadiusMiles: 300 },
      unavailableDates: [],
      yearsExperience: 6,
      ratingAvg: 4.8,
      ratingCount: 12,
      completedGigs: 9,
      portfolioAssetIds: [],
    });

    await editProfile(h, vendor.token);

    const after = await store.profiles.crew(vendor.userId);
    assert.equal(after?.ratingCount, 12, "the rating count survives the edit");
    assert.equal(after?.completedGigs, 9, "as does the completed-gig count");
    assert.equal(Number(after?.ratingAvg), 4.8, "as does the average");
  });

  test(`[${backing}] search does not surface a vendor who cannot be paid`, { skip: gate }, async () => {
    const h = harness(build());
    const host = await onboard(h, { email: `pi-shost-${backing}@frisco.test`, roles: ["host"], homeBase: FRISCO });
    // Registered with a profile, but never onboarded to Stripe.
    const unpayable = await onboard(h, { email: `pi-unpay-${backing}@plano.test`, roles: ["crew"], homeBase: PLANO });
    await h.call("POST", "/v1/profiles/crew", {
      token: unpayable.token,
      body: { specialties: ["mua"], culturalTags: ["telugu_traditional"], startingRateCents: 50_000 },
    });

    const found = await h.call("POST", "/v1/search/crew", {
      token: host.token,
      body: { specialty: "mua", venue: FRISCO, eventDate: "2027-06-20", budgetMinCents: 40_000, budgetMaxCents: 90_000 },
    });
    assert.equal(found.status, 200);
    const results = (found.body as { results: { userId: string }[] }).results;
    assert.ok(
      !results.some((r) => r.userId === unpayable.userId),
      "a host must not be shown a vendor the escrow step would refuse",
    );
  });

  test(`[${backing}] a vendor who cannot be paid still sees gigs to apply to`, { skip: gate }, async () => {
    // The payout gate belongs on the host's side of the question. A vendor is
    // allowed to apply once their phone is verified; being booked is what needs
    // payouts. Applying the gate to the vendor's own feed empties it for
    // everyone who has not finished Stripe onboarding -- which today is every
    // vendor, since no route sets id_verified -- with nothing explaining why.
    // The browser end-to-end run caught this; it does not run in CI, so this
    // test is what actually holds the line.
    const h = harness(build());
    const host = await onboard(h, { email: `pi-fhost-${backing}@frisco.test`, roles: ["host"], homeBase: FRISCO });
    const vendor = await onboard(h, { email: `pi-feed-${backing}@plano.test`, roles: ["crew"], homeBase: PLANO });
    await h.call("POST", "/v1/profiles/crew", {
      token: vendor.token,
      body: { specialties: ["mua"], culturalTags: ["telugu_traditional"], startingRateCents: 50_000 },
    });

    const created = await h.call("POST", "/v1/gigs", { token: host.token, body: BRIEF });
    const gigId = (created.body as { gig: { id: string } }).gig.id;
    await h.call("POST", `/v1/gigs/${gigId}/publish`, { token: host.token });

    const feed = await h.call("GET", "/v1/discover/gigs", { token: vendor.token });
    assert.equal(feed.status, 200);
    const gigs = (feed.body as { gigs: { gig: { id: string } }[] }).gigs;
    assert.ok(
      gigs.some((row) => row.gig.id === gigId),
      "a vendor without Stripe onboarding must still see gigs they can apply to",
    );
  });

  test(`[${backing}] a payout-ready vendor is still surfaced`, { skip: gate }, async () => {
    // The guard above is only correct if it does not also hide everyone else.
    const h = harness(build());
    const host = await onboard(h, { email: `pi-shost2-${backing}@frisco.test`, roles: ["host"], homeBase: FRISCO });
    const vendor = await payoutReadyVendor(h, `pi-ok-${backing}@plano.test`);

    const found = await h.call("POST", "/v1/search/crew", {
      token: host.token,
      body: { specialty: "mua", venue: FRISCO, eventDate: "2027-06-20", budgetMinCents: 40_000, budgetMaxCents: 90_000 },
    });
    const results = (found.body as { results: { userId: string }[] }).results;
    assert.ok(results.some((r) => r.userId === vendor.userId), "a bookable vendor is still found");
  });
}
