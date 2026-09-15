/**
 * Application wiring.
 *
 * Everything the service needs is passed in, so a test can build the whole API
 * over an in-memory store and a fake Stripe gateway and exercise real routes.
 */
import { randomUUID } from "node:crypto";
import { Redis } from "ioredis";
import { Router, readBody, send, HttpError, type RequestContext } from "./http/router.js";
import { errorBoundary, rateLimit } from "./http/middleware.js";
import { registerAuthRoutes } from "./http/routes/auth.js";
import { registerGigRoutes } from "./http/routes/gigs.js";
import { registerPaymentRoutes } from "./http/routes/payments.js";
import { registerDiscoveryRoutes } from "./http/routes/discovery.js";
import { InMemoryRateLimiter, type RateLimiter } from "./infra/rateLimit.js";
import { RedisRateLimiter } from "./infra/redisRateLimit.js";
import { createInMemoryStore, type Store } from "./infra/store.js";
import { connect, routed, withUnitOfWork, type Database } from "./infra/postgres/db.js";
import { createPostgresStore } from "./infra/postgres/store.js";
import type { StripeGateway } from "./infra/stripe/index.js";
import { FakeStripeGateway } from "./infra/stripe/fake.js";
import { liveStripeFromEnv } from "./infra/stripe/live.js";
import { InMemoryEventBus, type EventBus } from "./events/bus.js";
import { OutboxEventBus, OutboxRelay } from "./events/outbox.js";
import type { Geocoder } from "./infra/geocode/index.js";
import { CensusGeocoder } from "./infra/geocode/census.js";
import { CachedGeocoder } from "./infra/geocode/cached.js";
import { FakeGeocoder } from "./infra/geocode/fake.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface AppConfig {
  readonly tokenSecret: string;
  readonly webhookSigningSecret: string;
  /** Set false in production; it exposes OTP codes in responses for local runs. */
  readonly exposeDevSecrets: boolean;
}

export interface AppDeps {
  readonly config: AppConfig;
  readonly store: Store;
  readonly stripe: StripeGateway;
  readonly bus: EventBus;
  readonly limiter: RateLimiter;
  readonly geocoder: Geocoder;
  /**
   * Run a state change and the event describing it in one transaction.
   *
   * A no-op without a database, where there is nothing to be atomic about. Use
   * it only around work that makes no external calls: a Stripe round trip
   * inside a transaction holds a pooled connection across the network.
   */
  readonly unitOfWork: <T>(fn: () => Promise<T>) => Promise<T>;
}

/**
 * Connections this process opened and must close on the way out. Handing back
 * a closer keeps the ownership obvious: whoever built the dependency closes it,
 * and a caller who passed its own store or limiter in is left alone.
 */
const owned: Array<() => Promise<void>> = [];

/**
 * The database this process opened, if it opened one.
 *
 * Set by defaultStore() and read by defaultBus(), so the outbox writes through
 * the same handle the repositories do -- which is what lets an event share the
 * transaction of the state change it describes.
 */
let postgres: Database | undefined;

/** The relay draining the outbox, when there is one. Exposed so index.ts can start it. */
export let outboxRelay: OutboxRelay | undefined;

export function buildDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const config: AppConfig = overrides.config ?? {
    tokenSecret: process.env.DESI_NEXUS_TOKEN_SECRET ?? randomUUID(),
    webhookSigningSecret: process.env.DESI_NEXUS_WEBHOOK_SECRET ?? randomUUID(),
    exposeDevSecrets: process.env.NODE_ENV !== "production",
  };
  // Order matters: defaultStore() is what opens the connection that
  // defaultBus() needs in order to write to the outbox.
  const store = overrides.store ?? defaultStore();
  return {
    config,
    store,
    stripe: overrides.stripe ?? defaultStripeGateway(),
    bus: overrides.bus ?? defaultBus(),
    limiter: overrides.limiter ?? defaultRateLimiter(),
    geocoder: overrides.geocoder ?? defaultGeocoder(),
    unitOfWork:
      overrides.unitOfWork ??
      (postgres ? (fn) => withUnitOfWork(postgres as Database, fn) : (fn) => fn()),
  };
}

/**
 * The outbox when there is a database, the in-memory bus otherwise.
 *
 * Production refuses the in-memory bus for the reason the outbox exists: a
 * process that dies between publishing a gig and notifying the matched vendors
 * loses the notification permanently, and nothing in the system knows it
 * happened. A marketplace that silently fails to tell anyone about a booking is
 * worse than one that will not start.
 *
 * Must be called after defaultStore(), which is what opens the connection.
 */
function defaultBus(): EventBus {
  if (!postgres) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "an outbox requires a database: without one a lost notification is silent and permanent",
      );
    }
    return new InMemoryEventBus();
  }
  const bus = new OutboxEventBus(postgres);
  outboxRelay = new OutboxRelay(postgres, bus, {
    ...(process.env.OUTBOX_POLL_MS ? { intervalMs: Number(process.env.OUTBOX_POLL_MS) } : {}),
  });
  owned.push(async () => outboxRelay?.stop());
  return bus;
}

export async function shutdownDeps(): Promise<void> {
  await Promise.allSettled(owned.map((close) => close()));
  owned.length = 0;
  postgres = undefined;
  outboxRelay = undefined;
}

/**
 * PostgreSQL when a database is configured, in-memory otherwise.
 *
 * Production refuses the in-memory store for the obvious reason: it loses every
 * user, gig and ledger entry on restart, and a marketplace that forgets a
 * booking is worse than one that will not start.
 */
function defaultStore(): Store {
  const url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is required in production: the in-memory store is not durable");
    }
    return createInMemoryStore();
  }
  // Behind a transaction pooler (Supabase's 6543, PgBouncer) the server holds
  // far fewer connections than clients think they have, so keep these modest.
  const max = Number(process.env.DATABASE_POOL_MAX ?? 10);
  const app = connect({ connectionString: url, max });

  // The row-level security policies exempt one role, for the paths that belong
  // to no user: the Stripe webhook and the auto-release sweep. It is a separate
  // login on purpose, so a leaked application password does not carry the
  // exemption. Without it those paths would be refused by the policies and the
  // service would quietly stop recording captured payments -- so production
  // refuses to start rather than discovering that on the first booking.
  const systemUrl = process.env.DATABASE_SYSTEM_URL;
  if (!systemUrl && process.env.NODE_ENV === "production") {
    throw new Error(
      "DATABASE_SYSTEM_URL is required in production: without it the Stripe webhook " +
        "cannot record a capture, because row-level security has no user to act as",
    );
  }
  const system = systemUrl
    ? connect({ connectionString: systemUrl, max: Number(process.env.DATABASE_SYSTEM_POOL_MAX ?? 4) })
    : undefined;

  const db = routed(app, system);
  owned.push(() => db.close());
  postgres = db;
  return createPostgresStore(db);
}

/**
 * A shared limiter when Redis is configured, the in-process one otherwise.
 *
 * Production refuses the in-process limiter outright. With more than one
 * replica it is not a limit at all: each pod keeps its own buckets, so the
 * effective allowance is whatever was configured multiplied by the number of
 * pods. Failing to start is the honest outcome, because the alternative is a
 * service that looks rate limited and is not.
 */
function defaultRateLimiter(): RateLimiter {
  const url = process.env.REDIS_URL;
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("REDIS_URL is required in production: per-pod rate limits are not limits");
    }
    return new InMemoryRateLimiter();
  }
  const client = new Redis(url, {
    // Fail fast rather than queueing requests behind a dead Redis; the limiter
    // degrades to fail-open, which is the behaviour we want during an outage.
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
  client.on("error", (error) => console.error("[redis] client error", error));
  owned.push(async () => {
    await client.quit().catch(() => client.disconnect());
  });
  return new RedisRateLimiter(client);
}

/**
 * Live payments when a key is configured, the fake otherwise.
 *
 * The choice is made by the presence of a key rather than by a flag, so there
 * is no way to be in production with `USE_REAL_STRIPE=false` still set. The
 * production guard in index.ts refuses to start without one.
 */
function defaultStripeGateway(): StripeGateway {
  if (!process.env.STRIPE_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("STRIPE_API_KEY is required in production");
    }
    return new FakeStripeGateway();
  }
  return liveStripeFromEnv();
}

/**
 * The real address service when one is configured, the deterministic fake
 * otherwise.
 *
 * Selected by the presence of an endpoint rather than a flag, like every other
 * dependency here. The endpoint is configuration rather than a constant because
 * the Census service publishes its benchmarks at versioned paths and mirrors
 * exist; pinning it in code would make a provider change a release.
 *
 * Production refuses the fake. Its coordinates are plausible -- deliberately
 * so, to keep proximity scoring honest in development -- which is precisely why
 * shipping it would be dangerous: every gig would carry a confident, wrong
 * venue, and mileage would be billed against it.
 */
function defaultGeocoder(): Geocoder {
  const endpoint = process.env.GEOCODER_URL;
  if (!endpoint) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "GEOCODER_URL is required in production: the fake geocoder invents plausible coordinates",
      );
    }
    return new FakeGeocoder();
  }
  return new CachedGeocoder(
    new CensusGeocoder({
      endpoint,
      ...(process.env.GEOCODER_TIMEOUT_MS
        ? { timeoutMs: Number(process.env.GEOCODER_TIMEOUT_MS) }
        : {}),
    }),
  );
}

export function buildRouter(deps: AppDeps): Router {
  const router = new Router();
  router.use(errorBoundary());
  router.use(rateLimit(deps.limiter, "default"));

  router.get("/healthz", () => ({ status: 200, body: { status: "ok" } }));

  registerAuthRoutes(router, deps);
  registerDiscoveryRoutes(router, deps);
  registerGigRoutes(router, deps);
  registerPaymentRoutes(router, deps);
  return router;
}

/** Turn a node:http request into a RequestContext and dispatch it. */
export function createRequestListener(router: Router) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const traceId = `trc_${randomUUID().slice(0, 12)}`;
    const url = new URL(req.url ?? "/", "http://localhost");
    let rawBody = "";
    try {
      rawBody = await readBody(req);
    } catch (error) {
      if (error instanceof HttpError) {
        send(res, { status: error.status, body: { error: { code: error.code, message: error.message } } }, traceId);
        return;
      }
      throw error;
    }

    let body: unknown;
    if (rawBody.length > 0) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        send(res, { status: 400, body: { error: { code: "invalid_json", message: "request body is not valid JSON" } } }, traceId);
        return;
      }
    }

    const ctx: Omit<RequestContext, "params"> = {
      method: (req.method ?? "GET").toUpperCase(),
      path: url.pathname,
      query: url.searchParams,
      headers: req.headers,
      rawBody,
      body,
      ip: clientIp(req),
      traceId,
    };

    const result = await router.handle(ctx);
    send(res, result, traceId);
  };
}

/**
 * How many proxies in front of this service are ours.
 *
 * Every entry in X-Forwarded-For to the right of the client's own is appended
 * by a proxy; everything to the left of that the client wrote. One hop behind
 * Cloud Run, Vercel or a single load balancer; two if a CDN sits in front of it.
 */
function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "TRUSTED_PROXY_HOPS is required in production: without it the rate limiter " +
          "either trusts a header the client controls or buckets every user together",
      );
    }
    // Nothing in front of the process locally, so the socket is the truth.
    return 0;
  }
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(`TRUSTED_PROXY_HOPS must be a non-negative integer, got: ${raw}`);
  }
  return hops;
}

const TRUSTED_HOPS = trustedProxyHops();

/**
 * The client's address, counted from the right.
 *
 * This used to take the FIRST entry in X-Forwarded-For, with a comment claiming
 * that resisted spoofing. It is the opposite. A proxy appends the address it
 * saw; it does not replace what arrived. So a client sending
 *
 *     X-Forwarded-For: 1.2.3.4
 *
 * reaches the service as "1.2.3.4, <real client>", and reading index 0 returns
 * the value the attacker chose. Rotating it per request gives every request its
 * own rate-limit bucket -- verified against this service: twelve login attempts
 * from one forged address are cut off at the eleventh, and twelve from twelve
 * forged addresses all go through.
 *
 * That is not a throttling nuisance. The tightest budget in the system is `otp`
 * at five per hour, which is what stands between an attacker and brute-forcing
 * a six-digit phone code, and `auth` at ten per fifteen minutes is what stands
 * between them and credential stuffing.
 *
 * Counting from the right fixes it: with one trusted proxy the last entry is
 * the address that proxy actually observed, and nothing the client writes can
 * move it.
 */
export function resolveClientIp(
  header: string | string[] | undefined,
  direct: string,
  trustedHops: number,
): string {
  if (trustedHops <= 0) return direct;

  // Node joins repeated headers into an array; the forwarded chain is their
  // concatenation in arrival order.
  const chain = (Array.isArray(header) ? header.join(",") : (header ?? ""))
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (chain.length === 0) return direct;

  // One hop => the last entry. Clamped, so a short chain (a request that
  // skipped a proxy) falls back to the leftmost entry rather than undefined.
  const index = Math.max(0, chain.length - trustedHops);
  return chain[index] ?? direct;
}

function clientIp(req: IncomingMessage): string {
  return resolveClientIp(
    req.headers["x-forwarded-for"],
    req.socket.remoteAddress ?? "unknown",
    TRUSTED_HOPS,
  );
}
