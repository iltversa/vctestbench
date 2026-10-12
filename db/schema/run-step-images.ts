import { pgTable, uuid, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

// One small picture per step of a run: what the tablet showed when the step
// ended. Kept apart from test_runs so listing runs never carries pictures.
export const runStepImages = pgTable(
  "run_step_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // The bridge's run id (test_runs.run_id).
    runId: text("run_id").notNull(),
    stepIndex: integer("step_index").notNull(),
    // Base64 JPEG.
    data: text("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("run_step_images_run_step_unique").on(table.runId, table.stepIndex)]
);
