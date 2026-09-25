# Deployment

The pilot runs on three managed pieces:

| Piece | Runs on | Why |
|---|---|---|
| Web (Next.js) | Vercel | Native host for the App Router; preview URLs per PR and a CDN in front of the landing pages, which is where SEO for "Half-Saree Function makeup artist Frisco" has to land. |
| API (Node) | Cloud Run | A long-lived HTTP server that scales to zero between events. Bookings are bursty — a Saturday morning is nothing like a Tuesday. |
| PostgreSQL | Supabase | Managed Postgres with PostGIS available, which the schema needs for `geography(Point)` venues and home bases. |
| Redis | Upstash (or Memorystore) | Shared rate-limit buckets. See "Redis" below — it is not optional in production. |

Stripe is deliberately absent until the LLC is registered. Until `STRIPE_API_KEY`
is set the service uses the fake gateway, and no money moves.

## What the service refuses to start without

In production the API exits rather than starting half-configured:

| Variable | Why it is mandatory |
|---|---|
| `DESI_NEXUS_TOKEN_SECRET` | Session signing key. |
| `DESI_NEXUS_WEBHOOK_SECRET` | Stripe webhook signature verification — the only thing trusted to say a payment succeeded. |
| `DATABASE_URL` | Without it the in-memory store is used, and every booking is lost on restart. |
| `REDIS_URL` | Without it rate limits are per-pod, which is to say not limits. |
| `DATABASE_SYSTEM_URL` | Without it the Stripe webhook cannot record a capture: it has no user, and the policies have nobody to act as. |
| `STRIPE_API_KEY` | Without it the fake gateway is used and bookings move no money. |
| `GEOCODER_URL` | Without it venue addresses resolve through the fake, which invents plausible coordinates. |

Each is selected by presence rather than a feature flag, so there is no
configuration in which the service looks correct and is not.

## 1. Database (Supabase)

Create the project, then enable PostGIS and apply the migrations in order:

```sql
-- In the Supabase SQL editor, once:
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;
```

```bash
# Direct connection (not the pooler) for DDL.
read -rs PGPASSWORD && export PGPASSWORD   # not inline: shell history keeps it
export PGURL="postgresql://postgres@db.PROJECT.supabase.co:5432/postgres"
# ON_ERROR_STOP: without it psql prints the error and carries on to the next
# statement, so a failed CREATE TABLE is followed by grants on a table that
# does not exist and the run still exits 0.
# --single-transaction: without it each statement commits on its own, so a
# migration that fails halfway leaves its first half applied and cannot simply
# be run again. With it, a failure rolls the whole file back.
for m in \
  001_init.sql \
  002_seed_reference_data.sql \
  003_app_role.sql \
  004_rls_write_policies.sql \
  005_vendor_public_profiles.sql \
  006_enquiries.sql \
  007_crew_event_links.sql \
  008_metro_footprint.sql
do
  psql "$PGURL" -v ON_ERROR_STOP=1 --single-transaction -f "db/migrations/$m" || { echo "stopped at $m"; break; }
done
```

**Apply each migration exactly once, in order.** This list previously stopped at
003 -- 004 was described below but never in the commands, and 005 to 008 were
not mentioned at all -- so a database stood up from this page would be missing
the write policies, vendor profiles, enquiries, the event-history table the
match engine ranks on, and seven of the ten metros the site advertises.

Not every migration is safe to re-run, and that decides what to do on a
database that already exists. This table is **measured, not read**: each file
was applied to a fresh PostGIS 16 database, then applied a second time, and the
second run's outcome is recorded here. Reading the SQL got three of the eight
wrong -- 004 has eight `CREATE` statements and no `IF NOT EXISTS` on any of
them, and re-runs cleanly anyway.

| Migration | Re-runnable | Second run |
|---|---|---|
| 001 | **No** | `type "user_role" already exists` |
| 002 | Yes | `ON CONFLICT DO NOTHING` -- safe, but it never *corrects* a row, which is why 008 does not rely on it |
| 003 | Yes | role guarded by `duplicate_object`; grants and revokes are idempotent |
| 004 | Yes | |
| 005 | **No** | `column "slug" of relation "crew_profiles" already exists` |
| 006 | **No** | `relation "enquiries" already exists` |
| 007 | Yes | `IF NOT EXISTS` throughout |
| 008 | Yes | `ON CONFLICT (code) DO UPDATE`, so a re-run converges on the right centres and radii |

Re-running a **No** is not destructive -- with `ON_ERROR_STOP` and
`--single-transaction` it rolls back and changes nothing -- but it does stop the
loop, so everything after it silently goes unapplied. That is the failure to
watch for.

So on an existing database, find out where it stopped and apply only what
follows -- for example, one that predates the event-fit work needs just:

```bash
psql "$PGURL" -v ON_ERROR_STOP=1 --single-transaction -f db/migrations/007_crew_event_links.sql
psql "$PGURL" -v ON_ERROR_STOP=1 --single-transaction -f db/migrations/008_metro_footprint.sql
```

008 **deactivates** El Paso, the Rio Grande Valley, Corpus Christi and Lubbock
rather than deleting them. `users.metro_code` and `gigs.metro_code` reference
`metros(code)` with no `ON DELETE`, so a `DELETE` fails on the first account in
one of those metros -- or, worse, succeeds on an empty table today and starts
failing the day somebody there signs up. Deactivated rows keep every existing
reference readable; they simply cannot be chosen for anything new.

`004_rls_write_policies.sql` adds the write policies and creates a second role,
`desi_nexus_system`, for the paths that belong to no user -- the Stripe webhook
is authenticated by signature, not by session, and has to find an escrow by
payment intent before it could know whose it is. That role is exempt from the
row policies and nothing else: it still cannot delete a row or rewrite the
ledger. Keeping it a separate login is the point, so a leaked application
password does not carry the exemption with it.

Then give `desi_nexus_app` a password and use **that** role in `DATABASE_URL`:

```sql
ALTER ROLE desi_nexus_app WITH PASSWORD 'generated-by-your-secret-manager';
```

This matters more than it looks. Row-level security is bypassed by the table
owner, so connecting as `postgres` means the policies in `001_init.sql` protect
nothing. `003_app_role.sql` also withholds `DELETE` on users, gigs, bookings and
ledger rows, and `UPDATE` on the append-only tables, so a bug cannot erase
history either.

**Which port.** Use the transaction pooler (`:6543`) if the API ever runs
serverless, and the direct port (`:5432`) for a long-lived Cloud Run container.
Set `DATABASE_POOL_MAX` low (5–10) behind a pooler.

## 2. Redis

Any Redis 6+ works; Upstash has a free tier that suits a pilot. The limiter
refills and spends inside one Lua script and takes its clock from Redis, so
nothing is required of the instance beyond `EVAL`.

A Redis outage fails **open** by default — the edge still carries coarse limits,
and an outage that blocks every login is worse than one that briefly lets a
scraper run faster. Pass `onError: "closed"` if you would rather refuse.

## 3. API (Cloud Run)

```bash
gcloud run deploy desi-nexus-api \
  --source services/api \
  --region us-south1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production \
  --set-secrets DESI_NEXUS_TOKEN_SECRET=dn-token-secret:latest \
  --set-secrets DESI_NEXUS_WEBHOOK_SECRET=dn-webhook-secret:latest \
  --set-secrets DATABASE_URL=dn-database-url:latest \
  --set-secrets DATABASE_SYSTEM_URL=dn-database-system-url:latest \
  --set-secrets REDIS_URL=dn-redis-url:latest \
  --set-env-vars GEOCODER_URL=https://geocoding.geo.census.gov/geocoder/locations/onelineaddress
```

`us-south1` is Dallas — the pilot's own metro, which keeps the round trip to
Texas users short.

Secrets come from Secret Manager rather than `--set-env-vars`, so they are not
visible in the service description or in deploy logs.

`STRIPE_API_KEY` is omitted on purpose until the LLC exists. The service will
refuse to start in production without it, so either add it or run the pilot with
`NODE_ENV=staging`.

Health check: `GET /healthz`.

`GEOCODER_URL` is a plain environment variable, not a secret: the US Census
address service takes no API key. It is configuration rather than a constant
because Census publishes its benchmarks at versioned paths and mirrors exist.

**Verify the address lookup once, on the first deploy.** The parser is tested
against recorded payloads and the HTTP plumbing against an injected client, but
the build environment's egress policy blocks `geocoding.geo.census.gov`, so no
automated test has ever made the real request. Post one gig by address and
confirm the venue that comes back is the right building:

```bash
curl -s "$GEOCODER_URL?address=8000+Warren+Pkwy,+Frisco+TX+75034&benchmark=Public_AR_Current&format=json" \
  | python3 -c 'import json,sys; m=json.load(sys.stdin)["result"]["addressMatches"]; print(m[0]["matchedAddress"], m[0]["coordinates"])'
```

Expect a Frisco address with `x` near `-96.82` and `y` near `33.15`. If `x` and
`y` come back the other way round, the provider changed its contract and every
venue will land in the Indian Ocean while still looking like a valid number.

## 4. Web (Vercel)

```bash
cd apps/web
vercel link
vercel env add API_URL production     # the Cloud Run URL
vercel --prod
```

Vercel auto-detects Next.js; no build configuration is needed.

## 5. After deploying

- Confirm `GET /healthz` on the API.
- Register an account and verify a phone — that exercises the database, the
  rate limiter and the session path in one go.
- Post and publish a gig, then check `gig_transitions` has the Draft → Open row.
  If it does, persistence and the state machine are both live.

## A note on credentials

No credential belongs in this repository, and the secret-scan job in CI fails
the build if one lands. Issue them from Secret Manager (API) and Vercel's
encrypted environment variables (web), and rotate on a schedule.

If a key has ever been committed anywhere — including in another repository, and
especially a public one — treat it as compromised and rotate it rather than
reusing it. A key in a public repository is scraped within minutes of the push.
