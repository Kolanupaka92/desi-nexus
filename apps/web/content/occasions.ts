import type { Occasion } from "@/components/occasion/OccasionTile";

/**
 * The five occasion groups, as data.
 *
 * These mirror the `group` values the API's taxonomy serves and the five
 * `/plan/[group]` routes generate from. The descriptions name the functions a
 * host would actually recognise, because "Weddings" alone does not tell a
 * Telugu family planning a half-saree function that this site is for them.
 *
 * Colours are chosen from what the occasion looks like rather than from a
 * palette generator: turmeric for the ceremonies, henna green for the family
 * milestones, the magenta of a festival night, the indigo of a commercial
 * shoot. Each is paired with an ink that clears 4.5:1 against it -- measured,
 * not assumed, because "dark background so white text is fine" is how a
 * 3.8:1 pair ships.
 *
 * No `count` on any of these. The marketplace has not launched; a vendor
 * count would be a number we made up, and the brief forbids exactly that.
 * When the API can answer it honestly, it goes here.
 */
export const OCCASIONS: readonly Occasion[] = [
  {
    key: "wedding",
    title: "Weddings",
    description:
      "Roka, mehndi, haldi, sangeet, baraat, the ceremony itself — and the nikah, Anand Karaj or Kerala Christian wedding it might be instead.",
    href: "/plan/wedding",
    bg: "var(--occ-wedding)",
    ink: "var(--occ-wedding-ink)",
  },
  {
    key: "religious",
    title: "Pujas & ceremonies",
    description:
      "Griha Pravesham, Satyanarayan puja, naming ceremonies. Priests who know your family's tradition, not a generic one.",
    href: "/plan/religious",
    bg: "var(--occ-religious)",
    ink: "var(--occ-religious-ink)",
  },
  {
    key: "milestone",
    title: "Family milestones",
    description:
      "Half-saree functions, dhoti ceremonies, first birthdays, anniversaries and graduations.",
    href: "/plan/milestone",
    bg: "var(--occ-milestone)",
    ink: "var(--occ-milestone-ink)",
  },
  {
    key: "festival",
    title: "Festival nights",
    description:
      "Garba and dandiya, Diwali parties, Onam sadhya, Pongal and Eid gatherings.",
    href: "/plan/festival",
    bg: "var(--occ-festival)",
    ink: "var(--occ-festival-ink)",
  },
  {
    key: "commercial",
    title: "Shoots & brand events",
    description:
      "Boutique lookbooks, bridal editorials, restaurant launches and corporate Diwali nights.",
    href: "/plan/commercial",
    bg: "var(--occ-commercial)",
    ink: "var(--occ-commercial-ink)",
  },
];
