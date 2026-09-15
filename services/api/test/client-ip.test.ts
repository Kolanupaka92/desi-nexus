/**
 * Which address the rate limiter buckets on.
 *
 * This used to read the FIRST entry of X-Forwarded-For, with a comment claiming
 * that resisted spoofing. It is the opposite: a proxy appends the address it
 * saw rather than replacing the header, so index 0 is whatever the client
 * wrote. Rotating it gave every request a fresh bucket.
 *
 * Verified against the running service before the fix:
 *
 *   twelve logins, one forged address   -> 401 x10, then 429, 429
 *   twelve logins, twelve forged        -> 401 x12, never throttled
 *
 * The budgets that protects are the tightest in the system: `otp` at five per
 * hour is what stands between an attacker and a six-digit phone code, and
 * `auth` at ten per fifteen minutes is what stands between them and credential
 * stuffing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { resolveClientIp } from "../src/app.js";

const DIRECT = "10.0.0.1";

test("with no trusted proxy the header is ignored entirely", () => {
  // Nothing in front of the process, so anything in the header was written by
  // the client and none of it is evidence.
  assert.equal(resolveClientIp("1.2.3.4", DIRECT, 0), DIRECT);
  assert.equal(resolveClientIp("1.2.3.4, 5.6.7.8", DIRECT, 0), DIRECT);
  assert.equal(resolveClientIp(undefined, DIRECT, 0), DIRECT);
});

test("behind one proxy the client is the last entry, not the first", () => {
  // The proxy appended 203.0.113.7; the client wrote the rest.
  assert.equal(resolveClientIp("203.0.113.7", DIRECT, 1), "203.0.113.7");
  assert.equal(resolveClientIp("1.2.3.4, 203.0.113.7", DIRECT, 1), "203.0.113.7");
});

test("a forged prefix cannot change the bucket", () => {
  // The exploit, as one assertion: whatever the attacker prepends, the address
  // the trusted proxy observed is what comes out.
  const real = "203.0.113.7";
  for (const forged of ["1.1.1.1", "8.8.8.8, 9.9.9.9", "  198.51.100.4  ", "not-an-ip"]) {
    assert.equal(resolveClientIp(`${forged}, ${real}`, DIRECT, 1), real);
  }
});

test("rotating a forged prefix yields one bucket, not many", () => {
  // Precisely what made the limiter useless: twelve different forged values
  // must all resolve to the same identity.
  const real = "203.0.113.7";
  const resolved = new Set(
    Array.from({ length: 12 }, (_, i) => resolveClientIp(`198.51.100.${i}, ${real}`, DIRECT, 1)),
  );
  assert.deepEqual([...resolved], [real]);
});

test("two trusted hops count two from the right", () => {
  // A CDN in front of the load balancer.
  assert.equal(resolveClientIp("1.2.3.4, 203.0.113.7, 172.16.0.9", DIRECT, 2), "203.0.113.7");
});

test("repeated headers are one chain, in arrival order", () => {
  // Node hands back an array when a header appears more than once; reading only
  // the first array element would drop the proxy's own appended entry.
  assert.equal(resolveClientIp(["1.2.3.4", "203.0.113.7"], DIRECT, 1), "203.0.113.7");
});

test("a chain shorter than the trusted depth does not fall off the end", () => {
  // A request that reached the service having skipped a proxy. Clamped to the
  // leftmost entry rather than returning undefined.
  assert.equal(resolveClientIp("203.0.113.7", DIRECT, 3), "203.0.113.7");
});

test("an empty or whitespace header falls back to the socket", () => {
  for (const header of ["", "   ", ",", " , "]) {
    assert.equal(resolveClientIp(header, DIRECT, 1), DIRECT);
  }
});
