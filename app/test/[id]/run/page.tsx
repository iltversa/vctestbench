"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getTestsAction } from "@/actions/get-tests";
import ActivityFeed from "@/components/ActivityFeed";
import { useBridge } from "@/components/BridgeProvider";
import DevicePanel from "@/components/DevicePanel";
import FlowChart from "@/components/flow/FlowChart";
import { hydrateFlow } from "@/components/flow/tree";
import RunStatusBadge from "@/components/RunStatusBadge";
import { explainFailure, formatDuration } from "@/components/run-format";
import type { SavedTest } from "@/components/types";

const panel = "flex min-h-[24rem] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:min-h-0";

// A run, watched: the flow with each step's state, the tablet's screen, and a
// live feed of what is happening.
export default function RunViewPage() {
  const params = useParams();
  const testId = params.id as string;
  const bridge = useBridge();

  const [test, setTest] = useState<SavedTest | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "error" | "ready">("loading");
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getTestsAction();
        if (cancelled) return;

        if (!result.success || !result.data) {
          setState("error");
          return;
        }

        const found = (result.data as SavedTest[]).find((item) => item.id === testId);
        setTest(found ?? null);
        setState(found ? "ready" : "missing");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [testId, reload]);

  const run = bridge.run && bridge.run.testId === testId ? bridge.run : null;
  const running = run?.status === "running";

  // Elapsed time ticks only while a run is going.
  useEffect(() => {
    if (!running) return;

    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  const nodes = useMemo(
    () => (test?.flow?.length ? hydrateFlow(test.flow as never, []) : []),
    [test]
  );

  if (state === "loading") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-slate-700" role="status">Loading…</p>
      </main>
    );
  }

  if (state !== "ready" || !test) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
        <p>
          <strong>{state === "missing" ? "This test flow no longer exists." : "The test flow could not be loaded."}</strong>
        </p>
        <div className="flex gap-3">
          {state === "error" && (
            <button
              type="button"
              onClick={() => {
                setState("loading");
                setReload((count) => count + 1);
              }}
              className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Retry
            </button>
          )}
          <Link href="/" className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium">
            Test flows
          </Link>
        </div>
      </main>
    );
  }

  const total = run?.steps.length ?? 0;
  const passed = run?.steps.filter((step) => step.status === "passed").length ?? 0;
  const failedStep = run?.steps.find((step) => step.status === "failed");
  const elapsed = run
    ? run.durationMs ?? Math.max(0, now - new Date(run.startedAt).getTime())
    : null;
  const advice = run?.status === "failed" ? explainFailure(run.error) : null;
  const events = (bridge.state?.events ?? []).filter((event) => run && event.runId === run.runId);
  const percent = total ? Math.round((passed / total) * 100) : 0;

  const runAgain = async () => {
    setMessage("");
    const result = await bridge.startRun(testId);
    if (!result.ok) setMessage(result.message);
  };

  return (
    <div className="p-3 sm:p-4 lg:h-[calc(100dvh-64px)]">
      <div className="grid gap-4 lg:h-full lg:grid-cols-[minmax(0,1fr)_auto_300px]">
        {/* ----------------------- Flow: header and chart ----------------------- */}
        <section className={panel} aria-labelledby="run-title">
          <header className="border-b border-slate-200 px-4 py-3">
            <nav aria-label="Breadcrumb" className="text-sm">
              <Link href="/" className="font-medium text-slate-800 underline">Test flows</Link>
              <span className="mx-2 text-slate-500" aria-hidden="true">/</span>
              <span className="text-slate-700">Run</span>
            </nav>

            <div className="mt-1 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <h1 id="run-title" className="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900">
                  <span className="truncate">{test.title}</span>
                  <RunStatusBadge status={run ? run.status : "pending"} />
                </h1>
                <p className="text-sm text-slate-700">
                  {run
                    ? `${passed} of ${total} ${total === 1 ? "step" : "steps"} passed · ${formatDuration(elapsed)}`
                    : "Not run yet"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {running ? (
                  <button
                    type="button"
                    onClick={() => void bridge.stopRun()}
                    className="min-h-[44px] rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-900 hover:bg-red-50"
                  >
                    Stop run
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={runAgain}
                    disabled={Boolean(bridge.blockedReason) || bridge.starting}
                    title={bridge.blockedReason || undefined}
                    className="min-h-[44px] rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
                  >
                    {run ? "Run again" : "Run"}
                  </button>
                )}
                {run && !running && (
                  <Link
                    href={`/runs/${run.runId}`}
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Full report
                  </Link>
                )}
                <Link
                  href={`/test/${testId}`}
                  className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  Edit flow
                </Link>
              </div>
            </div>

            <div
              role="progressbar"
              aria-label="Steps passed"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className={`h-full transition-all ${
                  run?.status === "failed" ? "bg-red-600" : run?.status === "stopped" ? "bg-amber-500" : "bg-emerald-600"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>

            {(message || (!running && bridge.blockedReason)) && (
              <p role={message ? "alert" : "status"} className="mt-2 text-sm text-slate-800">
                {message || bridge.blockedReason}
              </p>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {nodes.length === 0 ? (
              <p className="text-sm text-slate-700">This test flow has no steps.</p>
            ) : (
              <FlowChart nodes={nodes} steps={run?.steps} activeStep={run?.activeStep} />
            )}
          </div>
        </section>

        {/* ------------------------------ Device ------------------------------ */}
        <DevicePanel className={panel} />

        {/* -------------------------- Live activity -------------------------- */}
        <section className={panel} aria-labelledby="live-title">
          <h2
            id="live-title"
            className="border-b border-slate-200 px-4 py-3 text-base font-semibold text-slate-900"
          >
            Live activity
            {running && <span className="ml-2 text-sm font-normal text-blue-800">· running</span>}
          </h2>

          {run?.status === "failed" && (
            <div className="m-3 mb-0 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-slate-900" role="alert">
              <p className="font-semibold">
                {failedStep ? `Failed at step ${failedStep.index}: ${failedStep.action}` : "The run failed"}
              </p>
              {run.error && <p className="mt-1 break-words">{run.error}</p>}
              {advice && <p className="mt-2"><strong>Likely cause:</strong> {advice}</p>}
            </div>
          )}
          {run?.status === "stopped" && (
            <p className="m-3 mb-0 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-slate-900">
              The run was stopped.
            </p>
          )}
          {run?.status === "passed" && (
            <p className="m-3 mb-0 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-slate-900">
              Flow completed. Every step passed.
            </p>
          )}

          <div className="min-h-0 flex-1 px-4 pb-2 pt-1">
            <ActivityFeed
              events={events}
              follow
              empty={run ? "Waiting for the first event…" : "Press Run to start. What happens appears here as it happens."}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
