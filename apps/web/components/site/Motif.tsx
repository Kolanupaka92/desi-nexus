/**
 * Drawn artwork, one piece per occasion and per craft.
 *
 * Every card that wants a picture had the same generic mandala behind a tint
 * until now, which meant five occasions and eight specialities were visually
 * one thing repeated thirteen times. A Sangeet does not look like a Griha
 * Pravesham and a henna artist does not do what a caterer does; the page
 * should say so before anybody reads a word.
 *
 * These are original line drawings, not photographs and not stock. That is a
 * deliberate split rather than a stopgap:
 *
 *  - Artwork *represents a category*. A drawn mandap means "weddings". It
 *    makes no claim about who worked one.
 *  - A photograph *is evidence*. A picture of a real bride on a vendor's card
 *    says that vendor did that wedding, and there is no honest source for that
 *    yet. When there is, the photographs go in the gallery and the profile,
 *    which is where evidence belongs -- see content/gallery.ts.
 *
 * So the site can look like what it is today, without claiming anything it
 * cannot back.
 *
 * Drawing rules, so thirteen pieces read as one set:
 *  - one 240x180 canvas, so a piece can be dropped into any slot
 *  - two tones only: `--motif-ink` for line, `--motif-accent` for fill
 *  - stroke 3.2 for structure, 2 for ornament, round caps and joins
 *  - the composition sits inside a 24px margin, so nothing collides with a
 *    card's corner radius or its caption
 */

export type MotifName =
  // Occasion groups.
  | "wedding"
  | "religious"
  | "milestone"
  | "festival"
  | "commercial"
  // Crafts.
  | "makeup-artist"
  | "photographer"
  | "henna-artist"
  | "pandit"
  | "decorator"
  | "dj"
  | "videographer"
  | "caterer"
  // Individual functions, for the pages that list them one by one.
  | "mehndi"
  | "haldi"
  | "sangeet"
  | "baraat"
  | "reception"
  | "half_saree_function";

/*
 * The hand is drawn once and used twice: as the craft (a henna artist) and as
 * the function (a mehndi). Two copies would drift the first time one of them
 * was adjusted.
 */
const HENNA_HAND = (
    <>
      <path d="M86 150V96q0-8 8-8t8 8v14M102 110V74q0-8 8-8t8 8v34M118 108V70q0-8 8-8t8 8v40M134 110V86q0-8 8-8t8 8v50q0 26-26 26h-14q-18 0-26-18l-12-24q-4-8 4-12t12 4l8 14" strokeWidth="3.2" />
      <path d="M114 120q-12 0-12 10t12 10 12-10-12-10Z" strokeWidth="2" opacity="0.75" />
      <path d="M114 106q-18 2-18 16" strokeWidth="2" opacity="0.5" />
      <circle cx="114" cy="130" r="3" fill="var(--motif-accent)" stroke="none" />
      <circle cx="132" cy="140" r="2.4" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
      <circle cx="98" cy="146" r="2.4" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
    </>
  );

const ART: Record<MotifName, React.ReactNode> = {
  /* A mandap: two pillars, a canopy, draped swags and a kalash beneath it.
     The structure every wedding function is built around or in front of. */
  wedding: (
    <>
      <path d="M44 156V74M196 156V74" strokeWidth="3.2" />
      <path d="M36 158h16M188 158h16" strokeWidth="3.2" />
      <path d="M44 74q76-40 152 0" strokeWidth="3.2" />
      <path d="M52 78q68-30 136 0" strokeWidth="2" opacity="0.55" />
      {/* Swags along the canopy edge. */}
      <path d="M56 80q12 16 24 0M80 80q12 16 24 0M104 80q12 16 24 0M128 80q12 16 24 0M152 80q12 16 24 0" strokeWidth="2" opacity="0.7" />
      {/* Hanging garlands from each pillar. */}
      <path d="M44 92v26M196 92v26" strokeWidth="2" opacity="0.6" />
      <circle cx="44" cy="122" r="4" fill="var(--motif-accent)" stroke="none" />
      <circle cx="196" cy="122" r="4" fill="var(--motif-accent)" stroke="none" />
      {/* The kalash under the canopy. */}
      <path d="M104 156h32M108 156q-8-20 0-32h24q8 12 0 32" strokeWidth="3.2" />
      <path d="M106 124h28" strokeWidth="3.2" />
      <circle cx="120" cy="114" r="8" strokeWidth="3.2" />
      <path d="M112 112q-10-8-16-2M128 112q10-8 16-2" strokeWidth="2" />
    </>
  ),

  /* A puja: kalash with coconut and mango leaves, a diya either side, and the
     rangoli arcs the whole thing is set out on. */
  religious: (
    <>
      <path d="M100 152h40M104 152q-10-26 0-40h32q10 14 0 40" strokeWidth="3.2" />
      <path d="M102 112h36" strokeWidth="3.2" />
      <path d="M112 112q-12-10-20-4M128 112q12-10 20-4" strokeWidth="2" />
      {/* Coconut, and the leaves under it. */}
      <ellipse cx="120" cy="98" rx="10" ry="12" strokeWidth="3.2" />
      <path d="M110 104q-14-2-18-10 12-6 20 4M130 104q14-2 18-10-12-6-20 4" strokeWidth="2" />
      {/* Two diyas. */}
      <path d="M46 150h28q-2 10-14 10t-14-10Z" strokeWidth="3.2" />
      <path d="M60 140q6-8 0-14-6 6 0 14Z" fill="var(--motif-accent)" stroke="none" />
      <path d="M166 150h28q-2 10-14 10t-14-10Z" strokeWidth="3.2" />
      <path d="M180 140q6-8 0-14-6 6 0 14Z" fill="var(--motif-accent)" stroke="none" />
      {/* Rangoli arcs. */}
      <path d="M62 166q58-18 116 0" strokeWidth="2" opacity="0.5" />
      <path d="M76 172q44-12 88 0" strokeWidth="2" opacity="0.35" />
    </>
  ),

  /* A jhula: the flower-hung swing a naming, a cradle ceremony or a
     half-saree function is staged around. */
  milestone: (
    <>
      <path d="M40 40h160" strokeWidth="3.2" />
      <path d="M72 40v58M168 40v58" strokeWidth="3.2" />
      {/* Flowers threaded down each rope. */}
      <circle cx="72" cy="58" r="3.4" fill="var(--motif-accent)" stroke="none" />
      <circle cx="72" cy="76" r="3.4" fill="var(--motif-accent)" stroke="none" />
      <circle cx="168" cy="58" r="3.4" fill="var(--motif-accent)" stroke="none" />
      <circle cx="168" cy="76" r="3.4" fill="var(--motif-accent)" stroke="none" />
      {/* The seat. */}
      <path d="M62 98h116v14H62Z" strokeWidth="3.2" />
      <path d="M62 112q58 24 116 0" strokeWidth="2" opacity="0.6" />
      {/* A garland swag under the bar. */}
      <path d="M80 44q40 26 80 0" strokeWidth="2" opacity="0.7" />
      <path d="M96 52q24 12 48 0" strokeWidth="2" opacity="0.45" />
      {/* Petals on the floor. */}
      <circle cx="88" cy="150" r="3" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
      <circle cx="120" cy="158" r="3" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
      <circle cx="152" cy="150" r="3" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
    </>
  ),

  /* Garba: crossed dandiya, a string of lights over them, and the circle the
     whole night is danced in. */
  festival: (
    <>
      {/* The string of lights. */}
      <path d="M28 44q92 44 184 0" strokeWidth="2" opacity="0.65" />
      <circle cx="66" cy="60" r="4" fill="var(--motif-accent)" stroke="none" />
      <circle cx="96" cy="68" r="4" fill="var(--motif-accent)" stroke="none" />
      <circle cx="144" cy="68" r="4" fill="var(--motif-accent)" stroke="none" />
      <circle cx="174" cy="60" r="4" fill="var(--motif-accent)" stroke="none" />
      {/* Crossed dandiya. */}
      <path d="M84 148L156 88M84 88l72 60" strokeWidth="8" opacity="0.18" />
      <path d="M84 148L156 88M84 88l72 60" strokeWidth="3.2" />
      <circle cx="84" cy="148" r="5" fill="var(--motif-accent)" stroke="none" />
      <circle cx="156" cy="88" r="5" fill="var(--motif-accent)" stroke="none" />
      <circle cx="84" cy="88" r="5" fill="var(--motif-accent)" stroke="none" />
      <circle cx="156" cy="148" r="5" fill="var(--motif-accent)" stroke="none" />
      {/* The circle it is danced in. */}
      <ellipse cx="120" cy="140" rx="74" ry="22" strokeWidth="2" opacity="0.4" />
    </>
  ),

  /* A shoot: camera on a tripod, one light, one backdrop. The commercial work
     is the same artists hired on different terms, and it looks different. */
  commercial: (
    <>
      <path d="M150 34v112" strokeWidth="2" opacity="0.4" />
      <path d="M150 146h46" strokeWidth="2" opacity="0.4" />
      {/* Tripod. */}
      <path d="M78 104v34M78 138l-22 22M78 138l22 22" strokeWidth="3.2" />
      {/* Camera body. */}
      <path d="M46 70h64a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6V76a6 6 0 0 1 6-6Z" strokeWidth="3.2" />
      <path d="M62 70l6-10h20l6 10" strokeWidth="3.2" />
      <circle cx="78" cy="89" r="14" strokeWidth="3.2" />
      <circle cx="78" cy="89" r="6" fill="var(--motif-accent)" stroke="none" />
      {/* Softbox. */}
      <path d="M156 52h44v34h-44Z" strokeWidth="3.2" />
      <path d="M178 86v54M162 140h32" strokeWidth="3.2" />
      <path d="M162 60h32M162 70h32M162 78h32" strokeWidth="2" opacity="0.45" />
    </>
  ),

  /* Brushes and a compact. */
  "makeup-artist": (
    <>
      <path d="M78 48l-10 62a10 10 0 0 0 20 0L78 48Z" strokeWidth="3.2" />
      <path d="M68 110q10 8 20 0" strokeWidth="2" />
      <path d="M78 110v32" strokeWidth="3.2" />
      <path d="M104 62l-8 50a8 8 0 0 0 16 0l-8-50Z" strokeWidth="3.2" />
      <path d="M104 112v30" strokeWidth="3.2" />
      <circle cx="160" cy="112" r="28" strokeWidth="3.2" />
      <circle cx="160" cy="112" r="16" strokeWidth="2" opacity="0.5" />
      <circle cx="160" cy="112" r="7" fill="var(--motif-accent)" stroke="none" />
      <path d="M140 88q20-18 40 0" strokeWidth="2" opacity="0.5" />
    </>
  ),

  photographer: (
    <>
      <path d="M52 66h136a10 10 0 0 1 10 10v58a10 10 0 0 1-10 10H52a10 10 0 0 1-10-10V76a10 10 0 0 1 10-10Z" strokeWidth="3.2" />
      <path d="M92 66l8-14h40l8 14" strokeWidth="3.2" />
      <circle cx="120" cy="104" r="28" strokeWidth="3.2" />
      <circle cx="120" cy="104" r="16" strokeWidth="2" opacity="0.6" />
      <circle cx="120" cy="104" r="7" fill="var(--motif-accent)" stroke="none" />
      <circle cx="172" cy="84" r="4" fill="var(--motif-accent)" stroke="none" />
    </>
  ),

  "henna-artist": HENNA_HAND,
  mehndi: HENNA_HAND,

  /* A diya and a shankh. */
  pandit: (
    <>
      <path d="M40 132h56q-4 16-28 16t-28-16Z" strokeWidth="3.2" />
      <path d="M68 118q10-14 0-24-10 10 0 24Z" fill="var(--motif-accent)" stroke="none" />
      <path d="M52 140q16 8 32 0" strokeWidth="2" opacity="0.45" />
      <path d="M198 74q-14 18-22 40-6 18-24 22-20 4-28-10-6-12 4-20 8-6 16 0" strokeWidth="3.2" />
      <path d="M176 114q-10-4-18 2" strokeWidth="2" opacity="0.6" />
      <path d="M186 92q-8 0-14 6" strokeWidth="2" opacity="0.45" />
      <circle cx="146" cy="128" r="3.4" fill="var(--motif-accent)" stroke="none" />
    </>
  ),

  /* A garland swag over a flower vase. */
  decorator: (
    <>
      <path d="M32 54q88 56 176 0" strokeWidth="3.2" />
      <path d="M46 62q74 44 148 0" strokeWidth="2" opacity="0.5" />
      <circle cx="74" cy="76" r="5" fill="var(--motif-accent)" stroke="none" />
      <circle cx="104" cy="88" r="5" fill="var(--motif-accent)" stroke="none" />
      <circle cx="136" cy="88" r="5" fill="var(--motif-accent)" stroke="none" />
      <circle cx="166" cy="76" r="5" fill="var(--motif-accent)" stroke="none" />
      <path d="M100 156h40l-6-42h-28l-6 42Z" strokeWidth="3.2" />
      <path d="M102 122h36" strokeWidth="2" opacity="0.5" />
      <path d="M120 114v-14M120 104q-12-2-14-12 12-2 14 10M120 104q12-2 14-12-12-2-14 10" strokeWidth="2" />
    </>
  ),

  /* A deck, and the room it has to fill. */
  dj: (
    <>
      <circle cx="96" cy="106" r="42" strokeWidth="3.2" />
      <circle cx="96" cy="106" r="22" strokeWidth="2" opacity="0.5" />
      <circle cx="96" cy="106" r="7" fill="var(--motif-accent)" stroke="none" />
      <path d="M126 76l24-16" strokeWidth="3.2" />
      <circle cx="154" cy="58" r="5" fill="var(--motif-accent)" stroke="none" />
      <path d="M156 96q14 12 0 26M170 84q26 24 0 50M184 72q38 36 0 74" strokeWidth="2" opacity="0.6" />
    </>
  ),

  videographer: (
    <>
      <path d="M40 74h104a8 8 0 0 1 8 8v52a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8V82a8 8 0 0 1 8-8Z" strokeWidth="3.2" />
      <path d="M152 96l44-22v72l-44-22Z" strokeWidth="3.2" />
      <circle cx="68" cy="60" r="14" strokeWidth="3.2" />
      <circle cx="104" cy="60" r="14" strokeWidth="3.2" />
      <circle cx="86" cy="108" r="7" fill="var(--motif-accent)" stroke="none" />
      <path d="M46 140h20" strokeWidth="2" opacity="0.5" />
    </>
  ),

  /*
   * A degchi and a ladle, with steam.
   *
   * This was a thali seen from above: a rim, three katoris and two arcs of
   * rice. On a card it read as two eyes and a mouth -- a frowning face, on the
   * one card about feeding three hundred people. Pareidolia is not a thing to
   * argue with; the drawing changed. A cooking pot at this scale is also
   * simply more legible than a plate seen from directly overhead.
   */
  caterer: (
    <>
      {/* Steam. */}
      <path d="M96 56q8-10 0-20M120 50q8-12 0-24M144 56q8-10 0-20" strokeWidth="2" opacity="0.6" />
      {/* Rim, then the body. */}
      <path d="M60 80h120" strokeWidth="3.2" />
      <path d="M70 80q6 62 20 70h60q14-8 20-70" strokeWidth="3.2" />
      {/* Handles. */}
      <path d="M60 84q-14 4-12 16M180 84q14 4 12 16" strokeWidth="3.2" />
      {/* A band across the belly, and what is in it. */}
      <path d="M78 116h84" strokeWidth="2" opacity="0.45" />
      <circle cx="120" cy="136" r="5" fill="var(--motif-accent)" stroke="none" opacity="0.85" />
      {/* The ladle, resting against the rim. */}
      <path d="M168 74l26-34" strokeWidth="3.2" />
      <path d="M160 78q-10 6-4 14t16 0-12-14Z" strokeWidth="3.2" />
    </>
  ),

  /* Turmeric: the bowl, the paste and what ends up on everybody. */
  haldi: (
    <>
      <path d="M62 92h116q-6 56-24 62H86q-18-6-24-62Z" strokeWidth="3.2" />
      <path d="M62 92q58 16 116 0" strokeWidth="2" opacity="0.5" />
      <ellipse cx="120" cy="92" rx="28" ry="9" fill="var(--motif-accent)" stroke="none" opacity="0.85" />
      {/* The applicator leaves resting in it. */}
      <path d="M104 88q-16-26-4-42 16 10 12 40" strokeWidth="2" />
      <path d="M138 88q18-24 8-42-18 8-16 40" strokeWidth="2" />
      {/* Marigold petals around the base. */}
      <circle cx="52" cy="150" r="5" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
      <circle cx="188" cy="150" r="5" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
      <circle cx="120" cy="164" r="5" fill="var(--motif-accent)" stroke="none" opacity="0.6" />
    </>
  ),

  /* A dhol, slung, with the string lights the night is played under. */
  sangeet: (
    <>
      <path d="M28 40q92 36 184 0" strokeWidth="2" opacity="0.55" />
      <circle cx="74" cy="56" r="4" fill="var(--motif-accent)" stroke="none" />
      <circle cx="120" cy="62" r="4" fill="var(--motif-accent)" stroke="none" />
      <circle cx="166" cy="56" r="4" fill="var(--motif-accent)" stroke="none" />
      {/* The barrel, seen slightly from the side. */}
      <ellipse cx="78" cy="118" rx="16" ry="34" strokeWidth="3.2" />
      <path d="M78 84h84M78 152h84" strokeWidth="3.2" />
      <ellipse cx="162" cy="118" rx="16" ry="34" strokeWidth="3.2" />
      <ellipse cx="162" cy="118" rx="8" ry="18" strokeWidth="2" opacity="0.45" />
      {/* The rope lacing between the heads. */}
      <path d="M86 90l68 12M86 102l68 12M86 114l68 12M86 126l68 12" strokeWidth="2" opacity="0.4" />
      {/* Sticks. */}
      <path d="M44 74l22 22M44 162l22-22" strokeWidth="3.2" />
    </>
  ),

  /* The decorated chatri carried over the groom. */
  baraat: (
    <>
      <path d="M40 92q80-72 160 0Z" strokeWidth="3.2" />
      <path d="M40 92q40 22 80 0t80 0" strokeWidth="3.2" />
      <path d="M120 40v112" strokeWidth="3.2" />
      <circle cx="120" cy="36" r="6" fill="var(--motif-accent)" stroke="none" />
      {/* Tassels along the edge. */}
      <path d="M56 100v14M88 106v14M120 100v14M152 106v14M184 100v14" strokeWidth="2" opacity="0.65" />
      <circle cx="56" cy="118" r="4" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
      <circle cx="120" cy="118" r="4" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
      <circle cx="184" cy="118" r="4" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
      {/* Ribs. */}
      <path d="M120 44q-40 8-64 46M120 44q40 8 64 46" strokeWidth="2" opacity="0.4" />
    </>
  ),

  /* The stage everybody is photographed in front of. */
  reception: (
    <>
      <path d="M58 40h124v92H58Z" strokeWidth="3.2" />
      <path d="M58 56q62 22 124 0" strokeWidth="2" opacity="0.5" />
      <circle cx="82" cy="46" r="4.5" fill="var(--motif-accent)" stroke="none" />
      <circle cx="120" cy="52" r="4.5" fill="var(--motif-accent)" stroke="none" />
      <circle cx="158" cy="46" r="4.5" fill="var(--motif-accent)" stroke="none" />
      {/* The two seats on it. */}
      <path d="M88 132v-24h28v24M124 132v-24h28v24" strokeWidth="3.2" />
      {/* Uplights either side. */}
      <path d="M36 152v-16l14 16ZM204 152v-16l-14 16Z" strokeWidth="3.2" />
      <path d="M36 152h168" strokeWidth="2" opacity="0.45" />
    </>
  ),

  /* The drape itself: pleats, pallu and border. */
  half_saree_function: (
    <>
      <path d="M78 34q-26 58-14 122h92q10-70-16-122" strokeWidth="3.2" />
      <path d="M72 76q48 16 96 0M68 112q52 18 104 0" strokeWidth="2" opacity="0.45" />
      {/* The pleats. */}
      <path d="M96 42v110M120 38v114M144 42v110" strokeWidth="2" opacity="0.5" />
      {/* The border. */}
      <path d="M64 156h112" strokeWidth="3.2" stroke="var(--motif-accent)" />
      <circle cx="84" cy="166" r="3.4" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
      <circle cx="120" cy="166" r="3.4" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
      <circle cx="156" cy="166" r="3.4" fill="var(--motif-accent)" stroke="none" opacity="0.8" />
    </>
  ),
};

/**
 * One piece of artwork, sized by its container.
 *
 * `aria-hidden` on every one of them: the card's own heading already names the
 * occasion or the craft, so announcing the picture too would read the same
 * thing twice to somebody using a screen reader. These are decoration in the
 * strict sense -- they carry no information the text does not.
 */
export function Motif({ name, className }: { name: MotifName; className?: string }) {
  return (
    <svg
      className={className ? `motif ${className}` : "motif"}
      viewBox="0 0 240 180"
      /* `meet`, not `slice`: each piece is drawn inside a margin, and cropping
         one to fill a slot cuts the composition it was drawn within. */
      preserveAspectRatio="xMidYMid meet"
      fill="none"
      stroke="var(--motif-ink)"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ART[name]}
    </svg>
  );
}

/**
 * The artwork for an event code, whatever it is.
 *
 * Thirty-odd occasions, thirteen drawings. Rather than draw a Satyanarayan
 * Puja and an Ayush Homam separately -- which would be thirty pieces, most of
 * them near-identical, and the reason illustration sets end up abandoned
 * half-finished -- the ones with their own visual language get their own
 * drawing and the rest fall back to their group's.
 *
 * A fallback is not a failure here: a Namakaranam and a Seemantham really are
 * both "a family milestone staged around a jhula", and saying so is more
 * honest than inventing a distinct icon for each.
 *
 * `group` is passed in rather than looked up so this module does not import
 * the taxonomy -- it is a drawing file, and it should stay one.
 */
export function motifFor(eventCode: string, group: string): MotifName {
  if (eventCode in ART) return eventCode as MotifName;
  // Hindu, Sikh, Nikah and Kerala Christian ceremonies all happen under some
  // form of canopy or arch, which is what the wedding drawing is.
  if (group in ART) return group as MotifName;
  return "wedding";
}
