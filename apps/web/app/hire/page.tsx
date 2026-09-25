import type { Metadata } from "next";
import Link from "next/link";
import { METROS, PLANS, SPECIALITIES, STATE_NAMES } from "@/content/seo";
import { CTASection } from "@/components/site/CTASection";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Hire South Asian event crew in Texas, North Carolina and California",
  description:
    "Verified makeup artists, photographers, henna artists, pandits, DJs and decorators for South Asian functions across ten metros in Texas, North Carolina and California.",
  alternates: { canonical: "/hire" },
};

export default function HireIndexPage() {
  return (
    <div className="shell">
      <section style={{ padding: "40px 0 8px", maxWidth: 760 }}>
        <span className="pill">Ten metros, three states</span>
        <h1 style={{ marginTop: "var(--space-4)" }}>Hire crew who know the function</h1>
        {/*
          Both numbers are counted, not typed. "Eight metros" survived the
          footprint going from eight Texas metros to ten across three states,
          because a sentence cannot fail. So can "seventeen specialities" the
          next time the list changes.
        */}
        <p className="lede">
          {METROS.length} metros, {SPECIALITIES.length} specialities, and a match engine that
          ranks whether they have worked your function above everything else &mdash; because a
          MUA who has done forty half-saree functions is not interchangeable with one who has
          done none.
        </p>
      </section>

      {/*
        Grouped by state rather than one flat list of ten.
        A visitor in Cary scanning a single column headed "By metro" has to read
        past seven places they will never book in to find theirs. The grouping
        is derived from the data, so adding a state is a content change.
      */}
      <section style={{ marginTop: 20 }}>
        <h2>By metro</h2>
        {(["TX", "NC", "CA"] as const).map((state) => {
          const inState = METROS.filter((metro) => metro.state === state);
          if (inState.length === 0) return null;
          return (
            <div key={state} style={{ marginTop: 16 }}>
              <h3 className="faint">{STATE_NAMES[state]}</h3>
              <div className="grid two" style={{ marginTop: 10 }}>
                {inState.map((metro) => (
                  <Link key={metro.slug} href={`/hire/${metro.slug}`} className="card link-card">
                    <strong>{metro.name}</strong>
                    <p className="faint" style={{ margin: "6px 0 0" }}>
                      {metro.cities.slice(0, 4).join(", ")}
                      {metro.cities.length > 4 ? " and more" : ""}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
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
          Links open the Dallas-Fort Worth page; every speciality is available in all {METROS.length} metros.
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
    </div>
  );
}
