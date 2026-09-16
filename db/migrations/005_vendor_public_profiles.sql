-- Opt-in public vendor profiles.
--
-- The marketplace is closed today: every route except the taxonomy requires a
-- session, and vendor search additionally requires the host role, because a
-- vendor able to page through the competitor roster is the other half of the
-- scraping problem. That restriction is deliberate and worth keeping.
--
-- It also makes the acquisition loop impossible. A vendor cannot send a client
-- a link to their own profile; a search engine cannot index anything; a link
-- shared to WhatsApp opens a sign-in wall. For a business whose customers
-- arrive from a family group chat, that is the whole funnel.
--
-- Publishing reconciles the two. A vendor decides, for themselves, that one
-- profile is public. Only published profiles can be read without a session,
-- and only the columns named below are readable even then. The roster itself
-- -- who is on the platform, who is available, what everyone charges -- stays
-- behind the host-only search it is behind now. Nothing here widens that.
--
-- Publishing is a state, not a flag, so `published_at` records when rather
-- than whether: "since when has this been indexable" is a question that gets
-- asked, and a boolean cannot answer it.
BEGIN;

ALTER TABLE crew_profiles
    -- The public address. A slug rather than the user's UUID, because the URL
    -- is the thing a vendor puts on an Instagram bio and reads down a phone,
    -- and because a UUID in a public URL hands out an internal identifier that
    -- appears in authenticated routes too.
    ADD COLUMN slug              TEXT UNIQUE
        CHECK (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    -- NULL means unpublished, which is the default for every existing row:
    -- nobody is opted in by a migration.
    ADD COLUMN published_at      TIMESTAMPTZ,
    -- What a vendor trades under, which is often not the name on their ID.
    ADD COLUMN business_name     TEXT CHECK (business_name IS NULL OR length(trim(business_name)) >= 2),
    -- One line under the name. Short on purpose: it has to survive a phone.
    ADD COLUMN headline          TEXT CHECK (headline IS NULL OR length(trim(headline)) BETWEEN 10 AND 120),
    ADD COLUMN about             TEXT CHECK (about IS NULL OR length(trim(about)) BETWEEN 40 AND 2000),
    -- The single image a card and a link preview use. Portfolio assets are a
    -- separate, ordered set; this is the one that has to exist before a
    -- profile may be published, because a vendor card with no picture is the
    -- reason a marketplace looks empty.
    ADD COLUMN profile_asset_id  UUID REFERENCES portfolio_assets(id) ON DELETE SET NULL;

-- Slug uniqueness is the column's own UNIQUE above, and it is deliberately
-- global rather than scoped to published rows: a vendor settles on their
-- address first and publishes second, so an unpublished profile has to be able
-- to hold the name it will be published under. Scoping it to published rows
-- would let two vendors both hold `anjali-mua` and discover the collision at
-- the worst moment. Enforced in the schema rather than only in the service
-- because two vendors racing to claim one slug is exactly the case an
-- application-level check loses.

-- Published profiles are read by anonymous visitors and by crawlers, which
-- means the read is the hot path and it filters on this column every time.
CREATE INDEX crew_profiles_published_idx
    ON crew_profiles (published_at DESC)
    WHERE published_at IS NOT NULL;

-- The completeness rule, in the schema rather than only in the service.
--
-- A published profile with no name, no description and no picture is worse
-- than no profile: it is an indexable page that tells a visitor nothing and
-- teaches a search engine that this site is thin. The service checks these
-- too, with a message a vendor can act on; this is the backstop for anything
-- that reaches the table another way.
ALTER TABLE crew_profiles
    ADD CONSTRAINT crew_profiles_publishable CHECK (
        published_at IS NULL
        OR (
            slug IS NOT NULL
            AND business_name IS NOT NULL
            AND headline IS NOT NULL
            AND about IS NOT NULL
            AND profile_asset_id IS NOT NULL
        )
    );

COMMIT;
