"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { GalleryItem } from "@/content/gallery";
import { label } from "@/lib/format";

/**
 * A filterable grid of real vendor work.
 *
 * The filter chips are derived from what the items actually carry rather than
 * from the full taxonomy. Seventeen specialities and thirty occasions as chips
 * over a gallery of eight photographs would be twenty-two dead filters and
 * three live ones, which teaches a visitor that the controls do not work.
 *
 * Filtering is client-side and the whole set is already in the DOM, so a chip
 * costs no request and no layout pass beyond hiding. That holds while a
 * gallery is tens of images; past a few hundred this wants pagination, which
 * is a problem to have.
 *
 * Every image reserves its space from the real file dimensions, so the page
 * does not jump as it fills in -- the most visible way a photo-heavy page
 * feels cheap.
 *
 * `label` is imported here rather than passed in from the page. It was a prop
 * first, which is a server component handing a function to a client one --
 * React cannot serialise that across the boundary, and the whole home page
 * rendered a 500 rather than the section failing on its own. Nothing catches
 * it earlier: the build succeeds, because the error happens when the page is
 * rendered rather than when it is compiled, and this page is dynamic.
 */
export function Gallery({ items }: { readonly items: readonly GalleryItem[] }) {
  const [active, setActive] = useState<string>("all");

  // In first-appearance order rather than alphabetical: the order the items
  // were curated in is a decision somebody made, and sorting discards it.
  const filters = useMemo(() => {
    const seen: string[] = [];
    for (const item of items) {
      if (!seen.includes(item.occasion)) seen.push(item.occasion);
    }
    return seen;
  }, [items]);

  const shown = active === "all" ? items : items.filter((item) => item.occasion === active);

  return (
    <>
      {filters.length > 1 && (
        <div className="gallery-filters" role="group" aria-label="Filter by occasion">
          <button
            type="button"
            className={`chip${active === "all" ? " on" : ""}`}
            aria-pressed={active === "all"}
            onClick={() => setActive("all")}
          >
            Everything
          </button>
          {filters.map((code) => (
            <button
              key={code}
              type="button"
              className={`chip${active === code ? " on" : ""}`}
              aria-pressed={active === code}
              onClick={() => setActive(code)}
            >
              {label(code)}
            </button>
          ))}
        </div>
      )}

      <ul className="gallery">
        {shown.map((item) => (
          <li key={item.src} className="gallery-item">
            <Image
              src={item.src}
              alt={item.alt}
              width={item.width}
              height={item.height}
              // The grid is two columns on a phone and four on a desktop, so
              // the browser is told that rather than left to assume the image
              // fills the viewport and download four times what it needs.
              sizes="(min-width: 980px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="gallery-img"
            />
            <div className="gallery-caption">
              <span className="gallery-occasion">{label(item.occasion)}</span>
              {/* Attribution is not decoration. These are vendors' photographs,
                  and a marketplace showing a photographer's work unattributed
                  is doing the thing it exists to stop. */}
              <span className="gallery-credit">
                {item.creditHref ? (
                  <Link href={item.creditHref}>{item.credit}</Link>
                ) : (
                  item.credit
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
