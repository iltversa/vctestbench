// db/schema/test-actions.ts

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

import { tests } from "./tests";

export const testActions = pgTable("test_actions", {
  id: uuid("id")
    .defaultRandom()
    .primaryKey(),

  testId: uuid("test_id")
    .notNull()
    .references(() => tests.id, {
      onDelete: "cascade",
    }),

  title: text("title")
    .notNull(),

  action: text("action")
    .notNull(),

  customAction: text("custom_action"),

  hasConfirmation: boolean("has_confirmation")
    .default(false)
    .notNull(),

  confirmationTimeout: integer("confirmation_timeout"),

  actionTimeout: integer("action_timeout")
    .notNull(),

  sortOrder: integer("sort_order")
    .notNull(),
});