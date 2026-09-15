import Link from "next/link";
import { taxonomy } from "@/lib/api";
import { label } from "@/lib/format";
import { EVENT_GROUPS, METROS, SPECIALITIES } from "@/content/seo";

/**
 * The front door.
 *
 * Rendered on the server and cached, because this is the page that has to rank:
 * the occasions below are the long tail of search terms nobody else covers --
 * "Half-Saree Function makeup artist Frisco" is not a query a generic
 * marketplace has a page for.
 *
 * Designed dark and saturated above the fold because that is the register the
 * category actually lives in. The working surfaces -- gig briefs, the vendor
 * feed -- stay on paper, where long forms belong.
 *
 * There is deliberately no photography here yet and no invented social proof.
 * Stock images of models would be a claim about who is on the platform that is
 * not true, and it is also exactly the generic look this is trying to escape.
 * The layout is built around image slots for when real vendor work exists; the
 * ornament is drawn, not photographed, in the meantime.
 */
export const revalidate = 3600;

const STEPS = [
  {
    title: "Post what you are actually planning",
    body: "A Sangeet is not a reception and a Griha Pravesham is not a birthday. Pick the real occasion, the look you want, and the languages you need on the day.",
  },
  {
    title: "Get matched in under an hour",
    body: "We rank local crew on cultural fit first, then distance, budget, language and track record — and show you exactly why each one ranked where they did.",
  },
  {
    title: "Pay into escrow, not into hope",
    body: "Your deposit is held until the work is delivered. If a vendor cancels on you, the refund is automatic and total.",
  },
];

const PROMISES = [
  {
    title: "Nobody can buy their way to the top",
    body: "Placement is not for sale. Ranking is cultural fit, distance, budget, language and track record — and the breakdown is shown to you.",
  },
  {
    title: "Travel is quoted before anyone commits",
    body: "Round trip from the vendor's base, past a free radius they set. A 9am call in Katy booked out of Plano is two long drives, and the quote says so.",
  },
  {
    title: "A vendor cancelling costs you nothing",
    body: "Their cancellation is a full refund, always. Yours is tiered by how close to the day it is, and the tiers are stated before you pay.",
  },
  {
    title: "The ledger cannot be quietly edited",
    body: "Every movement of money is an append-only entry. Corrections are new entries, not rewrites.",
  },
];

/** The first few occasions of each group, as a taste rather than a dump. */
const PREVIEW = 4;

const GROUP_BLURB: Record<string, string> = {
  wedding: "Multi-day, multi-family, never one event.",
  religious: "The tradition sets the sequence, not the planner.",
  milestone: "Only make sense inside the family.",
  festival: "Community-scale nights.",
  commercial: "Same supply, different demand.",
};

export default async function HomePage() {
  // The live taxonomy when the API answers, so a newly seeded occasion shows up
  // without a redeploy -- and the bundled copy when it does not.
  let groups: Record<string, readonly string[]> = EVENT_GROUPS;
  try {
    const data = await taxonomy();
    if (Object.keys(data.eventGroups).length > 0) groups = data.eventGroups;
  } catch {
    // Keeping the bundled copy.
  }

  const headline = ["mehndi", "sangeet", "half_saree_function", "griha_pravesham", "baraat", "garba_navratri"];

  return (
    <>
      <section className="bleed hero">
        <div className="hero-inner">
          <span className="eyebrow">Texas · now booking</span>
          <h1>
            The people who <em>already know</em> your function.
          </h1>
          <p className="hero-lede">
            Makeup artists, photographers, henna artists, pandits, decorators and creators for
            South Asian events across Texas — matched on whether they have done <em>your</em> kind
            of function before, not on who paid for placement.
          </p>
          <div className="hero-actions">
            <Link href="/gigs/new" className="btn gold">
              Find crew for my event
            </Link>
            <Link href="/for-vendors" className="btn ghost">
              I am a vendor — get booked
            </Link>
          </div>
          <div className="hero-ticker">
            {headline.map((event) => (
              <span key={event}>{label(event)}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="bleed band paper">
        <div className="shell">
          <div className="band-head">
            <span className="eyebrow" style={{ color: "var(--maroon)" }}>
              Every occasion, named properly
            </span>
            <h2>Not &ldquo;wedding&rdquo;. Not &ldquo;party&rdquo;.</h2>
            <p className="muted">
              Vendors here tag themselves by the functions they have actually worked. That is the
              whole difference between a shortlist worth reading and a directory.
            </p>
          </div>

          <div className="occasions">
            {Object.entries(groups).map(([group, events]) => (
              <Link key={group} href="/hire" className={`occasion ${group}`}>
                <h3>{label(group)}</h3>
                {/*
                  A subtitle on every card, in sentence case. It used to be a
                  fallback rendered through the ".more" count style, so a group
                  with no overflow -- Festival has exactly PREVIEW occasions --
                  printed a whole sentence in uppercase letter-spaced small caps.
                */}
                <p className="occasion-blurb">{GROUP_BLURB[group] ?? ""}</p>
                <ul>
                  {events.slice(0, PREVIEW).map((event) => (
                    <li key={event}>{label(event)}</li>
                  ))}
                </ul>
                {events.length > PREVIEW && (
                  <span className="more">+{events.length - PREVIEW} more</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bleed band dark">
        <div className="shell">
          <div className="band-head">
            <span className="eyebrow">How it works</span>
            <h2>Three steps, and the money is safe through all of them.</h2>
          </div>
          <div className="steps">
            {STEPS.map((step, index) => (
              <div className="step" key={step.title}>
                <span className="num">{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bleed band paper">
        <div className="shell">
          <div className="band-head">
            <span className="eyebrow" style={{ color: "var(--maroon)" }}>
              Who you can book
            </span>
            <h2>Seventeen specialities, each judged on its own craft.</h2>
          </div>
          <div className="crew">
            {SPECIALITIES.map((speciality) => (
              <Link key={speciality.slug} href={`/hire/dallas-fort-worth/${speciality.slug}`}>
                <span style={{ textTransform: "capitalize" }}>{speciality.noun}</span>
                <small>{speciality.events.slice(0, 2).map(label).join(" · ")}</small>
              </Link>
            ))}
          </div>

          <div className="band-head" style={{ marginTop: 44, marginBottom: 0 }}>
            <span className="eyebrow" style={{ color: "var(--maroon)" }}>
              Where
            </span>
            <div className="metro-strip">
              {METROS.map((metro) => (
                <Link key={metro.slug} href={`/hire/${metro.slug}`}>
                  {metro.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bleed band dark">
        <div className="shell promise">
          <div>
            <span className="eyebrow">The part nobody enjoys</span>
            <h2
              style={{
                fontFamily: "var(--serif)",
                fontSize: "clamp(1.7rem, 3.4vw, 2.3rem)",
                color: "#fffaf2",
                letterSpacing: "-0.02em",
                margin: "12px 0 10px",
              }}
            >
              Money, handled so you do not have to trust anyone.
            </h2>
            <p style={{ color: "rgba(253,246,236,0.72)" }}>
              A deposit funds an escrow before the date is held. The vendor knows they will be
              paid; you know the work happens first. Neither side is chasing the other.
            </p>
            <Link href="/gigs/new" className="btn gold" style={{ marginTop: 8 }}>
              Post a gig
            </Link>
          </div>
          <ul className="promise-list">
            {PROMISES.map((promise) => (
              <li key={promise.title}>
                <strong>{promise.title}</strong>
                <span>{promise.body}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
