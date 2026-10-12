// Everything configurable about the bridge, in one place.

import { execFileSync } from "node:child_process";

export const PORT = Number(process.env.VC_BRIDGE_PORT) || 3131;

// Every step waits this long before it runs, so a modal or a route change from
// the previous step has time to settle. A DELAY step adds more on top.
export const STEP_DELAY_SECONDS = (() => {
  const value = Number(process.env.VC_STEP_DELAY_SECONDS ?? 5);
  return Number.isFinite(value) && value >= 0 ? value : 5;
})();

// The "after" picture of a step is taken this long after the action, so a
// modal or a route change it caused has appeared by then.
export const AFTER_SHOT_DELAY_SECONDS = (() => {
  const value = Number(process.env.VC_AFTER_SHOT_DELAY_SECONDS ?? 2);
  return Number.isFinite(value) && value >= 0 ? value : 2;
})();

export const SANDBOX_PACKAGE = "com.versaclimber.sandbox";
export const DEVTOOLS_PORT = 9222;
export const POLL_INTERVAL_MS = 1500;

// Only the TestBench UI may call the bridge: it drives a real device. A CORS
// header alone is not enough (the browser still sends a cross-origin POST),
// so Origin and Host are checked before anything runs.
export const ALLOWED_ORIGINS = new Set(
  (process.env.VC_ALLOWED_ORIGINS ?? "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
export const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]);
export const MAX_BODY_BYTES = 1_000_000;

// Memory bounds.
export const MAX_RUNS = 20;
export const MAX_EVENTS = 100;
export const MAX_RUN_LOG = 300;

export const ADB =
  process.env.ADB ??
  (() => {
    for (const candidate of ["/opt/homebrew/bin/adb", "/usr/local/bin/adb", "adb"]) {
      try {
        execFileSync(candidate, ["version"], { stdio: "ignore" });
        return candidate;
      } catch {
        // try the next candidate
      }
    }
    return "adb";
  })();

const DEBUG = process.env.VC_BRIDGE_DEBUG === "1";

export const debug = (...args) => {
  if (DEBUG) console.log("[bridge]", ...args);
};
