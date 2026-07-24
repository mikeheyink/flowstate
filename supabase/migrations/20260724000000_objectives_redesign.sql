-- Objectives redesign: Eisenhower quad + Objectives + habit "why".
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Run this BEFORE deploying the redesign app build. Idempotent — safe to re-run.

-- ============================================================================
-- 1. Eisenhower quad on tasks
--    urgent / important are manual booleans (independent of due date);
--    quad_order is the manual position within the current quadrant.
--    The legacy important_order / today_order columns are kept (not dropped)
--    but the app no longer reads or writes them after this migration.
-- ============================================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS urgent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS important BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS quad_order DOUBLE PRECISION;

-- Backfill: the old Important list becomes important=true, preserving its
-- manual order (scaled *1000 to leave insertion gaps); the old Today order
-- seeds everyone else's quadrant position. Only touches untouched rows.
UPDATE tasks
SET important = TRUE
WHERE important = FALSE AND important_order IS NOT NULL;

UPDATE tasks
SET quad_order = COALESCE(important_order * 1000, today_order)
WHERE quad_order IS NULL
  AND (important_order IS NOT NULL OR today_order IS NOT NULL);

-- ============================================================================
-- 2. Objectives — the five life objectives; calm, read-mostly, owner-scoped.
-- ============================================================================

CREATE TABLE IF NOT EXISTS objectives (
  id VARCHAR(9) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  color VARCHAR(9) NOT NULL DEFAULT '#6674E4', -- hex, drives the app-wide accent for this objective
  "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  archived_at BIGINT,
  created_at_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS objectives_user_id_idx ON objectives(user_id);

ALTER TABLE objectives ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objectives' AND policyname = 'objectives_select_own') THEN
    CREATE POLICY objectives_select_own ON objectives FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objectives' AND policyname = 'objectives_insert_own') THEN
    CREATE POLICY objectives_insert_own ON objectives FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objectives' AND policyname = 'objectives_update_own') THEN
    CREATE POLICY objectives_update_own ON objectives FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objectives' AND policyname = 'objectives_delete_own') THEN
    CREATE POLICY objectives_delete_own ON objectives FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 3. Habits: optional link to an objective + a one-line "why"
--    (No FK to objectives: habits/objectives sync independently offline-first,
--    and an orphaned objective_id renders as "no objective" harmlessly.)
-- ============================================================================

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS objective_id VARCHAR(9);
ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS why TEXT;

-- 4. Verify.
SELECT
  (SELECT count(*) FROM tasks WHERE important) AS important_tasks,
  (SELECT count(*) FROM tasks WHERE quad_order IS NOT NULL) AS placed_tasks,
  (SELECT count(*) FROM objectives) AS objectives;
