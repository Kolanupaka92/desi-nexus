/**
 * The inspiration gallery.
 *
 * This list is empty, and that is the whole point of the file.
 *
 * A gallery is the single strongest thing a site in this category can show --
 * it is what a visitor scrolls to before reading a word of copy. It is also
 * the single easiest thing to fake, and faking it is worse than leaving it
 * out: a page of stock photographs of somebody else's wedding is a claim about
 * who works on this platform that is not true, it is the interchangeable look
 * every competitor already has, and the first client who recognises a Getty
 * image on a vendor's "portfolio" is a story that does not stop.
 *
 * So the section is built and the content is not invented. The moment there
 * are real photographs the gallery appears, already designed, filtered and
 * laid out. Nothing else has to change.
 *
 * ---------------------------------------------------------------------------
 * To turn the gallery on
 * ---------------------------------------------------------------------------
 *
 * 1. Put the image files in `apps/web/public/gallery/`. Prefer 1600px on the
 *    long edge; next/image generates the smaller sizes from them.
 * 2. Add an entry below for each one. `width` and `height` are the file's real
 *    pixel dimensions -- they reserve the space before the image loads, which
 *    is what stops the page jumping as it fills in.
 * 3. `occasion` and `speciality` must be codes that already exist:
 *    `occasion` from EVENT_GROUPS in ./seo.ts, `speciality` a slug from
 *    SPECIALITIES. The filter chips are built from whatever the entries
 *    actually use, so a gallery of four makeup photos shows one chip rather
 *    than seventeen with nothing behind them.
 * 4. `credit` names whose work it is. It is required, not optional: these are
 *    vendors' photographs, and a marketplace that shows a photographer's work
 *    without their name on it is doing the thing it exists to stop.
 * 5. `alt` describes what is in the frame for somebody who cannot see it.
 *    "Bridal makeup" is not a description; "Bride in a red lehenga having her
 *    dupatta pinned before the baraat" is.
 *
 * Only use photographs you have written permission to publish. Permission to
 * take a photograph at an event is not permission to publish it, and consent
 * from the vendor is not consent from the family in the frame.
 *
 * ---------------------------------------------------------------------------
 *
 * An entry looks like this:
 *
 *   {
 *     src: "/gallery/sangeet-frisco-01.jpg",
 *     width: 1600,
 *     height: 1067,
 *     alt: "Bride and her sisters mid-routine on a Sangeet stage, lit warm from the side",
 *     occasion: "sangeet",
 *     speciality: "photographer",
 *     credit: "Anjali Rao Studio",
 *   },
 */

export interface GalleryItem {
  /** Path under /public, e.g. "/gallery/sangeet-frisco-01.jpg". */
  readonly src: string;
  /** The file's real pixel dimensions, so the space is reserved before load. */
  readonly width: number;
  readonly height: number;
  /** What is in the frame, for somebody who cannot see it. */
  readonly alt: string;
  /** An event code from EVENT_GROUPS. */
  readonly occasion: string;
  /** A speciality slug from SPECIALITIES. */
  readonly speciality: string;
  /** Whose work this is. Required. */
  readonly credit: string;
  /** Optional link to the vendor's published profile, e.g. "/vendors/anjali-rao". */
  readonly creditHref?: string;
}

export const GALLERY: readonly GalleryItem[] = [];
