-- Three-state habit outcomes: add `status` (pending | done | failed) to habit_logs.
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Run this BEFORE deploying the three-state app build. Idempotent — safe to re-run.
--
-- The legacy `completed BOOLEAN` column is kept and still written by the app
-- (completed = (status = 'done')) for backward compatibility.

-- 1. Add the column (defaults every existing row to 'pending').
ALTER TABLE habit_logs
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- 2. Constrain to the three valid values (guarded so re-runs don't error).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'habit_logs_status_check'
  ) THEN
    ALTER TABLE habit_logs
      ADD CONSTRAINT habit_logs_status_check CHECK (status IN ('pending', 'done', 'failed'));
  END IF;
END $$;

-- 3. Backfill from the legacy boolean. Only touches rows still at the default,
--    so existing 'done'/'failed'/intentional-'pending' rows are never clobbered.
UPDATE habit_logs
SET status = CASE WHEN completed THEN 'done' ELSE 'pending' END
WHERE status = 'pending';

-- 4. Verify.
SELECT status, count(*) FROM habit_logs GROUP BY status ORDER BY status;
