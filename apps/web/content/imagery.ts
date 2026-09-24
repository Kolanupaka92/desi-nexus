import type { MotifName } from "@/components/site/Motif";

/**
 * Every card's picture, in one place.
 *
 * The point of this file is that supplying photography is a data change. No
 * component holds an image path, an alt string or a crop; they read this, so a
 * photograph arriving later replaces a drawing without anybody opening a .tsx
 * file. That is the brief's requirement and it is also the only arrangement
 * that survives the photographs being supplied piecemeal, a few at a time,
 * which is how this will actually happen.
 *
 * ---------------------------------------------------------------------------
 * Why `image` is undefined on every entry right now
 * ---------------------------------------------------------------------------
 *
 * The photographs could not be fetched from the environment this was built in:
 * the egress proxy answers 403 to CONNECT for every image host -- Unsplash,
 * Pexels, Wikimedia Commons. That is a network policy, not a missing feature,
 * and it is not something to route around.
 *
 * So each entry carries the exact search query for its picture instead, and
 * the card renders its drawing until the picture exists. `searchQuery` is not
 * decoration: it is the specific phrase to search, chosen per card, because
 * "Indian event" returns something generic for all fourteen and that is the
 * failure this file is meant to prevent.
 *
 * ---------------------------------------------------------------------------
 * Supplying one
 * ---------------------------------------------------------------------------
 *
 * 1. Put the file at `apps/web/public/images/<key>.jpg` (see
 *    public/images/README.md for the full list of filenames).
 * 2. Fill in `image` on that entry: `src`, real pixel `width`/`height`, `alt`,
 *    `credit`, `licence`, and `focal` if the subject is not centred.
 * 3. Nothing else. The card switches from the drawing to the photograph on the
 *    next build.
 *
 * `width` and `height` must be the file's true dimensions. They reserve the
 * space before the image loads, which is what stops the page shifting as it
 * fills in -- the most visible way a photo-heavy page feels cheap.
 *
 * `focal` is an `object-position`. The card crops to a fixed ratio, so this is
 * how the thing that communicates the service stays in frame: the hands in a
 * mehndi photograph, the decorated stage in a decorator's, the face in a
 * makeup artist's. Default is centre, which is wrong often enough to be worth
 * checking every time.
 */
export interface CardImage {
  /** Path under /public, e.g. "/images/wedding.jpg". */
  readonly src: string;
  /** The file's real pixel dimensions, so the space is reserved before load. */
  readonly width: number;
  readonly height: number;
  /** What is in the frame, for somebody who cannot see it. Not keywords. */
  readonly alt: string;
  /** An `object-position` value, when the subject is not centred. */
  readonly focal?: string;
  /** Who took it. */
  readonly credit: string;
  /** The licence it is used under, recorded so it can be audited later. */
  readonly licence: string;
  /** Where it came from. */
  readonly sourceUrl?: string;
}

export interface CardEntry {
  /** Stable id, and the expected image filename stem. */
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  /** What is drawn while there is no photograph. */
  readonly motif: MotifName;
  /** The photograph, once there is one. */
  readonly image?: CardImage;
  /**
   * The phrase to search for this specific picture.
   *
   * Per card, deliberately. A single broad query for all of them is how a site
   * ends up with fourteen interchangeable photographs of marigolds.
   */
  readonly searchQuery: string;
}

/**
 * The four big cards: what kind of function is this.
 *
 * Titles and descriptions mirror `PLANS` in ./seo.ts, which is where the
 * editorial copy lives; these are the card-sized versions.
 */
export const EVENT_CATEGORIES: readonly CardEntry[] = [
  {
    key: "wedding",
    title: "Weddings",
    description: "Multi-day, multi-family, never one event.",
    href: "/plan/wedding",
    motif: "wedding",
    searchQuery: "South Asian Indian wedding mandap ceremony bride and groom",
  },
  {
    key: "religious",
    title: "Pujas & ceremonies",
    description: "The tradition sets the sequence, not the planner.",
    href: "/plan/religious",
    motif: "religious",
    searchQuery: "Hindu griha pravesh puja ceremony kalash priest family",
  },
  {
    key: "milestone",
    title: "Family milestones",
    description: "Only make sense inside the family.",
    href: "/plan/milestone",
    motif: "milestone",
    searchQuery: "Indian half saree ceremony family celebration traditional attire",
  },
  {
    key: "festival",
    title: "Festival nights",
    description: "Community-scale nights.",
    href: "/plan/festival",
    motif: "festival",
    searchQuery: "Garba Navratri community celebration dandiya crowd dancing",
  },
  {
    key: "commercial",
    title: "Shoots & brand events",
    description: "Same supply, different demand.",
    href: "/plan/commercial",
    motif: "commercial",
    searchQuery: "Indian boutique lookbook fashion photoshoot studio lighting",
  },
];

/**
 * The craft cards: who you can book.
 *
 * `href` points at the Dallas-Fort Worth page for each, which is what the home
 * page already linked to -- every speciality exists in all ten metros, and
 * the metro pages carry the rest.
 */
export const SPECIALISTS: readonly CardEntry[] = [
  {
    key: "makeup-artist",
    title: "Makeup artist",
    description: "Mehndi · Sangeet",
    href: "/hire/dallas-fort-worth/makeup-artist",
    motif: "makeup-artist",
    searchQuery: "Indian bridal makeup artist applying makeup to South Asian bride",
  },
  {
    key: "photographer",
    title: "Photographer",
    description: "Mehndi · Sangeet",
    href: "/hire/dallas-fort-worth/photographer",
    motif: "photographer",
    searchQuery: "Indian wedding photographer with camera shooting ceremony",
  },
  {
    key: "henna-artist",
    title: "Henna artist",
    description: "Mehndi · Half-Saree Function",
    href: "/hire/dallas-fort-worth/henna-artist",
    motif: "henna-artist",
    searchQuery: "henna artist applying intricate bridal mehndi to hands close up",
  },
  {
    key: "pandit",
    title: "Pandit",
    description: "Hindu Wedding Ceremony · Griha Pravesham",
    href: "/hire/dallas-fort-worth/pandit",
    motif: "pandit",
    searchQuery: "Hindu priest pandit performing puja ritual fire ceremony",
  },
  {
    key: "decorator",
    title: "Decorator",
    description: "Hindu Wedding Ceremony · Sangeet",
    href: "/hire/dallas-fort-worth/decorator",
    motif: "decorator",
    searchQuery: "Indian wedding stage floral backdrop mandap decoration venue",
  },
  {
    key: "dj",
    title: "DJ",
    description: "Sangeet · Reception",
    href: "/hire/dallas-fort-worth/dj",
    motif: "dj",
    searchQuery: "Indian wedding DJ sangeet reception dance floor event lighting",
  },
  {
    key: "videographer",
    title: "Videographer",
    description: "Sangeet · Baraat",
    href: "/hire/dallas-fort-worth/videographer",
    motif: "videographer",
    searchQuery: "wedding videographer filming Indian ceremony cinema camera",
  },
  {
    key: "caterer",
    title: "Caterer",
    description: "Hindu Wedding Ceremony · Reception",
    href: "/hire/dallas-fort-worth/caterer",
    motif: "caterer",
    searchQuery: "Indian wedding catering buffet service thali food large event",
  },
];

/** Every card that wants a photograph, for the checklist in the README. */
export const ALL_CARDS: readonly CardEntry[] = [...EVENT_CATEGORIES, ...SPECIALISTS];

/** How many still have no photograph. Used by the image README's checklist. */
export const missingImageCount = (): number =>
  ALL_CARDS.filter((card) => card.image === undefined).length;
