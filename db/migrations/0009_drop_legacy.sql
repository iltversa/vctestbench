-- Removes tables and columns nothing reads or writes any more.
--
-- OPTIONAL and destructive: it deletes the data in them. The app works the same
-- with or without this migration, so skip it if you want to keep that data.
--
--   test_classes / test_class_actions / predefined_actions   an early model
--     in which actions belonged to a "test class"; replaced by the flow tree
--   test_actions.test_id / action / custom_action / sort_order   columns from
--     the model in which a test owned a list of actions
--   tests.action_ids                                         same
--   confirmation_options.sort_order                          same

DROP TABLE IF EXISTS "predefined_actions";
--> statement-breakpoint
DROP TABLE IF EXISTS "test_class_actions";
--> statement-breakpoint
DROP TABLE IF EXISTS "test_classes";
--> statement-breakpoint
ALTER TABLE "test_actions" DROP COLUMN IF EXISTS "test_id";
--> statement-breakpoint
ALTER TABLE "test_actions" DROP COLUMN IF EXISTS "action";
--> statement-breakpoint
ALTER TABLE "test_actions" DROP COLUMN IF EXISTS "custom_action";
--> statement-breakpoint
ALTER TABLE "test_actions" DROP COLUMN IF EXISTS "sort_order";
--> statement-breakpoint
ALTER TABLE "tests" DROP COLUMN IF EXISTS "action_ids";
--> statement-breakpoint
ALTER TABLE "confirmation_options" DROP COLUMN IF EXISTS "sort_order";
