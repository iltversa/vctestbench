-- The activity log of a run: what happened, in order, with timestamps.
ALTER TABLE "test_runs"
  ADD COLUMN IF NOT EXISTS "log" jsonb DEFAULT '[]'::jsonb NOT NULL;
