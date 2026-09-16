/**
 * Identity verification, and the booking it unblocks.
 *
 * canReceivePayouts requires id_verified. Before this, the only writes to a
 * user's verification level anywhere in the API were `unverified` at
 * registration and `phone_verified` on OTP -- nothing ever set id_verified. So
 * no vendor could be paid, and no booking could reach escrow, through the API
 * at all. The suite did not catch it because the test helper set the column by
 * direct store mutation, which no real vendor can do.
 *
 * The rule these tests defend: a level is granted by a signed webhook and by
 * nothing else. A client that could assert its own verification could assert
 * its way to a payout.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { harness, onboard, postWebhook, BRIEF, FRISCO, PLANO, type Harness } from "./helpers.js";

/** Everything a vendor can do for themselves through the public API. */
async function selfServeVendor(h: Harness, email: string) {
  const vendor = await onboard(h, { email, roles: ["crew"], homeBase: PLANO });
  await h.call("POST", "/v1/auth/mfa/enable", { token: vendor.token });
  const profile = await h.call("POST", "/v1/profiles/crew", {
    token: vendor.token,
    body: { specialties: ["mua"], culturalTags: ["telugu_traditional"], startingRateCents: 55_000, yearsExperience: 6 },
  });
  assert.equal(profile.status, 201, JSON.stringify(profile.body));
  const onboarded = await h.call("POST", "/v1/connect/onboard", { token: vendor.token });
  assert.equal(onboarded.status, 201, JSON.stringify(onboarded.body));
  h.stripe.completeOnboarding((onboarded.body as { accountId: string }).accountId);
  return vendor;
}

const verifiedEvent = (userId: string, sessionId: string) => ({
  type: "identity.verification_session.verified",
  data: { object: { id: sessionId, status: "verified", metadata: { userId } } },
});

test("a vendor can complete a booking using only the public API", async () => {
  // The whole point. Every step below is something a real vendor can do; none
  // of it reaches past the HTTP surface into the database.
  const h = harness();
  const host = await onboard(h, { email: "id-host@frisco.test", roles: ["host"], homeBase: FRISCO });
  const vendor = await selfServeVendor(h, "id-mua@plano.test");

  const started = await h.call("POST", "/v1/identity/verify", { token: vendor.token });
  assert.equal(started.status, 201, JSON.stringify(started.body));
  const { sessionId, verificationUrl } = started.body as { sessionId: string; verificationUrl: string };
  assert.ok(verificationUrl.length > 0, "the vendor is given somewhere to go");

  h.stripe.completeIdentityVerification(sessionId);
  const hook = await postWebhook(h, verifiedEvent(vendor.userId, sessionId));
  assert.equal(hook.status, 200);
  assert.equal((hook.body as { handled: boolean }).handled, true);

  const me = await h.call("GET", "/v1/me", { token: vendor.token });
  assert.equal((me.body as { user: { verification: string } }).user.verification, "id_verified");

  const created = await h.call("POST", "/v1/gigs", { token: host.token, body: BRIEF });
  const gigId = (created.body as { gig: { id: string } }).gig.id;
  await h.call("POST", `/v1/gigs/${gigId}/publish`, { token: host.token });
  const applied = await h.call("POST", `/v1/gigs/${gigId}/applications`, {
    token: vendor.token, body: { quotedRateCents: 50_000 },
  });
  await h.call("POST", `/v1/gigs/${gigId}/offer`, {
    token: host.token, body: { applicationId: (applied.body as { application: { id: string } }).application.id },
  });

  const escrow = await h.call("POST", `/v1/gigs/${gigId}/escrow`, { token: host.token });
  assert.equal(escrow.status, 201, `escrow must now succeed, got ${JSON.stringify(escrow.body)}`);
});

test("starting verification does not by itself grant it", async () => {
  // The guard that matters. If opening a session were enough, the route would
  // be a self-service path to a payout.
  const h = harness();
  const vendor = await selfServeVendor(h, "id-nogrant@plano.test");

  const started = await h.call("POST", "/v1/identity/verify", { token: vendor.token });
  assert.equal(started.status, 201);

  const me = await h.call("GET", "/v1/me", { token: vendor.token });
  assert.equal(
    (me.body as { user: { verification: string } }).user.verification, "phone_verified",
    "opening a verification session must not raise the level",
  );
});

test("an unsigned verification event is refused", async () => {
  const h = harness();
  const vendor = await selfServeVendor(h, "id-unsigned@plano.test");

  const forged = await h.call("POST", "/v1/webhooks/stripe", {
    rawBody: JSON.stringify(verifiedEvent(vendor.userId, "vs_forged")),
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
  });
  assert.equal(forged.status, 400);

  const me = await h.call("GET", "/v1/me", { token: vendor.token });
  assert.equal((me.body as { user: { verification: string } }).user.verification, "phone_verified");
});

test("a replayed verification event does not change anything", async () => {
  const h = harness();
  const vendor = await selfServeVendor(h, "id-replay@plano.test");
  const started = await h.call("POST", "/v1/identity/verify", { token: vendor.token });
  const { sessionId } = started.body as { sessionId: string };

  const first = await postWebhook(h, verifiedEvent(vendor.userId, sessionId));
  assert.equal((first.body as { handled: boolean }).handled, true);

  const second = await postWebhook(h, verifiedEvent(vendor.userId, sessionId));
  assert.equal(second.status, 200, "a replay is acknowledged, not an error Stripe would retry");
  assert.equal((second.body as { handled: boolean }).handled, false, "and changes nothing");

  const me = await h.call("GET", "/v1/me", { token: vendor.token });
  assert.equal((me.body as { user: { verification: string } }).user.verification, "id_verified");
});

test("a verification event for an unknown user is acknowledged, not an error", async () => {
  // Stripe retries a non-2xx forever. An event we cannot act on is not a fault.
  const h = harness();
  const hook = await postWebhook(h, verifiedEvent("00000000-0000-0000-0000-000000000000", "vs_ghost"));
  assert.equal(hook.status, 200);
  assert.equal((hook.body as { handled: boolean }).handled, false);
});

test("a verification event carrying no user is acknowledged, not acted on", async () => {
  const h = harness();
  const hook = await postWebhook(h, {
    type: "identity.verification_session.verified",
    data: { object: { id: "vs_nometa", status: "verified" } },
  });
  assert.equal(hook.status, 200);
  assert.equal((hook.body as { handled: boolean }).handled, false);
});

test("verification never moves a user backwards", async () => {
  // business_verified outranks id_verified. A late or replayed event must not
  // demote someone who has since been upgraded.
  const h = harness();
  const vendor = await selfServeVendor(h, "id-nodemote@plano.test");
  await h.deps.store.users.update(vendor.userId, { verification: "business_verified" });

  const hook = await postWebhook(h, verifiedEvent(vendor.userId, "vs_late"));
  assert.equal(hook.status, 200);
  assert.equal((hook.body as { handled: boolean }).handled, false);

  const me = await h.call("GET", "/v1/me", { token: vendor.token });
  assert.equal((me.body as { user: { verification: string } }).user.verification, "business_verified");
});

test("a host cannot open a vendor identity session", async () => {
  const h = harness();
  const host = await onboard(h, { email: "id-badhost@frisco.test", roles: ["host"], homeBase: FRISCO });
  const denied = await h.call("POST", "/v1/identity/verify", { token: host.token });
  assert.equal(denied.status, 403);
});

test("verification requires a session at all", async () => {
  const h = harness();
  const denied = await h.call("POST", "/v1/identity/verify", {});
  assert.equal(denied.status, 401);
});

test("an already-verified vendor is not charged for a second check", async () => {
  const h = harness();
  const vendor = await selfServeVendor(h, "id-twice@plano.test");
  const started = await h.call("POST", "/v1/identity/verify", { token: vendor.token });
  await postWebhook(h, verifiedEvent(vendor.userId, (started.body as { sessionId: string }).sessionId));

  const again = await h.call("POST", "/v1/identity/verify", { token: vendor.token });
  assert.equal(again.status, 200);
  assert.equal((again.body as { alreadyVerified: boolean }).alreadyVerified, true);
});
