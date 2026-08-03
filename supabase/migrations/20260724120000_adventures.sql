-- Adventure: a calm page for adventures lined up on the calendar + seeds of
-- future ones. Owner-scoped, offline-first (same shape as objectives).
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Idempotent — safe to re-run.

-- ============================================================================
-- 1. Adventure categories — a small, editable palette (Travel, Outdoors, …).
--    Seeded client-side with stable slug ids so adventures can reference them.
-- ============================================================================

CREATE TABLE IF NOT EXISTS adventure_categories (
  id VARCHAR(9) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label VARCHAR(255) NOT NULL,
  color VARCHAR(9) NOT NULL DEFAULT '#8B5CF6',
  "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  archived_at BIGINT
);

CREATE INDEX IF NOT EXISTS adventure_categories_user_id_idx ON adventure_categories(user_id);

ALTER TABLE adventure_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'adventure_categories' AND policyname = 'adv_cat_select_own') THEN
    CREATE POLICY adv_cat_select_own ON adventure_categories FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'adventure_categories' AND policyname = 'adv_cat_insert_own') THEN
    CREATE POLICY adv_cat_insert_own ON adventure_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'adventure_categories' AND policyname = 'adv_cat_update_own') THEN
    CREATE POLICY adv_cat_update_own ON adventure_categories FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'adventure_categories' AND policyname = 'adv_cat_delete_own') THEN
    CREATE POLICY adv_cat_delete_own ON adventure_categories FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 2. Adventures — Seed → Scheduled → Lived.
--    date IS NULL   → a seed (someday, undated)
--    date in future → scheduled (shown on the Horizon)
--    lived = TRUE, or date in the past → Looking Back (the memory log)
--    external_event_id is reserved for a future Google Calendar sync — nullable
--    now so that sync can be layered on without another migration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS adventures (
  id VARCHAR(9) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  category_id VARCHAR(9),          -- soft ref to adventure_categories.id (no FK: independent offline sync)
  date BIGINT,                     -- epoch ms of the scheduled day; NULL = seed
  lived BOOLEAN NOT NULL DEFAULT FALSE,
  external_event_id VARCHAR(255),  -- reserved: future Google Calendar event id
  "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL,
  archived_at BIGINT
);

CREATE INDEX IF NOT EXISTS adventures_user_id_idx ON adventures(user_id);

ALTER TABLE adventures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'adventures' AND policyname = 'adventures_select_own') THEN
    CREATE POLICY adventures_select_own ON adventures FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'adventures' AND policyname = 'adventures_insert_own') THEN
    CREATE POLICY adventures_insert_own ON adventures FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'adventures' AND policyname = 'adventures_update_own') THEN
    CREATE POLICY adventures_update_own ON adventures FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'adventures' AND policyname = 'adventures_delete_own') THEN
    CREATE POLICY adventures_delete_own ON adventures FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Verify.
SELECT
  (SELECT count(*) FROM adventures) AS adventures,
  (SELECT count(*) FROM adventure_categories) AS categories;
