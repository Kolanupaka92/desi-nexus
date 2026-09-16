import Image from "next/image";
import type { CardEntry } from "@/content/imagery";
import { Motif } from "./Motif";

/**
 * The picture on a card.
 *
 * One component for every card on the site, so the rule "photograph when there
 * is one, drawing when there is not" is written once rather than at fourteen
 * call sites where it would drift.
 *
 * The drawing is the fallback, not the design. Once `image` is filled in for a
 * card in content/imagery.ts, that card renders a photograph and the drawing
 * is never reached. Nothing here needs editing for that to happen -- which is
 * the whole reason the configuration is data.
 */
export function CardVisual({
  card,
  className,
  sizes,
  priority = false,
}: {
  readonly card: CardEntry;
  readonly className?: string;
  /**
   * What width this will actually render at, per breakpoint.
   *
   * Required rather than optional: the default is `100vw`, which on a card
   * four across a desktop grid downloads roughly four times the pixels needed.
   * Making the caller state it means nobody gets that by forgetting.
   */
  readonly sizes: string;
  /** Set on above-the-fold images only; everything else stays lazy. */
  readonly priority?: boolean;
}) {
  const shell = className ? `card-visual ${className}` : "card-visual";

  if (!card.image) {
    return (
      <div className={shell} data-visual="drawn">
        <Motif name={card.motif} />
      </div>
    );
  }

  const { src, width, height, alt, focal } = card.image;
  return (
    <div className={shell} data-visual="photo">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        // Everything not marked priority loads lazily, which is every card
        // below the fold -- that is most of them on a phone.
        loading={priority ? undefined : "lazy"}
        className="card-photo"
        /*
         * The card crops to a fixed ratio, so this is what keeps the subject in
         * frame: the hands in a mehndi photograph, the stage in a decorator's.
         * Centre is the default and is wrong often enough to be worth setting.
         */
        style={focal ? { objectPosition: focal } : undefined}
      />
    </div>
  );
}
