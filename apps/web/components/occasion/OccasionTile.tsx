import Link from "next/link";
import styles from "./OccasionTile.module.css";
import { cx } from "@/components/ui/Layout";

/**
 * One occasion, as a block of colour.
 *
 * The colour arrives as a CSS custom property set inline, not as a class per
 * occasion. That matters: the occasion list is data (content/occasions.ts), so
 * adding a sixth occasion has to be a data edit. A `.tileWedding` class per
 * entry would mean every new occasion needs a CSS change too, and the two
 * lists would drift the first time somebody forgot -- silently, because a
 * missing class renders as the fallback colour rather than as an error.
 */
export interface Occasion {
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly href: string;
  /** Background. Must clear 4.5:1 against `ink`. */
  readonly bg: string;
  /** Text colour on that background. */
  readonly ink: string;
  /**
   * How many vendors work this occasion, when we actually know.
   *
   * Optional, and undefined until the API says otherwise. A marketplace that
   * has not launched showing "120+ vendors" is the single most common lie on
   * a page like this, and the brief for this project rules it out explicitly.
   */
  readonly count?: number;
}

export function OccasionTile({
  occasion,
  feature = false,
}: {
  occasion: Occasion;
  /** Span two columns and set the title larger. For the first of a row. */
  feature?: boolean;
}) {
  const { title, description, href, bg, ink, count } = occasion;
  return (
    <Link
      href={href}
      className={cx(styles.tile, feature && styles.feature)}
      style={{ ["--tile-bg" as string]: bg, ["--tile-ink" as string]: ink }}
    >
      {count !== undefined && (
        <span className={styles.count}>
          {count} {count === 1 ? "vendor" : "vendors"}
        </span>
      )}
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.body}>{description}</p>
      <span className={styles.arrow} aria-hidden="true">
        Browse
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" focusable="false">
          <path
            d="M2 8h11M9 4l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}
