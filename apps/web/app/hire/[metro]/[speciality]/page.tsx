import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { METROS, SPECIALITIES, metroBySlug, specialityBySlug } from "@/content/seo";
import { label } from "@/lib/format";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import { CTASection } from "@/components/site/CTASection";
import { BRAND } from "@/content/brand";

/**
 * The page a search actually lands on: one speciality, in one metro.
 *
 * Statically generated and never revalidated against the API, because it must
 * render when the service is down. A marketing page that 500s at a first-time
 * visitor is worse than one that is a day stale.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://desi-nexus.com";

export function generateStaticParams() {
  return METROS.flatMap((metro) =>
    SPECIALITIES.map((speciality) => ({ metro: metro.slug, speciality: speciality.slug })),
  );
}

type Params = { params: Promise<{ metro: string; speciality: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { metro: metroSlug, speciality: specialitySlug } = await params;
  const metro = metroBySlug(metroSlug);
  const speciality = specialityBySlug(specialitySlug);
  if (!metro || !speciality) return {};

  const title = `South Asian ${speciality.noun} in ${metro.name}`;
  const description = `${speciality.does} Serving ${metro.cities.slice(0, 3).join(", ")} and the rest of ${metro.name}. Quotes include travel, and payment is held in escrow until the event.`;
  return {
    title,
    description,
    alternates: { canonical: `/hire/${metro.slug}/${speciality.slug}` },
    openGraph: { title: `${title} · ${BRAND.name}`, description, type: "website" },
  };
}

export default async function HirePage({ params }: Params) {
  const { metro: metroSlug, speciality: specialitySlug } = await params;
  const metro = metroBySlug(metroSlug);
  const speciality = specialityBySlug(specialitySlug);
  if (!metro || !speciality) notFound();

  // Described as a Service rather than a LocalBusiness: DESI-NEXUS is the
  // marketplace, not the vendor, and claiming to be a local business with a
  // storefront in eight metros at once is the kind of thing that gets
  // structured data ignored entirely.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: `South Asian event ${speciality.noun}`,
    provider: { "@type": "Organization", name: BRAND.name },
    areaServed: metro.cities.map((city) => ({
      "@type": "City",
      name: city,
      containedInPlace: { "@type": "State", name: "Texas" },
    })),
    description: speciality.does,
  };

  const others = SPECIALITIES.filter((other) => other.slug !== speciality.slug).slice(0, 8);

  return (
    <div className="shell">
      <JsonLd data={jsonLd} />

      <Breadcrumbs
        base={SITE}
        crumbs={[
          { label: "Hire", href: "/hire" },
          { label: metro.name, href: `/hire/${metro.slug}` },
          { label: speciality.noun },
        ]}
      />

      <section style={{ padding: "36px 0 8px", maxWidth: 760 }}>
        <span className="pill">{metro.name} · now booking</span>
        {/*
          Sentence case, not capitalize. `text-transform: capitalize` uppercases
          every word including the preposition -- "Makeup Artist In Dallas-Fort
          Worth" -- and the nouns are already written to read correctly inline.
        */}
        <h1 style={{ marginTop: "var(--space-4)" }}>
          South Asian {speciality.noun} in {metro.name}
        </h1>
        <p className="lede">{speciality.does}</p>
      </section>

      <div className="card" style={{ marginTop: 22 }}>
        <h3>Why the speciality matters</h3>
        <p style={{ margin: 0 }}>{speciality.why}</p>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Most often booked for</h3>
        <ul className="tags" style={{ marginTop: 8 }}>
          {speciality.events.map((event) => (
            <li key={event} className="pill tag">
              {label(event)}
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Serving {metro.name}</h3>
        <p style={{ marginTop: 0 }}>{metro.blurb}</p>
        <p className="faint" style={{ marginBottom: 0 }}>
          Including {metro.cities.join(", ")}. Travel beyond a vendor&rsquo;s free radius is quoted
          automatically, round trip, before anyone commits.
        </p>
      </div>

      {/*
        "Most briefs are matched within the hour" used to close this page. It
        is a statistic, nobody has measured it, and no booking has settled on
        this platform yet -- so it was a number invented to sound confident,
        which is the one thing a marketplace asking for a deposit cannot afford
        to be caught doing. What replaces it is the same promise stated as a
        mechanism, which is true and checkable on the results page.
      */}
      <div style={{ marginTop: 32 }}>
        <CTASection
          eyebrow="Post the function, not a job ad"
          title={`Tell us the occasion and the ${metro.name} shortlist ranks itself.`}
          body={`${metro.name} ${speciality.noun}s are ranked on cultural fit first, then distance, budget, language and track record — and every applicant arrives with the breakdown that produced their score. Placement is not for sale.`}
          primary={{ href: "/gigs/new", label: "Post a brief" }}
          secondary={{ href: "/register", label: "Join as a vendor" }}
        />
      </div>

      <section style={{ marginTop: 28 }}>
        <h3>Other crew for {metro.name} functions</h3>
        <ul className="tags" style={{ marginTop: 10 }}>
          {others.map((other) => (
            <li key={other.slug}>
              <Link className="pill tag" href={`/hire/${metro.slug}/${other.slug}`}>
                {other.noun}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h3 className="faint">Same speciality, other metros</h3>
        <ul className="tags" style={{ marginTop: 10 }}>
          {METROS.filter((other) => other.slug !== metro.slug).map((other) => (
            <li key={other.slug}>
              <Link className="pill tag" href={`/hire/${other.slug}/${speciality.slug}`}>
                {other.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
