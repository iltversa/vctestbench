import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

import { testClasses } from "./test-classes";

export const predefinedActions = pgTable("predefined_actions", {
  id: uuid("id")
    .defaultRandom()
    .primaryKey(),

  testClassId: uuid("test_class_id")
    .notNull()
    .references(() => testClasses.id, {
      onDelete: "cascade",
    }),

  title: text("title").notNull(),
  actionTimeout: integer("action_timeout").notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});
