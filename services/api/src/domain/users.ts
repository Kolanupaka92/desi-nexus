/**
 * The polymorphic user model.
 *
 * One base identity, three profile shapes. A person is routinely more than one
 * of these -- a boutique owner in Frisco hosts gigs on Monday and models for a
 * lookbook on Saturday -- so roles are a set on the base user rather than three
 * separate account types.
 */
import {
  isCrewSpecialty,
  isCulturalTag,
  isLanguage,
  type CreatorDiscipline,
  type CrewSpecialty,
  type CulturalTag,
  type Language,
} from "./taxonomy.js";
import { type LatLng, nearestMetro, withinPilotFootprint } from "./geo.js";
import type { TravelPolicy } from "./geo.js";
import type { Cents } from "./money.js";
import type { EventExperience } from "./matching.js";

export type Role = "host" | "crew" | "creator" | "admin";

export type VerificationLevel =
  /** Email confirmed only. Can browse, cannot transact. */
  | "unverified"
  /** Phone OTP confirmed. Can apply to gigs. */
  | "phone_verified"
  /** Government ID checked. Required to receive payouts. */
  | "id_verified"
  /** ID plus Stripe Connect onboarding complete, with a business record. */
  | "business_verified";

export const VERIFICATION_ORDER: readonly VerificationLevel[] = [
  "unverified",
  "phone_verified",
  "id_verified",
  "business_verified",
];

export function meetsVerification(actual: VerificationLevel, required: VerificationLevel): boolean {
  return VERIFICATION_ORDER.indexOf(actual) >= VERIFICATION_ORDER.indexOf(required);
}

export interface BaseUser {
  readonly id: string;
  email: string;
  phone?: string;
  displayName: string;
  roles: Role[];
  verification: VerificationLevel;
  /** MFA is mandatory before any wallet or payout surface is reachable. */
  mfaEnabled: boolean;
  homeBase: LatLng;
  metroId: string;
  languages: Language[];
  readonly createdAt: string;
  suspendedAt?: string;
}

export interface HostProfile {
  readonly userId: string;
  /** A boutique or agency, as against a family booking their own function. */
  readonly kind: "business" | "individual";
  businessName?: string;
  /** Free-form, e.g. "Bridal boutique, 2 locations". Not used for matching. */
  about?: string;
  eventsHosted: number;
  /** Rating vendors give the host: pays on time, brief matches reality. */
  ratingAvg?: number;
  ratingCount: number;
}

export interface CrewProfile {
  readonly userId: string;
  specialties: CrewSpecialty[];
  /**
   * The functions this vendor has worked. Optional, and the distinction from
   * an empty array is load-bearing: undefined is "not filled in yet" and
   * scores neutral, [] is "none of these" and scores low. See eventFitScore.
   */
  eventTypes?: EventExperience[];
  culturalTags: CulturalTag[];
  /** Base rate used for budget filtering before a formal offer exists. */
  startingRateCents: Cents;
  travelPolicy: Partial<TravelPolicy>;
  /** ISO dates the vendor has blocked out. */
  unavailableDates: string[];
  yearsExperience: number;
  ratingAvg?: number;
  ratingCount: number;
  completedGigs: number;
  /** Median minutes to first reply, used to hit the 60-minute match target. */
  medianResponseMinutes?: number;
  portfolioAssetIds: string[];
  stripeAccountId?: string;

  // --- The public profile. All optional: a vendor who never publishes has
  // none of it, which is the default and a perfectly good way to use the
  // platform. See publishability() for what has to be present before
  // publishedAt may be set.
  /** The public address, e.g. `anjali-studio-frisco`. Claimable before publishing. */
  slug?: string;
  /** When the vendor opted this profile into being public. Absent means private. */
  publishedAt?: string;
  businessName?: string;
  headline?: string;
  about?: string;
  /** The one image a card and a link preview use, out of portfolioAssetIds. */
  profileAssetId?: string;
}

export interface CreatorProfile {
  readonly userId: string;
  disciplines: CreatorDiscipline[];
  culturalTags: CulturalTag[];
  heightCm?: number;
  /** Handle plus the follower count verified through the platform's OAuth. */
  socials: SocialAccount[];
  ratePerPostCents?: Cents;
  dayRateCents?: Cents;
  unavailableDates: string[];
  portfolioAssetIds: string[];
  ratingAvg?: number;
  ratingCount: number;
  stripeAccountId?: string;
}

export interface SocialAccount {
  readonly platform: "instagram" | "tiktok" | "youtube";
  handle: string;
  followers: number;
  /** Share of the audience inside Texas. A 400k national account is worth less
   *  to a Sugar Land boutique than a 20k account that is 70% Houston. */
  texasAudienceShare?: number;
  engagementRate?: number;
  /** Set when the handle was proven via platform OAuth, not merely typed in. */
  verifiedAt?: string;
}

/**
 * Local reach: the metric the boutiques actually buy. A creator with a large
 * but diffuse audience scores below a smaller, genuinely local one.
 */
export function localReach(account: SocialAccount): number {
  const share = account.texasAudienceShare ?? 0.15;
  const engagement = account.engagementRate ?? 0.02;
  return Math.round(account.followers * share * Math.min(1, engagement / 0.02));
}

export function totalLocalReach(profile: Pick<CreatorProfile, "socials">): number {
  return profile.socials.reduce((sum, account) => sum + localReach(account), 0);
}

export class ValidationError extends Error {
  readonly field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** E.164, which is what the OTP provider wants. */
const PHONE = /^\+1\d{10}$/;

export function validateBaseUser(input: Partial<BaseUser>): void {
  if (!input.email || !EMAIL.test(input.email)) {
    throw new ValidationError("email", "a valid email address is required");
  }
  if (input.phone && !PHONE.test(input.phone)) {
    throw new ValidationError("phone", "phone must be E.164, e.g. +14695550123");
  }
  if (!input.displayName || input.displayName.trim().length < 2) {
    throw new ValidationError("displayName", "a display name of at least 2 characters is required");
  }
  if (!input.roles?.length) {
    throw new ValidationError("roles", "at least one role is required");
  }
  for (const role of input.roles) {
    if (!["host", "crew", "creator", "admin"].includes(role)) {
      throw new ValidationError("roles", `unknown role: ${role}`);
    }
  }
  if (!input.homeBase || !Number.isFinite(input.homeBase.lat) || !Number.isFinite(input.homeBase.lng)) {
    throw new ValidationError("homeBase", "a home base latitude and longitude are required");
  }
  if (!withinPilotFootprint(input.homeBase)) {
    const { metro, miles } = nearestMetro(input.homeBase);
    throw new ValidationError(
      "homeBase",
      `outside the Texas pilot footprint: the nearest covered metro is ${metro.name}, ${Math.round(miles)} miles away`,
    );
  }
  for (const language of input.languages ?? []) {
    if (!isLanguage(language)) throw new ValidationError("languages", `unknown language: ${language}`);
  }
}

export function validateCrewProfile(input: Partial<CrewProfile>): void {
  if (!input.specialties?.length) {
    throw new ValidationError("specialties", "at least one speciality is required");
  }
  for (const specialty of input.specialties) {
    if (!isCrewSpecialty(specialty)) {
      throw new ValidationError("specialties", `unknown speciality: ${specialty}`);
    }
  }
  for (const tag of input.culturalTags ?? []) {
    if (!isCulturalTag(tag)) throw new ValidationError("culturalTags", `unknown cultural tag: ${tag}`);
  }
  if (typeof input.startingRateCents !== "number" || input.startingRateCents <= 0) {
    throw new ValidationError("startingRateCents", "a starting rate above zero is required");
  }
}

/** A slug the public URL can carry, derived from what the vendor typed. */
export function toSlug(input: string): string {
  return input
    .normalize("NFKD")
    // Strip marks separately from the ASCII filter so that "Jhansi" survives
    // being typed as "Jhānsi" rather than losing the vowel entirely.
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Fields a vendor must fill in before their profile may be made public. */
export const PUBLISH_REQUIREMENTS = [
  "slug",
  "businessName",
  "headline",
  "about",
  // `profileAssetId` belongs here and is deliberately absent: nothing can
  // create a portfolio asset yet, so requiring one would make publishing
  // unreachable. It joins this list with the upload endpoint.
] as const;

export type PublishRequirement = (typeof PUBLISH_REQUIREMENTS)[number];

/**
 * Whether a profile may be published, and what is missing if not.
 *
 * Returning the whole list rather than throwing on the first gap is
 * deliberate: a vendor filling in a profile wants to be told everything left
 * to do, not sent round the loop once per field.
 *
 * The bar is not bureaucracy. A published profile is an indexable page and a
 * link someone forwards to family; one with no picture and no description
 * teaches a visitor that the marketplace is empty, and teaches a search engine
 * that the site is thin. Both are expensive to undo.
 */
export function publishability(profile: CrewProfile): {
  ok: boolean;
  missing: PublishRequirement[];
} {
  const missing = PUBLISH_REQUIREMENTS.filter((field) => {
    const value = profile[field];
    return typeof value !== "string" || value.trim().length === 0;
  });
  return { ok: missing.length === 0, missing };
}

/**
 * What a logged-out visitor is allowed to see.
 *
 * Built by naming every field rather than by deleting the private ones from
 * the record. Subtraction fails open: the next column added to CrewProfile
 * would be public by default, and the one after that, until something like a
 * home address or a payout account has leaked. Addition fails closed, which
 * for an anonymous endpoint is the only acceptable direction.
 *
 * Specifically withheld, and why:
 *  - `unavailableDates` -- a vendor's calendar is not public information, and
 *    read across a season it says a great deal about their business.
 *  - the user's `homeBase` -- for a great many vendors here that is their
 *    house. The service area a visitor needs is answered by the metro and the
 *    travel radius, neither of which is a coordinate.
 *  - `stripeAccountId`, and anything else on the payout path.
 *  - contact details. The platform is how a host reaches a vendor; publishing
 *    an email would route the booking around the escrow that protects both.
 */
export interface PublicVendorProfile {
  readonly slug: string;
  readonly businessName: string;
  readonly headline: string;
  readonly about: string;
  readonly displayName: string;
  readonly specialties: CrewSpecialty[];
  readonly culturalTags: CulturalTag[];
  readonly languages: string[];
  readonly metroId?: string;
  readonly startingRateCents: Cents;
  readonly yearsExperience: number;
  /** How far they travel, which is the public half of a service area. */
  readonly travelRadiusMiles?: number;
  /** Absent until the vendor has a picture to choose; see PUBLISH_REQUIREMENTS. */
  readonly profileAssetId?: string;
  readonly portfolioAssetIds: string[];
  readonly publishedAt: string;
  /** Reputation only once it is real; see the note below. */
  readonly ratingAvg?: number;
  readonly ratingCount: number;
  readonly completedGigs: number;
}

export function toPublicVendorProfile(
  profile: CrewProfile,
  user: Pick<BaseUser, "displayName" | "languages" | "metroId">,
): PublicVendorProfile | undefined {
  // Not published is not found. Callers turn this into a 404 rather than a
  // 403, so that an unpublished slug does not confirm it exists.
  if (!profile.publishedAt) return undefined;
  const { ok } = publishability(profile);
  if (!ok) return undefined;

  return {
    slug: profile.slug as string,
    businessName: profile.businessName as string,
    headline: profile.headline as string,
    about: profile.about as string,
    displayName: user.displayName,
    specialties: profile.specialties,
    culturalTags: profile.culturalTags,
    languages: user.languages,
    ...(user.metroId ? { metroId: user.metroId } : {}),
    startingRateCents: profile.startingRateCents,
    yearsExperience: profile.yearsExperience,
    ...(profile.travelPolicy?.maxRadiusMiles === undefined
      ? {}
      : { travelRadiusMiles: profile.travelPolicy.maxRadiusMiles }),
    ...(profile.profileAssetId ? { profileAssetId: profile.profileAssetId } : {}),
    portfolioAssetIds: profile.portfolioAssetIds,
    publishedAt: profile.publishedAt,
    // No reviews exist yet, so ratingAvg is absent on every profile today.
    // Passing it through rather than inventing a placeholder means the page
    // shows nothing where a rating would go, which is honest; a default of
    // "5.0" or "New" dressed up as a score would not be.
    ...(profile.ratingAvg === undefined ? {} : { ratingAvg: profile.ratingAvg }),
    ratingCount: profile.ratingCount,
    completedGigs: profile.completedGigs,
  };
}

/**
 * Payouts require ID verification and MFA, with no exceptions and no admin
 * override. This is the control that stops a compromised password from
 * redirecting a vendor's money.
 */
export function canReceivePayouts(user: BaseUser, stripeAccountId?: string): { ok: boolean; reason?: string } {
  if (user.suspendedAt) return { ok: false, reason: "account is suspended" };
  if (!meetsVerification(user.verification, "id_verified")) {
    return { ok: false, reason: "identity verification is incomplete" };
  }
  if (!user.mfaEnabled) return { ok: false, reason: "multi-factor authentication is not enabled" };
  if (!stripeAccountId) return { ok: false, reason: "Stripe Connect onboarding is not complete" };
  return { ok: true };
}
