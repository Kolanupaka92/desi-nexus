# The public site: design system, and what is deliberately missing

This records the decisions behind the marketing surface — the home page, the
occasion pages, the hire pages and the public vendor profile — so the next
person changing them knows which parts are choices and which are constraints.

## 1. What this site is allowed to say

The redesign brief that prompted this work describes a full-service event
planner: *"we'll handle the details"*, *"our team handles the event details"*,
*"Moments We've Helped Create"*, testimonials about us, a lead form that starts
a planning conversation.

DESI-NEXUS is not that. It is a two-sided marketplace: hosts post a brief,
independent vendors apply, a match engine ranks them on cultural fit first, and
an escrow holds the deposit until the work is delivered. The domain model is
`gig.ts`, `matching.ts`, `escrow.ts` and `geo.ts`; there is no planning service
anywhere in it, and nobody on this side of the platform attends an event.

The same brief also says *"only expose services that are actually supported by
the business"* and *"do not invent services merely for SEO"*. Those two
instructions cannot both be satisfied by building the copy literally, so the
site is built for the marketplace that exists. Concretely:

- The primary action is **post a brief**, with a **public enquiry form** beside
  it for anybody not ready for that (see §7).
- Social proof is the **published ranking weights** and the **escrow terms**,
  not testimonials. Both are checkable against the code.
- "Moments we've helped create" has no honest equivalent yet, so there is no
  gallery of past events. There is an **image-slot architecture** ready for one.

### The standing rules

Nothing on the public site may assert:

- a testimonial, review, star rating or quote from a customer
- a count of events served, vendors listed, or hosts matched
- a response or match time ("matched within the hour")
- company history, founding date, team size or awards
- a service the platform does not perform

Two of these were already on the site and have been removed: the home page's
*"Get matched in under an hour"* step, and the speciality page's *"Most briefs
are matched within the hour"*. No booking has settled on this platform, so
there was no source for either. Where a claim was worth keeping, it is restated
as a mechanism — *"ranked on cultural fit first, and every applicant arrives
with the breakdown that produced their score"* — which is true and which a
visitor can verify on the results page.

`PublicVendorProfile.ratingAvg` is optional and absent on every profile today.
The profile page renders nothing where a rating would go, and the
`ProfessionalService` structured data omits `aggregateRating` entirely rather
than defaulting it. When reviews exist, both pick the field up.

## 2. Photography, testimonials, and the sections waiting for them

The repository has no image assets. Not "a few placeholders" — none: no
`<img>`, no object storage configured in `.env.example`, and no endpoint that
can create a `portfolio_assets` row.

### Card photography

Every card on the home page reads its picture from `apps/web/content/imagery.ts`
— `title`, `description`, `href`, `image`, `imageAlt`, focal point, credit and
licence. No component holds an image path, so supplying a photograph is a data
change and a card can switch from its drawing to a photograph without anybody
opening a `.tsx` file.

`image` is undefined on every entry today because **the photographs could not
be fetched from this environment**: the egress proxy answers `403` to `CONNECT`
for every image host — Unsplash, Pexels, Wikimedia Commons. Each entry
therefore carries the exact per-card search query for its picture instead, and
`apps/web/public/images/README.md` is the drop-in procedure: filename, query,
size, focal point, licence.

Until a card has a photograph it renders a hand-drawn motif
(`components/site/Motif.tsx`, thirteen original line drawings). Those are a
fallback, not the design, and should not survive contact with real photography.
Both render into the same box, verified at 375/390/430/768/1280/1440px, so
photographs can arrive a few at a time without the page moving.

Two further sections are **built and switched off**, rather than omitted:

| Section | Turned on by | Renders when empty |
| --- | --- | --- |
| Gallery, with filtering | files in `apps/web/public/gallery/` + entries in `content/gallery.ts` | nothing at all |
| Testimonials | entries in `content/testimonials.ts` | nothing at all |

Both files carry the full instructions at the top, including the rules on
permission (consent to photograph is not consent to publish, and a vendor's
consent is not the family's) and on attribution (`credit` is required, because
a marketplace showing a photographer's work unattributed is doing the thing it
exists to stop). Both were verified with scratch fixtures — six generated
images and three placeholder quotes — screenshotted, and then reverted; none of
that content is in the repository.

Rendering nothing when empty rather than a heading over a gap is what lets the
page be complete today and *better* rather than *different* later.

Filling the event-type and speciality cards with stock photography would be a
claim about who works on this platform that is false, and it is also exactly
the interchangeable look the brand is trying to escape. So every card that
wants a photograph has an **image slot** instead: a fixed aspect ratio, a
tinted ground drawn from the palette, and the jaali motif the hero texture uses.
The geometry is decided now, so dropping a real photograph in later changes the
picture and nothing else — no reflow, no re-layout, no second design pass.

What unblocks real photography, in order: object storage provisioned, an upload
endpoint that can write `portfolio_assets`, then `profile_asset_id` moves into
`PUBLISH_REQUIREMENTS` (migration 005 explains why it is deliberately not there
yet), and `next/image` replaces the slot's background.

## 3. Type

Two families, loaded by `next/font` at build time and self-hosted, so there is
no runtime request to a Google domain and no render-blocking stylesheet.

- **Fraunces** for display. Variable, with the `opsz` axis, so the same file
  renders a 64px headline and a 20px section heading correctly rather than
  scaling one set of outlines. Warm rather than icy, which suits the
  marigold-and-wine palette; a Didone would have fought it.
- **Inter** for everything else, deliberately unremarkable. Most of this
  product is forms — a gig brief, a vendor profile, money — and the text face's
  job there is to disappear.

Before this, everything was set in `ui-serif, Georgia`, which resolves to Times
on most Windows machines. A site competing with a wedding photographer's
portfolio cannot be set in Times.

## 4. Tokens

All in `apps/web/app/globals.css`, on `:root`.

| Group | Tokens | Notes |
| --- | --- | --- |
| Type scale | `--step--1` … `--step-5` | Fluid; interpolates between a phone and 1280px. Ratio ≈1.2 at the body end, stretching to ≈1.28 at the display end. |
| Spacing | `--space-1` … `--space-9`, `--band-pad` | 4px base. `--band-pad` is fluid, because 96px above a heading is generous on a desktop and most of a phone screen. |
| Radius | `--radius-sm` … `--radius-xl`, `--radius-pill` | |
| Elevation | `--shadow-sm`, `--shadow-md`, `--shadow-lg` | Two layers each: a tight contact shadow for the edge, a wide soft one for height. One blurred shadow is what makes a card look like a 2014 template. |
| Motion | `--fast`, `--slow`, `--ease` | Zeroed under `prefers-reduced-motion`, which turns off every transition and reveal on the site at once. |
| Layout | `--shell`, `--shell-narrow`, `--measure` | `--measure` caps a paragraph at a readable line length independently of the column it sits in. |

The colour tokens predate this work and are unchanged.

## 5. Components

`apps/web/components/site/`:

- `Header` — the mobile menu is a checkbox and a label, with no JavaScript. The
  marketing pages are otherwise server components with no interactivity, so a
  `useState` menu would be the only reason any of them ship a client bundle,
  and it would be dead between first paint and hydration.
- `Footer` — four columns, every link resolving to a page that exists. It is
  also the internal-linking layer: the long-tail pages are two hops from
  anywhere because of it.
- `SectionHeader` — replaces the eyebrow/heading/lede block that was copied
  inline into each band with an inline `style` to recolour the eyebrow, and was
  wrong at two of the four call sites.
- `Breadcrumbs` — emits the visible trail and the `BreadcrumbList` from one
  list, so the two cannot disagree. As an `<ol>`, because the sequence is the
  meaning; the separator is drawn by `::before` rather than being a chevron
  text node a screen reader reads out as "single right-pointing angle
  quotation mark".
- `Faq` — native `<details>`, so keyboard operation, ARIA semantics and
  open-on-find-in-page come for free. Emits `FAQPage` matching the visible text.
- `CTASection` — one primary action and at most one secondary.
- `JsonLd` — escapes `<`, because vendor-supplied text reaches it on the
  profile pages and a string containing `</script` would close the tag early.

## 6. Structured data

| Type | Where | Notes |
| --- | --- | --- |
| `Organization`, `WebSite` | root layout | Name, URL, area served. No logo, founding date or employee count. |
| `BreadcrumbList` | every nested page | From the `Breadcrumbs` component. |
| `FAQPage` | home | Matches the visible answers exactly. |
| `Service` | speciality pages | The marketplace is the provider, not a local business with a storefront in eight metros. |
| `ProfessionalService` | published vendor profiles | Every field read off the profile. `aggregateRating` omitted while no reviews exist. |

## 7. The enquiry form

Every other way into the marketplace requires an account. That is correct for
booking — money and identity both depend on knowing who somebody is — and it
was, until now, also the only way to ask a question: a visitor arriving from a
WhatsApp link with a date and a question had to register, verify a phone and
fill in a structured gig brief before they could say anything.

`POST /v1/enquiries` is therefore the one endpoint that accepts input from
somebody with no session, and three things follow:

- **It is the strictest-but-one rate-limited write on the service**, keyed on
  the client address. The bucket is 20/hour rather than the 5/hour that first
  looked right: this audience is on phones, carrier CGNAT puts a large number
  of real people behind one address, and a limit tight enough to feel safe
  silently blocks leads that look identical to an attack. Twenty spam rows an
  hour is a worse day than losing a customer you never hear about.
- **A honeypot field** catches the untargeted majority before the limiter is
  reached. It is a real rendered input moved off-screen — not `display: none`,
  not `type="hidden"`, both of which a bot can detect and skip — kept out of
  the tab order and out of the accessibility tree. A filled honeypot gets the
  same `202` a real visitor gets, because telling a spammer which submissions
  were dropped is how they tune around it.
- **The application's database role has `INSERT` on `enquiries` and no
  `SELECT`.** Migration 006 revokes it, and — more importantly — no RLS policy
  on the table reaches that role, so it reads zero rows even if a later
  migration grants the privilege back. Both layers are asserted in
  `postgres.privileges.test.ts`, which re-grants `SELECT` and checks the rows
  stay invisible.

  Getting this right took two goes. The first version guarded its grants and
  its system-role policy on `IF EXISTS (… pg_roles …)`, because the test
  harness applies the schema migrations before 003 and 004 — the two that
  create the roles. On a cluster where the roles did not exist yet, 006 quietly
  skipped its own policy and left the table row-level secured with no policy
  reaching anybody. The RLS suite's "every RLS table has a policy for every
  command" invariant caught it in CI; it passed locally only because this
  machine's cluster already had the roles from earlier runs. 006 now creates
  both roles if they are missing, in the same `EXCEPTION WHEN duplicate_object`
  idiom 003 and 004 use, so it no longer depends on the order it is applied in.
  Re-verified against a freshly `initdb`-ed cluster with no `desi_nexus` roles,
  and mutation-checked: restoring the guards reproduces the CI failure exactly. This table is the one place holding
  contact details of people who never became users, and it is the single most
  valuable thing on the platform to steal, so the privilege to read it is not
  attached to the credential the API uses. That is also why the insert has no
  `RETURNING` clause and the service supplies the row id: `RETURNING` needs
  `SELECT` on the columns it returns, which would have undone the whole
  arrangement to recover one uuid.

The outbox event carries the enquiry id, occasion, metro and date — no message
body, no phone number, no address. An outbox row is the one copy of this data
that leaves the table whose RLS protects it.

## 8. Routes added

- `/plan/[group]` — five pages, one per occasion group, generated from
  `PLANS` and `EVENT_GROUPS`. The speciality list on each is **computed** from
  `SPECIALITIES[].events`, so the page cannot drift from the match engine's
  own data.

  Five, not forty: crossing the groups with the metros would produce pages
  whose only difference is a place name, which is a doorway set whatever it is
  called. The metro axis already has its own pages, written around what is
  actually different about each metro.

- `/contact` — the enquiry form with the FAQ under it. The home page carries
  the same form; this exists anyway because "contact" is what people type, look
  for in a footer, and paste into a message when they forward the site on.

- `/vendors/[slug]` — the public profile. The API gained
  `GET /v1/vendors/:slug` when publishing was added and nothing rendered it, so
  a vendor could opt in to being public and still had no address to send
  anyone. A 404 from the API is a miss; anything else is re-thrown, because a
  soft 404 on a real profile is how a page gets dropped from the index over a
  ten-minute outage.

  Vendor profiles are **not** in the sitemap: they are published one at a time
  by vendors and read at request time, so listing them would mean either a
  build-time query that fails the sitemap when the API is down, or a stale list
  that 404s the moment somebody unpublishes.

## 9. Verification

`apps/web/e2e/screenshots.mjs` renders every public page at 390px and 1280px
and asserts, per page: a 200, a clean console, no horizontal overflow, and
exactly one `h1`. It also opens the mobile menu and checks it starts closed and
becomes visible on tap. Screenshots land in `e2e/shots/`.

`apps/web/e2e/enquiry-flow.mjs` drives the contact form the way a visitor does,
at both widths: it checks the honeypot is off-screen, out of the tab order and
out of the accessibility tree; submits a real enquiry; and checks the form is
*replaced* by the confirmation rather than cleared, since a form that empties
itself reads as a failure and people re-send.

These exist because the regressions that matter here are not the ones a unit
test sees. Two examples from this work alone: a payout gate applied one level
too high emptied the vendor's own feed with every test still passing, and
passing `label` as a prop from the home page into the `Gallery` client
component 500'd the entire home page — React cannot serialise a function across
that boundary, `next build` succeeds because the error happens at render rather
than compile, and the page is dynamic, so CI would not have caught it either.
