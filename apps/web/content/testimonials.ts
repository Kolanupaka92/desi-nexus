/**
 * What clients have said.
 *
 * Empty, and it stays empty until somebody real has said something.
 *
 * No booking has settled on this platform yet, so there is nobody to quote.
 * Writing plausible quotes -- "DESI-NEXUS found us the perfect MUA, ten out of
 * ten, Priya from Frisco" -- is fabricating evidence of trustworthiness on a
 * site whose entire pitch is that it can be trusted with a deposit. It is also
 * the specific thing a visitor checks when they are deciding whether to
 * believe a new marketplace, and inventing it forfeits exactly what it was
 * meant to buy.
 *
 * The section renders only when this list has entries, so the page is complete
 * either way rather than carrying a heading with nothing under it.
 *
 * ---------------------------------------------------------------------------
 * Before adding one
 * ---------------------------------------------------------------------------
 *
 *  * The words must be theirs. Tidying punctuation is fine; writing the
 *    sentence for them and asking them to approve it is not a testimonial.
 *  * Get permission to publish it, including the name as it will appear. "You
 *    can use that" in a WhatsApp thread is enough; assuming is not.
 *  * A first name and a city is the most that should appear. These are private
 *    individuals and the event is often a family occasion.
 *  * Do not add a star rating here. Ratings come from the review system, are
 *    attached to a specific vendor and a settled booking, and belong on that
 *    vendor's profile -- not as a number on the marketing page.
 *
 * An entry looks like this:
 *
 *   {
 *     quote: "She turned up at five in the morning and stayed through the reception. The re-pin between functions was the thing I did not know to ask for.",
 *     name: "Divya",
 *     where: "Frisco",
 *     occasion: "Half-Saree Function",
 *   },
 */

export interface Testimonial {
  /** Their words, not ours. */
  readonly quote: string;
  /** A first name is enough. */
  readonly name: string;
  /** City, not a full address. */
  readonly where?: string;
  /** The function it was about, in plain words. */
  readonly occasion?: string;
}

export const TESTIMONIALS: readonly Testimonial[] = [];
