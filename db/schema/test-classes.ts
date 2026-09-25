import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";

export const testClasses = pgTable("test_classes", {
  id: uuid("id")
    .defaultRandom()
    .primaryKey(),

  name: varchar("name", {
    length: 100,
  })
    .notNull()
    .unique(),

  createdAt: timestamp("created_at")
    .defaultNow()
    .notNull(),
});