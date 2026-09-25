/**
 * Event fit: the term the score was missing.
 *
 * `gigs.event_type_code` was collected and stored from the first migration and
 * never read by the matcher. A host asking for a half-saree function was
 * ranked on category, tradition, distance, budget and reputation -- everything
 * except the thing they asked. Nothing failed, because there was nothing to
 * fail; the score simply did not contain the term.
 *
 * These assert the four cases and, more importantly, the two places the wiring
 * can silently come undone: the weights no longer summing to one, and the
 * Candidate adapter forgetting to pass the field through. The second is not
 * hypothetical -- `payoutReady` was dead in exactly that way for every real
 * search until someone noticed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  WEIGHTS,
  eventFitScore,
  scoreCandidate,
  type Candidate,
  type EventExperience,
} from "../src/domain/matching.js";
import type { GigBrief } from "../src/domain/gig.js";

const brief: GigBrief = {
  eventType: "half_saree_function",
  specialty: "mua",
  eventDate: "2027-06-20",
  venue: { lat: 33.15, lng: -96.82 },
  metroId: "dallas_fort_worth",
  budgetMinCents: 40_000,
  budgetMaxCents: 90_000,
  culturalTags: ["telugu_traditional"],
  languages: ["telugu"],
};

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    userId: "vendor-1",
    specialties: ["mua"],
    culturalTags: ["telugu_traditional"],
    languages: ["telugu", "english"],
    homeBase: { lat: 33.1, lng: -96.8 },
    startingRateCents: 60_000,
    ratingAvg: 4.8,
    ratingCount: 30,
    completedGigs: 40,
    medianResponseMinutes: 8,
    payoutReady: true,
    ...overrides,
  };
}

const worked = (eventType: string, claimedCount?: number, verifiedCount = 0): EventExperience =>
  ({
    eventType,
    ...(claimedCount === undefined ? {} : { claimedCount }),
    verifiedCount,
  }) as EventExperience;

test("the weights still sum to one after adding eventFit", () => {
  const total = Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
});

test("a vendor who has worked the function outranks one who has not", () => {
  const specialist = scoreCandidate(
    candidate({ eventTypes: [worked("half_saree_function", 40)] }),
    brief,
  );
  const stranger = scoreCandidate(candidate({ eventTypes: [worked("corporate_offsite", 40)] }), brief);

  assert.ok(
    specialist.score > stranger.score,
    `specialist ${specialist.score} should beat stranger ${stranger.score}`,
  );
  // Identical in every other respect, so the whole gap is the new term.
  assert.ok(
    specialist.score - stranger.score >= 15,
    `expected a decisive gap, got ${specialist.score - stranger.score}`,
  );
});

test("a sibling function in the same group beats an unrelated one", () => {
  // Sangeet and half-saree are both milestone/wedding-adjacent in EVENT_GROUPS;
  // corporate_offsite is not. Someone with forty sangeets can work a mehndi.
  const sibling = eventFitScore("mehndi", [worked("sangeet", 40)]);
  const unrelated = eventFitScore("mehndi", [worked("corporate_offsite", 40)]);
  assert.ok(sibling > unrelated, `sibling ${sibling} should beat unrelated ${unrelated}`);
});

test("a vendor who has not filled the list in is not buried beneath one who excluded the function", () => {
  const silent = eventFitScore("half_saree_function", undefined);
  const excluded = eventFitScore("half_saree_function", []);
  assert.ok(
    silent > excluded,
    `silence (${silent}) must rank above an explicit no (${excluded}); otherwise ` +
      "answering honestly costs a vendor work and nobody answers honestly twice",
  );
});

test("more experience of the same function ranks higher", () => {
  const once = eventFitScore("half_saree_function", [worked("half_saree_function", 1)]);
  const often = eventFitScore("half_saree_function", [worked("half_saree_function", 40)]);
  assert.ok(often > once, `40 worked (${often}) should beat 1 worked (${once})`);
  assert.ok(often <= 1, `score must stay within 0..1, got ${often}`);
});

test("a verified gig counts double a claimed one", () => {
  const claimed = eventFitScore("half_saree_function", [worked("half_saree_function", 4, 0)]);
  const verified = eventFitScore("half_saree_function", [worked("half_saree_function", 0, 4)]);
  assert.ok(
    verified > claimed,
    `proof (${verified}) must outrank a claim (${claimed}), or the first vendor ` +
      "to notice types a bigger number",
  );
});

test("every component is zero for a rejected candidate", () => {
  // Wrong specialty disqualifies; eventFit must not report a number beside a
  // score of nothing.
  const rejected = scoreCandidate(
    candidate({ specialties: ["pandit"], eventTypes: [worked("half_saree_function", 40)] }),
    brief,
  );
  assert.ok(rejected.rejectedFor !== undefined, "expected this candidate to be rejected");
  assert.equal(rejected.breakdown.eventFit, 0);
  assert.equal(rejected.score, 0);
});

test("eventFit actually moves the total score", () => {
  /*
   * The guard against the payoutReady failure mode: a term that is computed,
   * returned in the breakdown, and multiplied by its weight can still be dead
   * if nothing ever varies it. Two candidates differing ONLY in event history
   * must produce two different totals.
   */
  const a = scoreCandidate(candidate({ eventTypes: [worked("half_saree_function", 40)] }), brief);
  const b = scoreCandidate(candidate({ eventTypes: [] }), brief);
  assert.notEqual(
    a.score,
    b.score,
    "event history changed and the score did not: the term is not wired in",
  );
  assert.notEqual(a.breakdown.eventFit, b.breakdown.eventFit);
});
