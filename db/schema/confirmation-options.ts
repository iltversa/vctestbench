import {
  pgTable,
  uuid,
  text,
} from "drizzle-orm/pg-core";

import { testActions } from "./test-actions";
import { boolean } from "drizzle-orm/gel-core";

export const confirmationOptions = pgTable("confirmation_options", {

  id: uuid("id").defaultRandom().primaryKey(),
  testActionId: uuid("action_id")
    .notNull()
    .references(() => testActions.id, {
      onDelete: "cascade",
    }),

  option: text("value").notNull(),
  isSelected: boolean("isSelected").default(false),
});
