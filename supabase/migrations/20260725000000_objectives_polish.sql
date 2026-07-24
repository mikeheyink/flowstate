-- Objectives polish: multi-select habit objectives + objective essence line.
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Run BEFORE deploying this build. Idempotent — safe to re-run. Assumes the
-- prior migration (20260724000000_objectives_redesign.sql) has been applied.

-- ── 1. Habits: single objective_id → objective_ids array (multi-select) ──────
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS objective_ids TEXT[] NOT NULL DEFAULT '{}';

-- Backfill the array from the legacy single column (only where empty).
UPDATE habits
SET objective_ids = ARRAY[objective_id]
WHERE objective_id IS NOT NULL
  AND (objective_ids IS NULL OR cardinality(objective_ids) = 0);

-- ── 2. Objectives: add the always-visible essence line ───────────────────────
ALTER TABLE objectives
  ADD COLUMN IF NOT EXISTS essence TEXT NOT NULL DEFAULT '';

-- Optional convenience: seed essences onto the five default objectives IF they
-- still have none (matched by title; never overwrites an edited essence, never
-- touches body). If you renamed an objective it simply won't match — no harm.
UPDATE objectives SET essence = 'Accept each moment as it is.'
  WHERE essence = '' AND title = 'Peace';
UPDATE objectives SET essence = 'Show up fully for the people in my life.'
  WHERE essence = '' AND title = 'Love';
UPDATE objectives SET essence = 'Build a body ready for adventure.'
  WHERE essence = '' AND title = 'Health & Strength';
UPDATE objectives SET essence = 'Elite performance — through others.'
  WHERE essence = '' AND title = 'Elite performance at Yellow';
UPDATE objectives SET essence = 'Be a kid — plan something every day.'
  WHERE essence = '' AND title = 'Adventure';

-- 3. Verify.
SELECT
  (SELECT count(*) FROM habits WHERE cardinality(objective_ids) > 0) AS habits_with_objective,
  (SELECT count(*) FROM objectives WHERE essence <> '') AS objectives_with_essence;
