/**
 * Profile and talent-discovery endpoints.
 *
 * This is the surface a competitor would most like to scrape, so it is
 * authenticated, rate-limited on the strict discovery bucket, and returns
 * contact details to nobody. A host reaches a vendor through the in-app thread
 * that a booking creates, not through a phone number lifted from a search
 * result.
 */
import { HttpError, type Router } from "../router.js";
import { authenticate, field, isNumber, isObject, isString, isStringArray, rateLimit, requireRole } from "../middleware.js";
import {
  validateCrewProfile,
  ValidationError,
  totalLocalReach,
  canReceivePayouts,
  toSlug,
  publishability,
  toPublicVendorProfile,
  type CrewProfile,
} from "../../domain/users.js";
import { rankCandidates, type Candidate } from "../../domain/matching.js";
import { CREW_SPECIALTIES, CULTURAL_TAGS, EVENT_GROUPS, LANGUAGES, CUSTOMARY_CREW, isEventType } from "../../domain/taxonomy.js";
import { TEXAS_METROS, quoteTravel } from "../../domain/geo.js";
import { isPgError, UNIQUE_VIOLATION } from "../../infra/postgres/db.js";
import type { AppDeps } from "../../app.js";

export function registerDiscoveryRoutes(router: Router, deps: AppDeps): void {
  const { config, store, limiter } = deps;
  const requireAuth = authenticate(config.tokenSecret);
  const discoveryLimit = rateLimit(limiter, "discovery");

  /** The vocabulary the clients render their pickers from. Public and cacheable. */
  router.get("/v1/taxonomy", () => ({
    status: 200,
    body: {
      eventGroups: EVENT_GROUPS,
      crewSpecialties: CREW_SPECIALTIES,
      culturalTags: CULTURAL_TAGS,
      languages: LANGUAGES,
      metros: TEXAS_METROS,
    },
    headers: { "cache-control": "public, max-age=3600" },
  }));

  /** What a given event customarily needs, to pre-fill the gig wizard. */
  router.get("/v1/taxonomy/event/:eventType", (ctx) => {
    const eventType = ctx.params.eventType as string;
    if (!isEventType(eventType)) {
      throw new HttpError(404, "unknown_event_type", `no such event type: ${eventType}`);
    }
    return {
      status: 200,
      body: { eventType, customaryCrew: CUSTOMARY_CREW[eventType] ?? [] },
      headers: { "cache-control": "public, max-age=3600" },
    };
  });

  router.post(
    "/v1/profiles/crew",
    async (ctx) => {
      const userId = ctx.auth?.sub as string;
      const body = ctx.body as Record<string, unknown>;
      const specialties = field(ctx, "specialties", isStringArray);
      const startingRateCents = field(ctx, "startingRateCents", isNumber);
      const existing = await store.profiles.crew(userId);

      const profile: CrewProfile = {
        userId,
        specialties: specialties as CrewProfile["specialties"],
        culturalTags: (Array.isArray(body.culturalTags) ? body.culturalTags : []) as CrewProfile["culturalTags"],
        startingRateCents,
        travelPolicy: (isObject(body.travelPolicy) ? body.travelPolicy : {}) as CrewProfile["travelPolicy"],
        unavailableDates: (Array.isArray(body.unavailableDates) ? body.unavailableDates : []) as string[],
        yearsExperience: typeof body.yearsExperience === "number" ? body.yearsExperience : 0,
        ratingCount: 0,
        completedGigs: 0,
        portfolioAssetIds: (Array.isArray(body.portfolioAssetIds) ? body.portfolioAssetIds : []) as string[],
        // The public profile's fields. A vendor fills these in over time; none
        // is required until they ask to publish. The slug is normalised rather
        // than taken as typed, so a vendor who enters "Anjali's Studio" gets a
        // URL instead of a validation error.
        ...(typeof body.slug === "string" && body.slug.trim() ? { slug: toSlug(body.slug) } : {}),
        ...(typeof body.businessName === "string" ? { businessName: body.businessName.trim() } : {}),
        ...(typeof body.headline === "string" ? { headline: body.headline.trim() } : {}),
        ...(typeof body.about === "string" ? { about: body.about.trim() } : {}),
        ...(typeof body.profileAssetId === "string" ? { profileAssetId: body.profileAssetId } : {}),
        // Carried over, never accepted from the caller: publishing is its own
        // route. Without this an edit would drop a live profile out of the
        // index, since putCrew writes what it is given.
        ...(existing?.publishedAt ? { publishedAt: existing.publishedAt } : {}),
      };

      try {
        validateCrewProfile(profile);
      } catch (error) {
        if (error instanceof ValidationError) {
          throw new HttpError(400, "invalid_request", error.message, { field: error.field });
        }
        throw error;
      }

      const saved = await store.profiles.putCrew(profile);
      return { status: 201, body: { profile: saved } };
    },
    requireAuth,
    requireRole("crew"),
  );

  router.get(
    "/v1/profiles/crew/:userId",
    async (ctx) => {
      const profile = await store.profiles.crew(ctx.params.userId as string);
      if (!profile) throw new HttpError(404, "not_found", "no such crew profile");
      const user = await store.users.byId(profile.userId);
      return {
        status: 200,
        body: {
          profile: {
            ...profile,
            // Never leak the connected-account id to another user.
            stripeAccountId: undefined,
            displayName: user?.displayName,
            metroId: user?.metroId,
            languages: user?.languages ?? [],
          },
        },
      };
    },
    requireAuth,
    discoveryLimit,
  );

  router.post(
    "/v1/profiles/creator",
    async (ctx) => {
      const userId = ctx.auth?.sub as string;
      const body = ctx.body as Record<string, unknown>;
      const disciplines = field(ctx, "disciplines", isStringArray);
      const socials = (Array.isArray(body.socials) ? body.socials : []) as never[];

      const saved = await store.profiles.putCreator({
        userId,
        disciplines: disciplines as never,
        culturalTags: (Array.isArray(body.culturalTags) ? body.culturalTags : []) as never,
        socials,
        unavailableDates: (Array.isArray(body.unavailableDates) ? body.unavailableDates : []) as string[],
        portfolioAssetIds: (Array.isArray(body.portfolioAssetIds) ? body.portfolioAssetIds : []) as string[],
        ratingCount: 0,
        ...(typeof body.heightCm === "number" ? { heightCm: body.heightCm } : {}),
        ...(typeof body.dayRateCents === "number" ? { dayRateCents: body.dayRateCents } : {}),
        ...(typeof body.ratePerPostCents === "number" ? { ratePerPostCents: body.ratePerPostCents } : {}),
      });

      return {
        status: 201,
        body: { profile: saved, localReach: totalLocalReach(saved) },
      };
    },
    requireAuth,
    requireRole("creator"),
  );

  /**
   * Publish or unpublish a vendor's own profile.
   *
   * The only route that can make anything on this platform readable without a
   * session, which is why it is a deliberate action rather than a field on the
   * profile save: a vendor decides to be public, and can decide to stop.
   *
   * It publishes the caller's own profile and no one else's -- there is no
   * userId in the path or the body to get wrong.
   */
  router.post(
    "/v1/profiles/crew/publish",
    async (ctx) => {
      const userId = ctx.auth?.sub as string;
      const profile = await store.profiles.crew(userId);
      if (!profile) throw new HttpError(404, "not_found", "create a vendor profile first");

      const body = (ctx.body ?? {}) as Record<string, unknown>;
      // Default to publishing; `{ "published": false }` takes it back down.
      const wantsPublished = body.published !== false;

      if (!wantsPublished) {
        await store.profiles.setPublished(userId, undefined);
        return { status: 200, body: { published: false } };
      }

      const { ok, missing } = publishability(profile);
      if (!ok) {
        throw new HttpError(
          422,
          "profile_incomplete",
          `add ${missing.join(", ")} before publishing`,
          { missing },
        );
      }

      const publishedAt = profile.publishedAt ?? new Date().toISOString();
      try {
        await store.profiles.setPublished(userId, publishedAt);
      } catch (error) {
        // Someone else holds the slug. The database decides this, not a
        // read-then-write in the service, which two vendors publishing at once
        // would lose.
        if (isPgError(error, UNIQUE_VIOLATION)) {
          throw new HttpError(409, "slug_taken", `the address ${profile.slug} is already in use`);
        }
        throw error;
      }
      return {
        status: 200,
        body: { published: true, publishedAt, slug: profile.slug, url: `/vendors/${profile.slug}` },
      };
    },
    requireAuth,
    requireRole("crew"),
  );

  /**
   * A published vendor profile, by slug. No session required.
   *
   * The first genuinely public endpoint on this service other than the
   * taxonomy, so its two properties are worth stating plainly.
   *
   * It reads published profiles only, and an unpublished slug is a 404 rather
   * than a 403 -- a vendor who has not opted in should not be discoverable by
   * guessing, and the response must not confirm that a name is taken.
   *
   * It returns a projection built by naming public fields, never the stored
   * record with private ones removed. That is what keeps a column added later
   * from being public by accident. See toPublicVendorProfile.
   *
   * This does not open the roster: there is no way to list from here, so it
   * answers "show me this vendor", not "show me your vendors". The competitor
   * roster stays behind the host-only search below.
   */
  router.get(
    "/v1/vendors/:slug",
    async (ctx) => {
      const profile = await store.profiles.publishedBySlug(ctx.params.slug as string);
      if (!profile) throw new HttpError(404, "not_found", "no such vendor");

      const user = await store.users.byId(profile.userId);
      if (!user) throw new HttpError(404, "not_found", "no such vendor");

      const published = toPublicVendorProfile(profile, user);
      if (!published) throw new HttpError(404, "not_found", "no such vendor");
      return { status: 200, body: { vendor: published } };
    },
    // Anonymous, so the bucket is the client address rather than a session.
    discoveryLimit,
  );

  /**
   * Search the talent index against a brief. Hosts only: a vendor browsing the
   * full competitor roster is the other half of the scraping problem.
   */
  router.post(
    "/v1/search/crew",
    async (ctx) => {
      const specialty = field(ctx, "specialty", isString);
      const venue = field(ctx, "venue", isObject) as { lat: number; lng: number };
      const body = ctx.body as Record<string, unknown>;

      const brief = {
        eventType: (typeof body.eventType === "string" ? body.eventType : "reception") as never,
        specialty: specialty as never,
        eventDate: (typeof body.eventDate === "string" ? body.eventDate : "") as string,
        venue,
        metroId: "",
        budgetMinCents: typeof body.budgetMinCents === "number" ? body.budgetMinCents : 0,
        budgetMaxCents: typeof body.budgetMaxCents === "number" ? body.budgetMaxCents : Number.MAX_SAFE_INTEGER,
        culturalTags: (Array.isArray(body.culturalTags) ? body.culturalTags : []) as never,
        languages: (Array.isArray(body.languages) ? body.languages : []) as never,
      };

      const profiles = await store.profiles.crewBySpecialty(specialty);
      const candidates = await Promise.all(profiles.map((profile) => toCandidate(profile, store)));
      const ranked = rankCandidates(candidates, brief, { limit: 25 });

      const results = await Promise.all(
        ranked.map(async (match) => {
          const user = await store.users.byId(match.userId);
          return {
            userId: match.userId,
            displayName: user?.displayName ?? "",
            metroId: user?.metroId ?? "",
            score: match.score,
            breakdown: match.breakdown,
            travelMiles: match.travelMiles,
            travelFeeCents: match.travelFeeCents,
          };
        }),
      );
      return { status: 200, body: { results, count: results.length } };
    },
    requireAuth,
    requireRole("host", "admin"),
    discoveryLimit,
  );

  /** Price a trip before anyone commits, so both sides see the same number. */
  router.post(
    "/v1/travel/quote",
    async (ctx) => {
      const base = field(ctx, "base", isObject) as { lat: number; lng: number };
      const venue = field(ctx, "venue", isObject) as { lat: number; lng: number };
      const body = ctx.body as Record<string, unknown>;
      const quote = quoteTravel(base, venue, isObject(body.policy) ? (body.policy as never) : undefined);
      return { status: 200, body: quote };
    },
    requireAuth,
    discoveryLimit,
  );
}

/** Join a stored crew profile with its base user into a match candidate. */
export async function toCandidate(
  profile: CrewProfile,
  store: AppDeps["store"],
): Promise<Candidate> {
  const user = await store.users.byId(profile.userId);
  return {
    userId: profile.userId,
    // Matching disqualifies a candidate who cannot be paid, but this adapter
    // never set the flag, so the rule was dead for every real search: a host
    // could shortlist, take an application and extend an offer to a vendor the
    // escrow step would then refuse with vendor_not_payable. Deciding it with
    // canReceivePayouts -- the same function that guards escrow -- is what
    // keeps search and booking from disagreeing.
    payoutReady: user ? canReceivePayouts(user, profile.stripeAccountId).ok : false,
    specialties: profile.specialties,
    culturalTags: profile.culturalTags,
    languages: user?.languages ?? [],
    homeBase: user?.homeBase ?? { lat: 0, lng: 0 },
    startingRateCents: profile.startingRateCents,
    travelPolicy: profile.travelPolicy,
    unavailableDates: profile.unavailableDates,
    completedGigs: profile.completedGigs,
    ratingCount: profile.ratingCount,
    ...(profile.ratingAvg === undefined ? {} : { ratingAvg: profile.ratingAvg }),
    ...(profile.medianResponseMinutes === undefined
      ? {}
      : { medianResponseMinutes: profile.medianResponseMinutes }),
  };
}
