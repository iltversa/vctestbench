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
  pasteText: text("pasteText"),
  email: text("email"),
  password: text("password"),
  icon: text("icon"),
  clickOnText: text("clickOnText"),
});
