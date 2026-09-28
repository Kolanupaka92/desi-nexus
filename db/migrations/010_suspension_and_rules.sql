-- ---------------------------------------------------------------------------
-- 010: the marketplace rule, and removing people who break it
--
-- The rule: a client or vendor met through Utsav is not taken off the
-- platform to avoid it. Anyone who does is suspended.
--
-- Two halves, because a rule nobody agreed to cannot fairly be enforced, and a
-- rule with no way to enforce it is only words:
--
--   rules_accepted_at / rules_version -- when each account agreed, and to which
--     text. The version is kept because the rules will change; "they agreed"
--     has to mean "they agreed to the version that was in force".
--
--   suspension_reason / suspended_by -- why an account was removed and by whom.
--     suspended_at has existed since 001 and already blocks sign-in and session
--     refresh, but nothing could set it and nothing recorded why. A person told
--     only "your account is suspended" cannot answer the accusation; an
--     administrator reviewing an appeal needs the original reason.
--
-- SUSPENDED, NOT DELETED. The request was to "delete them from the app", and
-- to the people using the app a suspended account is gone: it cannot sign in,
-- its profile and listings disappear, it cannot be booked. But the row stays.
-- 003 deliberately withholds DELETE on users from the application role -- a
-- user's gigs, bookings, reviews and ledger entries reference that row, and
-- the ledger in particular is a financial record that must outlive a ban. A
-- suspension is also reversible, which a wrongful removal needs to be.
--
-- Re-runnable, and without a BEGIN/COMMIT of its own, like 007-009: the
-- runbook's --single-transaction is what makes it atomic.
-- ---------------------------------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_by      UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS rules_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rules_version     TEXT;

DO $$
BEGIN
    /*
     * A suspension must say why. Enforced here rather than trusted to the
     * service, because this is the column an appeal is decided on, and a
     * blank one is indistinguishable from a removal nobody can justify.
     *
     * The explicit IS NOT NULL is load-bearing. A CHECK passes when its
     * expression is NULL, not only when it is true -- and length(btrim(NULL))
     * is NULL, so `suspended_at IS NULL OR length(...) > 0` would have let a
     * suspension with no reason at all straight through: the one case this
     * exists to stop.
     *
     * Existing rows all have suspended_at NULL, so this holds immediately.
     * Added by catching the duplicate so a re-run is harmless.
     */
    BEGIN
        ALTER TABLE users ADD CONSTRAINT users_suspension_has_reason
            CHECK (suspended_at IS NULL
                   OR (suspension_reason IS NOT NULL AND length(btrim(suspension_reason)) > 0));
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END
$$;
