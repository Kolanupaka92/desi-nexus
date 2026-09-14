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
| `STRIPE_API_KEY` | Without it the fake gateway is used and bookings move no money. |

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
psql "$PGURL" -f db/migrations/001_init.sql
psql "$PGURL" -f db/migrations/002_seed_reference_data.sql
psql "$PGURL" -f db/migrations/003_app_role.sql
```

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
  --set-secrets REDIS_URL=dn-redis-url:latest
```

`us-south1` is Dallas — the pilot's own metro, which keeps the round trip to
Texas users short.

Secrets come from Secret Manager rather than `--set-env-vars`, so they are not
visible in the service description or in deploy logs.

`STRIPE_API_KEY` is omitted on purpose until the LLC exists. The service will
refuse to start in production without it, so either add it or run the pilot with
`NODE_ENV=staging`.

Health check: `GET /healthz`.

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
