// Shared by the Home screen and the test editor so both explain a blocked
// Run the same way.

export const BRIDGE = "http://localhost:3131";

export type FeedEvent = {
  id: number;
  at: string;
  label: string;
  detail: string;
  kind: "info" | "success" | "warning";
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
  test?: {
    status: "idle" | "running" | "passed" | "failed";
    name?: string;
    step?: string;
    error?: string;
  };
};

// Empty string means a run can start.
export function getRunBlockedReason(
  bridgeOnline: boolean,
  state: TabletState | null
): string {
  if (!bridgeOnline) return "Start the bridge to run tests.";
  if (!state?.connected) return "Connect the tablet with USB debugging to run tests.";
  if (state.test?.status === "running") return "A test is already running.";
  if (!state.sandboxForeground) return "Open the Sandbox app on the tablet to run tests.";
  if (state.route !== "/home") return "Go to the Sandbox Home screen on the tablet to run tests.";
  return "";
}
