import { pgTable, uuid, text, integer, timestamp, unique } from "drizzle-orm/pg-core";

// Small pictures of the tablet for each step of a run: one just before the
// action ("before") and one when the step ended ("after"). Kept apart from
// test_runs so listing runs never carries pictures.
export const runStepImages = pgTable(
  "run_step_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // The bridge's run id (test_runs.run_id).
    runId: text("run_id").notNull(),
    stepIndex: integer("step_index").notNull(),
    // "before" | "after"
    phase: text("phase").notNull().default("after"),
    // Base64 JPEG.
    data: text("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("run_step_images_run_step_phase_unique").on(table.runId, table.stepIndex, table.phase)]
);
