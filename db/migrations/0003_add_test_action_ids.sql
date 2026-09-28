ALTER TABLE "tests"
  ADD COLUMN IF NOT EXISTS "action_ids" text[] NOT NULL DEFAULT '{}';
