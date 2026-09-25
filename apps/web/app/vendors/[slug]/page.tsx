import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiCallError, vendorProfile, type PublicVendorProfile } from "@/lib/api";
import { label, usd } from "@/lib/format";
import { METROS, STATE_NAMES } from "@/content/seo";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CTASection } from "@/components/site/CTASection";
import { JsonLd } from "@/components/site/JsonLd";
import { BRAND } from "@/content/brand";
import { SITE_URL } from "@/content/site";

/**
 * A vendor's public page.
 *
 * The API gained `GET /v1/vendors/:slug` when publishing was added, and until
 * now nothing rendered it -- a vendor could opt in to being public and still
 * had no address to send anybody. This is that address: the one link a makeup
 * artist puts in an Instagram bio and a host forwards to a family group chat,
 * and the only page on the site a search engine can index about a specific
 * person.
 *
 * Everything on it comes from the vendor's own published profile. There is no
 * rating shown, because no reviews exist yet and the projection leaves
 * `ratingAvg` absent rather than defaulting it; there is no review count
 * dressed up as "New"; and there is no aggregateRating in the structured data,
 * because asserting a rating that does not exist is precisely the thing that
 * gets a domain a manual action. When reviews land, the field appears and both
 * the page and the markup pick it up.
 */
const SITE = SITE_URL;

type Params = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<PublicVendorProfile | undefined> {
  try {
    const { vendor } = await vendorProfile(slug);
    return vendor;
  } catch (error) {
    // A 404 is an unpublished or non-existent slug and is the page's normal
    // miss. Anything else -- the API down, a 500 -- must not be rendered as
    // "no such vendor", because a soft 404 on a real profile is how a page
    // gets dropped from the index for a problem that lasted ten minutes.
    if (error instanceof ApiCallError && error.status === 404) return undefined;
    throw error;
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await load(slug);
  if (!vendor) return { title: "Vendor not found", robots: { index: false } };

  const where = METROS.find((metro) => metro.code === vendor.metroId)?.name;
  return {
    title: `${vendor.businessName}${where ? ` — ${where}` : ""}`,
    description: vendor.headline,
    alternates: { canonical: `/vendors/${vendor.slug}` },
    openGraph: {
      title: vendor.businessName,
      description: vendor.headline,
      type: "profile",
      url: `${SITE}/vendors/${vendor.slug}`,
    },
  };
}

export default async function VendorPage({ params }: Params) {
  const { slug } = await params;
  const vendor = await load(slug);
  if (!vendor) notFound();

  const metro = METROS.find((m) => m.code === vendor.metroId);
  // The first letter of the trading name, as a stand-in until a vendor can
  // upload a picture. A monogram is honestly a placeholder; a stock headshot
  // would be a photograph of somebody who is not them.
  const monogram = vendor.businessName.trim().charAt(0).toUpperCase();

  return (
    <div className="shell">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfessionalService",
          name: vendor.businessName,
          description: vendor.about,
          url: `${SITE}/vendors/${vendor.slug}`,
          // Every field below is read off the profile. Nothing is defaulted:
          // an absent metro means no areaServed, not a guessed one.
          ...(metro
            ? { areaServed: { "@type": "City", name: metro.name, containedInPlace: { "@type": "State", name: STATE_NAMES[metro.state] } } }
            : {}),
          ...(vendor.languages.length > 0 ? { knowsLanguage: vendor.languages } : {}),
          ...(vendor.specialties.length > 0
            ? { makesOffer: vendor.specialties.map((code) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: label(code) } })) }
            : {}),
          ...(vendor.startingRateCents > 0
            ? { priceRange: `from ${usd(vendor.startingRateCents)}` }
            : {}),
          ...(vendor.ratingAvg !== undefined && vendor.ratingCount > 0
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: vendor.ratingAvg, reviewCount: vendor.ratingCount } }
            : {}),
          provider: { "@id": `${SITE}/#organization` },
        }}
      />

      <Breadcrumbs
        base={SITE}
        crumbs={[{ label: "Vendors", href: "/hire" }, { label: vendor.businessName }]}
      />

      <section className="vendor-head">
        <div className="vendor-avatar" aria-hidden="true">
          {monogram}
        </div>
        <div>
          <h1>{vendor.businessName}</h1>
          <p className="vendor-headline">{vendor.headline}</p>
          <div className="vendor-meta">
            {metro && <span className="pill">{metro.name}</span>}
            {vendor.yearsExperience > 0 && (
              <span className="pill plain">
                {vendor.yearsExperience} {vendor.yearsExperience === 1 ? "year" : "years"} working
              </span>
            )}
            {vendor.startingRateCents > 0 && (
              <span className="pill plain">From {usd(vendor.startingRateCents)}</span>
            )}
            {vendor.travelRadiusMiles !== undefined && (
              <span className="pill plain">Travels up to {vendor.travelRadiusMiles} miles</span>
            )}
          </div>
        </div>
      </section>

      <div className="grid two" style={{ marginTop: "var(--space-5)", alignItems: "start" }}>
        <div className="card">
          <h2>About</h2>
          <p className="vendor-about" style={{ margin: 0 }}>
            {vendor.about}
          </p>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Works as</h2>
            <ul className="tags" style={{ marginTop: "var(--space-3)" }}>
              {vendor.specialties.map((code) => (
                <li key={code} className="pill tag">
                  {label(code)}
                </li>
              ))}
            </ul>
          </div>

          {vendor.culturalTags.length > 0 && (
            <div className="card">
              <h2>Traditions worked</h2>
              <ul className="tags" style={{ marginTop: "var(--space-3)" }}>
                {vendor.culturalTags.map((code) => (
                  <li key={code} className="pill">
                    {label(code)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {vendor.languages.length > 0 && (
            <div className="card">
              <h2>Languages on the day</h2>
              <ul className="tags" style={{ marginTop: "var(--space-3)" }}>
                {vendor.languages.map((language) => (
                  <li key={language} className="pill plain">
                    {label(language)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/*
            Track record, and only when there is one. `completedGigs` is a
            counter the platform writes after a booking settles, so a zero is
            a vendor who has not yet been booked here -- which is stated as
            nothing at all rather than as "0 events", because a bare zero
            reads as a judgement the platform has not earned the right to make.
          */}
          {vendor.completedGigs > 0 && (
            <div className="card">
              <h2>On this platform</h2>
              <p style={{ margin: 0 }}>
                {vendor.completedGigs} {vendor.completedGigs === 1 ? "booking" : "bookings"}{" "}
                completed through {BRAND.name}, paid through escrow.
              </p>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "var(--space-7)" }}>
        <CTASection
          eyebrow="To book"
          title={`Post the function and ${vendor.businessName} can apply to it.`}
          body="Briefs name the actual occasion, the look you want and the languages you need on the day. Matching runs against that, and your deposit is held in escrow until the work is delivered."
          primary={{ href: "/gigs/new", label: "Post a brief" }}
          secondary={{ href: "/hire", label: "See other vendors" }}
        />
      </div>

      <p className="faint" style={{ marginTop: "var(--space-5)" }}>
        Published {new Date(vendor.publishedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.{" "}
        <Link href="/for-vendors">Work as a vendor</Link>
      </p>
    </div>
  );
}
