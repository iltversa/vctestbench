import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

// Who did what to which flow. Runs are not here: they are already kept, with
// far more detail, in test_runs, and the activity view joins the two.
export const activityLog = pgTable("activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
  // test.created | test.updated | test.deleted
  kind: text("kind").notNull(),
  // Not a foreign key: the entry has to outlive the flow it describes.
  testId: uuid("test_id"),
  // Copied, for the same reason.
  title: text("title").notNull(),
  detail: text("detail"),
});
