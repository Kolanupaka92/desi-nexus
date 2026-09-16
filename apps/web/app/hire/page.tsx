import type { Metadata } from "next";
import Link from "next/link";
import { METROS, PLANS, SPECIALITIES } from "@/content/seo";
import { CTASection } from "@/components/site/CTASection";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Hire South Asian event crew in Texas",
  description:
    "Verified makeup artists, photographers, henna artists, pandits, DJs and decorators for South Asian functions across eight Texas metros.",
  alternates: { canonical: "/hire" },
};

export default function HireIndexPage() {
  return (
    <>
      <section style={{ padding: "40px 0 8px", maxWidth: 760 }}>
        <span className="pill">Texas pilot</span>
        <h1 style={{ marginTop: "var(--space-4)" }}>Hire crew who know the function</h1>
        <p className="lede">
          Eight metros, seventeen specialities, and a match engine that ranks cultural fit above
          everything else &mdash; because a MUA who does South Indian bridal is not
          interchangeable with one who does Punjabi Sikh bridal.
        </p>
      </section>

      <section style={{ marginTop: 20 }}>
        <h2>By metro</h2>
        <div className="grid two" style={{ marginTop: 12 }}>
          {METROS.map((metro) => (
            <Link key={metro.slug} href={`/hire/${metro.slug}`} className="card link-card">
              <strong>{metro.name}</strong>
              <p className="faint" style={{ margin: "6px 0 0" }}>
                {metro.cities.slice(0, 4).join(", ")}
                {metro.cities.length > 4 ? " and more" : ""}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>By occasion</h2>
        <p className="faint" style={{ marginTop: 6 }}>
          What a function needs is a better starting point than what a role is called.
        </p>
        <ul className="tags" style={{ marginTop: 10 }}>
          {PLANS.map((plan) => (
            <li key={plan.slug}>
              <Link className="pill" href={`/plan/${plan.slug}`}>
                {plan.short}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2>By speciality</h2>
        <ul className="tags" style={{ marginTop: 10 }}>
          {SPECIALITIES.map((speciality) => (
            <li key={speciality.slug}>
              <Link className="pill tag" href={`/hire/dallas-fort-worth/${speciality.slug}`}>
                {speciality.noun}
              </Link>
            </li>
          ))}
        </ul>
        <p className="faint" style={{ marginTop: 10 }}>
          Links open the Dallas-Fort Worth page; every speciality is available in all eight metros.
        </p>
      </section>

      <div style={{ marginTop: 44 }}>
        <CTASection
          eyebrow="Or skip the browsing"
          title="Describe the function and let the matching do the shortlist."
          body="A brief names the occasion, the look you want and the languages you need on the day. Every applicant arrives with a score and the breakdown that produced it, and the deposit stays in escrow until the work is delivered."
          primary={{ href: "/gigs/new", label: "Post a brief" }}
          secondary={{ href: "/for-vendors", label: "I am a vendor" }}
        />
      </div>
    </>
  );
}
