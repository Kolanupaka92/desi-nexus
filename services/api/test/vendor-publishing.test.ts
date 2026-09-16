/**
 * Opt-in public vendor profiles.
 *
 * Before this the marketplace was closed: every route but the taxonomy needed
 * a session, and vendor search additionally needed the host role, because a
 * vendor paging through the competitor roster is the other half of the
 * scraping problem. That restriction is deliberate and these tests exist to
 * keep it while adding the one thing it made impossible -- a vendor sending
 * someone a link to their own page.
 *
 * So the properties under test are mostly about what stays shut:
 *  - a profile is public only because its owner said so,
 *  - an unpublished slug is a 404, not a 403, so it cannot be probed,
 *  - the public payload is built by naming fields, so a column added later is
 *    private by default,
 *  - and none of it opens the roster.
 */
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Database } from "../src/infra/postgres/db.js";
import { createTestSchema, skipWithoutDatabase, truncateAll } from "./db.js";
import { createPostgresStore } from "../src/infra/postgres/store.js";
import { createInMemoryStore, type Store } from "../src/infra/store.js";
import { toSlug, publishability } from "../src/domain/users.js";
import { harness, onboard, FRISCO, PLANO, type Harness } from "./helpers.js";

const skip = skipWithoutDatabase;
let db: Database;

before(async () => {
  if (skip) return;
  db = await createTestSchema("test_publishing");
});
after(async () => { if (db) await db.close(); });
beforeEach(async () => { if (!skip) await truncateAll(db); });

const COMPLETE = {
  specialties: ["mua"],
  culturalTags: ["telugu_traditional"],
  startingRateCents: 55_000,
  yearsExperience: 6,
  slug: "anjali-studio",
  businessName: "Anjali Studio",
  headline: "South Indian bridal makeup across Dallas-Fort Worth",
  about: "Twelve years of bridal work, mostly Telugu and Tamil ceremonies, with early call times.",
};

/** A vendor with everything a publish needs. */
async function publishableVendor(h: Harness, email: string, overrides: Record<string, unknown> = {}) {
  const vendor = await onboard(h, { email, roles: ["crew"], homeBase: PLANO });
  const saved = await h.call("POST", "/v1/profiles/crew", { token: vendor.token, body: { ...COMPLETE, ...overrides } });
  assert.equal(saved.status, 201, JSON.stringify(saved.body));
  return vendor;
}

// The domain rules do not need a store behind them.
test("a slug is derived from what the vendor actually types", () => {
  assert.equal(toSlug("Anjali's Studio"), "anjali-s-studio");
  assert.equal(toSlug("  Mehndi by Priya  "), "mehndi-by-priya");
  assert.equal(toSlug("Jhānsi Makeup"), "jhansi-makeup", "marks are stripped, the letter survives");
  assert.equal(toSlug("---"), "", "nothing usable yields nothing, rather than a stray dash");
});

test("publishability names everything missing, not just the first gap", () => {
  const bare = {
    userId: "u1", specialties: ["mua"], culturalTags: [], startingRateCents: 1,
    travelPolicy: {}, unavailableDates: [], yearsExperience: 0, ratingCount: 0,
    completedGigs: 0, portfolioAssetIds: [],
  } as never;
  const { ok, missing } = publishability(bare);
  assert.equal(ok, false);
  assert.deepEqual(missing, ["slug", "businessName", "headline", "about"]);
});

for (const backing of ["memory", "postgres"] as const) {
  const gate = backing === "postgres" ? skip : false;
  const build = (): Store => (backing === "postgres" ? createPostgresStore(db) : createInMemoryStore());
  const at = (n: string) => `${n}-${backing}@plano.test`;

  test(`[${backing}] a vendor publishes their own profile and anyone can read it`, { skip: gate }, async () => {
    const h = harness(build());
    const vendor = await publishableVendor(h, at("pub"));

    const published = await h.call("POST", "/v1/profiles/crew/publish", { token: vendor.token });
    assert.equal(published.status, 200, JSON.stringify(published.body));
    assert.equal((published.body as { published: boolean }).published, true);

    // No token: this is the point of the whole feature.
    const page = await h.call("GET", "/v1/vendors/anjali-studio");
    assert.equal(page.status, 200, JSON.stringify(page.body));
    const vendorBody = (page.body as { vendor: Record<string, unknown> }).vendor;
    assert.equal(vendorBody.businessName, "Anjali Studio");
    assert.equal(vendorBody.slug, "anjali-studio");
  });

  test(`[${backing}] an unpublished profile is not found, not forbidden`, { skip: gate }, async () => {
    // A 403 would confirm the slug exists, which is a way to discover who is
    // on the platform without being on it.
    const h = harness(build());
    await publishableVendor(h, at("quiet"));

    const page = await h.call("GET", "/v1/vendors/anjali-studio");
    assert.equal(page.status, 404);
    assert.equal((page.body as { error: { code: string } }).error.code, "not_found");
  });

  test(`[${backing}] unpublishing takes the page down again`, { skip: gate }, async () => {
    const h = harness(build());
    const vendor = await publishableVendor(h, at("down"));
    await h.call("POST", "/v1/profiles/crew/publish", { token: vendor.token });
    assert.equal((await h.call("GET", "/v1/vendors/anjali-studio")).status, 200);

    const off = await h.call("POST", "/v1/profiles/crew/publish", {
      token: vendor.token, body: { published: false },
    });
    assert.equal(off.status, 200);
    assert.equal((off.body as { published: boolean }).published, false);
    assert.equal((await h.call("GET", "/v1/vendors/anjali-studio")).status, 404);
  });

  test(`[${backing}] an incomplete profile cannot be published`, { skip: gate }, async () => {
    const h = harness(build());
    const vendor = await onboard(h, { email: at("thin"), roles: ["crew"], homeBase: PLANO });
    await h.call("POST", "/v1/profiles/crew", {
      token: vendor.token,
      body: { specialties: ["mua"], culturalTags: ["telugu_traditional"], startingRateCents: 55_000 },
    });

    const refused = await h.call("POST", "/v1/profiles/crew/publish", { token: vendor.token });
    assert.equal(refused.status, 422);
    const body = refused.body as { error: { code: string; details?: { missing?: string[] } } };
    assert.equal(body.error.code, "profile_incomplete");
    assert.deepEqual(
      body.error.details?.missing,
      ["slug", "businessName", "headline", "about"],
      "the vendor is told everything left to do, not sent round once per field",
    );
  });

  test(`[${backing}] the public payload withholds what is not public`, { skip: gate }, async () => {
    // The projection is built by naming fields, so this asserts the contract
    // rather than a blocklist: anything not named above must not appear.
    const h = harness(build());
    const vendor = await publishableVendor(h, at("private"), { unavailableDates: ["2027-06-21"] });
    await h.call("POST", "/v1/profiles/crew/publish", { token: vendor.token });

    const page = await h.call("GET", "/v1/vendors/anjali-studio");
    const serialised = JSON.stringify(page.body);

    for (const leaked of ["unavailableDates", "stripeAccountId", "homeBase", "email", "phone", "userId"]) {
      assert.ok(!serialised.includes(leaked), `the public profile must not carry ${leaked}`);
    }
    assert.ok(!serialised.includes(at("private")), "nor the vendor's email address by value");
    assert.ok(!serialised.includes("2027-06-21"), "nor a date they blocked out");
  });

  test(`[${backing}] a rating is absent rather than invented`, { skip: gate }, async () => {
    // No reviews exist yet. A placeholder score on a public page would be a
    // fabricated trust signal, which is worse than an empty space.
    const h = harness(build());
    const vendor = await publishableVendor(h, at("unrated"));
    await h.call("POST", "/v1/profiles/crew/publish", { token: vendor.token });

    const body = (await h.call("GET", "/v1/vendors/anjali-studio")).body as {
      vendor: Record<string, unknown>;
    };
    assert.equal("ratingAvg" in body.vendor, false, "no rating field at all when there is no rating");
    assert.equal(body.vendor.ratingCount, 0);
    assert.equal(body.vendor.completedGigs, 0);
  });

  test(`[${backing}] a host cannot publish somebody else's profile`, { skip: gate }, async () => {
    const h = harness(build());
    await publishableVendor(h, at("victim"));
    const host = await onboard(h, { email: `host-${backing}@frisco.test`, roles: ["host"], homeBase: FRISCO });

    const denied = await h.call("POST", "/v1/profiles/crew/publish", { token: host.token });
    assert.equal(denied.status, 403, "the route is crew-only, and publishes the caller's own profile");
    assert.equal((await h.call("GET", "/v1/vendors/anjali-studio")).status, 404);
  });

  test(`[${backing}] publishing requires a session`, { skip: gate }, async () => {
    const h = harness(build());
    await publishableVendor(h, at("anon"));
    assert.equal((await h.call("POST", "/v1/profiles/crew/publish", {})).status, 401);
  });

  test(`[${backing}] editing a published profile does not take it offline`, { skip: gate }, async () => {
    // putCrew writes what it is given, and the profile save does not carry
    // publishedAt, so without the carry-over an ordinary edit would silently
    // drop a live page out of the index.
    const h = harness(build());
    const vendor = await publishableVendor(h, at("edit"));
    await h.call("POST", "/v1/profiles/crew/publish", { token: vendor.token });

    const edited = await h.call("POST", "/v1/profiles/crew", {
      token: vendor.token,
      body: { ...COMPLETE, headline: "Telugu and Tamil bridal makeup, Dallas-Fort Worth" },
    });
    assert.equal(edited.status, 201);

    const page = await h.call("GET", "/v1/vendors/anjali-studio");
    assert.equal(page.status, 200, "the page is still live after an ordinary edit");
    assert.equal(
      (page.body as { vendor: { headline: string } }).vendor.headline,
      "Telugu and Tamil bridal makeup, Dallas-Fort Worth",
      "and shows the edit",
    );
  });

  test(`[${backing}] publishing does not open the roster`, { skip: gate }, async () => {
    // The whole bargain: one vendor can be public without the competitor list
    // becoming public. Vendor search stays host-only.
    const h = harness(build());
    const vendor = await publishableVendor(h, at("roster"));
    await h.call("POST", "/v1/profiles/crew/publish", { token: vendor.token });

    const asVendor = await h.call("POST", "/v1/search/crew", {
      token: vendor.token,
      body: { specialty: "mua", venue: FRISCO },
    });
    assert.equal(asVendor.status, 403, "a vendor still cannot browse the roster");

    const anonymous = await h.call("POST", "/v1/search/crew", {
      body: { specialty: "mua", venue: FRISCO },
    });
    assert.equal(anonymous.status, 401, "and neither can a stranger");
  });
}
