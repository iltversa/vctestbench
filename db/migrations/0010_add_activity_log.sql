-- A record of flows being created, changed and deleted, for the activity view.
CREATE TABLE IF NOT EXISTS "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"test_id" uuid,
	"title" text NOT NULL,
	"detail" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_log_at_idx" ON "activity_log" ("at" DESC);
