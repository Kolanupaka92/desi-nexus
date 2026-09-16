import Link from "next/link";
import { BRAND } from "@/content/brand";

/**
 * The mark.
 *
 * A diamond with a vesica cut out of its centre.
 *
 * The shape carries the business rather than decorating it: two circles
 * overlapping produce the lens in the middle, and that lens is the only part
 * of the mark that is not the diamond. A host on one side, a vendor on the
 * other, and the booking is the shape they make together -- which is literally
 * what this company sells. The outer diamond is the jaali cell the hero
 * texture is built from, so the mark and the page are drawn from one geometry.
 *
 * It replaces three concentric diamonds. Those were pleasant and meant
 * nothing, and at 16px they collapsed into a smudge with a dot.
 *
 * One path, one fill, `evenodd`. That matters more than it looks: a mark with
 * a single fill and no strokes works in gold on wine, in black on paper, in
 * white knocked out of a photograph, embroidered on a shirt, and stamped on an
 * invoice. A mark that needs two colours to be itself fails at half of those.
 */
export function Mark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="currentColor"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path
        fillRule="evenodd"
        d="M32 6 58 32 32 58 6 32Z M32 17 A16 16 0 0 1 32 47 A16 16 0 0 1 32 17Z"
      />
    </svg>
  );
}

/**
 * Mark plus wordmark, as one link home.
 *
 * The separator between words is drawn by CSS rather than typed, so the
 * accessible name is "DESI NEXUS" and not "DESI middle dot NEXUS". A screen
 * reader should read a company's name, not spell its punctuation.
 *
 * The words are mapped, not destructured. Destructuring a pair hard-codes a
 * two-word name: given a one-word `wordmark` it still emitted two spans, the
 * second empty, and the CSS separator -- which fires on `span + span` -- drew
 * a marigold dot after the name with nothing following it. Measured in
 * Chromium: two spans, one dot. Mapping makes the dot count fall out of the
 * word count, so a one-word name has no separator without anyone remembering
 * to remove one. Half the names on the shortlist are one word.
 */
export function Logo({
  className,
  stacked = false,
}: {
  className?: string;
  /** Mark above wordmark, for tight or square placements. */
  stacked?: boolean;
}) {
  return (
    <Link
      href="/"
      className={[`logo`, stacked ? "stacked" : "", className ?? ""].filter(Boolean).join(" ")}
      aria-label={`${BRAND.name} — home`}
    >
      <Mark className="logo-mark" />
      <span className="logo-word" aria-hidden="true">
        {BRAND.wordmark.map((part) => (
          <span key={part}>{part}</span>
        ))}
      </span>
    </Link>
  );
}
