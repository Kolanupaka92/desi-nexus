/**
 * Token-bucket rate limiting.
 *
 * The edge WAF carries the coarse limits; this is the per-identity layer that
 * the WAF cannot express. The buckets that matter are the scraping ones:
 * portfolio and talent-search endpoints are the crown jewels, and an
 * unauthenticated crawler walking the talent index is the most likely way a
 * competitor bootstraps their supply side.
 *
 * `check` is asynchronous because the only correct implementation for more than
 * one replica is a shared one. See `RedisRateLimiter` in ./redisRateLimit.ts:
 * per-process buckets let an attacker multiply their allowance by the replica
 * count, which is not a limit so much as a suggestion.
 */
export interface BucketPolicy {
  readonly capacity: number;
  /** Tokens added per second. */
  readonly refillPerSecond: number;
}

export const POLICIES = {
  /** Credential endpoints: slow, because this is where stuffing shows up. */
  auth: { capacity: 10, refillPerSecond: 10 / 900 },
  /** OTP sends cost money and annoy people; strictest bucket on the service. */
  otp: { capacity: 5, refillPerSecond: 5 / 3600 },
  /** Talent search and portfolio reads: the anti-scraping bucket. */
  discovery: { capacity: 120, refillPerSecond: 1 },
  /** Anything that moves money. */
  payments: { capacity: 30, refillPerSecond: 0.5 },
  /*
   * The public contact form. Anonymous, unauthenticated, and writes a row --
   * which makes it the one endpoint a spam script will find first.
   *
   * Looser than it first looks, and deliberately. The bucket is keyed on the
   * client address, and this audience is overwhelmingly on a phone: carrier
   * CGNAT puts a large number of real people behind one address, so a limit
   * tight enough to be satisfying here silently blocks leads that are indis-
   * tinguishable from an attack. Twenty an hour costs an operator twenty rows
   * to delete in the worst case; the alternative costs them a customer they
   * never hear about, which is the more expensive failure by a wide margin.
   *
   * The honeypot on the form removes the untargeted majority before this is
   * reached, and the edge WAF carries the coarse limits above it.
   */
  enquiry: { capacity: 20, refillPerSecond: 20 / 3600 },
  default: { capacity: 300, refillPerSecond: 5 },
} as const satisfies Record<string, BucketPolicy>;

export type PolicyName = keyof typeof POLICIES;

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface RateDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  /** Seconds until one more token is available. */
  readonly retryAfter: number;
}

/** What the middleware depends on; the backing store is an implementation detail. */
export interface RateLimiter {
  check(identity: string, policyName?: PolicyName, cost?: number): Promise<RateDecision>;
}

/**
 * The in-process limiter.
 *
 * Correct for a single replica, and used by the tests and local runs. It is
 * deliberately not the production default: with two pods behind a load
 * balancer each keeps its own buckets, so the effective limit is doubled.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly clock: () => number = () => Date.now()) {}

  async check(identity: string, policyName: PolicyName = "default", cost = 1): Promise<RateDecision> {
    const policy: BucketPolicy = POLICIES[policyName];
    const key = `${policyName}:${identity}`;
    const now = this.clock();
    const bucket = this.buckets.get(key) ?? { tokens: policy.capacity, updatedAt: now };

    const elapsedSeconds = Math.max(0, (now - bucket.updatedAt) / 1000);
    bucket.tokens = Math.min(policy.capacity, bucket.tokens + elapsedSeconds * policy.refillPerSecond);
    bucket.updatedAt = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      this.buckets.set(key, bucket);
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfter: 0 };
    }

    this.buckets.set(key, bucket);
    const deficit = cost - bucket.tokens;
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(deficit / policy.refillPerSecond),
    };
  }

  /** Drop buckets that have fully refilled, so the map does not grow forever. */
  sweep(): void {
    const now = this.clock();
    for (const [key, bucket] of this.buckets) {
      const policyName = key.slice(0, key.indexOf(":")) as PolicyName;
      const policy = POLICIES[policyName] ?? POLICIES.default;
      const full = (policy.capacity - bucket.tokens) / policy.refillPerSecond;
      if (now - bucket.updatedAt > full * 1000) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}
