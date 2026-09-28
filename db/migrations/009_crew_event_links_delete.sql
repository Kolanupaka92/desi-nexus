-- ---------------------------------------------------------------------------
-- 009: the application role may delete a vendor's event history
--
-- Saving a crew profile replaces the vendor's event history: the store runs
-- `DELETE FROM crew_event_links WHERE user_id = $1` and re-inserts the list,
-- exactly as it does for crew_specialty_links and crew_cultural_tags. It does
-- this on the APPLICATION role, because a vendor editing their own profile is
-- a user request, and db.ts routes those through `app.asUser`.
--
-- 007 granted DELETE on this table to the system role only, reasoning that the
-- save ran as system. It does not. So every vendor profile save failed:
--
--     permission denied for table crew_event_links
--
-- which meant no vendor could ever create a profile -- the whole supply side of
-- the marketplace, dead on arrival. Its two sibling link tables have always
-- granted DELETE to the application role (003); this one simply did not match
-- them, despite 007's own comment claiming it had "the same shape".
--
-- Nothing caught it. The unit and integration suites connect as a superuser,
-- which no grant can refuse, and the privileges test that checks exactly this
-- for the sibling tables was never extended to the new one. It surfaced only
-- when the booking flow was driven end to end, in a browser, against a database
-- built by the deployment runbook and reached as the restricted role.
--
-- A new migration rather than an edit to 007 alone: any database that already
-- has 007 will not re-run it -- the runbook applies only what follows -- so only
-- a later migration reaches it. 007 is corrected too, because it is documented
-- as safe to re-run, and as written a re-run would have revoked this grant.
--
-- Not self-wrapping (no BEGIN/COMMIT of its own), like 007 and 008: the
-- runbook's --single-transaction is what makes it atomic.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    target text := current_schema();
BEGIN
    -- Ensured rather than assumed, for the reason 006 and 007 document: the
    -- test harness applies schema migrations before 003/004, so on a fresh
    -- cluster the roles may not exist yet. Created by catching the duplicate,
    -- not by checking first -- parallel test files race on check-then-create.
    BEGIN
        CREATE ROLE desi_nexus_app LOGIN;
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

    -- GRANT is idempotent, so this is safe to re-run.
    EXECUTE format('GRANT DELETE ON %I.crew_event_links TO desi_nexus_app', target);
END
$$;
