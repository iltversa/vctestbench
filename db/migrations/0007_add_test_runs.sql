-- Run reports: one row per executed run, with a record for every step.
CREATE TABLE IF NOT EXISTS "test_runs" (
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
	"screenshot" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "test_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_test_id_idx" ON "test_runs" ("test_id", "started_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_runs_started_at_idx" ON "test_runs" ("started_at" DESC);
