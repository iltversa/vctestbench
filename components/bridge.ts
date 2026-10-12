// Shared by the Home screen and the test editor so both explain a blocked
// Run the same way.

export const BRIDGE = "http://localhost:3131";

export type FeedEvent = {
  id: number;
  // ISO timestamp.
  at: string;
  label: string;
  detail: string;
  kind: "info" | "success" | "warning";
  // The run this happened during, and the step it belongs to.
  runId: string | null;
  step: number | null;
};

export type StepStatus = "pending" | "running" | "passed" | "failed" | "stopped";

export type StepProgress = {
  index: number;
  nodeId: string;
  action: string;
  detail: string;
  status: StepStatus;
  // While a step is running: waiting out the default delay, or doing the action.
  phase: "waiting" | "acting" | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  waitedMs: number;
  error: string | null;
};

// The run in progress, or the most recent one.
export type RunProgress = {
  runId: string;
  testId: string | null;
  title: string;
  status: "running" | "passed" | "failed" | "stopped";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
  failedStep: number | null;
  activeStep: number | null;
  steps: StepProgress[];
};

export type TabletState = {
  connected: boolean;
  device?: string;
  model?: string;
  android?: string;
  foregroundPackage?: string;
  sandboxForeground: boolean;
  route?: string;
  updatedAt: string;
  events: FeedEvent[];
  // How long the bridge waits before every step (a DELAY step adds more).
  stepDelaySeconds?: number;
  // A flow is being recorded from the tablet.
  recording?: boolean;
  // Finished runs the bridge still holds in memory, oldest first.
  runIds?: string[];
  currentRunId?: string | null;
  run?: RunProgress | null;
  test?: {
    status: "idle" | "running" | "passed" | "failed" | "stopped";
    name?: string;
    step?: string;
    error?: string;
  };
};

// The bridge's /state carries a fresh timestamp on every poll. Pages compare
// this instead of the whole object, so an unchanged tablet does not re-render
// them every second and a half.
export function bridgeStateKey(state: TabletState | null): string {
  if (!state) return "";

  return JSON.stringify([
    state.connected,
    state.model,
    state.sandboxForeground,
    state.route,
    state.stepDelaySeconds,
    state.recording,
    state.runIds,
    state.currentRunId,
    state.events?.[state.events.length - 1]?.id,
    state.run && [
      state.run.runId,
      state.run.status,
      state.run.activeStep,
      state.run.error,
      state.run.steps.map((step) => [step.status, step.phase, step.error, step.durationMs]),
    ],
  ]);
}

// Empty string means a run can start.
export function getRunBlockedReason(
  bridgeOnline: boolean,
  state: TabletState | null
): string {
  if (!bridgeOnline) return "Start the bridge to run tests.";
  if (!state?.connected) return "Connect the tablet with USB debugging to run tests.";
  if (state.currentRunId || state.test?.status === "running") return "A test is already running.";
  if (state.recording) return "A flow is being recorded. Stop recording to run tests.";
  if (!state.sandboxForeground) return "Open the Sandbox app on the tablet to run tests.";
  return "";
}
