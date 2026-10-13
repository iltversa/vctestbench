// Records a flow from what is done on the tablet.
//
// While recording, a small listener runs in the Sandbox page (see
// recorder-script.mjs). The bridge drains its queue a couple of times a second
// and turns the raw taps and edits into the same steps a person would add by
// hand: CLICK, PASTE, AUTHENTICATION and SAVE.

import { RECORDER_SCRIPT, STOP_RECORDER_SCRIPT } from "./recorder-script.mjs";
import { RunRefused } from "./runner.mjs";
import { addEvent, store } from "./state.mjs";
import { evaluate } from "./webview.mjs";

const POLL_MS = 500;
const GIVE_UP_AFTER_MS = 30 * 60 * 1000;
const SIGN_IN_BUTTON = /sign\s*in|log\s*in|login|continue|submit|next/i;

// Turns raw page events into steps, in order. Kept free of the device so it can
// be tested: feed it events, read `steps`.
export class Recording {
  constructor() {
    this.steps = [];
    this.nextId = 1;
    // A password was typed and the sign-in button has not been tapped yet: that
    // tap belongs to AUTHENTICATION, which presses the button itself.
    this.awaitingSignIn = false;
  }

  get last() {
    return this.steps[this.steps.length - 1];
  }

  add(step) {
    this.steps.push({ id: this.nextId++, ...step });
  }

  ingest(events) {
    for (const event of Array.isArray(events) ? events : []) {
      if (event?.kind === "click") this.click(event);
      else if (event?.kind === "input") this.input(event);
      else if (event?.kind === "route") this.route(event);
    }
  }

  click({ label = "", isSave = false }) {
    const text = String(label).trim();

    if (isSave) {
      this.awaitingSignIn = false;
      if (this.last?.action !== "SAVE") this.add({ action: "SAVE" });
      return;
    }

    if (this.awaitingSignIn) {
      this.awaitingSignIn = false;
      if (SIGN_IN_BUTTON.test(text)) return;
    }

    this.add({ action: "CLICK", text, unlabeled: text === "" });
  }

  route({ path = "" }) {
    const route = String(path).trim();
    if (!route) return;

    // Only a change of page is a step.
    const previous = [...this.steps].reverse().find((step) => step.action === "ROUTE");
    if (previous?.route === route) return;

    this.add({ action: "ROUTE", route });
  }

  input({ password = false, value = "", field = "" }) {
    if (password) {
      const before = this.last;

      // Typed text right before a password is the account name.
      if (before?.action === "PASTE") {
        before.action = "AUTHENTICATION";
        before.email = before.text;
        before.text = undefined;
      } else {
        this.add({ action: "AUTHENTICATION", email: "" });
      }

      this.last.hasPassword = true;
      this.awaitingSignIn = true;
      return;
    }

    const text = String(value);
    if (text === "") return;

    // The same field edited again replaces what was recorded for it.
    if (this.last?.action === "PASTE" && this.last.field === field) {
      this.last.text = text;
      return;
    }

    this.add({ action: "PASTE", text, field });
  }
}

let timer = null;
let startedAt = 0;
let failures = 0;

function finish(reason) {
  const recording = store.recording;
  if (!recording?.active) return;

  recording.active = false;
  recording.stoppedAt = new Date().toISOString();
  if (reason) recording.error = reason;

  clearInterval(timer);
  timer = null;

  // Take the listener off the page (best effort: the page may be gone).
  evaluate(STOP_RECORDER_SCRIPT).catch(() => {});

  addEvent(
    "Recording stopped",
    `${recording.session.steps.length} ${recording.session.steps.length === 1 ? "step" : "steps"}${reason ? ` · ${reason}` : ""}`,
    reason ? "warning" : "success"
  );
}

async function drain() {
  const recording = store.recording;
  if (!recording?.active) return;

  if (!store.connection.connected) return finish("The tablet disconnected.");
  if (Date.now() - startedAt > GIVE_UP_AFTER_MS) return finish("Recording stopped after 30 minutes.");

  try {
    const events = await evaluate(RECORDER_SCRIPT, 3000);
    failures = 0;
    recording.session.ingest(events);
  } catch {
    // The page may be reloading; carry on unless it stays unreachable.
    failures += 1;
    if (failures >= 20) finish("The Sandbox page could not be reached.");
  }
}

export async function startRecording() {
  if (!store.connection.connected) {
    throw new RunRefused("The tablet is not connected.", 409);
  }

  if (store.currentRun) {
    throw new RunRefused("A test is running. Stop it before recording.", 409);
  }

  if (store.recording?.active) {
    throw new RunRefused("Already recording.", 409);
  }

  // Fails now, with a clear message, if the page cannot be reached.
  try {
    await evaluate(RECORDER_SCRIPT, 3000);
  } catch {
    throw new RunRefused("The Sandbox page could not be reached. Open the Sandbox app on the tablet.", 409);
  }

  startedAt = Date.now();
  failures = 0;

  store.recording = {
    active: true,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    error: null,
    session: new Recording(),
  };

  timer = setInterval(() => void drain(), POLL_MS);
  addEvent("Recording started", "Do the steps on the tablet", "info");
}

export async function stopRecording() {
  if (store.recording?.active) {
    // One last read so the final tap is not lost.
    await drain();
    finish(null);
  }

  return recordingState();
}

export function isRecording() {
  return Boolean(store.recording?.active);
}

export function recordingState() {
  const recording = store.recording;

  return {
    active: Boolean(recording?.active),
    startedAt: recording?.startedAt ?? null,
    stoppedAt: recording?.stoppedAt ?? null,
    error: recording?.error ?? null,
    steps: recording?.session.steps ?? [],
  };
}
