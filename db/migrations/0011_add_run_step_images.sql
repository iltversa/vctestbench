-- A small picture of the tablet for every step of a run, for the report.
CREATE TABLE IF NOT EXISTS "run_step_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"step_index" integer NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_step_images_run_step_unique" UNIQUE("run_id", "step_index")
);
