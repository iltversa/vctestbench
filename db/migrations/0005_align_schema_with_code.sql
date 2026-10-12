-- Brings a database built from 0000-0004 in line with db/schema/*.
-- Non-destructive: legacy columns are kept but no longer required.

ALTER TABLE "tests"
  ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "tests"
  ADD COLUMN IF NOT EXISTS "flow" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "test_actions" ALTER COLUMN "test_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_actions" ALTER COLUMN "action" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_actions" ALTER COLUMN "sort_order" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "test_actions" ADD COLUMN IF NOT EXISTS "email" text;
--> statement-breakpoint
ALTER TABLE "test_actions" ADD COLUMN IF NOT EXISTS "password" text;
--> statement-breakpoint
ALTER TABLE "test_actions" ADD COLUMN IF NOT EXISTS "icon" text;
--> statement-breakpoint
ALTER TABLE "test_actions" ADD COLUMN IF NOT EXISTS "clickOnText" text;
--> statement-breakpoint
ALTER TABLE "confirmation_options" ALTER COLUMN "sort_order" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "confirmation_options"
  ADD COLUMN IF NOT EXISTS "isSelected" boolean DEFAULT false;
