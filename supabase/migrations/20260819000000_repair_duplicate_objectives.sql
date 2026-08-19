-- Repair: collapse double-seeded objectives.
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Idempotent — safe to re-run. Reversible — it soft-deletes, nothing is lost.
--
-- Background: older builds seeded the five default objectives with random ids,
-- so a second device (or a cleared browser) seeded a second set beside the
-- first and the page showed each objective twice. The app now sweeps these on
-- its own; this script does the same thing server-side, immediately, for an
-- account that is already doubled.

-- ── 1. Preview — what is doubled, and what would go. Read this first. ───────
WITH ranked AS (
  SELECT id, title, created_at, body,
         ROW_NUMBER() OVER (PARTITION BY user_id, title ORDER BY created_at DESC) AS rn,
         COUNT(*)     OVER (PARTITION BY user_id, title)                         AS copies
  FROM objectives
  WHERE archived_at IS NULL
)
SELECT
  title,
  copies,
  CASE WHEN rn = 1 THEN 'KEEP' ELSE 'ARCHIVE' END AS verdict,
  created_at,
  left(body, 80) AS body_preview
FROM ranked
WHERE copies > 1
ORDER BY title, rn;

-- ── 2. Archive every copy but the most recent one of each title. ───────────
-- Only touches titles that genuinely have more than one live row; a title with
-- a single objective is never affected.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, title ORDER BY created_at DESC) AS rn,
         COUNT(*)     OVER (PARTITION BY user_id, title)                          AS copies
  FROM objectives
  WHERE archived_at IS NULL
)
UPDATE objectives o
SET archived_at = (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT
FROM ranked r
WHERE o.id = r.id
  AND r.copies > 1
  AND r.rn > 1;

-- ── 3. Verify — one row per title, and nothing lost. ───────────────────────
SELECT
  (SELECT count(*) FROM objectives WHERE archived_at IS NULL)                       AS live_objectives,
  (SELECT count(DISTINCT title) FROM objectives WHERE archived_at IS NULL)          AS distinct_titles,
  (SELECT count(*) FROM objectives WHERE archived_at IS NOT NULL)                   AS archived_objectives;

-- ── Undo, if a wrong copy was kept ─────────────────────────────────────────
-- Nothing is deleted; to bring a row back, clear its archived_at:
--   UPDATE objectives SET archived_at = NULL WHERE id = '<id>';
