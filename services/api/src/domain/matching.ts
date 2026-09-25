/**
 * The match engine.
 *
 * The North Star metric is Time-to-Match: a host posting a gig should have
 * verified, genuinely available local talent in front of them inside 60
 * minutes. That is a ranking problem and a notification problem, and this
 * module owns both halves: score every candidate, then decide who gets pinged
 * and in what order.
 *
 * Every score is returned with its component breakdown. An opaque score is
 * unsupportable -- when a vendor asks why they stopped seeing Sangeet gigs, the
 * answer has to be a specific number, not a shrug.
 */
import { EVENT_GROUPS, tagAffinity, type CulturalTag, type EventType, type Language } from "./taxonomy.js";
import { quoteTravel, type LatLng, type TravelPolicy } from "./geo.js";
import type { Cents } from "./money.js";
import type { GigBrief } from "./gig.js";

/** One function a vendor has worked, as they and the platform each report it. */
export interface EventExperience {
  readonly eventType: EventType;
  /** What the vendor says. `undefined` means "I have worked this, no number". */
  readonly claimedCount?: number;
  /** What completed gigs prove. Never written by the vendor. */
  readonly verifiedCount: number;
}

export interface Candidate {
  readonly userId: string;
  readonly specialties: readonly string[];
  /**
   * The functions this vendor has worked, and how many of each.
   *
   * Absent (rather than empty) means they have not filled it in yet, and the
   * two must stay distinguishable: an empty list is a vendor saying "none of
   * these", which should rank below an unknown, while `undefined` is a new
   * vendor who should not be buried for not having got round to it.
   */
  readonly eventTypes?: readonly EventExperience[];
  readonly culturalTags: readonly CulturalTag[];
  readonly languages: readonly Language[];
  readonly homeBase: LatLng;
  readonly startingRateCents: Cents;
  readonly travelPolicy?: Partial<TravelPolicy>;
  readonly unavailableDates?: readonly string[];
  readonly ratingAvg?: number;
  readonly ratingCount?: number;
  readonly completedGigs?: number;
  readonly medianResponseMinutes?: number;
  /** Payout-ready: ID verified, MFA on, Stripe Connect live. */
  readonly payoutReady?: boolean;
}

/**
 * Weights sum to 1.0; the assertion in the tests keeps that honest.
 *
 * `eventFit` is new and takes the largest share, which is the point of adding
 * it: "has worked a half-saree function" is a more specific and more useful
 * answer than "knows Telugu traditions", and until now the score did not
 * contain the first term at all.
 *
 * Where these came from: cultural drops 0.30 -> 0.24 because eventFit now
 * carries the sharper half of the same question, and language drops 0.12 ->
 * 0.07 because it was partly double-counting -- a vendor tagged
 * `telugu_traditional` almost certainly speaks Telugu, so the two terms moved
 * together and the pair was worth more than the pair deserved.
 *
 * eventFit + cultural = 0.52, a deliberate majority. The first split tried
 * gave them 0.48, and the test asserting that occasion fit outweighs
 * everything else put together failed -- correctly. At 0.48 a perfectly
 * located, cheap, fast, well-reviewed generalist outranks a slightly further
 * specialist, which is precisely the outcome this marketplace exists to
 * prevent; a directory that sorts by postcode is what the incumbents already
 * are. Distance and budget still matter inside the qualified pool, and
 * out-of-radius candidates are removed by disqualify() before scoring rather
 * than by being outweighed.
 */
export const WEIGHTS = {
  eventFit: 0.28,
  cultural: 0.24,
  proximity: 0.17,
  budget: 0.12,
  language: 0.07,
  reputation: 0.07,
  responsiveness: 0.05,
} as const;

export interface ScoreBreakdown {
  readonly eventFit: number;
  readonly cultural: number;
  readonly proximity: number;
  readonly budget: number;
  readonly language: number;
  readonly reputation: number;
  readonly responsiveness: number;
}

export interface MatchResult {
  readonly userId: string;
  /** 0-100, rounded. */
  readonly score: number;
  readonly breakdown: ScoreBreakdown;
  readonly travelMiles: number;
  readonly travelFeeCents: Cents;
  /** Why a candidate was dropped, when they were. */
  readonly rejectedFor?: string;
}

/** Hard filters. Failing any of these removes the candidate outright. */
export function disqualify(candidate: Candidate, brief: GigBrief): string | undefined {
  if (!candidate.specialties.includes(brief.specialty)) {
    return `does not offer ${brief.specialty}`;
  }
  if (candidate.unavailableDates?.includes(brief.eventDate)) {
    return `unavailable on ${brief.eventDate}`;
  }
  if (candidate.payoutReady === false) {
    return "cannot receive payouts yet";
  }
  const travel = quoteTravel(candidate.homeBase, brief.venue, candidate.travelPolicy);
  if (travel.outOfRange) {
    return `venue is ${travel.miles} miles away, beyond their travel radius`;
  }
  // A vendor whose floor is above the host's ceiling wastes both parties' time.
  // 15% of headroom is allowed, because rates are negotiable at the margin.
  if (candidate.startingRateCents > brief.budgetMaxCents * 1.15) {
    return "starting rate is above the posted budget";
  }
  return undefined;
}

/**
 * Cultural fit. Exact tag matches score full, adjacent styles half. A brief
 * with no tags scores neutral rather than zero, so an untagged corporate gig
 * does not rank everyone identically at the bottom.
 */
/*
 * Which group each event belongs to, inverted once at module load.
 *
 * Built from EVENT_GROUPS rather than written out, so a new occasion added to
 * the taxonomy is scored the day it is added instead of falling into the
 * "no relation" bucket until somebody remembers this file exists.
 */
const GROUP_OF_EVENT: ReadonlyMap<string, string> = new Map(
  Object.entries(EVENT_GROUPS).flatMap(([group, codes]) =>
    (codes as readonly string[]).map((code) => [code, group] as const),
  ),
);

/** Exact match floor, before any experience bonus. */
const EVENT_EXACT_BASE = 0.75;
/** A sibling function in the same group. */
const EVENT_SIBLING = 0.55;
/** They told us what they work, and this is not it. */
const EVENT_UNRELATED = 0.15;
/** They have not filled the list in. Same convention as responsivenessScore. */
const EVENT_UNKNOWN = 0.5;
/** Weighted count at which the experience bonus is fully earned. */
const EVENT_EXPERIENCE_CEILING = 20;

/**
 * Has this vendor worked this function before?
 *
 * The term the score was missing. `gigs.event_type_code` was collected,
 * validated and stored from the first migration and then never read by the
 * matcher, so a host asking for a half-saree function was ranked entirely on
 * category, tradition, distance, budget and reputation -- everything except
 * the thing they actually asked.
 *
 * Four cases, and the distinction between the last two is the one that matters:
 *
 *   Worked it        -> 0.75, plus up to 0.25 for how much of it.
 *   Worked a sibling -> 0.55. Someone with forty sangeets behind them can
 *                       work a mehndi; the groups in EVENT_GROUPS are exactly
 *                       that judgement, already made.
 *   Says no          -> 0.15. Not zero: an unrelated specialist who is
 *                       otherwise perfect should still be reachable when
 *                       nobody in the metro has worked the function.
 *   Said nothing     -> 0.5. A vendor who has not filled the list in must not
 *                       be buried beneath one who filled it in and excluded
 *                       this function, or the honest answer costs them work
 *                       and nobody answers honestly twice.
 */
export function eventFitScore(
  eventType: EventType,
  worked: readonly EventExperience[] | undefined,
): number {
  if (worked === undefined) return EVENT_UNKNOWN;

  const exact = worked.find((entry) => entry.eventType === eventType);
  if (exact) {
    /*
     * Verified gigs count double.
     *
     * claimedCount is what the vendor typed and nothing checks it; verified is
     * what completed on this platform. Weighting them equally would make the
     * claim as good as the proof, and the first vendor to notice would type a
     * larger number. Doubling is a deliberate, stated exchange rate rather
     * than a fudge factor.
     */
    const weighted = exact.verifiedCount * 2 + (exact.claimedCount ?? 0);
    const bonus = Math.min(1, weighted / EVENT_EXPERIENCE_CEILING) * (1 - EVENT_EXACT_BASE);
    return EVENT_EXACT_BASE + bonus;
  }

  if (worked.length === 0) return EVENT_UNRELATED;

  const group = GROUP_OF_EVENT.get(eventType);
  if (group !== undefined) {
    for (const entry of worked) {
      if (GROUP_OF_EVENT.get(entry.eventType) === group) return EVENT_SIBLING;
    }
  }
  return EVENT_UNRELATED;
}

export function culturalScore(required: readonly CulturalTag[], offered: readonly CulturalTag[]): number {
  if (required.length === 0) return 0.6;
  if (offered.length === 0) return 0;
  let total = 0;
  for (const tag of required) {
    let best = 0;
    for (const candidateTag of offered) {
      best = Math.max(best, tagAffinity(tag, candidateTag));
      if (best === 1) break;
    }
    total += best;
  }
  return total / required.length;
}

/**
 * Proximity decays smoothly rather than stepping at a metro boundary: a vendor
 * in Plano and one in Denton are both serving a Frisco gig, and the fence
 * between DFW sub-cities is a map artefact, not a real constraint.
 */
export function proximityScore(miles: number): number {
  if (miles <= 15) return 1;
  if (miles >= 250) return 0;
  return Math.max(0, 1 - Math.log10(miles / 15) / Math.log10(250 / 15));
}

/** Rewards a rate comfortably inside the budget, without punishing the cheapest. */
export function budgetScore(rateCents: Cents, brief: GigBrief): number {
  const { budgetMinCents: min, budgetMaxCents: max } = brief;
  if (max <= 0) return 0.5;
  if (rateCents <= min) return 1;
  if (rateCents <= max) return 1 - (0.35 * (rateCents - min)) / Math.max(1, max - min);
  const overBy = (rateCents - max) / max;
  return Math.max(0, 0.65 - overBy * 3);
}

export function languageScore(required: readonly Language[], spoken: readonly Language[]): number {
  if (required.length === 0) return 1;
  const set = new Set(spoken);
  const matched = required.filter((language) => set.has(language)).length;
  return matched / required.length;
}

/**
 * Bayesian-smoothed rating, so a single five-star review does not outrank a
 * hundred jobs at 4.8. New vendors sit at the prior and climb from there,
 * which keeps the supply side joinable.
 */
export const RATING_PRIOR = 4.2;
export const RATING_PRIOR_WEIGHT = 8;

export function reputationScore(candidate: Candidate): number {
  const count = candidate.ratingCount ?? 0;
  const average = candidate.ratingAvg ?? RATING_PRIOR;
  const smoothed =
    (average * count + RATING_PRIOR * RATING_PRIOR_WEIGHT) / (count + RATING_PRIOR_WEIGHT);
  const rating = Math.max(0, Math.min(1, (smoothed - 1) / 4));
  // A track record of completed gigs is worth a modest, capped bonus.
  const experience = Math.min(1, (candidate.completedGigs ?? 0) / 40);
  return rating * 0.8 + experience * 0.2;
}

/** Fast repliers rank higher, because Time-to-Match is the metric. */
export function responsivenessScore(medianResponseMinutes: number | undefined): number {
  if (medianResponseMinutes === undefined) return 0.5;
  if (medianResponseMinutes <= 10) return 1;
  if (medianResponseMinutes >= 24 * 60) return 0;
  return Math.max(0, 1 - Math.log10(medianResponseMinutes / 10) / Math.log10(144));
}

export function scoreCandidate(candidate: Candidate, brief: GigBrief): MatchResult {
  const rejectedFor = disqualify(candidate, brief);
  const travel = quoteTravel(candidate.homeBase, brief.venue, candidate.travelPolicy);

  if (rejectedFor) {
    return {
      userId: candidate.userId,
      score: 0,
      // Every component zeroed, eventFit included. A rejected candidate is not
      // ranked at all, so a non-zero component here would be a number shown
      // beside a score of 0 with nothing behind it.
      breakdown: {
        eventFit: 0,
        cultural: 0,
        proximity: 0,
        budget: 0,
        language: 0,
        reputation: 0,
        responsiveness: 0,
      },
      travelMiles: travel.miles,
      travelFeeCents: travel.totalCents,
      rejectedFor,
    };
  }

  const breakdown: ScoreBreakdown = {
    eventFit: eventFitScore(brief.eventType, candidate.eventTypes),
    cultural: culturalScore(brief.culturalTags, candidate.culturalTags),
    proximity: proximityScore(travel.miles),
    budget: budgetScore(candidate.startingRateCents, brief),
    language: languageScore(brief.languages, candidate.languages),
    reputation: reputationScore(candidate),
    responsiveness: responsivenessScore(candidate.medianResponseMinutes),
  };

  const weighted =
    breakdown.eventFit * WEIGHTS.eventFit +
    breakdown.cultural * WEIGHTS.cultural +
    breakdown.proximity * WEIGHTS.proximity +
    breakdown.budget * WEIGHTS.budget +
    breakdown.language * WEIGHTS.language +
    breakdown.reputation * WEIGHTS.reputation +
    breakdown.responsiveness * WEIGHTS.responsiveness;

  return {
    userId: candidate.userId,
    score: Math.round(weighted * 100),
    breakdown,
    travelMiles: travel.miles,
    travelFeeCents: travel.totalCents,
  };
}

export interface RankOptions {
  readonly limit?: number;
  /** Drop anything below this score even if the shortlist is short. */
  readonly minScore?: number;
  readonly includeRejected?: boolean;
}

export function rankCandidates(
  candidates: readonly Candidate[],
  brief: GigBrief,
  options: RankOptions = {},
): MatchResult[] {
  const { limit = 25, minScore = 25, includeRejected = false } = options;
  const scored = candidates.map((candidate) => scoreCandidate(candidate, brief));
  const eligible = scored.filter((result) =>
    includeRejected ? true : !result.rejectedFor && result.score >= minScore,
  );
  eligible.sort((a, b) => b.score - a.score || a.travelMiles - b.travelMiles || a.userId.localeCompare(b.userId));
  return eligible.slice(0, limit);
}

/**
 * Notification fan-out.
 *
 * Blasting every eligible vendor at once gets the host thirty applications and
 * twenty-nine disappointed vendors, and trains everyone to ignore the push.
 * Instead the shortlist goes out in waves: the strongest matches get an
 * exclusive head start, and the next wave only fires if the gig is still short
 * of applications. Urgent gigs collapse the waves, because a Saturday-morning
 * cancellation cannot wait 45 minutes for wave three.
 */
export interface NotificationWave {
  readonly wave: number;
  readonly userIds: readonly string[];
  /** Minutes after posting that this wave fires. */
  readonly delayMinutes: number;
}

export function planNotificationWaves(
  ranked: readonly MatchResult[],
  options: { hoursUntilEvent?: number; targetApplications?: number } = {},
): NotificationWave[] {
  const { hoursUntilEvent = 24 * 30, targetApplications = 5 } = options;
  if (ranked.length === 0) return [];

  // Inside 72 hours the gig is urgent: everyone hears about it immediately.
  const urgent = hoursUntilEvent <= 72;
  const sizes = urgent
    ? [ranked.length]
    : [Math.max(targetApplications, 3), targetApplications * 2, ranked.length];
  const delays = urgent ? [0] : [0, 15, 40];

  const waves: NotificationWave[] = [];
  let cursor = 0;
  for (let i = 0; i < sizes.length && cursor < ranked.length; i += 1) {
    const size = sizes[i] ?? ranked.length;
    const slice = ranked.slice(cursor, cursor + size);
    if (slice.length === 0) break;
    waves.push({
      wave: i + 1,
      userIds: slice.map((result) => result.userId),
      delayMinutes: delays[i] ?? 60,
    });
    cursor += slice.length;
  }
  return waves;
}
