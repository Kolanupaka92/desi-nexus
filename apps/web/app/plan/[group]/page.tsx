import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EVENT_GROUPS, METROS, PLANS, SPECIALITIES, planBySlug } from "@/content/seo";
import { label } from "@/lib/format";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { CTASection } from "@/components/site/CTASection";

/**
 * One page per occasion group: what this kind of function needs, and who works
 * it.
 *
 * Five of these, not forty. Crossing the five groups with the eight metros
 * would generate forty pages whose only difference is a place name, which is
 * the definition of a doorway page and is treated as one. The metro dimension
 * already has its own pages, written around what is actually different about
 * each metro, and this axis is written around what is actually different about
 * each occasion.
 *
 * The speciality list is computed rather than written: a role appears here if
 * one of its `events` falls in this group, which is the same data the match
 * engine and the hero search read. So the page cannot drift from the product --
 * add an occasion to a speciality and this page says so on the next build.
 */
export const dynamic = "force-static";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://desi-nexus.com";

export function generateStaticParams() {
  return PLANS.map((plan) => ({ group: plan.slug }));
}

type Params = { params: Promise<{ group: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { group } = await params;
  const plan = planBySlug(group);
  if (!plan) return {};
  return {
    title: plan.title,
    description: plan.lede,
    alternates: { canonical: `/plan/${plan.slug}` },
    openGraph: { title: plan.title, description: plan.lede, type: "article" },
  };
}

export default async function PlanPage({ params }: Params) {
  const { group } = await params;
  const plan = planBySlug(group);
  if (!plan) notFound();

  const events = EVENT_GROUPS[plan.slug] ?? [];
  const eventSet = new Set(events);
  // Ordered by how much of this group a speciality covers, so the roles a
  // visitor planning it will need first are the ones at the top.
  const crew = SPECIALITIES.map((speciality) => ({
    speciality,
    overlap: speciality.events.filter((event) => eventSet.has(event)),
  }))
    .filter((entry) => entry.overlap.length > 0)
    .sort((a, b) => b.overlap.length - a.overlap.length);

  return (
    <>
      <Breadcrumbs base={SITE} crumbs={[{ label: "Plan", href: "/#plan" }, { label: plan.title }]} />

      <section style={{ padding: "36px 0 8px", maxWidth: 760 }}>
        <span className="pill">Texas · {events.length} functions</span>
        <h1 style={{ marginTop: 16 }}>{plan.title}</h1>
        <p className="lede">{plan.lede}</p>
      </section>

      <div className="card" style={{ marginTop: 22 }}>
        <h2>What is different about booking for this</h2>
        <p style={{ margin: 0, maxWidth: "var(--measure)" }}>{plan.brief}</p>
      </div>

      <section style={{ marginTop: 28 }}>
        <h2>The functions in this group</h2>
        <ul className="tags" style={{ marginTop: 12 }}>
          {events.map((event) => (
            <li key={event} className="pill tag">
              {label(event)}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Who works them</h2>
        <p className="faint" style={{ marginTop: 6 }}>
          Ordered by how many of these functions the speciality is normally booked for.
        </p>
        <div className="grid two" style={{ marginTop: 14 }}>
          {crew.map(({ speciality, overlap }) => (
            <Link
              key={speciality.slug}
              href={`/hire/dallas-fort-worth/${speciality.slug}`}
              className="card link-card"
            >
              <strong style={{ textTransform: "capitalize" }}>{speciality.noun}</strong>
              <p className="faint" style={{ margin: "6px 0 8px" }}>
                {speciality.does}
              </p>
              <span className="faint">
                {overlap.length} of {events.length} functions here
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2>Where</h2>
        <div className="metro-strip">
          {METROS.map((metro) => (
            <Link key={metro.slug} href={`/hire/${metro.slug}`}>
              {metro.name}
            </Link>
          ))}
        </div>
      </section>

      <div style={{ marginTop: 44 }}>
        <CTASection
          eyebrow="Next step"
          title="Tell us the function, not the category."
          body="A brief takes a few minutes and names the actual occasion, the look you want and the languages you need on the day. Matching runs against that, and the deposit stays in escrow until the work is delivered."
          primary={{ href: "/gigs/new", label: "Post a brief" }}
          secondary={{ href: "/hire", label: "Browse vendors first" }}
        />
      </div>
    </>
  );
}
