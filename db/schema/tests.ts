// db/schema/tests.ts

import {
  pgTable,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const tests = pgTable("tests", {
  id: uuid("id")
    .defaultRandom()
    .primaryKey(),

  title: text("title")
    .notNull(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull(),
});