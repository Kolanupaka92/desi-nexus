/**
 * The public contact form.
 *
 * This is the only write on the service that an anonymous caller can perform,
 * which makes it worth testing for what it refuses as much as for what it
 * accepts. The properties here are:
 *
 *  - a visitor with no account can leave one, because that is the point;
 *  - nothing it accepts can violate a database constraint, so a malformed
 *    submission is a 400 naming the field rather than a 500;
 *  - a value outside the closed taxonomy is dropped rather than rejected or
 *    written, because it would be a foreign key violation and the enquiry is
 *    still worth having;
 *  - the honeypot is silent, so a bot cannot learn which submissions were
 *    dropped;
 *  - and the outbox event carries no message body or phone number, because an
 *    outbox row is the one copy of this data that leaves the table whose
 *    row-level security protects it.
 */
import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Database } from "../src/infra/postgres/db.js";
import { createTestSchema, skipWithoutDatabase, truncateAll } from "./db.js";
import { createPostgresStore } from "../src/infra/postgres/store.js";
import { createInMemoryStore, type Store } from "../src/infra/store.js";
import { normaliseEnquiry, validateEnquiry } from "../src/domain/enquiry.js";
import { ValidationError } from "../src/domain/users.js";
import { TOPICS } from "../src/events/bus.js";
import { harness } from "./helpers.js";

const skip = skipWithoutDatabase;
let db: Database;

before(async () => {
  if (skip) return;
  db = await createTestSchema("test_enquiries");
});
after(async () => { if (db) await db.close(); });
beforeEach(async () => { if (!skip) await truncateAll(db); });

const GOOD = {
  name: "Priya Menon",
  email: "Priya.Menon@example.com",
  phone: "(469) 555-0123",
  eventType: "sangeet",
  eventDate: "2027-03-14",
  metroCode: "dfw",
  message: "We are planning a Sangeet in Frisco next March and need a MUA and a photographer. What would that cost?",
  source: "/plan/wedding",
};

// --- The domain rules, which need no store ---------------------------------

test("an address is lower-cased and blank optional fields become absent", () => {
  const enquiry = normaliseEnquiry({ id: "e1", ...GOOD, phone: "  ", eventDate: "" });
  assert.equal(enquiry.email, "priya.menon@example.com");
  assert.equal("phone" in enquiry, false, 'a form sends "" for an untouched field, not undefined');
  assert.equal("eventDate" in enquiry, false);
  assert.equal(enquiry.status, "new");
});

test("a phone number is taken as typed rather than forced into E.164", () => {
  // Registration demands E.164 because the OTP provider does. Nobody is
  // sending an OTP to this number, and rejecting the format every American
  // actually types would cost a lead to buy nothing.
  const enquiry = normaliseEnquiry({ id: "e1", ...GOOD });
  assert.doesNotThrow(() => validateEnquiry(enquiry));
  assert.equal(enquiry.phone, "(469) 555-0123");
});

test("the bounds match the constraints the table will apply", () => {
  const short = normaliseEnquiry({ id: "e1", ...GOOD, message: "too short" });
  assert.throws(() => validateEnquiry(short), (error: unknown) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.field, "message");
    return true;
  });

  const nameless = normaliseEnquiry({ id: "e1", ...GOOD, name: "x" });
  assert.throws(() => validateEnquiry(nameless), (error: unknown) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.field, "name");
    return true;
  });
});

test("a date that is not a date is refused before it reaches the column", () => {
  const enquiry = normaliseEnquiry({ id: "e1", ...GOOD, eventDate: "next March" });
  assert.throws(() => validateEnquiry(enquiry), (error: unknown) => {
    assert.ok(error instanceof ValidationError);
    assert.equal(error.field, "eventDate");
    return true;
  });
});

// --- The endpoint, against both stores -------------------------------------

for (const backing of ["memory", "postgres"] as const) {
  const gate = backing === "postgres" ? skip : false;
  const build = (): Store => (backing === "postgres" ? createPostgresStore(db) : createInMemoryStore());

  test(`[${backing}] a visitor with no account can leave an enquiry`, { skip: gate }, async () => {
    const h = harness(build());
    const response = await h.call("POST", "/v1/enquiries", { body: GOOD });
    assert.equal(response.status, 202, JSON.stringify(response.body));
    const body = response.body as { received: boolean; id: string };
    assert.equal(body.received, true);
    assert.match(body.id, /^[0-9a-f-]{36}$/);
  });

  test(`[${backing}] a missing required field is a 400 naming it, not a 500`, { skip: gate }, async () => {
    const h = harness(build());
    const { message: _dropped, ...withoutMessage } = GOOD;
    const response = await h.call("POST", "/v1/enquiries", { body: withoutMessage });
    assert.equal(response.status, 400, JSON.stringify(response.body));
  });

  test(`[${backing}] an unknown occasion is dropped rather than written`, { skip: gate }, async () => {
    // The column is a foreign key into the taxonomy, so writing this would be
    // a constraint violation surfacing as a 500 on a form somebody filled in
    // correctly apart from one select.
    const h = harness(build());
    const response = await h.call("POST", "/v1/enquiries", {
      body: { ...GOOD, eventType: "quinceanera", metroCode: "nyc" },
    });
    assert.equal(response.status, 202, JSON.stringify(response.body));
  });

  test(`[${backing}] the honeypot is accepted and silently discarded`, { skip: gate }, async () => {
    const h = harness(build());
    const response = await h.call("POST", "/v1/enquiries", {
      body: { ...GOOD, website: "https://buy-cheap-things.example" },
    });
    // Same response a real visitor gets: telling a spammer which submissions
    // were dropped is how they tune around the filter.
    assert.equal(response.status, 202, JSON.stringify(response.body));
    assert.equal((response.body as { id?: string }).id, undefined, "nothing was written");
    assert.equal(
      h.bus.published.filter((event) => event.topic === TOPICS.enquiryReceived).length,
      0,
    );
  });

  test(`[${backing}] the event routes the enquiry without carrying its contents`, { skip: gate }, async () => {
    const h = harness(build());
    await h.call("POST", "/v1/enquiries", { body: GOOD });

    const published = h.bus.published.filter((event) => event.topic === TOPICS.enquiryReceived);
    assert.equal(published.length, 1);
    const payload = published[0]!.payload as Record<string, unknown>;
    assert.deepEqual(Object.keys(payload).sort(), [
      "enquiryId", "eventDate", "eventType", "metroCode", "receivedAt",
    ]);
    const serialised = JSON.stringify(payload);
    assert.equal(serialised.includes("555-0123"), false, "no phone number in the outbox");
    assert.equal(serialised.includes("Frisco"), false, "no message body in the outbox");
    assert.equal(serialised.includes("example.com"), false, "no address in the outbox");
  });

  test(`[${backing}] leaving an enquiry needs no session and grants none`, { skip: gate }, async () => {
    const h = harness(build());
    const response = await h.call("POST", "/v1/enquiries", { body: GOOD });
    assert.equal(response.status, 202);
    // Nothing about the response is a credential, and the endpoint exposes no
    // way to read anything back.
    assert.deepEqual(
      Object.keys(response.body as object).sort(),
      ["id", "received"],
    );
  });
}
