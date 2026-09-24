/**
 * Content for the public, indexable pages.
 *
 * The taxonomy has 8 metros, 17 specialities and 31 event types. Generating
 * every combination would be 4,216 pages, and that is not an SEO strategy --
 * it is a doorway-page penalty. Search engines are explicit about this: pages
 * that differ only by a substituted city name are the canonical example of what
 * they demote.
 *
 * So the cross-product is cut deliberately. The pages generated are the ones a
 * person actually types -- "indian wedding makeup artist frisco" -- and each
 * carries content that could not be copied from its neighbour: what the role
 * really does at a South Asian function, which occasions book it, and which
 * suburbs the metro's Desi community actually lives in.
 *
 * The codes here must exist in the API's taxonomy. A test asserts it, for the
 * same reason the schema-drift test exists: a speciality that is valid on this
 * page and unknown to the service is a page whose every link 404s.
 */

export interface Metro {
  readonly slug: string;
  /** The API's metro id. */
  readonly code: string;
  readonly name: string;
  /** Where the community actually is, which is not the same as the city centre. */
  readonly cities: readonly string[];
  readonly blurb: string;
}

export const METROS: readonly Metro[] = [
  {
    slug: "dallas-fort-worth",
    code: "dfw",
    name: "Dallas-Fort Worth",
    cities: ["Frisco", "Plano", "Irving", "Richardson", "Allen", "McKinney", "Carrollton"],
    blurb:
      "The densest South Asian corridor in Texas runs north out of Dallas through Richardson, Plano and Frisco. It is also the most competitive weekend calendar in the state: a Saturday in wedding season can have four Sangeets within ten miles of each other, and the artists who work them are booked months out.",
  },
  {
    slug: "houston",
    code: "hou",
    name: "Greater Houston",
    cities: ["Sugar Land", "Katy", "Pearland", "Missouri City", "Stafford", "Cypress"],
    blurb:
      "Houston's community is spread wide -- Sugar Land and Katy are forty minutes apart on a good day, and considerably worse on a Saturday evening. Travel time is a real part of the cost here, which is why quotes include mileage both ways rather than pretending the drive home is free.",
  },
  {
    slug: "austin",
    code: "aus",
    name: "Austin",
    cities: ["Round Rock", "Cedar Park", "Pflugerville", "Leander"],
    blurb:
      "Austin's South Asian community skews younger and tech-heavy, concentrated north through Round Rock and Cedar Park. Smaller functions, more first-generation couples planning their own events, and a noticeably higher share of fusion ceremonies than Dallas or Houston.",
  },
  {
    slug: "san-antonio",
    code: "sat",
    name: "San Antonio",
    cities: ["Stone Oak", "Schertz", "New Braunfels"],
    blurb:
      "A smaller community with a thinner local vendor bench, so San Antonio functions often bring an artist down from Austin. That drive is priced into the quote up front rather than discovered afterwards.",
  },
  {
    slug: "rio-grande-valley",
    code: "rgv",
    name: "Rio Grande Valley",
    cities: ["McAllen", "Edinburg", "Harlingen", "Brownsville"],
    blurb:
      "The Valley's South Asian community is small, tight-knit and largely medical. Vendors are few enough locally that most functions draw from San Antonio or Houston, which makes an honest travel quote the difference between a booking and a surprise.",
  },
  {
    slug: "el-paso",
    code: "elp",
    name: "El Paso",
    cities: ["El Paso", "Horizon City"],
    blurb:
      "El Paso is closer to Phoenix than to Dallas, and the vendor pool reflects that isolation. Functions here plan further ahead by necessity, and overnight stays are the norm rather than the exception for anyone travelling in.",
  },
  {
    slug: "corpus-christi",
    code: "cc",
    name: "Corpus Christi",
    cities: ["Corpus Christi", "Portland"],
    blurb:
      "A coastal community small enough that most families know each other's vendors by name. Bookings tend to come by referral, and the gap this fills is mainly reaching artists in San Antonio and Houston who would happily make the drive.",
  },
  {
    slug: "lubbock",
    code: "lbb",
    name: "Lubbock",
    cities: ["Lubbock"],
    blurb:
      "Largely a student and medical community around Texas Tech. Functions are smaller and often organised at shorter notice, which puts a premium on knowing quickly who is genuinely available rather than who might reply.",
  },
];

export interface Speciality {
  readonly slug: string;
  /** The API's crew speciality code. */
  readonly code: string;
  /** Used in headings: "Indian wedding {noun} in Frisco". */
  readonly noun: string;
  /** What this role actually does at a South Asian function. */
  readonly does: string;
  /** Why booking a generalist for it goes wrong. */
  readonly why: string;
  /** Event codes this speciality is most often booked for. */
  readonly events: readonly string[];
}

export const SPECIALITIES: readonly Speciality[] = [
  {
    slug: "makeup-artist",
    code: "mua",
    noun: "makeup artist",
    does: "Bridal and family makeup, usually starting before sunrise and covering two or three looks across a single day.",
    why: "South Asian bridal makeup is its own discipline. Skin tones that photograph badly under a generalist's palette, a dupatta that has to be pinned so it survives a full baraat, and lehenga reds that fight with the wrong lip. An artist who has done forty Half-Saree Functions knows what the camera does at 6am under a shamiana; one who has done none is learning on your daughter.",
    events: ["mehndi", "sangeet", "hindu_ceremony", "reception", "half_saree_function", "nikah"],
  },
  {
    slug: "hair-stylist",
    code: "hair_stylist",
    noun: "hair stylist",
    does: "Bridal and party hair, including the structural work that holds a heavy dupatta or maang tikka in place for twelve hours.",
    why: "The weight is the problem. A style that looks right at the trial fails by the reception if it was not built to carry jewellery, and re-pinning between functions is a skill of its own.",
    events: ["mehndi", "sangeet", "hindu_ceremony", "reception", "half_saree_function"],
  },
  {
    slug: "photographer",
    code: "photographer",
    noun: "photographer",
    does: "Full-day coverage across ceremonies that often run in low light, in crowds, and to a ritual sequence nobody announces.",
    why: "The difference is knowing what is about to happen. A photographer who has shot an Anand Karaj knows when the laavan begins; one who has not is behind a pillar when it does. Ritual moments do not repeat for the camera.",
    events: ["mehndi", "sangeet", "baraat", "hindu_ceremony", "nikah", "reception", "griha_pravesham"],
  },
  {
    slug: "videographer",
    code: "videographer",
    noun: "videographer",
    does: "Cinematic and documentary coverage, usually cut to a highlight film plus full ceremony footage.",
    why: "Audio is where most fail. Mantras, a nikah's vows and a sangeet's speeches all need different capture, and a single on-camera mic delivers none of them well.",
    events: ["sangeet", "baraat", "hindu_ceremony", "nikah", "reception"],
  },
  {
    slug: "drone-operator",
    code: "drone_operator",
    noun: "drone operator",
    does: "Aerial coverage of baraats, outdoor mandaps and large venue establishing shots.",
    why: "Most of this work is regulatory rather than creative: licensing, venue permission and airspace near the major Texas airports, which quietly rules out a lot of Irving and Sugar Land venues without prior clearance.",
    events: ["baraat", "hindu_ceremony", "reception", "garba_navratri"],
  },
  {
    slug: "henna-artist",
    code: "henna_artist",
    noun: "henna artist",
    does: "Bridal mehndi — typically four to six hours for the bride alone — plus guest henna for however many people turn up.",
    why: "Bridal mehndi and guest henna are different jobs. Bridal is intricate, slow, and stains deepest when applied the night before; guest work is volume under time pressure. Booking one artist expecting both is how a mehndi runs three hours late.",
    events: ["mehndi", "half_saree_function", "seemantham_baby_shower", "diwali_celebration"],
  },
  {
    slug: "decorator",
    code: "decorator",
    noun: "decorator",
    does: "Mandap, stage and venue design, including the load-in and strike that venues schedule tightly.",
    why: "A mandap is a structure, not a backdrop. It has ritual requirements, a fire element in many ceremonies, and venue fire-code implications that a general event decorator will not have met before.",
    events: ["hindu_ceremony", "sangeet", "reception", "griha_pravesham", "garba_navratri"],
  },
  {
    slug: "florist",
    code: "florist",
    noun: "florist",
    does: "Garlands, mandap florals, car decoration and the jaimala that has to survive being lifted overhead.",
    why: "Volume and sourcing. Marigold and jasmine in the quantities a South Asian function needs are not a standard wholesale order in most of Texas, and substitutions show immediately in photographs.",
    events: ["hindu_ceremony", "baraat", "griha_pravesham", "reception", "satyanarayan_puja"],
  },
  {
    slug: "dj",
    code: "dj",
    noun: "DJ",
    does: "Sangeet and reception sets, usually mixing Bollywood, Punjabi, regional and Western across one night.",
    why: "The crossfade between a Punjabi set and a Telugu one is a real skill, and a DJ whose library stops at Bollywood top-40 loses a room that spans three generations and four languages.",
    events: ["sangeet", "reception", "garba_navratri", "bhangra_night", "diwali_celebration"],
  },
  {
    slug: "live-musician",
    code: "live_musician",
    noun: "live musician",
    does: "Classical and devotional performance — nadaswaram, shehnai, tabla, vocalists — for ceremonies and receptions.",
    why: "Ceremony music is liturgical, not background. The pieces are tied to ritual moments, and which tradition the family follows decides the instrument entirely.",
    events: ["hindu_ceremony", "satyanarayan_puja", "upanayanam", "reception", "griha_pravesham"],
  },
  {
    slug: "dhol-player",
    code: "dhol_player",
    noun: "dhol player",
    does: "Baraat processions, sangeet entrances and garba sets, typically in one- to two-hour blocks.",
    why: "It is outdoor, it is loud, and it has to hold a crowd walking at an unpredictable pace. Venue noise limits in several Texas suburbs constrain this more than people expect.",
    events: ["baraat", "sangeet", "garba_navratri", "bhangra_night"],
  },
  {
    slug: "choreographer",
    code: "choreographer",
    noun: "choreographer",
    does: "Sangeet performances for families with a wide range of ability and very little rehearsal time.",
    why: "The job is mostly managing people, not steps. A routine that works has to survive an uncle who attends one rehearsal and a cousin joining by video from another state.",
    events: ["sangeet", "half_saree_function", "reception", "graduation_party"],
  },
  {
    slug: "caterer",
    code: "caterer",
    noun: "caterer",
    does: "Multi-cuisine service at scale, usually with simultaneous vegetarian, Jain and non-vegetarian requirements.",
    why: "Dietary separation is not a preference here, it is the whole job. Jain requirements, onion-and-garlic-free preparation for a puja, and genuine vegetarian separation need a kitchen that has done it before.",
    events: ["hindu_ceremony", "reception", "sangeet", "griha_pravesham", "satyanarayan_puja"],
  },
  {
    slug: "pandit",
    code: "priest_pandit",
    noun: "pandit",
    does: "Conducting ceremonies and pujas, including explaining the rituals to guests who may not follow the language.",
    why: "Regional tradition decides everything. A Telugu ceremony and a Gujarati one differ in sequence, language and duration, and the family's own sampradaya decides which is correct. Booking the wrong tradition is the most common way a ceremony goes quietly wrong.",
    events: ["hindu_ceremony", "griha_pravesham", "satyanarayan_puja", "ayush_homam", "upanayanam", "namakaranam"],
  },
  {
    slug: "event-planner",
    code: "event_planner",
    noun: "event planner",
    does: "End-to-end coordination across multi-day functions, vendors and families who may be planning from overseas.",
    why: "Multi-day South Asian weddings are a logistics problem before they are a design problem: overlapping vendor load-ins, guest counts that move, and two families who may have different expectations of who decides what.",
    events: ["hindu_ceremony", "sangeet", "reception", "nikah", "sikh_anand_karaj"],
  },
  {
    slug: "mehndi-assistant",
    code: "mehndi_assistant",
    noun: "mehndi assistant",
    does: "Guest henna alongside a lead bridal artist, working through a queue at volume.",
    why: "Booked specifically so the bridal artist is not interrupted. Without one, guest henna either eats the bride's session or simply does not happen.",
    events: ["mehndi", "half_saree_function", "diwali_celebration"],
  },
  {
    slug: "saree-draper",
    code: "saree_draper",
    noun: "saree draper",
    does: "Draping for the bride and family across regional styles, and re-draping between functions.",
    why: "Nivi, Bengali, Gujarati seedha pallu and a half-saree's own drape are genuinely different techniques. A drape that is merely competent is the detail that dates every photograph from the day.",
    events: ["half_saree_function", "hindu_ceremony", "reception", "sangeet", "seemantham_baby_shower"],
  },
];

export const metroBySlug = (slug: string): Metro | undefined =>
  METROS.find((metro) => metro.slug === slug);

export const specialityBySlug = (slug: string): Speciality | undefined =>
  SPECIALITIES.find((speciality) => speciality.slug === slug);

/**
 * The occasion taxonomy, for the landing page's grid.
 *
 * The page prefers the live API so a newly seeded occasion appears without a
 * redeploy, and falls back to this. Without a fallback the grid renders as a
 * heading with nothing under it whenever the API is unreachable -- which is
 * exactly what the front door looks like before the API is hosted at all.
 *
 * Kept in the same order and grouping as the service's own EVENT_GROUPS; the
 * drift test asserts both directions.
 */
export const EVENT_GROUPS: Readonly<Record<string, readonly string[]>> = {
  wedding: [
    "roka_engagement",
    "mehndi",
    "haldi",
    "sangeet",
    "baraat",
    "hindu_ceremony",
    "nikah",
    "sikh_anand_karaj",
    "kerala_christian_wedding",
    "reception",
  ],
  religious: [
    "griha_pravesham",
    "satyanarayan_puja",
    "ayush_homam",
    "upanayanam",
    "namakaranam",
  ],
  milestone: [
    "half_saree_function",
    "mundan_child_carnival",
    "seemantham_baby_shower",
    "first_birthday",
    "graduation_party",
  ],
  festival: ["garba_navratri", "diwali_celebration", "holi_event", "bhangra_night"],
  commercial: [
    "boutique_lookbook",
    "brand_campaign_shoot",
    "jewellery_catalogue",
    "corporate_diwali",
    "corporate_offsite",
    "restaurant_launch",
    "influencer_collab",
  ],
};

/**
 * How the match engine actually weights a ranking.
 *
 * Shown on the landing page because it is the one thing no comparable
 * marketplace offers: every competitor returns a list, and none of them will
 * tell a host why this artist is above that one. Publishing the weights is also
 * the honest version of "we do not sell placement" -- a claim anyone can make,
 * and this is the receipt.
 *
 * These must equal the service's own WEIGHTS. A drift test asserts it: a
 * landing page publishing weights the engine does not use is worse than one
 * publishing nothing, because it is a specific promise that is false.
 */
export const MATCH_WEIGHTS: ReadonlyArray<{
  readonly key: string;
  readonly label: string;
  readonly weight: number;
  readonly why: string;
}> = [
  {
    key: "eventFit",
    label: "Worked your function",
    weight: 0.28,
    why: "Whether they have worked a half-saree function, a griha pravesham, a nikah — the thing you are actually planning. Someone who has run forty sangeets knows where the bottleneck is at hour three; someone who has photographed forty corporate launches does not, however good they are.",
  },
  {
    key: "cultural",
    label: "Cultural fit",
    weight: 0.24,
    why: "Whether they know your tradition. A MUA who does South Indian bridal is not interchangeable with one who does Punjabi Sikh bridal, and booking the wrong one is the most common way a function is ruined.",
  },
  {
    key: "proximity",
    label: "Distance",
    weight: 0.17,
    why: "Measured from the venue's real address, not a city centre. It decides what the drive costs and whether they can make a 6am call time.",
  },
  {
    key: "budget",
    label: "Budget fit",
    weight: 0.12,
    why: "Their rate against your range. Being shown someone at triple your budget wastes an enquiry for both of you.",
  },
  {
    key: "language",
    label: "Language",
    weight: 0.07,
    why: "What they speak on the day, with your family and the other vendors — not what is on their profile.",
  },
  {
    key: "reputation",
    label: "Track record",
    weight: 0.07,
    why: "Completed bookings and how they were reviewed. Deliberately not the heaviest weight, or nobody new could ever get their first booking.",
  },
  {
    key: "responsiveness",
    label: "Replies fast",
    weight: 0.05,
    why: "How quickly they answer. Small, because a slow reply from the right artist still beats a fast one from the wrong one.",
  },
];

/**
 * The five occasion groups, written up as pages.
 *
 * `EVENT_GROUPS` above is the taxonomy -- codes and grouping, shared with the
 * service. This is the editorial layer on top of it: what a visitor planning
 * this kind of function is actually deciding, and why the crew list for it is
 * not the crew list for the next one.
 *
 * Five pages, not five hundred. The temptation with a taxonomy this size is to
 * cross it with the eight metros and generate forty near-identical pages, and
 * every one of them would be thin: the thing that differs between a Sangeet in
 * Plano and a Sangeet in Katy is the travel quote, which is a number on the
 * vendor's page, not an article. What genuinely differs -- what a wedding needs
 * versus what a Griha Pravesham needs -- is these five.
 *
 * Nothing here is a claim about the business. No counts of events served, no
 * vendor numbers, no testimonials: the copy describes the occasions, which are
 * facts about the culture rather than assertions about us.
 */
export interface Plan {
  readonly slug: string;
  /** The h1, and the page title's subject. */
  readonly title: string;
  /** The two-word version, used on the home page card and in breadcrumbs. */
  readonly short: string;
  /** One paragraph under the h1. */
  readonly lede: string;
  /** What makes booking for this kind of function different. */
  readonly brief: string;
  /** The short line that appears on the home page card. */
  readonly card: string;
}

export const PLANS: readonly Plan[] = [
  {
    slug: "wedding",
    title: "Planning a wedding",
    short: "Weddings",
    card: "Multi-day, multi-family, never one event.",
    lede: "A South Asian wedding is not an event, it is a week. Mehndi, Haldi and Sangeet each want a different look, a different room and often a different crew, and the reception wants all of it done again by people who have not slept.",
    brief: "The mistake that costs the most is booking one vendor for the whole week without checking they have worked each function. A photographer who shoots receptions beautifully may never have covered a Baraat, which happens outdoors, in motion, in daylight that changes by the minute. Every vendor here tags the specific functions they have worked, so a shortlist for a four-day wedding can be read function by function rather than hoped at.",
  },
  {
    slug: "religious",
    title: "Planning a puja or ceremony",
    short: "Pujas & ceremonies",
    card: "The tradition sets the sequence, not the planner.",
    lede: "A Griha Pravesham, a Satyanarayan Puja, an Upanayanam or a Namakaranam runs to a sequence the family does not set. The vendor's job is to fit around it without ever being the reason something waits.",
    brief: "This is the category where language and tradition are not preferences. A pandit who performs in the family's tradition and speaks the language the elders are following in is the difference between a ceremony and a recital nobody can follow. Profiles here carry the tradition and the languages spoken, and the match engine weights both above distance.",
  },
  {
    slug: "milestone",
    title: "Planning a family milestone",
    short: "Family milestones",
    card: "Only make sense inside the family.",
    lede: "A Half-Saree Function, a Mundan, a Seemantham, a first birthday. Smaller than a wedding and, for the people in the room, not smaller at all.",
    brief: "Generalist vendors read these as parties and price them as parties, which is how a Half-Saree Function ends up with prom makeup and a photographer who missed the ritual because nobody told them it was coming. The crew listed for these functions have worked them before and know which twenty minutes of a four-hour afternoon actually matter.",
  },
  {
    slug: "festival",
    title: "Planning a festival night",
    short: "Festival nights",
    card: "Community-scale nights.",
    lede: "Garba, Diwali, Holi, a Bhangra night. Hundreds of people, one room, a sound system that has to survive nine nights and lighting that has to work for a crowd rather than a couple.",
    brief: "The constraints here are closer to a live event than to a wedding: load-in windows, power, a DJ who owns a rig that can fill a hall rather than a booth, and a photographer who can work a moving crowd in bad light. Vendors who work these tag them, because the equipment list is different and so is the night.",
  },
  {
    slug: "commercial",
    title: "Planning a shoot or brand event",
    short: "Shoots & brand events",
    card: "Same supply, different demand.",
    lede: "Boutique lookbooks, jewellery catalogues, brand campaigns, a corporate Diwali, a restaurant launch. The same artists, hired on commercial terms.",
    brief: "The people who do bridal well are frequently the people a boutique wants, and they are hard to find because they are indexed under weddings everywhere else. Briefs here carry usage terms and deliverables alongside the date, so a shoot is not negotiated twice.",
  },
];

export const planBySlug = (slug: string): Plan | undefined =>
  PLANS.find((plan) => plan.slug === slug);
