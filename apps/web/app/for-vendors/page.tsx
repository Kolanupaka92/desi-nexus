import type { Metadata } from "next";
import Link from "next/link";
import { METROS, SPECIALITIES } from "@/content/seo";

/**
 * The supply side's own page.
 *
 * Deliberately separate from the host landing page, because the two audiences
 * want opposite things. A family wants to know they will not be let down; an
 * artist wants to know they will be paid and not made to chase it. Selling one
 * pitch to both gets neither.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "For makeup artists, photographers and henna artists",
  description:
    "Get booked for South Asian functions across Texas. Payment is held in escrow before the day, travel is quoted round trip, and you are ranked on what you actually specialise in.",
  alternates: { canonical: "/for-vendors" },
  openGraph: {
    title: "Get booked for the functions you actually specialise in · DESI-NEXUS",
    description:
      "Escrow before the event, round-trip travel in every quote, and matching on cultural fit rather than who paid for placement.",
    type: "website",
  },
};

const PROMISES = [
  {
    title: "The money is already there",
    body: "A host funds escrow before the date is held. You are not chasing a deposit, and you are not finding out on the morning that the balance is coming later. If a host cancels inside the window their refund is partial and the rest is yours.",
  },
  {
    title: "Travel is quoted both ways",
    body: "Mileage is priced round trip from your base, past a free radius you set, with an overnight charge beyond a threshold you set. Dallas to Katy is two long drives, not one, and the quote says so before anyone commits.",
  },
  {
    title: "You are ranked on what you actually do",
    body: "Cultural fit is the heaviest weight in matching. If South Indian bridal is your work, you are not buried under generalists with more reviews — and nobody can buy their way above you, because placement is not for sale.",
  },
  {
    title: "Briefs are specific enough to quote",
    body: "Hosts pick a real occasion, not \"a party\". You see the function, the languages needed on the day, the venue's actual address, and the budget range before you decide whether to apply.",
  },
];

export default function ForVendorsPage() {
  return (
    <>
      <section style={{ padding: "40px 0 8px", maxWidth: 760 }}>
        <span className="pill">Now onboarding crew &amp; creators</span>
        <h1 style={{ marginTop: 16, fontSize: "2.5rem" }}>
          Get booked for the functions you actually specialise in.
        </h1>
        <p className="lede">
          DESI-NEXUS matches South Asian event work across Texas on cultural fit first. If you do
          Telugu bridal, you are shown Telugu bridal &mdash; not every &ldquo;wedding
          makeup&rdquo; lead within fifty miles.
        </p>
        <div style={{ marginTop: 20 }}>
          <Link href="/register" className="btn accent">
            Join as a vendor
          </Link>{" "}
          <Link href="/gigs" className="btn secondary">
            See open gigs
          </Link>
        </div>
      </section>

      <section style={{ marginTop: 26 }}>
        <div className="grid two">
          {PROMISES.map((promise) => (
            <div key={promise.title} className="card">
              <h3 style={{ marginTop: 0 }}>{promise.title}</h3>
              <p style={{ margin: 0 }}>{promise.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="card" style={{ marginTop: 22 }}>
        <h3>What it costs</h3>
        <p style={{ marginTop: 0 }}>
          Commission is charged on the service portion of a booking only &mdash; never on your
          mileage. Driving further does not cost you more in fees. Listing is free; you are
          charged when you are paid.
        </p>
      </div>

      <section style={{ marginTop: 26 }}>
        <h3>Specialities we match</h3>
        <ul className="tags" style={{ marginTop: 10 }}>
          {SPECIALITIES.map((speciality) => (
            <li key={speciality.slug} className="pill tag" style={{ textTransform: "capitalize" }}>
              {speciality.noun}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: 26 }}>
        <h3>Where we are booking</h3>
        <ul className="tags" style={{ marginTop: 10 }}>
          {METROS.map((metro) => (
            <li key={metro.slug}>
              <Link className="pill tag" href={`/hire/${metro.slug}`}>
                {metro.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="card accent-card" style={{ marginTop: 26 }}>
        <h3 style={{ marginTop: 0 }}>Build a profile in about ten minutes</h3>
        <p>
          Your specialities, the styles you actually work in, the languages you speak on the day,
          your base and how far you will travel. That is what the match engine reads.
        </p>
        <Link href="/register" className="btn accent">
          Join as a vendor
        </Link>
      </div>
    </>
  );
}
