"use server";

import {
  filterUnsavedRunIdsService,
  getRunService,
  getRunTrendsService,
  listRunsService,
  saveRunReportService,
} from "@/services/run-reports";
import { listActivityService } from "@/services/activity";
import { requireUserIfEnabled } from "@/services/require-user";

const FAILED = { success: false as const, message: "Could not reach the database." };

export async function saveRunReportAction(report: unknown) {
  try {
    await requireUserIfEnabled();
    const result = await saveRunReportService(report);
    return { success: true as const, saved: result.saved };
  } catch (error) {
    console.error("saveRunReportAction error:", error);
    return FAILED;
  }
}

export async function filterUnsavedRunIdsAction(runIds: unknown) {
  try {
    await requireUserIfEnabled();
    return { success: true as const, runIds: await filterUnsavedRunIdsService(runIds) };
  } catch (error) {
    console.error("filterUnsavedRunIdsAction error:", error);
    return FAILED;
  }
}

export async function listRunsAction(options?: { testId?: string; limit?: number }) {
  try {
    await requireUserIfEnabled();
    return { success: true as const, runs: await listRunsService(options ?? {}) };
  } catch (error) {
    console.error("listRunsAction error:", error);
    return FAILED;
  }
}

export async function getRunAction(input: { runId: string }) {
  try {
    await requireUserIfEnabled();

    if (typeof input?.runId !== "string" || !input.runId) {
      return { success: false as const, message: "Run id is required." };
    }

    const run = await getRunService(input.runId);
    return run
      ? { success: true as const, run }
      : { success: false as const, notFound: true as const, message: "This report was not found." };
  } catch (error) {
    console.error("getRunAction error:", error);
    return FAILED;
  }
}

export async function getRunTrendsAction() {
  try {
    await requireUserIfEnabled();
    return { success: true as const, trends: await getRunTrendsService() };
  } catch (error) {
    console.error("getRunTrendsAction error:", error);
    return FAILED;
  }
}

export async function getActivityAction(options?: { limit?: number }) {
  try {
    await requireUserIfEnabled();
    return { success: true as const, items: await listActivityService(options?.limit ?? 40) };
  } catch (error) {
    console.error("getActivityAction error:", error);
    return FAILED;
  }
}
