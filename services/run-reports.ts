import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { runStepImages } from "@/db/schema/run-step-images";
import { testRuns, type RunLogEntry, type RunStep } from "@/db/schema/test-runs";

// Reports reach the server through the browser, which copied them from the
// local bridge, so every field is checked and size-limited before it is stored.

const MAX_STEPS = 500;
const MAX_LOG = 300;
// A step picture is about 60 KB as base64; anything far beyond that is not one.
const MAX_IMAGE_CHARS = 400_000;
const BASE64 = /^[A-Za-z0-9+/=]+$/;
const LOG_KINDS = new Set(["info", "success", "warning"]);
const MAX_TEXT = 2000;
const MAX_SCREENSHOT = 2_000_000;
const STATUSES = new Set(["passed", "failed", "stopped"]);
const STEP_STATUSES = new Set(["pending", "running", "passed", "failed", "stopped"]);
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
    hasBefore: step.hasBefore === true,
    hasImage: step.hasImage === true,
    error: text(step.error),
  };
}

function cleanLogEntry(raw: unknown): RunLogEntry {
  const entry = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  return {
    at: text(entry.at, 40) ?? "",
    label: text(entry.label, 300) ?? "",
    detail: text(entry.detail, 500) ?? "",
    kind: (typeof entry.kind === "string" && LOG_KINDS.has(entry.kind) ? entry.kind : "info") as RunLogEntry["kind"],
    step: count(entry.step),
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

  const log = (Array.isArray(report.log) ? report.log : []).slice(-MAX_LOG).map(cleanLogEntry);

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
      log,
      screenshot,
    })
    .onConflictDoNothing({ target: testRuns.runId })
    .returning({ id: testRuns.id });

  const saved = inserted.length > 0;

  // Pictures normally arrive separately, in small batches (see
  // saveRunStepImagesService); accept them inline too.
  if (saved && report.images) {
    await saveRunStepImagesService(runId, report.images);
  }

  return { saved };
}

// Stores step pictures for a run that is already saved, and marks the steps
// that have them. Accepts { "1": { before, after } }, and the older
// { "1": "<after>" }. Safe to call again: a picture already stored is kept.
export async function saveRunStepImagesService(runId: string, raw: unknown): Promise<{ stored: number }> {
  const entries = raw && typeof raw === "object" ? Object.entries(raw as Record<string, unknown>) : [];

  const valid = (data: unknown): data is string =>
    typeof data === "string" && data.length > 0 && data.length <= MAX_IMAGE_CHARS && BASE64.test(data);

  const rows: { runId: string; stepIndex: number; phase: "before" | "after"; data: string }[] = [];

  for (const [key, value] of entries) {
    const stepIndex = Number(key);
    if (!Number.isInteger(stepIndex) || stepIndex < 1 || stepIndex > MAX_STEPS) continue;

    const pictures =
      typeof value === "string"
        ? { after: value }
        : value && typeof value === "object"
          ? (value as { before?: unknown; after?: unknown })
          : {};

    if (valid(pictures.before)) rows.push({ runId, stepIndex, phase: "before", data: pictures.before });
    if (valid(pictures.after)) rows.push({ runId, stepIndex, phase: "after", data: pictures.after });
  }

  if (rows.length === 0) return { stored: 0 };

  const [run] = await db.select({ steps: testRuns.steps }).from(testRuns).where(eq(testRuns.runId, runId));
  if (!run) return { stored: 0 };

  await db.insert(runStepImages).values(rows).onConflictDoNothing();

  // A step says it has a picture only because one is stored.
  const before = new Set(rows.filter((row) => row.phase === "before").map((row) => row.stepIndex));
  const after = new Set(rows.filter((row) => row.phase === "after").map((row) => row.stepIndex));

  const steps = run.steps.map((step) => ({
    ...step,
    hasBefore: step.hasBefore || before.has(step.index),
    hasImage: step.hasImage || after.has(step.index),
  }));

  await db.update(testRuns).set({ steps }).where(eq(testRuns.runId, runId));

  return { stored: rows.length };
}

export type StepPictures = { before?: string; after?: string };

// Step pictures by step number, as base64 JPEG.
export async function getRunStepImagesService(runId: string): Promise<Record<number, StepPictures>> {
  const rows = await db
    .select({ stepIndex: runStepImages.stepIndex, phase: runStepImages.phase, data: runStepImages.data })
    .from(runStepImages)
    .where(eq(runStepImages.runId, runId));

  const pictures: Record<number, StepPictures> = {};

  for (const row of rows) {
    const entry = (pictures[row.stepIndex] ??= {});
    if (row.phase === "before") entry.before = row.data;
    else entry.after = row.data;
  }

  return pictures;
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

// ---------------------------------------------------------------------
// Trends: how each test has been doing over its recent runs.
// ---------------------------------------------------------------------

const TREND_RUNS_PER_TEST = 20;
const TREND_SCAN_LIMIT = 500;

export type TestTrend = {
  key: string;
  testId: string | null;
  title: string;
  total: number;
  passed: number;
  passRate: number;
  // Oldest first, so the strip reads left to right through time.
  results: { runId: string; status: string; startedAt: string }[];
  lastStatus: string;
  lastRunAt: string;
  avgDurationMs: number | null;
  streak: { status: string; length: number };
  commonFailure: { action: string; detail: string; count: number } | null;
  // Pass rate of the newest half against the older half, in percentage points.
  change: number | null;
};

export async function getRunTrendsService(): Promise<TestTrend[]> {
  const rows = await db
    .select({
      runId: testRuns.runId,
      testId: testRuns.testId,
      title: testRuns.title,
      status: testRuns.status,
      startedAt: testRuns.startedAt,
      durationMs: testRuns.durationMs,
      failedStep: testRuns.failedStep,
      steps: testRuns.steps,
    })
    .from(testRuns)
    .orderBy(desc(testRuns.startedAt))
    .limit(TREND_SCAN_LIMIT);

  // A deleted test keeps its history, grouped by the title it had.
  const groups = new Map<string, typeof rows>();

  for (const row of rows) {
    const key = row.testId ?? `title:${row.title}`;
    const list = groups.get(key) ?? [];
    if (list.length < TREND_RUNS_PER_TEST) list.push(row);
    groups.set(key, list);
  }

  const rate = (list: typeof rows) =>
    list.length === 0 ? null : (list.filter((run) => run.status === "passed").length / list.length) * 100;

  const trends: TestTrend[] = [];

  for (const [key, newestFirst] of groups) {
    const latest = newestFirst[0];
    const oldestFirst = [...newestFirst].reverse();

    let streakLength = 0;
    for (const run of newestFirst) {
      if (run.status !== latest.status) break;
      streakLength += 1;
    }

    const failures = new Map<string, { action: string; detail: string; count: number }>();
    for (const run of newestFirst) {
      if (run.status !== "failed") continue;
      const step = run.steps.find((item) => item.index === run.failedStep || item.status === "failed");
      if (!step) continue;

      const failureKey = `${step.action}|${step.detail}`;
      const entry = failures.get(failureKey) ?? { action: step.action, detail: step.detail, count: 0 };
      entry.count += 1;
      failures.set(failureKey, entry);
    }

    const durations = newestFirst
      .map((run) => run.durationMs)
      .filter((value): value is number => typeof value === "number");

    // Compare halves only when there is enough history to mean something.
    let change: number | null = null;
    if (oldestFirst.length >= 6) {
      const half = Math.floor(oldestFirst.length / 2);
      const older = rate(oldestFirst.slice(0, half));
      const newer = rate(oldestFirst.slice(oldestFirst.length - half));
      if (older !== null && newer !== null) change = Math.round(newer - older);
    }

    const passed = newestFirst.filter((run) => run.status === "passed").length;

    trends.push({
      key,
      testId: latest.testId,
      title: latest.title,
      total: newestFirst.length,
      passed,
      passRate: Math.round((passed / newestFirst.length) * 100),
      results: oldestFirst.map((run) => ({
        runId: run.runId,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
      })),
      lastStatus: latest.status,
      lastRunAt: latest.startedAt.toISOString(),
      avgDurationMs: durations.length
        ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
        : null,
      streak: { status: latest.status, length: streakLength },
      commonFailure: [...failures.values()].sort((a, b) => b.count - a.count)[0] ?? null,
      change,
    });
  }

  // Tests that need attention first: lowest pass rate, then most recent.
  return trends.sort(
    (a, b) => a.passRate - b.passRate || b.lastRunAt.localeCompare(a.lastRunAt)
  );
}
