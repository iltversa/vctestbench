// The bridge's shared, in-memory state. One object so every module reads and
// writes the same thing.

import { MAX_EVENTS, MAX_RUN_LOG } from "./config.mjs";

export const store = {
  // What adb says about the tablet.
  connection: {
    connected: false,
    sandboxForeground: false,
    device: null,
    model: null,
    android: null,
    foregroundPackage: "",
    route: "",
  },
  // Activity feed, newest last.
  events: [],
  // Finished runs, oldest first. The UI copies them into the database.
  runs: [],
  // The run in progress, and the most recent run (in progress or finished) so
  // a page can show its result straight away.
  currentRun: null,
  lastRun: null,
  // Set by POST /stop; the runner checks it between and inside steps.
  stopRequested: false,
};

let eventId = 0;

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// kind: "info" | "success" | "warning". Events raised during a run are also
// kept on that run, so its report has the log of what happened.
export function addEvent(label, detail = "", kind = "info") {
  const run = store.currentRun;
  const event = {
    id: ++eventId,
    at: new Date().toISOString(),
    label,
    detail,
    kind,
    runId: run?.runId ?? null,
    step: run?.activeStep ?? null,
  };

  store.events.push(event);
  while (store.events.length > MAX_EVENTS) store.events.shift();

  if (run) {
    run.log.push({ at: event.at, label, detail, kind, step: event.step });
    while (run.log.length > MAX_RUN_LOG) run.log.shift();
  }

  return event;
}
