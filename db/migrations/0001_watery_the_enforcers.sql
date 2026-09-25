CREATE TABLE "test_class_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_class_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "test_classes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "test_class_actions" ADD CONSTRAINT "test_class_actions_test_class_id_test_classes_id_fk" FOREIGN KEY ("test_class_id") REFERENCES "public"."test_classes"("id") ON DELETE cascade ON UPDATE no action;