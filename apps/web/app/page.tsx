import Link from "next/link";
import { taxonomy } from "@/lib/api";
import { label } from "@/lib/format";
import { EVENT_GROUPS, MATCH_WEIGHTS, METROS, SPECIALITIES } from "@/content/seo";
import { HOME_FAQ } from "@/content/faq";
import { HeroSearch } from "@/components/HeroSearch";
import { EnquiryForm } from "@/components/EnquiryForm";
import { SectionHeader } from "@/components/site/SectionHeader";
import { CTASection } from "@/components/site/CTASection";
import { Faq } from "@/components/site/Faq";
import { Gallery } from "@/components/site/Gallery";
import { Testimonials } from "@/components/site/Testimonials";
import { CardVisual } from "@/components/site/CardVisual";
import { EVENT_CATEGORIES, SPECIALISTS } from "@/content/imagery";
import { GALLERY } from "@/content/gallery";
import { TESTIMONIALS } from "@/content/testimonials";

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
 * The page is ordered by what a visitor is deciding, not by what we want to
 * say. What are you planning; who works it; how does the money work; why this
 * vendor and not that one; the questions everyone asks; and then one action.
 *
 * Two things are deliberately missing, and will stay missing until they can be
 * true. There is no photography: stock images of models would be a claim about
 * who is on the platform that is not, and it is also exactly the generic look
 * this is trying to escape. The layout is built around image slots for the day
 * real vendor work exists, and the ornament is drawn rather than photographed
 * in the meantime. And there are no testimonials, review counts, star ratings
 * or "events delivered" figures, because there is no honest source for any of
 * them yet -- a marketplace's first job is to be worth trusting, and inventing
 * the evidence of trustworthiness is the fastest way to forfeit it.
 */
export const revalidate = 3600;

const STEPS = [
  {
    title: "Post what you are actually planning",
    body: "A Sangeet is not a reception and a Griha Pravesham is not a birthday. Pick the real occasion, the look you want, and the languages you need on the day.",
  },
  {
    title: "Get matched on the functions they have worked",
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

  // Every occasion, grouped order preserved, as [code, label] for the search.
  const occasionOptions = Object.values(groups)
    .flat()
    .map((code) => [code, label(code)] as const);

  // The metro list as the enquiry form wants it. `code` rather than `slug`:
  // the form posts to the API, which keys metros by code, while the /hire URLs
  // are keyed by slug.
  const metroOptions = METROS.map((metro) => [metro.code, metro.name] as const);

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
          {/*
            The search is the primary action, not the buttons. Every comparable
            marketplace opens with one, and a visitor who can act in two clicks
            does not need to be persuaded by a third paragraph first.
          */}
          <HeroSearch occasions={occasionOptions} />

          {/*
            One secondary link, not three. The hero used to offer the search
            plus two equally weighted buttons, which is the usual way a page
            ends up with no primary action at all.
          */}
          <div className="hero-actions">
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

      <section className="bleed band paper reveal" id="plan" aria-labelledby="plan-h">
        <div className="shell">
          <SectionHeader
            tone="paper"
            eyebrow="Start here"
            id="plan-h"
            title="What are you planning?"
            lede="Five kinds of function, and the crew for one is not the crew for the next. Pick the one you are in and the page tells you who you will need."
          />

          <div className="planner">
            {EVENT_CATEGORIES.map((card, index) => {
              const events = groups[card.key] ?? EVENT_GROUPS[card.key] ?? [];
              return (
                <Link key={card.key} href={card.href} className="plan-card">
                  {/*
                    The picture. A photograph once content/imagery.ts has one
                    for this card, the drawing until then -- both in the same
                    box, so supplying photography changes the picture and
                    nothing about the layout.

                    `sizes` matches the grid below: one card across a phone,
                    two on a tablet, and three across on a desktop where the
                    shell is capped at 1120px.
                  */}
                  <CardVisual
                    card={card}
                    className={`plan-shot tint-${index}`}
                    sizes="(min-width: 1000px) 360px, (min-width: 640px) 50vw, 100vw"
                  />
                  <div className="plan-body">
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                    <ul className="plan-list">
                      {events.slice(0, PREVIEW).map((event) => (
                        <li key={event}>{label(event)}</li>
                      ))}
                      {events.length > PREVIEW && <li>+{events.length - PREVIEW} more</li>}
                    </ul>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bleed band dark reveal" id="how-it-works" aria-labelledby="how-h">
        <div className="shell">
          <SectionHeader
            eyebrow="How it works"
            id="how-h"
            title="Three steps, and the money is safe through all of them."
          />
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

      <section className="bleed band paper reveal" aria-labelledby="who-h">
        <div className="shell">
          <SectionHeader
            tone="paper"
            eyebrow="Who you can book"
            id="who-h"
            title="Every speciality judged on its own craft."
          />
          {/*
            Eight, not seventeen. A full taxonomy on the front door is a wall,
            and seventeen identical placeholder tiles read as a loading state
            rather than a catalogue. Every marketplace in this category shows a
            handful and links to the rest.
          */}
          <div className="crew">
            {SPECIALISTS.map((card, index) => (
              <Link key={card.key} href={card.href} className="crew-card">
                <CardVisual
                  card={card}
                  className={`crew-shot tint-${index % 8}`}
                  sizes="(min-width: 980px) 260px, (min-width: 700px) 33vw, 50vw"
                />
                <div className="crew-body">
                  <strong>{card.title}</strong>
                  <small>{card.description}</small>
                </div>
              </Link>
            ))}
          </div>
          <p style={{ marginTop: "var(--space-5)" }}>
            <Link href="/hire" className="btn secondary">
              See all {SPECIALITIES.length} specialities
            </Link>
          </p>

          <div className="band-head" style={{ marginTop: "var(--space-7)", marginBottom: 0 }}>
            <span className="eyebrow on-paper">Where</span>
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

      {/*
        Two sections that render only when there is something real to put in
        them, rather than a heading over a gap.

        The gallery needs photographs and the quotes need clients; today there
        are neither, so neither appears and the page is complete without them.
        Both are built and laid out, so the day somebody drops files into
        public/gallery and fills in content/gallery.ts, the section arrives
        finished -- see the notes at the top of those two files. Filling them
        with stock photography and invented quotes in the meantime would make
        the page look busier and the business less believable.
      */}
      {GALLERY.length > 0 && (
        <section className="bleed band paper reveal" id="work" aria-labelledby="work-h">
          <div className="shell">
            <SectionHeader
              tone="paper"
              eyebrow="Real work"
              id="work-h"
              title="Functions these vendors have actually worked."
              lede="Every photograph here is a vendor's own, credited to them. Filter by the kind of function you are planning."
            />
            <Gallery items={GALLERY} />
          </div>
        </section>
      )}

      {TESTIMONIALS.length > 0 && (
        <section className="bleed band paper reveal" aria-labelledby="said-h">
          <div className="shell">
            <SectionHeader
              tone="paper"
              eyebrow="In their words"
              id="said-h"
              title="What hosts have said."
            />
            <Testimonials items={TESTIMONIALS} />
          </div>
        </section>
      )}

      <section className="bleed band dark reveal" aria-labelledby="rank-h">
        <div className="shell">
          <SectionHeader
            eyebrow="Why this artist, and not that one"
            id="rank-h"
            title="The ranking is published, not a black box."
            lede="Every other marketplace hands you a list. None of them will tell you why the person at the top is at the top. These are the exact weights the match engine uses — and placement is not for sale, which is a claim anyone can make and this is the receipt."
          />
          <div className="weights">
            {MATCH_WEIGHTS.map((factor) => (
              <div className="weight" key={factor.key}>
                <span className="weight-name">{factor.label}</span>
                <span className="weight-pct">{Math.round(factor.weight * 100)}%</span>
                <span className="weight-track">
                  {/* Scaled against the largest weight so the bars use the full
                      width; the number beside each one is the real figure. */}
                  <i style={{ width: `${(factor.weight / MATCH_WEIGHTS[0]!.weight) * 100}%` }} />
                </span>
                <p className="weight-why">{factor.why}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bleed band darker reveal" aria-labelledby="money-h">
        <div className="shell promise">
          <div>
            <span className="eyebrow">The part nobody enjoys</span>
            <h2
              id="money-h"
              style={{
                fontFamily: "var(--serif)",
                fontSize: "var(--step-3)",
                color: "#fffaf2",
                letterSpacing: "-0.02em",
                margin: "var(--space-3) 0 var(--space-3)",
              }}
            >
              Money, handled so you do not have to trust anyone.
            </h2>
            <p style={{ color: "rgba(253,246,236,0.72)" }}>
              A deposit funds an escrow before the date is held. The vendor knows they will be
              paid; you know the work happens first. Neither side is chasing the other.
            </p>
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

      {/*
        The contact form, before the FAQ rather than after it.

        Until this section existed the only way to reach the business was to
        register, verify a phone and fill in a structured gig brief -- which is
        the right flow for somebody ready to book and the wrong one for the
        larger group who arrive first, from a shared link, with a date and a
        question. Asking them to sign up in order to ask was the funnel closing
        on itself.
      */}
      <section className="bleed band dark reveal" id="enquire" aria-labelledby="enq-h">
        <div className="shell">
          <div className="enquiry-panel">
            <div className="enquiry-intro">
              <span className="eyebrow">Talk to a person</span>
              <h2 id="enq-h">Not ready to post a brief? Just ask.</h2>
              <p>
                Tell us what you are planning and we will come back with who is available for it
                and what the date looks like. No account, no obligation.
              </p>
              <ul className="enquiry-points">
                <li>Every enquiry gets a reply, by email, from a person.</li>
                <li>Your details are not shared with vendors unless you ask us to.</li>
                <li>If you would rather browse first, the vendor pages are open.</li>
              </ul>
            </div>
            <EnquiryForm occasions={occasionOptions} metros={metroOptions} source="/" />
          </div>
        </div>
      </section>

      <section className="bleed band paper reveal" id="faq" aria-labelledby="faq-h">
        <div className="shell narrow">
          <SectionHeader
            tone="paper"
            eyebrow="Before you pay anyone"
            id="faq-h"
            title="The questions everybody asks."
          />
          <Faq items={HOME_FAQ} />
        </div>
      </section>

      <section className="bleed band paper" style={{ paddingTop: 0 }}>
        <div className="shell">
          <CTASection
            eyebrow="One action"
            title="Name the function. We will find the people who have worked it."
            body="A brief takes a few minutes. Matching runs on the occasion, not the category, and the deposit stays in escrow until the work is delivered."
            primary={{ href: "/gigs/new", label: "Post a brief" }}
            secondary={{ href: "/hire", label: "Browse vendors first" }}
          />
        </div>
      </section>
    </>
  );
}
