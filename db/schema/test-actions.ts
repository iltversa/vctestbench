import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

// import { tests } from "./tests";
import { testClasses } from "./test-classes";

export const testActions = pgTable("test_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  testClassId: uuid("test_class_id").notNull().references(() => testClasses.id, {   onDelete: "restrict" }),
  title: text("title").notNull(),
// testId: uuid("test_id")
//     // .notNull()
//     .references(() => tests.id, {
//       onDelete: "cascade",
//     }),
  hasConfirmation: boolean("has_confirmation").notNull().default(false),
  confirmationTimeout: integer("confirmation_timeout"),
  actionTimeout: integer("action_timeout").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});
