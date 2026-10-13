-- A step now keeps two pictures: just before the action and when it ended.
-- Existing pictures were taken when the step ended, which is the default.
ALTER TABLE "run_step_images"
  ADD COLUMN IF NOT EXISTS "phase" text DEFAULT 'after' NOT NULL;
--> statement-breakpoint
ALTER TABLE "run_step_images" DROP CONSTRAINT IF EXISTS "run_step_images_run_step_unique";
--> statement-breakpoint
ALTER TABLE "run_step_images" DROP CONSTRAINT IF EXISTS "run_step_images_run_step_phase_unique";
--> statement-breakpoint
ALTER TABLE "run_step_images"
  ADD CONSTRAINT "run_step_images_run_step_phase_unique" UNIQUE ("run_id", "step_index", "phase");
