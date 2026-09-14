/**
 * A small in-process cache in front of a geocoder.
 *
 * Venue addresses repeat far more than they look like they would: a host edits
 * a draft several times before publishing, and the popular banquet halls in
 * Frisco and Sugar Land appear on hundreds of gigs. Each of those is the same
 * lookup returning the same point.
 *
 * Per-process is the right scope here, which is worth saying out loud because
 * this service refuses to run a per-process *rate limiter* in production. The
 * difference is what a miss costs. A rate limiter that each pod keeps privately
 * is not a limit -- the real allowance silently multiplies by the pod count. A
 * cache each pod keeps privately is still a correct cache; the worst case is
 * one extra upstream call, which is what would have happened anyway.
 *
 * Only successes are stored. A failure is usually either a typo the host is
 * about to correct or an outage that is about to end, and neither is worth
 * remembering.
 */
import { normalizeAddress, type Geocoder, type GeocodeResult } from "./index.js";

export interface CachedGeocoderOptions {
  readonly maxEntries?: number;
  readonly ttlMs?: number;
  readonly now?: () => number;
}

interface Entry {
  readonly result: GeocodeResult;
  readonly expiresAt: number;
}

export class CachedGeocoder implements Geocoder {
  private readonly entries = new Map<string, Entry>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(
    private readonly inner: Geocoder,
    options: CachedGeocoderOptions = {},
  ) {
    this.maxEntries = options.maxEntries ?? 5_000;
    // Long, because street addresses do not move. The bound exists so a
    // long-lived pod eventually picks up corrections upstream.
    this.ttlMs = options.ttlMs ?? 7 * 24 * 60 * 60 * 1_000;
    this.now = options.now ?? Date.now;
  }

  async geocode(address: string): Promise<GeocodeResult> {
    const key = normalizeAddress(address);
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) {
      // Re-insert so recently used entries survive eviction.
      this.entries.delete(key);
      this.entries.set(key, hit);
      return hit.result;
    }
    if (hit) this.entries.delete(key);

    const result = await this.inner.geocode(address);
    this.entries.set(key, { result, expiresAt: this.now() + this.ttlMs });
    this.evictIfNeeded();
    return result;
  }

  get size(): number {
    return this.entries.size;
  }

  /** Map iterates in insertion order, so the first key is the least recently used. */
  private evictIfNeeded(): void {
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) return;
      this.entries.delete(oldest.value);
    }
  }
}
