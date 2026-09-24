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
 *
 * EVERY FUNCTION NAMED IN A DESCRIPTION MUST EXIST IN THAT GROUP IN
 * EVENT_GROUPS (content/seo.ts). This is not a style note. The first version
 * of this file promised Onam sadhya, Pongal, Eid gatherings and anniversaries,
 * none of which are in the taxonomy -- so a Malayali family clicking "Festival
 * nights" for Onam would have landed on garba, Diwali, Holi and bhangra, and a
 * couple looking for an anniversary would have found nothing at all. Nothing
 * failed; the copy simply lied, and it took a competitor's service list to
 * notice. The drift test below catches it now.
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
      "Half-saree functions, mundans, baby showers, first birthdays and graduation parties.",
    href: "/plan/milestone",
    bg: "var(--occ-milestone)",
    ink: "var(--occ-milestone-ink)",
  },
  {
    key: "festival",
    title: "Festival nights",
    description:
      "Garba and dandiya nights, Diwali parties, Holi events and bhangra nights.",
    href: "/plan/festival",
    bg: "var(--occ-festival)",
    ink: "var(--occ-festival-ink)",
  },
  {
    key: "commercial",
    title: "Shoots & brand events",
    description:
      "Boutique lookbooks, jewellery catalogues, brand shoots, restaurant launches and corporate Diwali nights.",
    href: "/plan/commercial",
    bg: "var(--occ-commercial)",
    ink: "var(--occ-commercial-ink)",
  },
];
