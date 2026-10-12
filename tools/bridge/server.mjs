// The bridge's HTTP API, used by the TestBench UI on this machine.
//
//   GET  /state       connection, run progress and the activity feed
//   GET  /screen      PNG of the tablet's screen (captured on demand)
//   GET  /runs        finished runs the bridge still holds
//   POST /run-test    start a run          -> 202 { accepted, runId }
//   POST /stop        stop the current run
//   POST /launch-sand bring the Sandbox app to the front

import http from "node:http";
import { screenshot } from "./adb.mjs";
import { ALLOWED_HOSTS, ALLOWED_ORIGINS, MAX_BODY_BYTES, PORT, STEP_DELAY_SECONDS } from "./config.mjs";
import { launchSandbox } from "./device.mjs";
import { RunRefused, requestStop, startRun } from "./runner.mjs";
import { addEvent, store } from "./state.mjs";

// What the UI polls. Steps are included so a page can show live progress; the
// heavy parts of a run (log, screenshot) are only served by /runs.
function runProgress(run) {
  if (!run) return null;

  return {
    runId: run.runId,
    testId: run.testId,
    title: run.title,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    durationMs: run.durationMs,
    error: run.error,
    failedStep: run.failedStep,
    activeStep: run.activeStep,
    steps: run.steps,
  };
}

// The older single-test shape the UI already understands.
function legacyTest(run) {
  if (!run) return { status: "idle" };

  const active = run.steps.find((step) => step.index === run.activeStep);

  return {
    status: run.status,
    name: run.title,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    step: run.status === "running" ? active?.action ?? "Starting" : undefined,
    error: run.error ?? undefined,
  };
}

function buildState() {
  const run = store.currentRun ?? store.lastRun;

  return {
    ...store.connection,
    updatedAt: new Date().toISOString(),
    stepDelaySeconds: STEP_DELAY_SECONDS,
    run: runProgress(run),
    test: legacyTest(run),
    runIds: store.runs.map((item) => item.runId),
    currentRunId: store.currentRun?.runId ?? null,
    events: store.events,
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function readJson(request, response) {
  return new Promise((resolve) => {
    let body = "";
    let tooLarge = false;

    request.on("data", (chunk) => {
      if (tooLarge) return;

      body += chunk;

      if (body.length > MAX_BODY_BYTES) {
        tooLarge = true;
        sendJson(response, 413, { accepted: false, error: "Request body too large" });
        request.destroy();
        resolve(null);
      }
    });

    request.on("end", () => {
      if (tooLarge) return;

      try {
        resolve(JSON.parse(body));
      } catch {
        sendJson(response, 400, { accepted: false, error: "Invalid test data" });
        resolve(null);
      }
    });
  });
}

async function handle(request, response) {
  const origin = request.headers.origin;

  // Another site could make the browser call this bridge: refuse anything that
  // is not the TestBench UI or the bridge itself.
  if (
    !ALLOWED_HOSTS.has(request.headers.host ?? "") ||
    (origin !== undefined && !ALLOWED_ORIGINS.has(origin))
  ) {
    response.writeHead(403);
    return response.end();
  }

  if (origin) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");

  const path = (request.url ?? "").split("?")[0];
  const method = request.method;

  if (method === "OPTIONS") {
    response.writeHead(204);
    return response.end();
  }

  if (method === "GET" && path === "/state") {
    return sendJson(response, 200, buildState());
  }

  if (method === "GET" && path === "/screen") {
    if (!store.connection.connected) {
      response.writeHead(404);
      return response.end();
    }

    const png = await screenshot();

    if (!png) {
      response.writeHead(404);
      return response.end();
    }

    response.writeHead(200, { "Content-Type": "image/png" });
    return response.end(png);
  }

  if (method === "GET" && path === "/runs") {
    return sendJson(response, 200, store.runs);
  }

  if (method === "POST" && path === "/launch-sand") {
    sendJson(response, 202, { accepted: true });
    launchSandbox().catch((error) => addEvent("Sandbox launch failed", error.message, "warning"));
    return;
  }

  if (method === "POST" && path === "/stop") {
    return sendJson(response, 200, { stopping: requestStop() });
  }

  if (method === "POST" && path === "/run-test") {
    if (!String(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
      return sendJson(response, 415, { accepted: false, error: "Content-Type must be application/json" });
    }

    // One run at a time: a second start would drive the same tablet twice.
    if (store.currentRun) {
      return sendJson(response, 409, { accepted: false, error: "A test is already running" });
    }

    const testData = await readJson(request, response);
    if (testData === null) return;

    try {
      const { runId } = startRun(testData);
      return sendJson(response, 202, { accepted: true, runId });
    } catch (error) {
      if (error instanceof RunRefused) {
        return sendJson(response, error.status, { accepted: false, error: error.message });
      }
      throw error;
    }
  }

  response.writeHead(404);
  response.end();
}

export function startServer() {
  const server = http.createServer((request, response) => {
    handle(request, response).catch((error) => {
      console.error("[bridge] request failed:", error);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });

  server.listen(PORT, "127.0.0.1", () => {
    console.log(`VC TestBench bridge listening on http://localhost:${PORT}`);
  });

  return server;
}
