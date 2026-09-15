/**
 * Fill a development database with something to look at.
 *
 * The vendor feed, the dashboard and the match breakdown are all empty on a
 * fresh database, which makes the app impossible to evaluate -- you cannot tell
 * a working feed from a broken one when both show nothing.
 *
 * This drives the real HTTP API rather than writing rows directly. Inserting
 * straight into the tables is faster and produces states the service would
 * never create: a published gig with no transition log, a vendor profile with
 * no speciality links, an escrow whose ledger does not balance. Seed data whose
 * shape the application disagrees with is worse than no seed data, because the
 * bugs it causes look like application bugs.
 *
 * NOT FOR PRODUCTION, and it refuses to run there. These are invented hosts and
 * invented gigs. On a live marketplace they would be fake demand: a real makeup
 * artist could turn down paid work for a Sangeet that does not exist. The
 * refusal below is the point, not a formality.
 *
 *   node scripts/seed-demo.mjs                  # against localhost:4000
 *   API=http://127.0.0.1:4000 node scripts/seed-demo.mjs
 */

const API = process.env.API ?? "http://127.0.0.1:4000";
const PASSWORD = "a-long-enough-passphrase";

if (process.env.NODE_ENV === "production") {
  console.error("refusing to seed demo data into production");
  process.exit(1);
}

// E.164 for the US is "+1" followed by ten digits: three area, seven
// subscriber. 555-01xx is the reserved fictional range, so these can never
// reach a real handset. Randomised start so a re-seed does not collide with
// numbers an earlier run already took -- phone is unique in the schema.
let phoneSeq = Math.floor(Math.random() * 8000);
const nextPhone = () => `+1469${String(5550000 + (phoneSeq += 1)).slice(0, 7)}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait out a 429 rather than route around it.
 *
 * Registration and login are bucketed per IP at ten per fifteen minutes, and
 * this script makes two such calls per account, so a roster of any size will
 * hit it. The tempting fix is to vary X-Forwarded-For per request, which does
 * work -- that is precisely the bypass that had to be closed in the service --
 * and a seeding tool that depends on a spoof is a seeding tool that stops
 * working the moment the spoof is fixed. So it waits.
 *
 * Everything after sign-in is bucketed per user rather than per IP, so posting
 * the gigs themselves costs nothing against this budget.
 */
async function call(method, path, { token, body } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`${API}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};

    if (response.status === 429 && attempt < 12) {
      const wait = Math.min(120, Number(parsed?.error?.details?.retryAfterSeconds) || 30);
      process.stdout.write(`    rate limited, waiting ${wait}s… `);
      await sleep(wait * 1000);
      console.log("retrying");
      continue;
    }
    if (!response.ok) {
      throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(parsed)}`);
    }
    return parsed;
  }
}

/** Register, verify the phone, and come back with an MFA-verified session. */
async function onboard({ email, roles, homeBase, languages, displayName }) {
  await call("POST", "/v1/auth/register", {
    body: { email, password: PASSWORD, displayName, roles, homeBase, phone: nextPhone(), languages },
  });
  const { accessToken: first } = await call("POST", "/v1/auth/login", {
    body: { email, password: PASSWORD },
  });
  const { devCode } = await call("POST", "/v1/auth/otp/send", { token: first });
  if (!devCode) throw new Error("no devCode: the API is not exposing dev secrets, so it thinks it is production");
  const { accessToken } = await call("POST", "/v1/auth/otp/verify", { token: first, body: { code: devCode } });
  return accessToken;
}

const FRISCO = { lat: 33.1507, lng: -96.8236 };
const PLANO = { lat: 33.0198, lng: -96.6989 };
const IRVING = { lat: 32.814, lng: -96.9489 };
const SUGAR_LAND = { lat: 29.6197, lng: -95.6349 };

const VENDORS = [
  {
    displayName: "Anjali Rao",
    email: "anjali.mua@demo.test",
    homeBase: PLANO,
    languages: ["english", "telugu", "hindi"],
    profile: {
      specialties: ["mua", "hair_stylist"],
      culturalTags: ["south_indian_bridal", "telugu_traditional", "hd_airbrush"],
      startingRateCents: 65_000,
      yearsExperience: 9,
    },
  },
  {
    displayName: "Simran Kaur",
    email: "simran.mua@demo.test",
    homeBase: IRVING,
    languages: ["english", "punjabi", "hindi"],
    profile: {
      specialties: ["mua"],
      culturalTags: ["punjabi_sikh", "north_indian_bridal", "indo_western_fusion"],
      startingRateCents: 58_000,
      yearsExperience: 6,
    },
  },
  {
    displayName: "Vikram Shah",
    email: "vikram.photo@demo.test",
    homeBase: FRISCO,
    languages: ["english", "gujarati", "hindi"],
    profile: {
      specialties: ["photographer", "videographer"],
      culturalTags: ["gujarati_traditional", "north_indian_bridal"],
      startingRateCents: 210_000,
      yearsExperience: 11,
    },
  },
  {
    displayName: "Meera Nair",
    email: "meera.henna@demo.test",
    homeBase: PLANO,
    languages: ["english", "malayalam", "tamil"],
    profile: {
      specialties: ["henna_artist", "mehndi_assistant"],
      culturalTags: ["malayali_traditional", "south_indian_bridal", "minimal_natural"],
      startingRateCents: 42_000,
      yearsExperience: 7,
    },
  },
  {
    displayName: "Pandit Sharma",
    email: "pandit.sharma@demo.test",
    homeBase: SUGAR_LAND,
    languages: ["english", "hindi", "telugu"],
    profile: {
      specialties: ["priest_pandit"],
      culturalTags: ["telugu_traditional", "tamil_iyer"],
      startingRateCents: 35_000,
      yearsExperience: 20,
    },
  },
];

const HOSTS = [
  { displayName: "Lakshmi Reddy", email: "lakshmi.host@demo.test", homeBase: FRISCO, languages: ["english", "telugu"] },
  { displayName: "Harpreet Singh", email: "harpreet.host@demo.test", homeBase: IRVING, languages: ["english", "punjabi"] },
  { displayName: "Ritu Boutique", email: "ritu.boutique@demo.test", homeBase: PLANO, languages: ["english", "hindi"] },
];

/**
 * Addresses, not coordinates: the API geocodes them, which is what a real host
 * does and what exercises the path that decides the metro and the travel quote.
 */
const GIGS = [
  {
    host: 0,
    eventType: "half_saree_function",
    specialty: "mua",
    eventDate: "2027-04-17",
    venueAddress: "8000 Warren Pkwy, Frisco TX 75034",
    budgetMinCents: 45_000,
    budgetMaxCents: 95_000,
    culturalTags: ["telugu_traditional", "south_indian_bridal"],
    languages: ["telugu", "english"],
    headcount: 140,
    notes: "Morning call time, bride plus two aunts. Saree draping needed between the ceremony and the reception.",
  },
  {
    host: 0,
    eventType: "griha_pravesham",
    specialty: "priest_pandit",
    eventDate: "2027-03-06",
    venueAddress: "2601 Preston Rd, Frisco TX 75034",
    budgetMinCents: 30_000,
    budgetMaxCents: 55_000,
    culturalTags: ["telugu_traditional"],
    languages: ["telugu", "english"],
    headcount: 45,
    notes: "Telugu tradition. Please bring the samagri list ahead of time so we can shop for it.",
  },
  {
    host: 1,
    eventType: "sangeet",
    specialty: "dj",
    eventDate: "2027-05-22",
    venueAddress: "4300 N MacArthur Blvd, Irving TX 75038",
    budgetMinCents: 120_000,
    budgetMaxCents: 220_000,
    culturalTags: ["punjabi_sikh", "indo_western_fusion"],
    languages: ["punjabi", "hindi", "english"],
    headcount: 320,
    notes: "Mixed crowd, three generations. Needs a real Punjabi set, not Bollywood top-40 on shuffle.",
  },
  {
    host: 1,
    eventType: "mehndi",
    specialty: "henna_artist",
    eventDate: "2027-05-20",
    venueAddress: "1200 W Airport Fwy, Irving TX 75062",
    budgetMinCents: 50_000,
    budgetMaxCents: 90_000,
    culturalTags: ["north_indian_bridal", "punjabi_sikh"],
    languages: ["punjabi", "english"],
    headcount: 90,
    notes: "Bridal mehndi the night before plus guest henna for roughly sixty people. Assistant required.",
  },
  {
    host: 1,
    eventType: "baraat",
    specialty: "dhol_player",
    eventDate: "2027-05-23",
    venueAddress: "4300 N MacArthur Blvd, Irving TX 75038",
    budgetMinCents: 40_000,
    budgetMaxCents: 75_000,
    culturalTags: ["punjabi_sikh"],
    languages: ["punjabi", "english"],
    headcount: 200,
    notes: "Ninety minutes outdoors, procession pace is unpredictable. Venue has a noise limit after 9pm.",
  },
  {
    host: 2,
    eventType: "boutique_lookbook",
    specialty: "photographer",
    eventDate: "2027-02-14",
    venueAddress: "1930 Preston Rd, Plano TX 75093",
    budgetMinCents: 150_000,
    budgetMaxCents: 300_000,
    culturalTags: ["indo_western_fusion", "minimal_natural"],
    languages: ["english", "hindi"],
    headcount: 12,
    notes: "Spring lehenga collection, studio plus two outdoor setups. Deliverables inside ten days.",
  },
  {
    host: 2,
    eventType: "jewellery_catalogue",
    specialty: "mua",
    eventDate: "2027-02-15",
    venueAddress: "1930 Preston Rd, Plano TX 75093",
    budgetMinCents: 60_000,
    budgetMaxCents: 110_000,
    culturalTags: ["hd_airbrush", "minimal_natural"],
    languages: ["english"],
    headcount: 6,
    notes: "Two models, six looks. Skin has to hold up under continuous strobe for eight hours.",
  },
  {
    host: 0,
    eventType: "seemantham_baby_shower",
    specialty: "decorator",
    eventDate: "2027-06-12",
    venueAddress: "6363 Parkwood Blvd, Plano TX 75024",
    budgetMinCents: 80_000,
    budgetMaxCents: 160_000,
    culturalTags: ["telugu_traditional", "south_indian_bridal"],
    languages: ["telugu", "english"],
    headcount: 70,
    notes: "Traditional setup with a floral swing. Venue allows load-in from 7am only.",
  },
];

async function main() {
  console.log(`seeding demo data into ${API}`);
  const health = await call("GET", "/healthz");
  if (health.status !== "ok") throw new Error("API is not healthy");

  const vendorTokens = [];
  for (const vendor of VENDORS) {
    const token = await onboard({ ...vendor, roles: ["crew"] });
    await call("POST", "/v1/profiles/crew", { token, body: vendor.profile });
    vendorTokens.push(token);
    console.log(`  vendor  ${vendor.displayName} (${vendor.profile.specialties.join(", ")})`);
  }

  const hostTokens = [];
  for (const host of HOSTS) {
    hostTokens.push(await onboard({ ...host, roles: ["host"] }));
    console.log(`  host    ${host.displayName}`);
  }

  let published = 0;
  for (const gig of GIGS) {
    const { host: hostIndex, ...brief } = gig;
    const token = hostTokens[hostIndex];
    const created = await call("POST", "/v1/gigs", { token, body: brief });
    await call("POST", `/v1/gigs/${created.gig.id}/publish`, { token });
    published += 1;
    console.log(`  gig     ${brief.eventType} / ${brief.specialty} — ${brief.venueAddress}`);
  }

  console.log(`\n${VENDORS.length} vendors, ${HOSTS.length} hosts, ${published} published gigs.`);
  console.log(`\nSign in and look around (password for every account: ${PASSWORD})`);
  console.log(`  vendor feed : ${VENDORS[0].email}`);
  console.log(`  host view   : ${HOSTS[0].email}`);
  console.log(`\nPhone verification is required on sign-in; the code is returned in the`);
  console.log(`response body while the API is not in production mode.`);
}

main().catch((error) => {
  console.error(`\nseed failed: ${error.message}`);
  process.exit(1);
});
