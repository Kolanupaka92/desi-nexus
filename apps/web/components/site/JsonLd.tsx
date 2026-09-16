/**
 * Structured data, in one place.
 *
 * Every JSON-LD block on the site went in through its own
 * `dangerouslySetInnerHTML={{ __html: JSON.stringify(...) }}`, which is three
 * things to get right at each call site and one of them -- escaping -- is the
 * kind that fails silently and only on the page with an apostrophe in it.
 *
 * `<` is escaped because a string ending up inside the script that contains
 * `</script` closes the tag early; the rest of the page then renders as JSON.
 * Vendor-supplied text reaches this component on the profile pages, so it is
 * not a theoretical input.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
