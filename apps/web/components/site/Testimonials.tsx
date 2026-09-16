import type { Testimonial } from "@/content/testimonials";

/**
 * What clients have said, when any of them have said anything.
 *
 * Renders nothing at all for an empty list rather than a heading over a gap,
 * so the page is complete before there is anything to put here and improves
 * rather than changes once there is. There is deliberately no star rating and
 * no aggregate: ratings belong to a settled booking and a specific vendor, and
 * a number on a marketing page is the easiest thing on a site to invent.
 */
export function Testimonials({ items }: { readonly items: readonly Testimonial[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="quotes">
      {items.map((item) => (
        <li key={`${item.name}-${item.quote.slice(0, 24)}`}>
          <figure>
            <blockquote>
              <p>{item.quote}</p>
            </blockquote>
            <figcaption>
              <strong>{item.name}</strong>
              {(item.where ?? item.occasion) && (
                <span>{[item.occasion, item.where].filter(Boolean).join(" · ")}</span>
              )}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
