import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { testRuns, type RunStep } from "@/db/schema/test-runs";

// Reports reach the server through the browser, which copied them from the
// local bridge, so every field is checked and size-limited before it is stored.

const MAX_STEPS = 500;
const MAX_TEXT = 2000;
const MAX_SCREENSHOT = 2_000_000;
const STATUSES = new Set(["passed", "failed"]);
const STEP_STATUSES = new Set(["pending", "running", "passed", "failed"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const text = (value: unknown, max = MAX_TEXT): string | null =>
  typeof value === "string" ? value.slice(0, max) : null;

const count = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;

const date = (value: unknown): Date | null => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function cleanStep(raw: unknown, position: number): RunStep {
  const step = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const status = typeof step.status === "string" && STEP_STATUSES.has(step.status) ? step.status : "pending";

  return {
    index: count(step.index) ?? position + 1,
    nodeId: text(step.nodeId, 100) ?? "",
    action: text(step.action, 100) ?? "Unknown",
    detail: text(step.detail, 300) ?? "",
    status: status as RunStep["status"],
    startedAt: text(step.startedAt, 40),
    finishedAt: text(step.finishedAt, 40),
    durationMs: count(step.durationMs),
    waitedMs: count(step.waitedMs) ?? 0,
    error: text(step.error),
  };
}

export type SaveRunReportResult = { saved: boolean };

export async function saveRunReportService(raw: unknown): Promise<SaveRunReportResult> {
  const report = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;

  if (!report) throw new Error("Invalid report");

  const runId = text(report.runId, 100);
  const title = text(report.title, 300);
  const status = typeof report.status === "string" ? report.status : "";
  const startedAt = date(report.startedAt);

  if (!runId || !title || !STATUSES.has(status) || !startedAt) {
    throw new Error("Invalid report");
  }

  const steps = (Array.isArray(report.steps) ? report.steps : [])
    .slice(0, MAX_STEPS)
    .map(cleanStep);

  const device = (report.device && typeof report.device === "object" ? report.device : {}) as Record<string, unknown>;
  const testId = typeof report.testId === "string" && UUID.test(report.testId) ? report.testId : null;
  const screenshot =
    typeof report.screenshot === "string" &&
    report.screenshot.length <= MAX_SCREENSHOT &&
    /^[A-Za-z0-9+/=]+$/.test(report.screenshot)
      ? report.screenshot
      : null;

  const inserted = await db
    .insert(testRuns)
    .values({
      runId,
      testId,
      title,
      status,
      startedAt,
      finishedAt: date(report.finishedAt),
      durationMs: count(report.durationMs),
      error: text(report.error),
      failedStep: count(report.failedStep),
      stepDelaySeconds: count(report.stepDelaySeconds),
      device: { model: text(device.model, 100), android: text(device.android, 50) },
      steps,
      screenshot,
    })
    .onConflictDoNothing({ target: testRuns.runId })
    .returning({ id: testRuns.id });

  return { saved: inserted.length > 0 };
}

// Which of these bridge run ids are not stored yet.
export async function filterUnsavedRunIdsService(runIds: unknown): Promise<string[]> {
  const ids = (Array.isArray(runIds) ? runIds : [])
    .filter((id): id is string => typeof id === "string" && id.length <= 100)
    .slice(0, 50);

  if (ids.length === 0) return [];

  const known = await db
    .select({ runId: testRuns.runId })
    .from(testRuns)
    .where(inArray(testRuns.runId, ids));

  const knownIds = new Set(known.map((row) => row.runId));
  return ids.filter((id) => !knownIds.has(id));
}

// List rows leave out the steps and the screenshot, which are the heavy parts.
const listColumns = {
  runId: testRuns.runId,
  testId: testRuns.testId,
  title: testRuns.title,
  status: testRuns.status,
  startedAt: testRuns.startedAt,
  durationMs: testRuns.durationMs,
  failedStep: testRuns.failedStep,
  error: testRuns.error,
  steps: testRuns.steps,
};

export async function listRunsService(options: { testId?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const query = db.select(listColumns).from(testRuns);

  const rows = await (options.testId && UUID.test(options.testId)
    ? query.where(eq(testRuns.testId, options.testId))
    : query
  )
    .orderBy(desc(testRuns.startedAt))
    .limit(limit);

  return rows.map(({ steps, ...row }) => ({
    ...row,
    stepCount: steps.length,
    passedCount: steps.filter((step) => step.status === "passed").length,
  }));
}

export async function getRunService(runId: string) {
  const [row] = await db.select().from(testRuns).where(eq(testRuns.runId, runId));
  return row ?? null;
}
