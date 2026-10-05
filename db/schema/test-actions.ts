import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
} from "drizzle-orm/pg-core";


export const testActions = pgTable("test_actions", {
  id: uuid("id").defaultRandom().primaryKey(),

  title: text("title").notNull(),
  hasConfirmation: boolean("has_confirmation").notNull().default(false),
  confirmationTimeout: integer("confirmation_timeout"),
  actionTimeout: integer("action_timeout").notNull(),
  pasteText: text("paste_text"),
  sortOrder: integer("sort_order").notNull().default(0),
});
