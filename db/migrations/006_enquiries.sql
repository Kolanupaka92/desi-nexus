-- Enquiries: the way somebody who is not a user reaches the business.
--
-- Until now the only route in was "post a brief", which requires registering
-- an account, verifying a phone and filling in a structured gig. That is the
-- right flow for somebody ready to book. It is the wrong -- and only -- flow
-- for a visitor who arrived from a WhatsApp link, has a date and a question,
-- and wants to talk to a person first. For a business whose customers arrive
-- from a family group chat, "sign up to ask a question" is the funnel closing
-- on itself.
--
-- An enquiry is therefore not a gig and not a user. It is a message with
-- enough structure to route it: who, how to reach them, what kind of function,
-- roughly when, and roughly where.
BEGIN;

CREATE TABLE enquiries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Contact. Deliberately loose: a person filling in a form on a phone is
    -- not a record being reconciled, and a CHECK that rejects a real name with
    -- a hyphen or a real address with a plus costs a lead. The service
    -- validates shape; this validates only that something is there.
    name          TEXT        NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
    -- citext, so the same address typed with different capitalisation groups
    -- together when somebody looks these up. NOT unique: one person may
    -- enquire about two functions, and deduplicating their second message into
    -- silence is worse than two rows.
    email         CITEXT      NOT NULL CHECK (position('@' IN email) > 1),
    phone         TEXT        CHECK (phone IS NULL OR length(trim(phone)) BETWEEN 7 AND 32),

    -- What they are planning. event_type references the taxonomy when it is one
    -- of ours, and is NULL when they picked "something else" -- which is a real
    -- answer and must not be forced into the nearest wrong code.
    event_type    TEXT        REFERENCES event_types(code) ON DELETE SET NULL,
    -- A date, not a timestamp: nobody planning a wedding knows the hour yet,
    -- and half of them do not yet know the day either, hence nullable.
    event_date    DATE,
    -- `metro_code`, matching users and gigs: metros are keyed by their code.
    metro_code    TEXT        REFERENCES metros(code) ON DELETE SET NULL,

    message       TEXT        NOT NULL CHECK (length(trim(message)) BETWEEN 10 AND 4000),

    -- Which page the form was on. Plain text rather than a foreign key: it is
    -- attribution, and a path that no longer exists should not stop an enquiry
    -- being recorded.
    source        TEXT        CHECK (source IS NULL OR length(source) <= 200),

    -- Ops state. An enquiry that nobody can mark as handled becomes a list
    -- everybody re-reads, so the states are the ones a person actually moves
    -- it through rather than a workflow engine.
    status        TEXT        NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'contacted', 'converted', 'spam', 'closed')),

    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER enquiries_touch BEFORE UPDATE ON enquiries
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- The list is read newest-first and almost always filtered to the ones nobody
-- has picked up yet.
CREATE INDEX enquiries_triage_idx ON enquiries (status, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
--
-- This table is the one place on the platform holding the contact details of
-- people who never agreed to be users. It is also, for a marketplace, the most
-- obviously valuable thing to steal: a list of names, phone numbers and event
-- dates is a competitor's cold-call sheet.
--
-- So the application role gets INSERT and nothing else. There is no session,
-- no role and no bug in a route that can turn into a SELECT over this table,
-- because the privilege to read it is not attached to the credential the API
-- uses. Reading is the system role's, which is the connection the webhook and
-- the sweep use and whose password is issued separately.
--
-- That is why there is no GET /v1/enquiries on the application connection. An
-- endpoint listing leads is exactly the endpoint an attacker wants, and the
-- honest place for that list is an ops surface authenticating differently.
--
-- One consequence worth stating, because it looks like an oversight: the
-- service supplies the row's id rather than reading it back, and the insert
-- has no RETURNING clause. `INSERT ... RETURNING` needs SELECT privilege on
-- the columns it returns, so a RETURNING here would have forced a SELECT grant
-- and undone the whole arrangement for the sake of one uuid the caller could
-- just as well generate.
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
-- Also FORCE, so the exemption the table owner would otherwise enjoy does not
-- quietly reopen it during a migration run or a psql session as the owner.
ALTER TABLE enquiries FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
    target text := current_schema();
BEGIN
    -- Both roles are ensured here rather than assumed.
    --
    -- In a production run 003 and 004 have already created them, so these are
    -- no-ops. They are not no-ops everywhere: the test harness applies the
    -- schema migrations (001, 002, 005, 006) and only afterwards applies 003
    -- and 004, because exercising those two is a different file's job. Written
    -- with IF EXISTS guards instead, this migration quietly skipped its own
    -- grants and its own policy in that order and left the table row-level
    -- secured with no policy reaching anybody -- which the RLS suite's
    -- "every RLS table has a policy for every command" invariant caught, and
    -- which a developer whose cluster already had the roles would not have
    -- seen locally.
    --
    -- Created by catching the duplicate rather than checking first, as in 003
    -- and 004: parallel test files apply these migrations concurrently, and
    -- check-then-create loses that race intermittently. No password, also as
    -- in 003 and 004: it is issued and rotated out of band.
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

    -- 003 grants the app role SELECT, INSERT and UPDATE on every table in the
    -- schema, and its default privileges extend that to tables created later --
    -- which includes this one. Revoking here rather than relying on the policy
    -- alone means the restriction holds at the privilege layer too, where it
    -- does not depend on a policy being written correctly.
    EXECUTE format('GRANT INSERT ON %I.enquiries TO desi_nexus_app', target);
    EXECUTE format('REVOKE SELECT, UPDATE, DELETE ON %I.enquiries FROM desi_nexus_app', target);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I.enquiries TO desi_nexus_system', target);
END
$$;

-- Anyone may leave one. The form is public by design: that is the point of it.
DROP POLICY IF EXISTS enquiries_insert_public ON enquiries;
CREATE POLICY enquiries_insert_public ON enquiries
    FOR INSERT
    WITH CHECK (true);

-- Reading and triaging belong to the system connection alone. Scoped with TO
-- rather than granted as BYPASSRLS, for the reason 004 gives: a role attribute
-- only a superuser can grant is not available on managed Postgres, and a
-- policy naming the role is visible to a reviewer.
--
-- Unconditional: the DO block above guarantees the role exists whatever order
-- the migrations ran in. This policy is also what satisfies the RLS suite's
-- invariant that every row-level-secured table carries a policy for every
-- command the service runs -- FOR ALL counts as one. It does not widen
-- anything for the application: the policy is scoped TO desi_nexus_system, so
-- a SELECT by desi_nexus_app still matches no policy and returns no rows.
DROP POLICY IF EXISTS enquiries_system_access ON enquiries;
CREATE POLICY enquiries_system_access ON enquiries
    FOR ALL
    TO desi_nexus_system
    USING (true)
    WITH CHECK (true);

COMMIT;
