// db/schema/confirmation-options.ts

import {
  pgTable,
  uuid,
  text,
  integer,
} from "drizzle-orm/pg-core";

import { testActions } from "./test-actions";

export const confirmationOptions = pgTable(
  "confirmation_options",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    actionId: uuid("action_id")
      .notNull()
      .references(() => testActions.id, {
        onDelete: "cascade",
      }),

    value: text("value")
      .notNull(),

    sortOrder: integer("sort_order")
      .notNull(),
  }
);