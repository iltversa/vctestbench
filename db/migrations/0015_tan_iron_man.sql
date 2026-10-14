CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"test_id" uuid,
	"title" text NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE TABLE "test_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"test_id" uuid,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"error" text,
	"failed_step" integer,
	"step_delay_seconds" integer,
	"device" jsonb,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"screenshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "run_step_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"step_index" integer NOT NULL,
	"phase" text DEFAULT 'after' NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_step_images_run_step_phase_unique" UNIQUE("run_id","step_index","phase")
);
--> statement-breakpoint
ALTER TABLE "test_class_actions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "test_classes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "test_class_actions" CASCADE;--> statement-breakpoint
DROP TABLE "test_classes" CASCADE;--> statement-breakpoint
ALTER TABLE "test_actions" DROP CONSTRAINT "test_actions_test_id_tests_id_fk";
--> statement-breakpoint
ALTER TABLE "confirmation_options" ADD COLUMN "isSelected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "description" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "flow" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "test_actions" ADD COLUMN "pasteText" text;--> statement-breakpoint
ALTER TABLE "test_actions" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "test_actions" ADD COLUMN "password" text;--> statement-breakpoint
ALTER TABLE "test_actions" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "test_actions" ADD COLUMN "clickOnText" text;--> statement-breakpoint
ALTER TABLE "confirmation_options" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "test_actions" DROP COLUMN "test_id";--> statement-breakpoint
ALTER TABLE "test_actions" DROP COLUMN "action";--> statement-breakpoint
ALTER TABLE "test_actions" DROP COLUMN "custom_action";--> statement-breakpoint
ALTER TABLE "test_actions" DROP COLUMN "sort_order";