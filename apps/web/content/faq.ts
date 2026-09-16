import type { QandA } from "@/components/site/Faq";

/**
 * The questions a host actually asks before paying a stranger a deposit.
 *
 * Every answer here states a policy the code enforces -- escrow holding,
 * full refund on a vendor cancellation, travel quoted round trip from the
 * vendor's base past a free radius they set, an append-only ledger, and
 * ranking that is not for sale. None of them is a marketing claim written to
 * fill an accordion, which matters twice over: the block is emitted as
 * FAQPage structured data, and a rich result asserting something the product
 * does not do is the kind of thing that gets a domain a manual action.
 *
 * Deliberately absent: anything about how many vendors are on the platform,
 * how many events have been booked, or how fast anyone has been matched in
 * practice. Those are numbers, and there is no honest source for them yet.
 */
export const HOME_FAQ: readonly QandA[] = [
  {
    q: "How does payment work?",
    a: "You pay a deposit into escrow when a booking is confirmed. The money is held there rather than passed to the vendor, and it is released after the event. The vendor knows the funds exist before they hold the date; you know the work happens before they are paid.",
  },
  {
    q: "What happens if a vendor cancels on me?",
    a: "You get a full refund, every time, with no tier and no fee. A cancellation by you is refunded on a tiered scale that depends on how close to the event date it is, and those tiers are shown before you pay rather than after.",
  },
  {
    q: "Is travel included in the price?",
    a: "Travel is quoted separately and up front. Each vendor sets a radius they treat as free, and beyond it the quote is a round trip from their base — because the drive home is a real cost whether or not anyone charges for it. You see the figure before you commit, not on the invoice.",
  },
  {
    q: "Can a vendor pay to appear higher in my results?",
    a: "No. Placement is not for sale. Ranking is cultural fit, distance, budget, language and track record, in that order of weight, and each result shows the breakdown that produced its score — so the claim is checkable rather than a promise.",
  },
  {
    q: "Why does the site ask which function I am planning?",
    a: "Because a Sangeet is not a reception and a Griha Pravesham is not a birthday, and the crew who work them well are not the same people. Vendors tag the specific functions they have actually worked, and the match engine weights that above everything else.",
  },
  {
    q: "Which parts of Texas is this available in?",
    a: "Dallas-Fort Worth, Greater Houston, Austin, San Antonio, the Rio Grande Valley, El Paso, Corpus Christi and Lubbock. Texas is the pilot region; vendors regularly travel between metros, and when they do the drive is priced into the quote.",
  },
];
