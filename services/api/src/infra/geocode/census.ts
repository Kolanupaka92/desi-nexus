/**
 * The live geocoder: the US Census Bureau's public address service.
 *
 * Chosen over the commercial options for three reasons that matter at this
 * stage. It needs no API key, so there is no credential to leak from a repo or
 * rotate after one does. It is authoritative for US street addresses, which is
 * the entire pilot footprint. And its terms do not restrict storing the
 * coordinates it returns, which the paid map providers generally do -- we keep
 * a venue's point for the life of the gig, so that restriction would rule them
 * out regardless of price.
 *
 * It only covers the United States. That is a real limit, and the right one to
 * accept while the footprint is eight Texas metros.
 */
import { haversineMiles, type LatLng } from "../../domain/geo.js";
import {
  assertSpecificEnough,
  GeocodeError,
  type Geocoder,
  type GeocodeResult,
} from "./index.js";

/** Census publishes a new vintage periodically; this alias tracks the current one. */
const BENCHMARK = "Public_AR_Current";

/**
 * Two matches this close together are the same building described twice --
 * typically one row per ZIP+4 or per side of the street -- not a real choice
 * for the host to make.
 */
const SAME_PLACE_MILES = 0.1;

export interface CensusGeocoderOptions {
  readonly endpoint: string;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

interface CensusMatch {
  readonly matchedAddress?: unknown;
  readonly coordinates?: { readonly x?: unknown; readonly y?: unknown };
}

export class CensusGeocoder implements Geocoder {
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CensusGeocoderOptions) {
    this.endpoint = options.endpoint;
    this.timeoutMs = options.timeoutMs ?? 4_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async geocode(address: string): Promise<GeocodeResult> {
    assertSpecificEnough(address);

    const url = new URL(this.endpoint);
    url.searchParams.set("address", address);
    url.searchParams.set("benchmark", BENCHMARK);
    url.searchParams.set("format", "json");

    let payload: unknown;
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: "application/json" },
        // A host is waiting on a form submit. Beyond a few seconds, failing
        // with "try again" beats holding the request open.
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        throw new GeocodeError("unavailable", `address lookup returned HTTP ${response.status}`);
      }
      payload = await response.json();
    } catch (error) {
      if (error instanceof GeocodeError) throw error;
      // A timeout, a DNS failure, or a body that is not JSON all land here and
      // all mean the same thing to the caller.
      throw new GeocodeError("unavailable", "the address lookup service did not respond");
    }

    return parseCensusResponse(payload);
  }
}

/**
 * Exported so the parser can be tested against recorded payloads without a
 * network call -- the field names and the coordinate order are the parts that
 * break, and neither needs a live service to verify.
 */
export function parseCensusResponse(payload: unknown): GeocodeResult {
  const matches = extractMatches(payload);
  if (matches.length === 0) {
    throw new GeocodeError("not_found", "no address matched that text");
  }

  const parsed = matches.flatMap((match) => {
    const point = toPoint(match.coordinates);
    const formattedAddress = typeof match.matchedAddress === "string" ? match.matchedAddress : "";
    return point && formattedAddress ? [{ point, formattedAddress }] : [];
  });
  if (parsed.length === 0) {
    throw new GeocodeError("unavailable", "the address lookup returned an unreadable result");
  }

  const [first, ...rest] = parsed as [
    { point: LatLng; formattedAddress: string },
    ...Array<{ point: LatLng; formattedAddress: string }>,
  ];
  const elsewhere = rest.filter(
    (candidate) => haversineMiles(first.point, candidate.point) > SAME_PLACE_MILES,
  );
  if (elsewhere.length > 0) {
    throw new GeocodeError(
      "ambiguous",
      "that address matches more than one place -- add the city or ZIP",
      [first.formattedAddress, ...elsewhere.map((candidate) => candidate.formattedAddress)].slice(0, 5),
    );
  }

  return {
    point: first.point,
    formattedAddress: first.formattedAddress,
    // This endpoint interpolates along a TIGER street segment rather than
    // returning a parcel, so claiming rooftop accuracy would overstate it.
    precision: "interpolated",
  };
}

function extractMatches(payload: unknown): readonly CensusMatch[] {
  if (typeof payload !== "object" || payload === null) return [];
  const result = (payload as { result?: unknown }).result;
  if (typeof result !== "object" || result === null) return [];
  const matches = (result as { addressMatches?: unknown }).addressMatches;
  return Array.isArray(matches) ? (matches as CensusMatch[]) : [];
}

/**
 * Census reports coordinates as x/y, not lat/lng.
 *
 * x is longitude and y is latitude. Reading them in the order they are written
 * puts every Texas venue in the Indian Ocean, and the resulting distances are
 * plausible enough numerically that nothing else complains.
 */
function toPoint(coordinates: CensusMatch["coordinates"]): LatLng | undefined {
  const lng = coordinates?.x;
  const lat = coordinates?.y;
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { lat, lng };
}
