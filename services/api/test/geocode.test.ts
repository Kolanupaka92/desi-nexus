/**
 * Geocoding: the address a host types becomes the point everything is priced
 * from, so the failures worth testing are the quiet ones -- a coordinate pair
 * read in the wrong order, a city centroid accepted as a venue, an ambiguous
 * match silently resolved to the first row.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  GeocodeError,
  isSpecificEnough,
  normalizeAddress,
  type Geocoder,
  type GeocodeResult,
} from "../src/infra/geocode/index.js";
import { CensusGeocoder, parseCensusResponse } from "../src/infra/geocode/census.js";
import { CachedGeocoder } from "../src/infra/geocode/cached.js";
import { FakeGeocoder } from "../src/infra/geocode/fake.js";
import { haversineMiles } from "../src/domain/geo.js";

const FRISCO_MATCH = {
  matchedAddress: "8000 WARREN PKWY, FRISCO, TX, 75034",
  coordinates: { x: -96.8236, y: 33.1507 },
};

function censusPayload(matches: unknown[]): unknown {
  return { result: { input: {}, addressMatches: matches } };
}

test("normalizing collapses punctuation and spacing to one cache key", () => {
  assert.equal(normalizeAddress("123 Main St."), "123 main st");
  assert.equal(normalizeAddress("  123   MAIN  st  "), "123 main st");
  assert.equal(normalizeAddress("123 Main St., Frisco, TX"), "123 main st frisco tx");
});

test("a city or venue name alone is rejected as too vague", () => {
  // The whole point of the module: these resolve fine, to a centroid, which is
  // the failure being removed rather than a success.
  assert.equal(isSpecificEnough("Frisco, TX"), false);
  assert.equal(isSpecificEnough("Marriott Legacy Town Center"), false);
  assert.equal(isSpecificEnough("75034"), false);
  assert.equal(isSpecificEnough("8000 Warren Pkwy, Frisco TX 75034"), true);
  assert.equal(isSpecificEnough("1201B Elm St, Dallas TX"), true);
});

test("census x/y is longitude/latitude, not the other way round", () => {
  const result = parseCensusResponse(censusPayload([FRISCO_MATCH]));
  assert.equal(result.point.lat, 33.1507);
  assert.equal(result.point.lng, -96.8236);
  // Swapping them puts this venue in the Indian Ocean rather than Texas, and
  // nothing downstream would object -- the distances stay finite.
  assert.ok(haversineMiles(result.point, { lat: 33.15, lng: -96.82 }) < 1);
  assert.equal(result.formattedAddress, "8000 WARREN PKWY, FRISCO, TX, 75034");
  assert.equal(result.precision, "interpolated");
});

test("no matches reads as not_found rather than an empty success", () => {
  assert.throws(
    () => parseCensusResponse(censusPayload([])),
    (error: GeocodeError) => error.code === "not_found",
  );
});

test("duplicate rows for one building are not treated as a choice", () => {
  // Census returns a row per ZIP+4 and per side of the street; they are the
  // same place and must not stall the host with a disambiguation prompt.
  const result = parseCensusResponse(
    censusPayload([
      FRISCO_MATCH,
      { ...FRISCO_MATCH, coordinates: { x: -96.8237, y: 33.1508 } },
    ]),
  );
  assert.equal(result.point.lat, 33.1507);
});

test("genuinely different places are reported as ambiguous with the candidates", () => {
  let caught: unknown;
  try {
    parseCensusResponse(
      censusPayload([
        FRISCO_MATCH,
        { matchedAddress: "8000 WARREN PKWY, HOUSTON, TX", coordinates: { x: -95.42, y: 29.79 } },
      ]),
    );
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof GeocodeError, "expected a GeocodeError");
  assert.equal(caught.code, "ambiguous");
  // Both places travel back, so the host can pick rather than guess.
  assert.deepEqual(caught.candidates, [
    "8000 WARREN PKWY, FRISCO, TX, 75034",
    "8000 WARREN PKWY, HOUSTON, TX",
  ]);
});

test("an unreadable payload fails loudly instead of yielding NaN coordinates", () => {
  for (const broken of [
    censusPayload([{ matchedAddress: "somewhere", coordinates: { x: "-96.8", y: "33.1" } }]),
    censusPayload([{ matchedAddress: "somewhere", coordinates: { x: -96.8 } }]),
    censusPayload([{ coordinates: { x: -96.8, y: 33.1 } }]),
    { result: {} },
    "not json at all",
  ]) {
    assert.throws(
      () => parseCensusResponse(broken),
      (error: unknown) => error instanceof GeocodeError,
    );
  }
});

test("latitude beyond the poles is rejected rather than stored", () => {
  assert.throws(
    () =>
      parseCensusResponse(
        censusPayload([{ matchedAddress: "impossible", coordinates: { x: -96.8, y: 933.1 } }]),
      ),
    (error: GeocodeError) => error.code === "unavailable",
  );
});

test("an HTTP error from the provider is unavailable, not not_found", () => {
  const geocoder = new CensusGeocoder({
    endpoint: "https://example.invalid/geocoder",
    fetchImpl: async () => new Response("upstream is down", { status: 503 }),
  });
  return assert.rejects(
    geocoder.geocode("8000 Warren Pkwy, Frisco TX"),
    (error: GeocodeError) => error.code === "unavailable",
  );
});

test("a vague address never reaches the network", async () => {
  let called = false;
  const geocoder = new CensusGeocoder({
    endpoint: "https://example.invalid/geocoder",
    fetchImpl: async () => {
      called = true;
      return new Response("{}", { status: 200 });
    },
  });
  await assert.rejects(
    geocoder.geocode("Frisco, TX"),
    (error: GeocodeError) => error.code === "too_vague",
  );
  assert.equal(called, false);
});

test("the address is sent as a query parameter with the current benchmark", async () => {
  let seen: URL | undefined;
  const geocoder = new CensusGeocoder({
    endpoint: "https://example.invalid/geocoder",
    fetchImpl: async (input) => {
      seen = new URL(String(input));
      return new Response(JSON.stringify(censusPayload([FRISCO_MATCH])), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  const result = await geocoder.geocode("8000 Warren Pkwy, Frisco TX 75034");
  assert.equal(seen?.searchParams.get("address"), "8000 Warren Pkwy, Frisco TX 75034");
  assert.equal(seen?.searchParams.get("benchmark"), "Public_AR_Current");
  assert.equal(seen?.searchParams.get("format"), "json");
  assert.equal(result.point.lat, 33.1507);
});

test("the cache serves a repeat address without a second upstream call", async () => {
  let calls = 0;
  const inner: Geocoder = {
    async geocode(): Promise<GeocodeResult> {
      calls += 1;
      return { point: { lat: 33.1, lng: -96.8 }, formattedAddress: "somewhere", precision: "interpolated" };
    },
  };
  const cached = new CachedGeocoder(inner);
  await cached.geocode("8000 Warren Pkwy, Frisco TX");
  // Same address, written differently: the normalized key must collapse them.
  await cached.geocode("8000  Warren Pkwy., frisco tx");
  assert.equal(calls, 1);
});

test("the cache re-asks once an entry has expired", async () => {
  let calls = 0;
  let clock = 0;
  const inner: Geocoder = {
    async geocode(): Promise<GeocodeResult> {
      calls += 1;
      return { point: { lat: 33.1, lng: -96.8 }, formattedAddress: "somewhere", precision: "interpolated" };
    },
  };
  const cached = new CachedGeocoder(inner, { ttlMs: 1_000, now: () => clock });
  await cached.geocode("8000 Warren Pkwy, Frisco TX");
  clock = 1_001;
  await cached.geocode("8000 Warren Pkwy, Frisco TX");
  assert.equal(calls, 2);
});

test("a failed lookup is not cached", async () => {
  let calls = 0;
  const inner: Geocoder = {
    async geocode(): Promise<GeocodeResult> {
      calls += 1;
      throw new GeocodeError("unavailable", "down");
    },
  };
  const cached = new CachedGeocoder(inner);
  await assert.rejects(cached.geocode("8000 Warren Pkwy, Frisco TX"));
  await assert.rejects(cached.geocode("8000 Warren Pkwy, Frisco TX"));
  assert.equal(calls, 2, "an outage must not be remembered as a permanent answer");
});

test("the cache evicts the least recently used entry when full", async () => {
  const inner: Geocoder = {
    async geocode(address): Promise<GeocodeResult> {
      return { point: { lat: 33.1, lng: -96.8 }, formattedAddress: address, precision: "interpolated" };
    },
  };
  const cached = new CachedGeocoder(inner, { maxEntries: 2 });
  await cached.geocode("1 A St, Frisco TX");
  await cached.geocode("2 B St, Frisco TX");
  await cached.geocode("3 C St, Frisco TX");
  assert.equal(cached.size, 2);
});

test("the fake scatters addresses instead of collapsing them to one point", async () => {
  const geocoder = new FakeGeocoder();
  const a = await geocoder.geocode("8000 Warren Pkwy, Frisco TX");
  const b = await geocoder.geocode("2601 Preston Rd, Frisco TX");
  // The failure this replaces: every venue in a metro sharing one centroid, so
  // every vendor scored as "0 miles away".
  assert.notDeepEqual(a.point, b.point);
  assert.ok(haversineMiles(a.point, b.point) > 0.05, "two Frisco addresses must not coincide");
  assert.ok(haversineMiles(a.point, b.point) < 10, "two Frisco addresses must stay in Frisco");
});

test("the fake is deterministic across calls", async () => {
  const first = await new FakeGeocoder().geocode("8000 Warren Pkwy, Frisco TX");
  const second = await new FakeGeocoder().geocode("8000 warren pkwy,  frisco tx");
  assert.deepEqual(first.point, second.point);
});

test("the fake puts different cities in their real metros", async () => {
  const geocoder = new FakeGeocoder();
  const frisco = await geocoder.geocode("8000 Warren Pkwy, Frisco TX");
  const katy = await geocoder.geocode("1000 Grand Pkwy, Katy TX");
  const miles = haversineMiles(frisco.point, katy.point);
  // DFW to Greater Houston is a real drive, and the fake has to reflect that or
  // the travel-fee paths are never exercised in development.
  assert.ok(miles > 200 && miles < 300, `expected a cross-metro distance, got ${miles}`);
});

test("the fake honours the same vagueness rule as the live geocoder", () => {
  return assert.rejects(
    new FakeGeocoder().geocode("Frisco, TX"),
    (error: GeocodeError) => error.code === "too_vague",
  );
});
