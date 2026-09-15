-- Write policies, and the role the user-less paths connect as.
--
-- 001_init.sql enabled row-level security on gigs, escrows and reviews and then
-- defined only SELECT policies. A table with RLS enabled and no policy for a
-- command denies that command outright, so connecting as desi_nexus_app -- the
-- role 003 creates and docs/deployment.md instructs operators to use -- the
-- service could not insert a gig, an escrow or a review at all. It failed
-- closed, so nothing leaked; it also meant the marketplace could not take a
-- booking in the configuration it ships with.
--
-- Two things were missing, and they are different problems.
--
-- The first is the write policies themselves, below. They mirror the SELECT
-- policies already there: a gig is writable by its host and by any vendor who
-- has applied to it, because a vendor applying increments the gig's application
-- count and either party can drive a state transition. "Only the host may
-- update" reads tighter and is simply wrong -- it would break applying.
--
-- The second is that some writes belong to nobody. The Stripe webhook is
-- authenticated by signature rather than by session: it has no user, and it
-- must still record that a deposit was captured. It cannot borrow the host's
-- identity either, because it has to find the escrow by payment intent before
-- it knows who the host is, and that lookup is itself policed.
--
-- So those paths connect as a second role with its own permissive policies,
-- scoped with TO. Scoping by role rather than granting BYPASSRLS matters
-- practically: BYPASSRLS is a role attribute only a superuser can grant, which
-- managed Postgres (Supabase, Cloud SQL) generally does not hand out. A policy
-- carrying TO desi_nexus_system needs no special privilege and is visible in
-- the schema, where a reviewer can see exactly how wide the exemption is.
--
-- Naming the escape hatch as a separate login is the point. The webhook's
-- credential is not the API's credential, so a leaked application password does
-- not carry the exemption with it.

BEGIN;

-- ---------------------------------------------------------------------------
-- The system role
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    target text := current_schema();
BEGIN
    -- No password here, as in 003: it is issued and rotated out of band. And,
    -- as in 003, created by catching the duplicate rather than checking first:
    -- parallel test files apply these migrations concurrently, and
    -- check-then-create loses that race intermittently.
    BEGIN
        CREATE ROLE desi_nexus_system LOGIN;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

    EXECUTE format('GRANT USAGE ON SCHEMA %I TO desi_nexus_system', target);
    EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA %I TO desi_nexus_system', target);
    EXECUTE format(
        'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO desi_nexus_system', target);

    -- The same posture as the application role: nothing is ever erased, and the
    -- append-only tables stay insert-only. The RLS exemption below widens which
    -- ROWS this role may touch; it must not widen which OPERATIONS it may run.
    EXECUTE format(
        'REVOKE DELETE ON ALL TABLES IN SCHEMA %I FROM desi_nexus_system', target);

    -- The same exception 003 makes for the application role. These join tables
    -- hold replaceable set membership rather than records: saving a gig rewrites
    -- its tags and languages wholesale, and the webhook saves gigs when a
    -- deposit lands. Without this the capture fails on "permission denied for
    -- table gig_cultural_tags" -- money taken and nothing recorded.
    EXECUTE format(
        'GRANT DELETE ON %I.crew_specialty_links, %I.crew_cultural_tags,
                         %I.vendor_unavailability, %I.gig_cultural_tags,
                         %I.gig_languages, %I.portfolio_assets
         TO desi_nexus_system',
        target, target, target, target, target, target);
    EXECUTE format(
        'REVOKE UPDATE ON %I.ledger_entries, %I.gig_transitions FROM desi_nexus_system',
        target, target);
    EXECUTE format(
        'REVOKE INSERT, UPDATE ON %I.event_types, %I.crew_specialties,
                                  %I.cultural_tags, %I.cultural_tag_affinity,
                                  %I.metros, %I.languages
         FROM desi_nexus_system',
        target, target, target, target, target, target);

    EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA %I
         GRANT SELECT, INSERT, UPDATE ON TABLES TO desi_nexus_system', target);
    EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA %I
         GRANT USAGE, SELECT ON SEQUENCES TO desi_nexus_system', target);
END
$$;

-- ---------------------------------------------------------------------------
-- Gigs
-- ---------------------------------------------------------------------------

-- A host may only post a gig as themselves. Without the WITH CHECK a caller
-- could insert a gig owned by somebody else and then read it back through the
-- "open gigs" arm of the SELECT policy.
DROP POLICY IF EXISTS gigs_insert_by_host ON gigs;
CREATE POLICY gigs_insert_by_host ON gigs
    FOR INSERT
    WITH CHECK (host_id = current_setting('app.current_user_id', TRUE)::uuid);

-- Both parties write to a gig in normal use: the host publishes it and extends
-- an offer, and a vendor applying increments application_count. USING picks the
-- rows that may be updated; WITH CHECK is the same expression so an update
-- cannot hand the gig to a different host on the way past.
DROP POLICY IF EXISTS gigs_update_by_parties ON gigs;
CREATE POLICY gigs_update_by_parties ON gigs
    FOR UPDATE
    USING (
        host_id = current_setting('app.current_user_id', TRUE)::uuid
        OR EXISTS (
            SELECT 1 FROM applications a
            WHERE a.gig_id = gigs.id
              AND a.vendor_id = current_setting('app.current_user_id', TRUE)::uuid
        )
    )
    WITH CHECK (
        host_id = current_setting('app.current_user_id', TRUE)::uuid
        OR EXISTS (
            SELECT 1 FROM applications a
            WHERE a.gig_id = gigs.id
              AND a.vendor_id = current_setting('app.current_user_id', TRUE)::uuid
        )
    );

-- ---------------------------------------------------------------------------
-- Escrows
-- ---------------------------------------------------------------------------

-- An escrow is opened by the host who is booking, and only for themselves.
DROP POLICY IF EXISTS escrows_insert_by_host ON escrows;
CREATE POLICY escrows_insert_by_host ON escrows
    FOR INSERT
    WITH CHECK (host_id = current_setting('app.current_user_id', TRUE)::uuid);

-- Either party moves a booking along; the money itself is moved by the webhook,
-- which arrives as the system role below.
DROP POLICY IF EXISTS escrows_update_by_parties ON escrows;
CREATE POLICY escrows_update_by_parties ON escrows
    FOR UPDATE
    USING (
        host_id = current_setting('app.current_user_id', TRUE)::uuid
        OR vendor_id = current_setting('app.current_user_id', TRUE)::uuid
    )
    WITH CHECK (
        host_id = current_setting('app.current_user_id', TRUE)::uuid
        OR vendor_id = current_setting('app.current_user_id', TRUE)::uuid
    );

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

-- Reviews are already world-readable. Writing one is signing it: you may only
-- post as yourself. The table's own constraints handle the rest -- one review
-- per direction per gig, and never about yourself.
DROP POLICY IF EXISTS reviews_insert_by_author ON reviews;
CREATE POLICY reviews_insert_by_author ON reviews
    FOR INSERT
    WITH CHECK (author_id = current_setting('app.current_user_id', TRUE)::uuid);

-- Deliberately no UPDATE policy. A review is a record, not a draft; editing one
-- after the fact would let a vendor pressure a host into quietly rewriting it.

-- ---------------------------------------------------------------------------
-- The system exemption
-- ---------------------------------------------------------------------------

-- Scoped TO desi_nexus_system, so it does nothing for the application role.
-- Permissive policies are OR-ed, so this role sees and writes every row while
-- desi_nexus_app stays bound by the policies above.
DROP POLICY IF EXISTS gigs_system_access ON gigs;
CREATE POLICY gigs_system_access ON gigs
    FOR ALL TO desi_nexus_system USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS escrows_system_access ON escrows;
CREATE POLICY escrows_system_access ON escrows
    FOR ALL TO desi_nexus_system USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS reviews_system_access ON reviews;
CREATE POLICY reviews_system_access ON reviews
    FOR ALL TO desi_nexus_system USING (TRUE) WITH CHECK (TRUE);

COMMIT;
