import Link from "next/link";
import { JsonLd } from "./JsonLd";

export interface Crumb {
  readonly label: string;
  /** Absent on the last crumb, which is the current page. */
  readonly href?: string;
}

/**
 * The trail, and the BreadcrumbList that goes with it.
 *
 * The two were separate before: the hire pages rendered a visible trail and,
 * on one of the two, a JSON-LD blob written by hand. Emitting both from one
 * list is the only way they stay in agreement -- a BreadcrumbList that
 * disagrees with the visible trail is a structured-data warning in Search
 * Console and, worse, a wrong trail in the result snippet.
 *
 * Home is prepended here rather than passed in, because every trail starts
 * there and Google's guidance is that the list be complete from the site root.
 */
export function Breadcrumbs({ crumbs, base }: { crumbs: readonly Crumb[]; base: string }) {
  const full: Crumb[] = [{ label: "Home", href: "/" }, ...crumbs];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: full.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.label,
            // The last item has no URL: it is the page the visitor is on, and
            // a self-referencing item is what the spec asks for here.
            ...(crumb.href ? { item: new URL(crumb.href, base).toString() } : {}),
          })),
        }}
      />
      <nav className="crumbs faint" aria-label="Breadcrumb">
        <ol>
          {full.map((crumb) => (
            <li key={crumb.label}>
              {crumb.href ? (
                <Link href={crumb.href}>{crumb.label}</Link>
              ) : (
                <span aria-current="page">{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
