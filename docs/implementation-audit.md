# Implementation audit

What exists in this repository today, measured rather than assumed, as the
baseline for the marketplace launch-readiness work.

Audited at commit `35a237f` (main, all four stacked PRs merged).
Everything below was verified by running it. Where a claim came from reading
code rather than executing it, it says so.

---

## 1. Baseline: tests, build, types, lint

| Check | Command | Result |
|---|---|---|
| API tests (with PostgreSQL) | `services/api && npm test` | **252 tests, 237 pass, 0 fail, 15 skipped** (~35s) |
| API tests (no database) | same, `DESI_NEXUS_TEST_DATABASE_URL` unset | 252 tests, 182 pass, 0 fail, **70 skipped** |
| API typecheck | `npm run typecheck` | pass |
| Web typecheck | `npm run typecheck` | pass |
| Web build | `npx next build` | pass — **159 pages**, 103 kB shared JS |
| Lint | — | **does not exist** (see below) |
| Web tests | — | **no test script** (see below) |

Size: 7,192 lines of API source, 4,485 lines of API tests, 3,695 lines of web.

### The 15 skips are deliberate; the 70 are not the same thing

15 tests gate on Stripe and Redis credentials. The other 55 gate on a database.
CI provisions PostGIS 16 and sets `DESI_NEXUS_TEST_DATABASE_URL`, and
`.github/workflows/ci.yml` fails the build if the service-backed tests are
skipped (`::error::service-backed tests were skipped`). That guard is
load-bearing: a local run without a database reports **182 pass / 0 fail**,
which looks green and proves almost nothing about persistence, RLS or the
booking flow.

### Gap: no lint tooling anywhere

Neither workspace has an ESLint config or a `lint` script, and there is no root
`package.json`. The deployment checklist calls for `npm run lint`; that command
does not exist and never has. Formatting and import hygiene are currently
maintained by convention alone.

### Gap: the web app has no automated tests

`apps/web` has no test script and no test runner. Its only coverage is
`apps/web/e2e/booking-flow.mjs`, a Playwright script run by hand against a live
API and database. It is good (17 checks, real browser, real forms) but it is
not wired into CI, so no web change is gated by it.

---

## 2. What is actually built

The domain and money layers are the strongest part of this repository and
should not be rebuilt.

**Production-ready**
- Email/password auth with scrypt, phone OTP, MFA step-up sessions
- Multi-role identity (host / crew / creator / admin)
- Event taxonomy: 31 event types, 17 crew specialities, 15 cultural tags,
  8 Texas metros, cultural-affinity scoring
- Gig state machine with guarded transitions and an append-only transition log
- Match scoring with an explainable per-factor breakdown
- Travel quoting: round-trip miles, free radius, per-mile, overnight threshold
- Escrow: append-only ledger, integer cents, idempotent, deposit/balance legs
- Stripe Connect with signature-verified webhooks, replay-safe
- Row-level security with a named system-role exemption (migration 004)
- Redis token-bucket rate limiting; trusted-proxy client IP resolution
- Transactional outbox with a `FOR UPDATE SKIP LOCKED` relay
- Geocoding with a Census backend, cache and deterministic fake

**Partially implemented**
- Notification waves are *planned and persisted* — no transport sends them
- `/v1/search/crew` exists but is a table scan (the roadmap says so plainly)
- `payouts_enabled` is stored but not what the booking guard reads

**Schema only — no code path touches it**
- `reviews` — the table exists with sound constraints (one review per direction
  per gig, `author_id <> subject_id`). **Zero references in `services/api/src`.**
  Nothing writes or reads a review.
- `portfolio_assets` — readable, but there is no upload endpoint, so the table
  can never be populated. `portfolioAssetIds` is accepted in profile bodies and
  refers to rows nothing can create.

**Documented but not started** (roadmap is accurate on all of these)
- Social OAuth for verified follower counts, government ID verification,
  push/SMS transports, in-app messaging, a real search index

`docs/roadmap.md` is honest and current. It is a reliable document and did not
overstate anything I checked.

---

## 3. The structural finding: this is a closed marketplace

The entire public API surface is **three endpoints**:

| Endpoint | Auth |
|---|---|
| `GET /healthz` | none |
| `GET /v1/taxonomy` | none |
| `GET /v1/taxonomy/event/:eventType` | none |
| `POST /v1/webhooks/stripe` | Stripe signature (not a session) |

All 33 other routes require `requireAuth`. Specifically:

- **`GET /v1/profiles/crew/:userId` requires auth.** There is no public vendor
  profile. A shared link to a vendor is not viewable by a logged-out visitor.
- **`POST /v1/search/crew` requires auth *and* `requireRole("host", "admin")`.**
  Vendors cannot browse; anonymous visitors cannot browse.

That restriction is deliberate and documented in the code: *"Hosts only: a
vendor browsing the full competitor roster is the other half of the scraping
problem."* It is a real product decision, not an oversight.

**This is the central tension in the launch brief and it needs an explicit
decision.** The brief asks for public, indexable, WhatsApp-shareable vendor
profiles (§13, §19, §23, §45) while also requiring that vendor roster privacy be
preserved and RLS not weakened (§40, §65). Both cannot hold for the same data.

The resolution the brief itself hints at is an **opt-in publishing model**
(§23: *"Vendor profiles should only enter the sitemap when they satisfy defined
publishing/indexing requirements"*): a vendor explicitly publishes a public
profile, only published profiles are anonymously readable and indexable, and the
full roster stays private. That preserves the anti-scraping intent while making
the funnel possible. Nothing in the schema supports it yet.

### Other shape mismatches against the brief

| Brief expects | Repository has |
|---|---|
| `GET` search, linkable/cacheable | `POST /v1/search/crew` — not shareable, not cacheable |
| Search by city or ZIP | `venue: {lat, lng}` only — no place resolution on the search path |
| Filter by cultural style, event type, price | Query filters on **speciality only**; everything else is applied during ranking |
| Pagination | Hard-coded `limit: 25`, no cursor, no total |
| `/vendors/[slug]` | No `slug` column; profiles are addressed by user UUID |
| Vendor cards with photo, price, area | Search returns `userId`, `displayName`, `metroId`, `score`, `breakdown`, travel — **no photo, no bio, no business name** (none exist in the schema) |
| Categories incl. Models, Influencers | Those are **creator disciplines**, and **there is no creator search endpoint at all** |
| City pages (Frisco, Plano, Irving…) | Locations are 8 **metros**; every city in the brief's list is inside `dfw`. No city entity exists |

### The 145 SEO pages contain no vendors

`/hire/[metro]/[speciality]` and `/hire/[metro]` make **no API calls**. They
render entirely from `apps/web/content/seo.ts`. That is why they survive with
the API down — verified by building against a dead port, all pages 200.

They are legitimate *content* pages with real, non-substitutable prose. But
against the brief's own test (§54: *"Can it link to real vendors?"*) they
currently cannot, because no public endpoint can list one.

---

## 4. Defects found, and verified by running them

Both are pre-existing. Both were proven against a real PostgreSQL, not inferred.

### D1 — Editing a profile silently makes a vendor unbookable

`putCrew` is an UPSERT whose `ON CONFLICT DO UPDATE` sets
`stripe_account_id = EXCLUDED.stripe_account_id`, and `POST /v1/profiles/crew`
never sends one. So any ordinary profile edit nulls the Stripe account link.

Observed, end to end:

```
escrow BEFORE profile edit: 201 "ok"
profile edit status:        201   (the vendor is told nothing is wrong)
escrow AFTER  profile edit: 409 "vendor_not_payable"
```

The same UPSERT also resets `rating_avg`, `rating_count` and `completed_gigs`
to the route's hard-coded zeros, and leaves `payouts_enabled` untouched —
producing `payouts_enabled: true` alongside `stripe_account_id: null`:

```
BEFORE edit: {"stripe_account_id":"acct_4164c44d…","rating_count":12,"completed_gigs":9}
AFTER  edit: {"stripe_account_id":null,"payouts_enabled":true,"rating_avg":null,
              "rating_count":0,"completed_gigs":0}
```

**Money is not at risk.** The escrow guard reads `canReceivePayouts(vendor,
stripeAccountId)`, so it fails *closed* — no capture happens. The damage is
liquidity and trust: a vendor edits their profile, is told everything saved
fine, and silently stops being bookable with no indication why. The reputation
reset is dormant today only because nothing populates ratings; it becomes
destructive the moment reviews ship.

### D2 — The "never show a vendor who cannot be paid" rule never fires

`services/api/src/domain/matching.ts` disqualifies a candidate when
`payoutReady === false`. `toCandidate()` in `discovery.ts` — the only adapter
that builds candidates from the database — **never sets `payoutReady`**, so the
value is always `undefined` and the check can never be true in production.

`test/matching.test.ts` passes because it constructs a candidate with
`payoutReady: false` by hand. The unit test is green; the real path is dead.

Verified against the database — a vendor who never onboarded to Stripe:

```
search results: 1 - unpayable vendor shown: true
```

Consequence: a host can search, shortlist, receive an application and extend an
offer to a vendor who cannot be booked, and only discovers it at the payment
step. This is the same failure shape as the RLS gap fixed in migration 004 — a
rule expressed in the domain, tested in isolation, and not wired to the adapter.

---

## 5. Frontend baseline

Routes today: `/`, `/login`, `/register`, `/dashboard`, `/vendor`, `/gigs`,
`/gigs/new`, `/gigs/[id]`, `/for-vendors`, `/hire`, `/hire/[metro]`,
`/hire/[metro]/[speciality]`, `/robots.txt`, `/sitemap.xml`.

- No `/vendors`, no vendor profile page, no category pages, no city pages, no
  `/how-it-works`, `/trust`, `/request-vendor`, `/guides`
- The homepage is **`ƒ` (dynamic)**, not static — it awaits `taxonomy()` on
  every request. It has a bundled fallback, so it degrades rather than failing,
  but it pays a TTFB cost for content that changes almost never
- No navigation header component and no footer; pages link ad hoc
- No analytics of any kind — no events, no provider, no `docs/analytics.md`
- No JSON-LD anywhere. `sitemap.ts` and `robots.ts` exist and are correct for
  the routes that exist
- No image pipeline: no `next/image` usage, no vendor imagery, no OG images
- `globals.css` is hand-rolled; no design-system primitives, no token scale

---

## 6. What must not regress

Verified present and working; every one is covered by a test that fails if it
is removed:

- RLS write policies scoped `TO desi_nexus_system`, never `BYPASSRLS`
- The acting user travelling in `AsyncLocalStorage`; no actor ⇒ denial, not leak
- Stripe webhook signature verification and replay safety
- Append-only ledger; integer cents end to end
- Booking state machine guards
- Rate limits bucketed on a client-unforgeable address
- The transactional outbox committing with the state change it describes
- `vendor_not_payable` (409) blocking escrow for an unpayable vendor

---

## 7. Recommended order

Sequenced by dependency, not by the brief's numbering. Nothing here is built
yet; this is the plan the audit implies.

**Phase 0 — fix what is broken, add the missing gates** (small, no new surface)
1. D1: stop the profile UPSERT clobbering payout and reputation columns
2. D2: populate `payoutReady` in `toCandidate`, so the domain rule engages
3. Add ESLint to both workspaces and a web test script; wire both into CI

**Phase 1 — decide and build the publishing model** (blocks everything public)
4. Vendor public-profile decision: opt-in `published` state, `slug`,
   `business_name`, `headline`, `about`, profile photo, plus the publishing
   criteria that gate it
5. Public read endpoints for published profiles only, with the private roster
   still host-only

**Phase 2 — search that a marketplace can use**
6. `GET /v1/vendors` with server-side filters (speciality, cultural tag, event
   type, metro/city, price), cursor pagination, stable ordering
7. Place resolution so a city or ZIP becomes coordinates server-side
8. Creator search, or an explicit decision that models/influencers are out of
   scope for launch — the brief's category list currently promises pages that
   have no backing query

**Phase 3 — the pages** (homepage, `/vendors`, profiles, categories, cities)

**Phase 4 — SEO, structured data, sitemap gated on published inventory**

**Phase 5 — analytics and marketplace metrics**

**Phase 6 — empty states and the supply-gap capture flow**

Reviews (§37) should stay behind Phase 0's fix: shipping reviews onto a profile
UPSERT that resets `rating_count` to zero would destroy them on the vendor's
next edit.

---

## 8. Production blockers as of this audit

1. **D1** — vendors silently lose bookability on profile edit
2. **D2** — unpayable vendors surface in search
3. `DATABASE_SYSTEM_URL` must be set and migration 004 must run before boot —
   the service refuses to start otherwise, by design
4. No lint in CI
5. No web tests in CI
6. Reviews, portfolio upload and notification transports are not implemented;
   no page may claim them
7. The API has no deployment target yet (Vercel hosts the web app only)

Not production-ready. Items 1 and 2 are correctness defects in the booking
funnel and should land before any public-facing work.
