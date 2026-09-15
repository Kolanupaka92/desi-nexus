import type { Metadata } from "next";
import Link from "next/link";
import { METROS, SPECIALITIES } from "@/content/seo";

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
        <h1 style={{ marginTop: 16, fontSize: "2.5rem" }}>Hire crew who know the function</h1>
        <p className="lede">
          Eight metros, seventeen specialities, and a match engine that ranks cultural fit above
          everything else &mdash; because a MUA who does South Indian bridal is not
          interchangeable with one who does Punjabi Sikh bridal.
        </p>
      </section>

      <section style={{ marginTop: 20 }}>
        <h3>By metro</h3>
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
        <h3>By speciality</h3>
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
    </>
  );
}
