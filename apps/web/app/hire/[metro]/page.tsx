import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { METROS, SPECIALITIES, metroBySlug } from "@/content/seo";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CTASection } from "@/components/site/CTASection";
import { BRAND } from "@/content/brand";
import { SITE_URL } from "@/content/site";

/** The metro hub: every speciality we cover, for one place. */
export const dynamic = "force-static";

const SITE = SITE_URL;

export function generateStaticParams() {
  return METROS.map((metro) => ({ metro: metro.slug }));
}

type Params = { params: Promise<{ metro: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { metro: slug } = await params;
  const metro = metroBySlug(slug);
  if (!metro) return {};

  const title = `South Asian event vendors in ${metro.name}`;
  const description = `Makeup artists, photographers, henna artists, pandits, DJs and decorators for South Asian functions across ${metro.cities.slice(0, 4).join(", ")} and the rest of ${metro.name}.`;
  return {
    title,
    description,
    alternates: { canonical: `/hire/${metro.slug}` },
    openGraph: { title: `${title} · ${BRAND.name}`, description, type: "website" },
  };
}

export default async function MetroPage({ params }: Params) {
  const { metro: slug } = await params;
  const metro = metroBySlug(slug);
  if (!metro) notFound();

  return (
    <div className="shell">
      <Breadcrumbs
        base={SITE}
        crumbs={[{ label: "Hire", href: "/hire" }, { label: metro.name }]}
      />

      <section style={{ padding: "36px 0 8px", maxWidth: 760 }}>
        <span className="pill">{metro.name}</span>
        <h1 style={{ marginTop: "var(--space-4)" }}>
          South Asian event vendors in {metro.name}
        </h1>
        <p className="lede">{metro.blurb}</p>
        <p className="faint">Covering {metro.cities.join(", ")}.</p>
      </section>

      <section style={{ marginTop: 20 }}>
        <h3>Who you can book</h3>
        <div className="grid two" style={{ marginTop: 12 }}>
          {SPECIALITIES.map((speciality) => (
            <Link
              key={speciality.slug}
              href={`/hire/${metro.slug}/${speciality.slug}`}
              className="card link-card"
            >
              <strong style={{ textTransform: "capitalize" }}>{speciality.noun}</strong>
              <p className="faint" style={{ margin: "6px 0 0" }}>
                {speciality.does}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div style={{ marginTop: 36 }}>
        <CTASection
          eyebrow="Not sure who you need?"
          title="Post the occasion instead."
          body={`Tell us it is a Half-Saree Function rather than "a party" and we suggest the crew that function actually needs, then rank them on cultural fit, distance, budget and language.`}
          primary={{ href: "/gigs/new", label: "Post a brief" }}
          secondary={{ href: "/hire", label: "Other metros" }}
        />
      </div>

      <section style={{ marginTop: 28 }}>
        <h3 className="faint">Other metros</h3>
        <ul className="tags" style={{ marginTop: 10 }}>
          {METROS.filter((other) => other.slug !== metro.slug).map((other) => (
            <li key={other.slug}>
              <Link className="pill tag" href={`/hire/${other.slug}`}>
                {other.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
