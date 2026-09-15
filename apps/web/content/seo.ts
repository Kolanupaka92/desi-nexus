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
