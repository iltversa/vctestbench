CREATE TABLE "predefined_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_class_id" uuid NOT NULL,
	"title" text NOT NULL,
	"action_timeout" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "predefined_actions" ADD CONSTRAINT "predefined_actions_test_class_id_test_classes_id_fk" FOREIGN KEY ("test_class_id") REFERENCES "public"."test_classes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "predefined_actions" ("test_class_id", "title", "action_timeout", "created_at") 
SELECT "id", 'DELAY', 120000, now() FROM "test_classes";
