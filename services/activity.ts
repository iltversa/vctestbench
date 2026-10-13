import { desc } from "drizzle-orm";
import { db } from "@/db";
import { activityLog } from "@/db/schema/activity-log";
import { testRuns } from "@/db/schema/test-runs";

export type ActivityKind =
  | "test.created"
  | "test.updated"
  | "test.deleted"
  | "run.passed"
  | "run.failed"
  | "run.stopped";

export type ActivityItem = {
  id: string;
  at: string;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  testId: string | null;
  // Set for runs, which have a report to open.
  runId: string | null;
};

// Logging must never make the thing it describes fail.
export async function recordActivity(entry: {
  kind: "test.created" | "test.updated" | "test.deleted";
  testId: string | null;
  title: string;
  detail?: string | null;
}) {
  try {
    await db.insert(activityLog).values({
      kind: entry.kind,
      testId: entry.testId,
      title: entry.title.slice(0, 300),
      detail: entry.detail?.slice(0, 500) ?? null,
    });
  } catch (error) {
    console.error("recordActivity failed:", error);
  }
}

const seconds = (ms: number | null) => (ms === null ? null : `${(ms / 1000).toFixed(1)} s`);

// Flow changes and run results as one timeline, newest first.
export async function listActivityService(limit = 40): Promise<ActivityItem[]> {
  const size = Math.min(Math.max(limit, 1), 200);

  const [changes, runs] = await Promise.all([
    db.select().from(activityLog).orderBy(desc(activityLog.at)).limit(size),
    db
      .select({
        runId: testRuns.runId,
        testId: testRuns.testId,
        title: testRuns.title,
        status: testRuns.status,
        startedAt: testRuns.startedAt,
        finishedAt: testRuns.finishedAt,
        durationMs: testRuns.durationMs,
        failedStep: testRuns.failedStep,
        error: testRuns.error,
      })
      .from(testRuns)
      .orderBy(desc(testRuns.startedAt))
      .limit(size),
  ]);

  const items: ActivityItem[] = [
    ...changes.map((row) => ({
      id: `change:${row.id}`,
      at: row.at.toISOString(),
      kind: row.kind as ActivityKind,
      title: row.title,
      detail: row.detail,
      testId: row.testId,
      runId: null,
    })),
    ...runs.map((row) => ({
      id: `run:${row.runId}`,
      at: (row.finishedAt ?? row.startedAt).toISOString(),
      kind: `run.${row.status}` as ActivityKind,
      title: row.title,
      detail:
        row.status === "failed"
          ? `Step ${row.failedStep ?? "?"}: ${row.error ?? "failed"}`
          : seconds(row.durationMs),
      testId: row.testId,
      runId: row.runId,
    })),
  ];

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, size);
}
