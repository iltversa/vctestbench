CREATE TABLE "confirmation_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"value" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" uuid NOT NULL,
	"title" text NOT NULL,
	"action" text NOT NULL,
	"custom_action" text,
	"has_confirmation" boolean DEFAULT false NOT NULL,
	"confirmation_timeout" integer,
	"action_timeout" integer NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "confirmation_options" ADD CONSTRAINT "confirmation_options_action_id_test_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."test_actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_actions" ADD CONSTRAINT "test_actions_test_id_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."tests"("id") ON DELETE cascade ON UPDATE no action;