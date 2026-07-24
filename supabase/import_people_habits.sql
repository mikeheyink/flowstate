-- Import Mike's three "people" habits (company / leadership focus), linked to
-- the "Elite performance at Yellow" objective, with rich hover detail.
--
-- Run in: Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Run AFTER 20260724000000_objectives_redesign.sql and 20260725000000_objectives_polish.sql.
-- Idempotent: ON CONFLICT (id) DO NOTHING, so re-running is safe.

-- Defensive: make sure the columns exist even if run before the migrations.
ALTER TABLE habits ADD COLUMN IF NOT EXISTS why TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS objective_ids TEXT[] NOT NULL DEFAULT '{}';

DO $$
DECLARE
  uid   UUID;
  ts    BIGINT := (extract(epoch from now()) * 1000)::bigint;
  wk    VARCHAR(8) := to_char(now(), 'IYYY"-W"IW');   -- current ISO week, e.g. 2026-W30
  ord   DOUBLE PRECISION;
  yellow TEXT[];   -- objective_ids for "Elite performance at Yellow" (empty if not found)
BEGIN
  -- Resolve the owner. The repo's other import used mike@yellow.africa; the
  -- account may be mike.heyink@yellow.africa — accept either.
  SELECT id INTO uid FROM auth.users
    WHERE email IN ('mike.heyink@yellow.africa', 'mike@yellow.africa')
    ORDER BY created_at LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No matching auth user — sign in to prod once, then re-run.';
  END IF;

  SELECT coalesce(max("order"), 0) INTO ord FROM habits WHERE user_id = uid;
  SELECT coalesce(array_remove(array_agg(id), NULL), '{}')
    INTO yellow
    FROM objectives
    WHERE user_id = uid AND title = 'Elite performance at Yellow' AND archived_at IS NULL;

  INSERT INTO habits (id, user_id, title, type, created_at, archived_at, "order", applies_from_week, applies_until_week, days_of_week, objective_ids, why) VALUES
    (
      'h_enlmtg', uid, 'Enlightened Meetings', 'do', ts, NULL, ord + 1, wk, NULL, '{0,1,2,3,4}', yellow,
      $why$In every meeting today I:
- Was on time; was fully in or out (fixed the workshop plan); was 100% present.
- Didn't criticise, deflate or undermine; asked questions; gave feedback after (not during); spoke less and later; made it fun.
- Offered to help rather than told people what to do — took a patient, longer-term view; built the team; empowered and energised people.$why$
    ),
    (
      'h_offhelp', uid, 'Offered to Help, Not Told What to Do', 'do', ts, NULL, ord + 2, wk, NULL, '{0}', yellow,
      $why$I proactively extended offers to help people achieve what **they** are trying to achieve — rather than telling them what to do.$why$
    ),
    (
      'h_recog', uid, 'Proactive Recognition', 'do', ts, NULL, ord + 3, wk, NULL, '{2,4}', yellow,
      $why$I actively and specifically recognised people and expressed genuine gratitude — until it becomes habitual.$why$
    )
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Verify.
SELECT title, days_of_week, objective_ids, left(why, 40) AS why_preview
FROM habits
WHERE id IN ('h_enlmtg', 'h_offhelp', 'h_recog');
