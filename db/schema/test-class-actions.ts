import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

import { testClasses } from "./test-classes";

export const testClassActions = pgTable(
  "test_class_actions",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    testClassId: uuid("test_class_id")
      .notNull()
      .references(() => testClasses.id, {
        onDelete: "cascade",
      }),

    action: varchar("action", {
      length: 100,
    }).notNull(),

    sortOrder: integer("sort_order")
      .notNull()
      .default(0),

    createdAt: timestamp("created_at")
      .defaultNow()
      .notNull(),
  }
);