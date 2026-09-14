/**
 * The geocoder used in development and tests.
 *
 * It does not call anything, but it is deliberately not a stub that returns one
 * fixed point. A fake that answers every address with the same coordinates
 * would reproduce exactly the bug this whole module exists to remove, and the
 * end-to-end test would go green while proximity scoring did nothing.
 *
 * So: the city is read out of the address and the result is scattered
 * deterministically within that city's few square miles. The same address
 * always resolves to the same point, two different addresses in Frisco land
 * near each other but not on top of each other, and an address in Katy is a
 * real two-hour drive from a vendor based in Plano.
 */
import type { LatLng } from "../../domain/geo.js";
import {
  assertSpecificEnough,
  GeocodeError,
  normalizeAddress,
  type Geocoder,
  type GeocodeResult,
} from "./index.js";

/** Cities with enough South Asian event volume to be worth naming. */
const CITIES: ReadonlyArray<readonly [string, LatLng]> = [
  ["frisco", { lat: 33.1507, lng: -96.8236 }],
  ["plano", { lat: 33.0198, lng: -96.6989 }],
  ["allen", { lat: 33.1032, lng: -96.6706 }],
  ["mckinney", { lat: 33.1972, lng: -96.6398 }],
  ["richardson", { lat: 32.9483, lng: -96.7299 }],
  ["irving", { lat: 32.814, lng: -96.9489 }],
  ["carrollton", { lat: 32.9756, lng: -96.89 }],
  ["arlington", { lat: 32.7357, lng: -97.1081 }],
  ["fort worth", { lat: 32.7555, lng: -97.3308 }],
  ["dallas", { lat: 32.7767, lng: -96.797 }],
  ["katy", { lat: 29.7858, lng: -95.8245 }],
  ["sugar land", { lat: 29.6197, lng: -95.6349 }],
  ["pearland", { lat: 29.5636, lng: -95.2861 }],
  ["houston", { lat: 29.7604, lng: -95.3698 }],
  ["round rock", { lat: 30.5083, lng: -97.6789 }],
  ["austin", { lat: 30.2672, lng: -97.7431 }],
  ["san antonio", { lat: 29.4241, lng: -98.4936 }],
  ["el paso", { lat: 31.7619, lng: -106.485 }],
  ["mcallen", { lat: 26.2034, lng: -98.23 }],
  ["corpus christi", { lat: 27.8006, lng: -97.3964 }],
  ["lubbock", { lat: 33.5779, lng: -101.8552 }],
];

/** Unrecognised cities resolve into DFW, the densest pilot metro. */
const FALLBACK: LatLng = { lat: 33.1507, lng: -96.8236 };

/** Roughly how far a street address sits from the city's nominal centre. */
const SCATTER_MILES = 4;
const MILES_PER_DEGREE_LAT = 69;

export class FakeGeocoder implements Geocoder {
  /** Addresses a test wants to pin exactly, keyed by normalized address. */
  private readonly pinned = new Map<string, GeocodeResult>();
  /** Addresses a test wants to fail, keyed by normalized address. */
  private readonly failures = new Map<string, GeocodeError>();

  calls = 0;

  /** Force one address to a known point, for a test that asserts on distance. */
  pin(address: string, result: GeocodeResult): this {
    this.pinned.set(normalizeAddress(address), result);
    return this;
  }

  /** Force one address to fail, for a test that exercises the error path. */
  fail(address: string, error: GeocodeError): this {
    this.failures.set(normalizeAddress(address), error);
    return this;
  }

  async geocode(address: string): Promise<GeocodeResult> {
    this.calls += 1;
    const key = normalizeAddress(address);

    const failure = this.failures.get(key);
    if (failure) throw failure;

    const pinned = this.pinned.get(key);
    if (pinned) return pinned;

    // Held below the pinned lookups so a test can pin a deliberately vague
    // address and still get a result out of it.
    assertSpecificEnough(address);

    const city = CITIES.find(([name]) => key.includes(name));
    const center = city ? city[1] : FALLBACK;
    return {
      point: scatter(center, key),
      formattedAddress: titleCase(key),
      precision: "interpolated",
    };
  }
}

/**
 * Nudge a point a few miles in a direction fixed by the address text.
 *
 * Longitude degrees shrink towards the poles; at Texas latitudes a degree of
 * longitude is about 85% of a degree of latitude, so scattering by equal
 * degrees would stretch the cloud east-west. Correcting keeps the offsets in
 * actual miles.
 */
function scatter(center: LatLng, key: string): LatLng {
  const hash = fnv1a(key);
  const angle = ((hash % 3600) / 3600) * 2 * Math.PI;
  const distance = (((hash >>> 12) % 1000) / 1000) * SCATTER_MILES;
  const dLat = (distance * Math.cos(angle)) / MILES_PER_DEGREE_LAT;
  const lngMilesPerDegree = MILES_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180);
  const dLng = (distance * Math.sin(angle)) / lngMilesPerDegree;
  return { lat: round6(center.lat + dLat), lng: round6(center.lng + dLng) };
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function titleCase(value: string): string {
  return value.replace(/\b[a-z]/g, (character) => character.toUpperCase());
}
