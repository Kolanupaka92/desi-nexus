-- ---------------------------------------------------------------------------
-- 007: which functions a vendor has actually worked
--
-- The product's one differentiating claim is that a host is matched on whether
-- a vendor has worked THEIR kind of function -- a half-saree function, a griha
-- pravesham, a nikah -- rather than on the category "makeup artist". It is on
-- the home page, in the match engine's own doc comment, and in the pitch.
--
-- It was not implemented. `gigs.event_type_code` has always been collected,
-- validated and stored, and then never read again: the matcher's Candidate
-- carried specialties, cultural tags, languages, location, rate and reputation,
-- and no event types at all. Nothing failed, because there was nothing to fail
-- -- the score simply never contained the term.
--
-- Cultural tags were not a stand-in for it. `telugu_traditional` says whose
-- traditions a vendor knows; it does not say they have ever worked a
-- half-saree function. Those are different questions and a host asking the
-- second one was being answered with the first.
--
-- This table is the missing half.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS crew_event_links (
    user_id         UUID NOT NULL REFERENCES crew_profiles(user_id) ON DELETE CASCADE,
    event_type_code TEXT NOT NULL REFERENCES event_types(code),

    /*
     * How many of this function the vendor says they have worked.
     *
     * Self-reported, and the column name does not hide that -- `claimed_count`
     * rather than `count`. Until enough gigs complete on this platform to
     * derive the number, a claim is all there is, and a field called `count`
     * would be read as audited by the next person to write a query against it.
     *
     * NULL means "I have worked this, I am not putting a number on it", which
     * is a different statement from 0 and has to stay distinguishable: 0 would
     * rank a vendor below someone who never claimed the function at all.
     */
    claimed_count   INT CHECK (claimed_count IS NULL OR claimed_count >= 0),

    /*
     * Set once the platform can prove it from completed gigs. Null until then.
     *
     * Kept separate from claimed_count rather than overwriting it, so the UI
     * can show "12 worked through Utsav" with confidence and "40 claimed"
     * without, instead of one number whose provenance nobody can reconstruct.
     */
    verified_count  INT NOT NULL DEFAULT 0 CHECK (verified_count >= 0),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_type_code)
);

/*
 * The lookup that runs on every posting: given this gig's event type, who has
 * worked it? Leading column is event_type_code so it is an index scan rather
 * than a sequential one, matching crew_specialty_lookup next door.
 */
CREATE INDEX IF NOT EXISTS crew_event_lookup ON crew_event_links (event_type_code, user_id);

DO $$
DECLARE
    target text := current_schema();
BEGIN
    -- Both roles are ensured here rather than assumed, for the reason 006
    -- documents at length: the test harness applies the schema migrations
    -- first and 003/004 afterwards, so at this point the roles may not exist.
    -- Guarding with IF EXISTS instead is what made 006 silently skip its own
    -- grants on a fresh cluster while passing on mine.
    --
    -- Created by catching the duplicate rather than checking first: parallel
    -- test files apply these migrations concurrently and check-then-create
    -- loses that race intermittently.
    BEGIN
        CREATE ROLE desi_nexus_app LOGIN;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        CREATE ROLE desi_nexus_system LOGIN;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

    EXECUTE format('GRANT USAGE ON SCHEMA %I TO desi_nexus_app, desi_nexus_system', target);

    /*
     * SELECT, INSERT and UPDATE arrive through the default privileges 003 and
     * 004 set for tables created later, but they are granted explicitly here
     * too. Default privileges apply only to tables created by the role that
     * set them; if this migration is ever applied by a different owner they
     * silently do not, and the failure shows up as a permission denied in
     * production rather than here.
     */
    EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE ON %I.crew_event_links TO desi_nexus_app, desi_nexus_system',
        target);

    /*
     * DELETE for BOTH roles, because saving a profile replaces its links: the
     * store deletes this user's rows and re-inserts them, the same shape it
     * uses for crew_specialty_links and crew_cultural_tags -- both of which
     * grant DELETE to the application role (003).
     *
     * This originally granted DELETE to the system role only and REVOKED it
     * from the application role, on the reasoning that the save ran as system
     * and the narrower credential was safer. The save does not run as system:
     * a vendor editing their own profile is a user request, routed through
     * `app.asUser`. So every profile save failed with "permission denied for
     * table crew_event_links". 009 grants it for databases that already ran
     * this; this block is corrected so a re-run -- 007 is documented as safe
     * to re-run -- does not revoke it again.
     *
     * What this does NOT do is widen anything. Like crew_specialty_links and
     * crew_cultural_tags, this table has no row-level security: the scoping to
     * one vendor's rows is enforced by the application (the store deletes
     * `WHERE user_id = $1`, the acting user), not by the database. Granting
     * DELETE brings it level with its siblings -- the same trust, no more.
     */
    EXECUTE format('GRANT DELETE ON %I.crew_event_links TO desi_nexus_app, desi_nexus_system', target);
END
$$;
