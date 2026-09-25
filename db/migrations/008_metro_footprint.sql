-- ---------------------------------------------------------------------------
-- 008: the footprint becomes three states
--
-- Texas narrows to the four metros actually served -- Dallas-Fort Worth,
-- Greater Houston, Austin and San Antonio -- and North Carolina and California
-- are added.
--
-- The four dropped Texas metros are DEACTIVATED, not deleted.
--
-- `users.metro_code` and `gigs.metro_code` both reference metros(code) with no
-- ON DELETE clause, so a DELETE either fails outright on the first row that
-- points at it or, worse, succeeds today on empty tables and starts failing in
-- production the day somebody in El Paso has an account. `enquiries.metro_code`
-- would silently null. Deactivating keeps every existing reference resolvable
-- and readable: a gig in Lubbock still says Lubbock, it simply cannot be
-- created any more.
--
-- is_active has existed since 001 and nothing has ever read it. This is what it
-- was for, and 008 is where it starts being enforced -- both here and in the
-- service, which now filters on it rather than assuming every seeded row is
-- live.
-- ---------------------------------------------------------------------------

INSERT INTO metros (code, name, center, radius_miles, is_active) VALUES
    -- North Carolina. The Triangle first: Cary and Morrisville sit among the
    -- highest-density Indian-American populations in the country.
    ('rdu', 'Raleigh-Durham', ST_MakePoint(-78.78, 35.86)::geography, 35, TRUE),
    ('clt', 'Charlotte',      ST_MakePoint(-80.83, 35.15)::geography, 35, TRUE),
    ('gso', 'Greensboro',     ST_MakePoint(-79.82, 36.07)::geography, 30, TRUE),

    -- California. One Bay Area rather than San Francisco and San Jose apart:
    -- 45 miles from Hayward reaches both, and splitting them would put Fremont
    -- on the boundary between two pages. The travel quote is computed from the
    -- venue's real coordinates regardless, so the merge costs precision in the
    -- label and not in anyone's fee.
    ('bay', 'Bay Area',       ST_MakePoint(-122.10, 37.55)::geography, 45, TRUE),
    ('lax', 'Los Angeles',    ST_MakePoint(-118.24, 34.05)::geography, 50, TRUE),
    ('sd',  'San Diego',      ST_MakePoint(-117.15, 32.83)::geography, 30, TRUE)
ON CONFLICT (code) DO UPDATE SET
    -- Re-running must converge rather than skip. DO NOTHING would leave a row
    -- seeded with the wrong centre wrong for ever, and 002 already uses DO
    -- NOTHING, so a correction applied there alone would never take effect.
    name         = EXCLUDED.name,
    center       = EXCLUDED.center,
    radius_miles = EXCLUDED.radius_miles,
    is_active    = EXCLUDED.is_active;

-- No longer served. The rows stay so their foreign keys stay valid.
UPDATE metros SET is_active = FALSE WHERE code IN ('elp', 'rgv', 'cc', 'lbb');
