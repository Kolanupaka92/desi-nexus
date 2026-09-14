/**
 * Turning what a host types into a point on the map.
 *
 * Before this existed the web form made the host pick a metro and submitted the
 * metro's centroid, which meant every venue in Dallas-Fort Worth was the same
 * point. Proximity is 22% of the match score and mileage is billed per mile, so
 * a shared centroid did not merely lose precision -- it silently switched both
 * off inside a metro, where most bookings actually happen. Every vendor read as
 * "0 miles away" and every intra-metro travel fee came out at zero.
 *
 * The address is therefore resolved server-side, never by the browser: it is an
 * input to pricing, and a client that can post its own coordinates is a client
 * that can post coordinates next door to every vendor it wants to undercut.
 */
import type { LatLng } from "../../domain/geo.js";

export type GeocodePrecision =
  /** The geocoder placed the address on a specific parcel or building. */
  | "rooftop"
  /** Interpolated along a street segment from the numbers at each end. */
  | "interpolated"
  /** A ZIP or locality centroid: good enough to show, not to bill from. */
  | "approximate";

export interface GeocodeResult {
  readonly point: LatLng;
  /** The address as the geocoder understood it, to show back to the host. */
  readonly formattedAddress: string;
  readonly precision: GeocodePrecision;
}

export type GeocodeFailure =
  /** No candidate at all. Usually a typo or a non-existent number. */
  | "not_found"
  /** Several genuinely different places match. The host has to disambiguate. */
  | "ambiguous"
  /** Parsed fine but is not specific enough to bill mileage from. */
  | "too_vague"
  /** The provider was unreachable, slow, or returned something unusable. */
  | "unavailable";

export class GeocodeError extends Error {
  constructor(
    readonly code: GeocodeFailure,
    message: string,
    /** Shown to the host when the failure is one they can resolve themselves. */
    readonly candidates: readonly string[] = [],
  ) {
    super(message);
    this.name = "GeocodeError";
  }
}

export interface Geocoder {
  /** Resolve an address, or throw a {@link GeocodeError} explaining why not. */
  geocode(address: string): Promise<GeocodeResult>;
}

/**
 * A stable key for the same address written two ways.
 *
 * "123 Main St." and "123  main st" are one lookup, not two. This only has to
 * be consistent, not clever -- it keys a cache, and a miss costs one request.
 */
export function normalizeAddress(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether the address is specific enough to be worth geocoding.
 *
 * "Frisco, TX" resolves perfectly well -- to the city centroid, which is the
 * exact failure this module was written to remove, just at a smaller radius. A
 * street number is the cheapest available proof that the host meant a building.
 * The US Census geocoder also cannot match venue names ("Marriott Legacy"), so
 * requiring a number costs nothing that provider could have answered anyway.
 */
export function isSpecificEnough(address: string): boolean {
  return /^\s*\d+[a-z]?\s+\S/i.test(address) && /[a-z]/i.test(address);
}

export function assertSpecificEnough(address: string): void {
  if (!isSpecificEnough(address)) {
    throw new GeocodeError(
      "too_vague",
      "include the street number, e.g. \"8000 Warren Pkwy, Frisco TX 75034\" -- " +
        "a city or venue name alone resolves to a centroid, which would price every " +
        "vendor's drive identically",
    );
  }
}
