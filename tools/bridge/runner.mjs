// The flow engine: walks a saved flow on the tablet and records a report.
//
// A flow is a tree. Every action keeps what comes next in `paths`, and a chain
// ends in an empty slot. Reaching the end of the chain is the flow completing;
// nothing runs after it.

import { randomUUID } from "node:crypto";
import { screenshotBase64 } from "./adb.mjs";
import { MAX_RUNS, STEP_DELAY_SECONDS } from "./config.mjs";
import { addEvent, sleep, store } from "./state.mjs";
import { clickSaveButton, clickTextAround, evaluate } from "./webview.mjs";

// ---------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------

export class RunRefused extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

class RunStopped extends Error {
  constructor() {
    super("Stopped by user");
  }
}

const assertNotStopped = () => {
  if (store.stopRequested) throw new RunStopped();
};

// A sleep that notices Stop within a fraction of a second.
async function pause(ms) {
  const until = Date.now() + ms;

  while (Date.now() < until) {
    assertNotStopped();
    await sleep(Math.min(200, until - Date.now()));
  }

  assertNotStopped();
}

// ---------------------------------------------------------------------
// Describing steps
// ---------------------------------------------------------------------

function describeStep(title, data = {}) {
  const name = String(title || "").trim().toUpperCase();

  if (name === "DELAY") return `Wait ${Number(data.actionTimeout) || 0}s`;
  if (name === "PASTE") return data.pasteText ? `Paste "${data.pasteText}"` : "Paste text";
  if (name === "CLICK") return data.clickOnText ? `Tap "${data.clickOnText}"` : `Tap "${title}"`;
  if (name === "AUTHENTICATION") return data.email ? `Sign in as ${data.email}` : "Sign in";
  if (name === "SAVE") return "Press save";
  if (name === "CONFIRMATION") {
    const chosen = (data.confirmationOptions || []).find((option) => option.isSelected === true);
    return chosen ? `Choose "${chosen.option}"` : "Confirm";
  }
  return `Tap "${title}"`;
}

const isConfirmation = (title) => String(title).trim().toUpperCase() === "CONFIRMATION";

// The steps a run is expected to execute, in order, so a report can show the
// ones that were never reached after a failure.
export function planFlow(nodes, actionMap, out = []) {
  for (const node of Array.isArray(nodes) ? nodes : []) {
    if (!node.actionId) {
      planFlow(node.paths, actionMap, out);
      continue;
    }

    const data = actionMap.get(node.actionId) ?? node.actionData ?? {};
    const title = String(data.title || node.actionTitle || "Unknown").trim();

    out.push({
      index: out.length + 1,
      nodeId: node.id,
      action: title,
      detail: describeStep(title, data),
      status: "pending",
      phase: null,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      waitedMs: 0,
      error: null,
    });

    if (isConfirmation(title)) {
      const chosen = (data.confirmationOptions || []).find((option) => option.isSelected === true);
      const branch = (node.paths || []).find((child) => child.optionId === chosen?.id);
      planFlow(branch?.paths, actionMap, out);
    } else {
      planFlow(node.paths, actionMap, out);
    }
  }

  return out;
}

// ---------------------------------------------------------------------
// Step bookkeeping
// ---------------------------------------------------------------------

function beginStep(run, node, action) {
  let step = run.steps.find((item) => item.nodeId === node.id);

  if (!step) {
    step = {
      index: run.steps.length + 1,
      nodeId: node.id,
      action: String(action.title || "").trim(),
      detail: describeStep(action.title, action),
      status: "pending",
      phase: null,
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      waitedMs: 0,
      error: null,
    };
    run.steps.push(step);
  }

  step.status = "running";
  step.phase = null;
  step.startedAt = new Date().toISOString();
  run.activeStep = step.index;

  return step;
}

function endStep(step, status, error = null) {
  step.status = status;
  step.phase = null;
  step.finishedAt = new Date().toISOString();
  step.durationMs = step.startedAt ? Date.now() - new Date(step.startedAt).getTime() : null;
  step.error = error;
}

// ---------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------

function createRun(testData, actionMap) {
  const startedAt = new Date().toISOString();
  const { model, android } = store.connection;

  return {
    runId: randomUUID(),
    testId: typeof testData.testId === "string" ? testData.testId : null,
    title: String(testData.title ?? ""),
    status: "running",
    startedAt,
    finishedAt: null,
    durationMs: null,
    error: null,
    failedStep: null,
    activeStep: null,
    stepDelaySeconds: STEP_DELAY_SECONDS,
    device: { model: model ?? null, android: android ?? null },
    steps: planFlow(testData.flow, actionMap),
    log: [],
    screenshot: null,
  };
}

async function finalizeRun(run, status, error = null) {
  const finishedAt = new Date().toISOString();

  run.status = status;
  run.finishedAt = finishedAt;
  run.durationMs = new Date(finishedAt).getTime() - new Date(run.startedAt).getTime();
  run.error = error;
  run.failedStep = run.steps.find((step) => step.status === "failed")?.index ?? null;
  run.activeStep = null;

  // Steps that were never reached stay "pending"; reports show them as not run.
  if (status === "failed") run.screenshot = await screenshotBase64();

  store.runs.push(run);
  while (store.runs.length > MAX_RUNS) store.runs.shift();

  store.currentRun = null;
  store.stopRequested = false;
}

// Starts a run and returns straight away; progress is read from the store.
export function startRun(testData) {
  if (!testData || !Array.isArray(testData.flow)) {
    throw new RunRefused("Cannot run: the test has no flow.", 400);
  }

  if (store.currentRun) {
    throw new RunRefused("A test is already running", 409);
  }

  const actionMap = new Map((testData.actions || []).map((action) => [action.id, action]));
  const run = createRun(testData, actionMap);

  store.currentRun = run;
  store.lastRun = run;
  store.stopRequested = false;

  addEvent(`Starting test: ${run.title}`, `${run.steps.length} ${run.steps.length === 1 ? "step" : "steps"}`);

  void execute(run, testData, actionMap);

  return { runId: run.runId };
}

export function requestStop() {
  if (!store.currentRun) return false;

  store.stopRequested = true;
  addEvent("Stop requested", "The run ends after the current action", "warning");
  return true;
}

async function execute(run, testData, actionMap) {
  try {
    await executeFlowNodes(run, testData.flow, actionMap);

    const passed = run.steps.filter((step) => step.status === "passed").length;

    // Logged while the run is still open, so it is part of the run's own log.
    addEvent(
      `Flow completed: ${run.title}`,
      `${passed} ${passed === 1 ? "step" : "steps"} passed`,
      "success"
    );

    await finalizeRun(run, "passed");
  } catch (error) {
    if (error instanceof RunStopped) {
      // The step that was in progress did not finish; it is stopped, not failed.
      const open = run.steps.find((step) => step.status === "running");
      if (open) endStep(open, "stopped", "Stopped by user");

      addEvent(`${run.title} stopped`, "Stopped by user", "warning");
      await finalizeRun(run, "stopped", "Stopped by user");
      return;
    }

    const message = error instanceof Error ? error.message : String(error);

    addEvent(`${run.title} failed`, message, "warning");
    await finalizeRun(run, "failed", message);
  }
}

// ---------------------------------------------------------------------
// Walking the flow
// ---------------------------------------------------------------------

async function executeFlowNodes(run, nodes, actionMap) {
  if (!Array.isArray(nodes)) return;

  for (const node of nodes) {
    assertNotStopped();

    // An empty slot: nothing to run here, carry on below it.
    if (!node.actionId && !node.optionId) {
      await executeFlowNodes(run, node.paths, actionMap);
      continue;
    }

    // A confirmation option. A branch that was not chosen must not run.
    if (!node.actionId && node.optionId) {
      if (node.isSelected === false) continue;

      await executeFlowNodes(run, node.paths, actionMap);
      continue;
    }

    // The editor saves each node's own configuration in actionData and does
    // not send a separate actions list, so fall back to it.
    const action = actionMap.get(node.actionId) ?? node.actionData ?? undefined;

    if (!action) {
      throw new Error(`Action not found for actionId: ${node.actionId}`);
    }

    const title = String(action.title || "").trim();
    const name = title.toUpperCase();
    const step = beginStep(run, node, action);

    try {
      // Default settle time before every step. DELAY is exempt: it is the
      // explicit way to wait longer.
      if (name !== "DELAY" && STEP_DELAY_SECONDS > 0) {
        step.phase = "waiting";
        addEvent(`Waiting ${STEP_DELAY_SECONDS}s before ${title}`);

        const waitStarted = Date.now();
        await pause(STEP_DELAY_SECONDS * 1000);
        step.waitedMs = Date.now() - waitStarted;
      }

      step.phase = "acting";
      addEvent(`Attempting action: ${title}`, step.detail);

      await executeDeviceAction(action);

      addEvent(`Finished action: ${title}`, "", "success");

      if (name === "CONFIRMATION") {
        // The step is done once the option is tapped; the branch below it
        // records its own steps.
        await executeConfirmationNode(run, node, action, actionMap, () => endStep(step, "passed"));

        if (step.status === "running") endStep(step, "passed");
        continue;
      }

      endStep(step, "passed");
    } catch (error) {
      if (step.status === "running" && !(error instanceof RunStopped)) {
        endStep(step, "failed", error instanceof Error ? error.message : String(error));
      }

      throw error;
    }

    // Carry on with whatever comes next. When there is nothing next, the
    // flow is complete.
    await executeFlowNodes(run, node.paths, actionMap);
  }
}

async function executeConfirmationNode(run, node, action, actionMap, onOptionTapped) {
  const options = Array.isArray(action.confirmationOptions) ? action.confirmationOptions : [];
  const selected = options.find((option) => option.isSelected === true);

  if (!selected) {
    addEvent("No confirmation option selected", "Tapping Connect", "info");
    await clickTextAround("Connect");
    return;
  }

  const optionName = String(selected.option || "").trim();
  addEvent(`Selected confirmation: ${optionName}`);

  const optionNode = (node.paths || []).find((child) => child.optionId === selected.id);

  if (!optionNode) {
    throw new Error(`No flow path found for confirmation option "${optionName}"`);
  }

  await clickTextAround(optionName);
  addEvent(`Tapped confirmation option: ${optionName}`, "", "success");

  await onOptionTapped();

  await executeFlowNodes(run, optionNode.paths || [], actionMap);
}

// ---------------------------------------------------------------------
// One action on the device
// ---------------------------------------------------------------------

async function executeDeviceAction(action) {
  const title = String(action.title || "").trim();
  const name = title.toUpperCase();

  if (name === "DELAY") {
    const seconds = Number(action.actionTimeout) || 0;
    addEvent(`Waiting ${seconds}s`);
    await pause(seconds * 1000);
    return;
  }

  // The option itself is tapped by executeConfirmationNode.
  if (name === "CONFIRMATION") return;

  if (name === "PASTE") {
    const text = String(action.pasteText || "").trim();

    const result = await evaluate(`(() => {
      const input = document.querySelector('input[type="text"], input:not([type]), textarea');
      if (!input) return { ok: false };
      input.focus();
      input.value = ${JSON.stringify(text)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    })()`);

    // A missing field used to be logged as a success; it is a failed step.
    if (!result?.ok) {
      throw new Error("No text field is visible on the tablet to paste into.");
    }

    addEvent("Pasted text", text, "success");
    return;
  }

  // Fill the visible email and password fields and press the sign-in button.
  // Values are passed as JSON so they cannot break out of the script, and the
  // password is never logged or added to the activity feed.
  if (name === "AUTHENTICATION") {
    const email = String(action.email ?? "").trim();
    const password = String(action.password ?? "");

    if (!email || !password) {
      throw new Error("AUTHENTICATION needs both an email and a password.");
    }

    const findAndSignIn = () =>
      evaluate(`(() => {
        const email = ${JSON.stringify(email)};
        const password = ${JSON.stringify(password)};
        const visible = (el) => !!(el.offsetWidth || el.offsetHeight);
        const inputs = [...document.querySelectorAll("input")]
          .filter((el) => visible(el) && !el.disabled && el.type !== "hidden");
        const passwordField = inputs.find((el) => el.type === "password");

        if (!passwordField) return { ok: false, error: "No password field is visible on the tablet." };

        const hint = (el) =>
          [el.type, el.name, el.id, el.placeholder, el.autocomplete, el.getAttribute("aria-label")]
            .join(" ").toLowerCase();
        const others = inputs.filter((el) => el !== passwordField);
        const emailField =
          others.find((el) => el.type === "email") ||
          others.find((el) => /e-?mail|user|login/.test(hint(el))) ||
          others.find((el) => ["text", "tel", ""].includes(el.type));

        if (!emailField) return { ok: false, error: "No email field is visible on the tablet." };

        const setValue = (el, value) => {
          el.focus();
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
          setter.call(el, value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        };

        setValue(emailField, email);
        setValue(passwordField, password);

        const scope = passwordField.form || document;
        const label = (b) => (b.innerText || b.value || b.getAttribute("aria-label") || "").trim().toLowerCase();
        const buttons = [...scope.querySelectorAll("button,[role=button],input[type=submit]")].filter(visible);
        const submit =
          buttons.find((b) => b.type === "submit") ||
          buttons.find((b) => /sign\\s*in|log\\s*in|login|continue|submit|next/.test(label(b)));

        if (!submit) return { ok: false, error: "No sign-in button was found next to the password field." };

        submit.click();
        return { ok: true, button: label(submit) };
      })()`);

    // The form is often in a modal that is still opening: keep looking for
    // the fields for up to 10 seconds before giving up.
    let result = await findAndSignIn();
    const giveUpAt = Date.now() + 10_000;

    while (
      result &&
      result.ok === false &&
      /No (password|email) field/.test(result.error || "") &&
      Date.now() < giveUpAt
    ) {
      await pause(500);
      result = await findAndSignIn();
    }

    if (!result || result.ok !== true) {
      throw new Error(result?.error || "Could not sign in on the tablet.");
    }

    addEvent(`Signed in as ${email}`, `Pressed "${result.button}"`, "success");

    // Give the app a moment to leave the login screen before the next step.
    await pause(1500);
    return;
  }

  if (name === "SAVE") {
    await clickSaveButton();
    addEvent("Pressed save", "", "success");
    return;
  }

  // CLICK: the text to tap is stored in clickOnText; fall back to the action's
  // title for actions that are named after the button itself.
  const target = String(action.clickOnText || "").trim() || title;
  await clickTextAround(target);
  addEvent(`Tapped "${target}"`, "", "success");
}
