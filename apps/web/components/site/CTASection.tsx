import Link from "next/link";

/**
 * The closing call to action, used at the foot of every marketing page.
 *
 * One primary action and at most one secondary. The version this replaces had
 * three buttons of equal weight in the hero and two more at the bottom, which
 * is the usual way a page ends up with no call to action at all: a visitor
 * offered five equivalent choices makes none of them.
 */
export function CTASection({
  eyebrow,
  title,
  body,
  primary,
  secondary,
}: {
  eyebrow?: string;
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <div className="cta">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className="cta-actions">
        <Link href={primary.href} className="btn gold">
          {primary.label}
        </Link>
        {secondary && (
          <Link href={secondary.href} className="btn ghost">
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}
