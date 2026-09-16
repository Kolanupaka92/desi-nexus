/**
 * The repository layer.
 *
 * Interfaces first, in-memory implementations behind them. The PostgreSQL
 * implementations land against the schema in db/migrations/001_init.sql without
 * the domain or the routes changing, because nothing above this line knows what
 * a row is.
 */
import type { BaseUser, CrewProfile, CreatorProfile, HostProfile } from "../domain/users.js";
import type { Gig } from "../domain/gig.js";
import type { Escrow } from "../domain/escrow.js";
import type { Cents } from "../domain/money.js";
import { UNIQUE_VIOLATION } from "./postgres/db.js";

export interface Application {
  readonly id: string;
  readonly gigId: string;
  readonly vendorId: string;
  quotedRateCents: Cents;
  message?: string;
  status: "submitted" | "shortlisted" | "offered" | "accepted" | "declined" | "withdrawn";
  readonly createdAt: string;
}

export interface Credentials {
  readonly userId: string;
  passwordHash: string;
  mfaSecret?: string;
  otpHash?: string;
  otpExpiresAt?: string;
  failedAttempts: number;
  lockedUntil?: string;
}

export interface UserRepository {
  create(user: BaseUser): Promise<BaseUser>;
  byId(id: string): Promise<BaseUser | undefined>;
  byEmail(email: string): Promise<BaseUser | undefined>;
  update(id: string, patch: Partial<BaseUser>): Promise<BaseUser>;
}

export interface ProfileRepository {
  putHost(profile: HostProfile): Promise<HostProfile>;
  putCrew(profile: CrewProfile): Promise<CrewProfile>;
  putCreator(profile: CreatorProfile): Promise<CreatorProfile>;
  host(userId: string): Promise<HostProfile | undefined>;
  crew(userId: string): Promise<CrewProfile | undefined>;
  creator(userId: string): Promise<CreatorProfile | undefined>;
  /** Candidate pool for matching, pre-filtered on speciality. */
  crewBySpecialty(specialty: string): Promise<CrewProfile[]>;
  /**
   * Attach a Stripe connected account to a vendor.
   *
   * Separate from putCrew because payout state is the platform's to write, not
   * the vendor's to submit. Round-tripping it through a profile save is how the
   * account id came to be nulled by an ordinary edit.
   */
  linkStripeAccount(userId: string, stripeAccountId: string): Promise<void>;
  /**
   * Opt a profile into being public, or back out of it.
   *
   * Separate from putCrew because publishing is a decision, not a field: it is
   * the moment a vendor's page becomes readable without a session and
   * indexable by a crawler. Routing it through a profile save would make it
   * something a malformed body could toggle.
   */
  setPublished(userId: string, publishedAt: string | undefined): Promise<void>;
  /**
   * A published profile by its public slug.
   *
   * Only ever returns published rows, so an unpublished slug is
   * indistinguishable from one that was never claimed and cannot be used to
   * probe for who is on the platform.
   */
  publishedBySlug(slug: string): Promise<CrewProfile | undefined>;
}

export interface GigRepository {
  create(gig: Gig): Promise<Gig>;
  byId(id: string): Promise<Gig | undefined>;
  byHost(hostId: string): Promise<Gig[]>;
  /**
   * Gigs still taking applications, optionally narrowed to a set of
   * specialities. Backed by the partial index on (specialty_code, event_date),
   * so this stays an index lookup rather than a scan of every gig ever posted.
   */
  open(specialties?: readonly string[]): Promise<Gig[]>;
  save(gig: Gig): Promise<Gig>;
}

export interface ApplicationRepository {
  create(application: Application): Promise<Application>;
  byId(id: string): Promise<Application | undefined>;
  byGig(gigId: string): Promise<Application[]>;
  save(application: Application): Promise<Application>;
}

export interface EscrowRepository {
  create(escrow: Escrow): Promise<Escrow>;
  byId(id: string): Promise<Escrow | undefined>;
  byGig(gigId: string): Promise<Escrow | undefined>;
  save(escrow: Escrow): Promise<Escrow>;
}

export interface CredentialRepository {
  put(credentials: Credentials): Promise<Credentials>;
  byUserId(userId: string): Promise<Credentials | undefined>;
}

/** Everything the service needs to reach persistence. */
export interface Store {
  readonly users: UserRepository;
  readonly profiles: ProfileRepository;
  readonly gigs: GigRepository;
  readonly applications: ApplicationRepository;
  readonly escrows: EscrowRepository;
  readonly credentials: CredentialRepository;
}

/**
 * Deep-copy on the way in and out, so a caller mutating what it read cannot
 * silently corrupt stored state. Postgres gives this for free; the in-memory
 * store has to be explicit or the tests pass for the wrong reason.
 */
function clone<T>(value: T): T {
  return structuredClone(value);
}

class MemoryUsers implements UserRepository {
  private readonly byIdMap = new Map<string, BaseUser>();
  private readonly byEmailMap = new Map<string, string>();
  private readonly byPhoneMap = new Map<string, string>();

  async create(user: BaseUser): Promise<BaseUser> {
    const key = user.email.toLowerCase();
    if (this.byEmailMap.has(key)) throw new Error("email already registered");
    // Phone is unique in the schema, and must be here too: a number shared
    // between accounts means an OTP that authenticates the wrong person.
    if (user.phone && this.byPhoneMap.has(user.phone)) {
      throw new Error("phone already registered");
    }
    this.byIdMap.set(user.id, clone(user));
    this.byEmailMap.set(key, user.id);
    if (user.phone) this.byPhoneMap.set(user.phone, user.id);
    return clone(user);
  }

  async byId(id: string): Promise<BaseUser | undefined> {
    const user = this.byIdMap.get(id);
    return user ? clone(user) : undefined;
  }

  async byEmail(email: string): Promise<BaseUser | undefined> {
    const id = this.byEmailMap.get(email.toLowerCase());
    return id ? this.byId(id) : undefined;
  }

  async update(id: string, patch: Partial<BaseUser>): Promise<BaseUser> {
    const user = this.byIdMap.get(id);
    if (!user) throw new Error(`no such user: ${id}`);
    if (patch.phone && patch.phone !== user.phone && this.byPhoneMap.has(patch.phone)) {
      throw new Error("phone already registered");
    }
    const updated = { ...user, ...patch, id: user.id } as BaseUser;
    this.byIdMap.set(id, updated);
    if (user.phone && updated.phone !== user.phone) this.byPhoneMap.delete(user.phone);
    if (updated.phone) this.byPhoneMap.set(updated.phone, id);
    return clone(updated);
  }
}

class MemoryProfiles implements ProfileRepository {
  private readonly hosts = new Map<string, HostProfile>();
  private readonly crewMap = new Map<string, CrewProfile>();
  private readonly creators = new Map<string, CreatorProfile>();

  async putHost(profile: HostProfile): Promise<HostProfile> {
    this.hosts.set(profile.userId, clone(profile));
    return clone(profile);
  }

  /**
   * Reputation and payout state a profile save must never carry.
   *
   * The caller of a profile save is the vendor, and these are the platform's
   * to write. Keeping the stored values here mirrors what the SQL stores do by
   * leaving these columns out of their ON CONFLICT SET lists -- if the two
   * disagreed, the PostgreSQL end-to-end suite would be asserting different
   * behaviour from the in-memory one.
   */
  private static preserve<T extends CrewProfile | CreatorProfile>(stored: T | undefined, incoming: T): T {
    if (!stored) return incoming;
    return {
      ...incoming,
      ...(stored.stripeAccountId === undefined ? {} : { stripeAccountId: stored.stripeAccountId }),
      ...(stored.ratingAvg === undefined ? {} : { ratingAvg: stored.ratingAvg }),
      ratingCount: stored.ratingCount,
      ...("completedGigs" in stored ? { completedGigs: (stored as CrewProfile).completedGigs } : {}),
      ...("medianResponseMinutes" in stored && stored.medianResponseMinutes !== undefined
        ? { medianResponseMinutes: stored.medianResponseMinutes }
        : {}),
    };
  }

  /**
   * Slugs are unique across every vendor, and this store has to say so too.
   *
   * The SQL schema enforces it with a UNIQUE column; in memory there is no
   * constraint to lean on, so two vendors could both hold `anjali-studio` and
   * `publishedBySlug` would return whichever the iteration order reached
   * first -- one public address quietly resolving to either of two people.
   * That is not a difference the tests would have caught, because the
   * assertions that run against both backings never claimed one address twice.
   *
   * The error carries PostgreSQL's unique-violation code so the routes need
   * exactly one branch for it rather than one per store. Development runs on
   * this store when DATABASE_URL is unset, which is precisely where a
   * constraint that exists only in production is worth nothing.
   */
  private assertSlugFree(profile: CrewProfile): void {
    if (!profile.slug) return;
    for (const other of this.crewMap.values()) {
      if (other.userId !== profile.userId && other.slug === profile.slug) {
        throw Object.assign(new Error(`slug ${profile.slug} is already in use`), {
          code: UNIQUE_VIOLATION,
          constraint: "crew_profiles_slug_key",
        });
      }
    }
  }

  async putCrew(profile: CrewProfile): Promise<CrewProfile> {
    this.assertSlugFree(profile);
    const kept = MemoryProfiles.preserve(this.crewMap.get(profile.userId), profile);
    this.crewMap.set(profile.userId, clone(kept));
    return clone(kept);
  }

  async putCreator(profile: CreatorProfile): Promise<CreatorProfile> {
    const kept = MemoryProfiles.preserve(this.creators.get(profile.userId), profile);
    this.creators.set(profile.userId, clone(kept));
    return clone(kept);
  }

  async setPublished(userId: string, publishedAt: string | undefined): Promise<void> {
    const profile = this.crewMap.get(userId);
    if (!profile) return;
    const next = { ...profile };
    if (publishedAt === undefined) delete next.publishedAt;
    else next.publishedAt = publishedAt;
    this.crewMap.set(userId, next);
  }

  async publishedBySlug(slug: string): Promise<CrewProfile | undefined> {
    const found = [...this.crewMap.values()].find(
      (profile) => profile.slug === slug && profile.publishedAt !== undefined,
    );
    return found ? clone(found) : undefined;
  }

  async linkStripeAccount(userId: string, stripeAccountId: string): Promise<void> {
    const crew = this.crewMap.get(userId);
    if (crew) this.crewMap.set(userId, { ...crew, stripeAccountId });
    const creator = this.creators.get(userId);
    if (creator) this.creators.set(userId, { ...creator, stripeAccountId });
  }

  async host(userId: string): Promise<HostProfile | undefined> {
    const profile = this.hosts.get(userId);
    return profile ? clone(profile) : undefined;
  }

  async crew(userId: string): Promise<CrewProfile | undefined> {
    const profile = this.crewMap.get(userId);
    return profile ? clone(profile) : undefined;
  }

  async creator(userId: string): Promise<CreatorProfile | undefined> {
    const profile = this.creators.get(userId);
    return profile ? clone(profile) : undefined;
  }

  async crewBySpecialty(specialty: string): Promise<CrewProfile[]> {
    return [...this.crewMap.values()]
      .filter((profile) => (profile.specialties as readonly string[]).includes(specialty))
      .map(clone);
  }
}

class MemoryGigs implements GigRepository {
  private readonly map = new Map<string, Gig>();

  async create(gig: Gig): Promise<Gig> {
    this.map.set(gig.id, clone(gig));
    return clone(gig);
  }

  async byId(id: string): Promise<Gig | undefined> {
    const gig = this.map.get(id);
    return gig ? clone(gig) : undefined;
  }

  async byHost(hostId: string): Promise<Gig[]> {
    return [...this.map.values()].filter((gig) => gig.hostId === hostId).map(clone);
  }

  async open(specialties?: readonly string[]): Promise<Gig[]> {
    return [...this.map.values()]
      .filter((gig) => gig.state === "Open" || gig.state === "ApplicationsReview")
      .filter((gig) => !specialties?.length || specialties.includes(gig.brief.specialty))
      .sort((a, b) => a.brief.eventDate.localeCompare(b.brief.eventDate))
      .map(clone);
  }

  async save(gig: Gig): Promise<Gig> {
    this.map.set(gig.id, clone(gig));
    return clone(gig);
  }
}

class MemoryApplications implements ApplicationRepository {
  private readonly map = new Map<string, Application>();

  async create(application: Application): Promise<Application> {
    this.map.set(application.id, clone(application));
    return clone(application);
  }

  async byId(id: string): Promise<Application | undefined> {
    const application = this.map.get(id);
    return application ? clone(application) : undefined;
  }

  async byGig(gigId: string): Promise<Application[]> {
    return [...this.map.values()].filter((application) => application.gigId === gigId).map(clone);
  }

  async save(application: Application): Promise<Application> {
    this.map.set(application.id, clone(application));
    return clone(application);
  }
}

class MemoryEscrows implements EscrowRepository {
  private readonly map = new Map<string, Escrow>();

  async create(escrow: Escrow): Promise<Escrow> {
    this.map.set(escrow.id, clone(escrow));
    return clone(escrow);
  }

  async byId(id: string): Promise<Escrow | undefined> {
    const escrow = this.map.get(id);
    return escrow ? clone(escrow) : undefined;
  }

  async byGig(gigId: string): Promise<Escrow | undefined> {
    const escrow = [...this.map.values()].find((candidate) => candidate.gigId === gigId);
    return escrow ? clone(escrow) : undefined;
  }

  async save(escrow: Escrow): Promise<Escrow> {
    this.map.set(escrow.id, clone(escrow));
    return clone(escrow);
  }
}

class MemoryCredentials implements CredentialRepository {
  private readonly map = new Map<string, Credentials>();

  async put(credentials: Credentials): Promise<Credentials> {
    this.map.set(credentials.userId, clone(credentials));
    return clone(credentials);
  }

  async byUserId(userId: string): Promise<Credentials | undefined> {
    const credentials = this.map.get(userId);
    return credentials ? clone(credentials) : undefined;
  }
}

export function createInMemoryStore(): Store {
  return {
    users: new MemoryUsers(),
    profiles: new MemoryProfiles(),
    gigs: new MemoryGigs(),
    applications: new MemoryApplications(),
    escrows: new MemoryEscrows(),
    credentials: new MemoryCredentials(),
  };
}
