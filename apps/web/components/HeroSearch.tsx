"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { METROS, SPECIALITIES } from "@/content/seo";

/**
 * The search a marketplace opens with.
 *
 * Every comparable in this category -- Airbnb, Thumbtack, WedMeGood -- puts a
 * control above the fold so a visitor acts rather than reads. This one does the
 * same job, but the occasion is not decoration: picking "Sangeet" narrows the
 * crew list to the people a Sangeet actually books, which is the whole premise
 * of the product made operable in two clicks.
 *
 * It routes to pages that already exist and are statically rendered, so the
 * search costs no request and cannot 500 when the API is down.
 */
export function HeroSearch({
  occasions,
}: {
  /** Event code to display label, in the order they should be offered. */
  readonly occasions: ReadonlyArray<readonly [string, string]>;
}) {
  const router = useRouter();
  const [occasion, setOccasion] = useState("");
  const [speciality, setSpeciality] = useState("");
  const [metro, setMetro] = useState(METROS[0]?.slug ?? "dallas-fort-worth");

  // The crew that occasion is actually booked for. With no occasion chosen,
  // everyone -- rather than an empty list, which would read as "nobody".
  const available = useMemo(() => {
    if (!occasion) return SPECIALITIES;
    const matching = SPECIALITIES.filter((s) => s.events.includes(occasion));
    return matching.length > 0 ? matching : SPECIALITIES;
  }, [occasion]);

  // Changing the occasion can strand a speciality that is no longer offered.
  const effective = available.some((s) => s.slug === speciality) ? speciality : "";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const target = effective || available[0]?.slug;
    if (target) router.push(`/hire/${metro}/${target}`);
  }

  return (
    <form className="hero-search" onSubmit={submit}>
      <div className="hero-search-field">
        <label htmlFor="hs-occasion">What are you planning?</label>
        <select
          id="hs-occasion"
          value={occasion}
          onChange={(event) => setOccasion(event.target.value)}
        >
          <option value="">Any occasion</option>
          {occasions.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="hero-search-field">
        <label htmlFor="hs-speciality">Who do you need?</label>
        <select
          id="hs-speciality"
          value={effective}
          onChange={(event) => setSpeciality(event.target.value)}
        >
          <option value="">
            {occasion ? `Crew for this function (${available.length})` : "Any speciality"}
          </option>
          {available.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.noun.charAt(0).toUpperCase() + s.noun.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="hero-search-field">
        <label htmlFor="hs-metro">Where?</label>
        <select id="hs-metro" value={metro} onChange={(event) => setMetro(event.target.value)}>
          {METROS.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="btn gold hero-search-go">
        Find crew
      </button>
    </form>
  );
}
