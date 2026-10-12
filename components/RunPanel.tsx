"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBridge } from "@/components/BridgeProvider";
import ActivityFeed from "@/components/ActivityFeed";
import RunStatusBadge from "@/components/RunStatusBadge";
import { explainFailure, formatDuration } from "@/components/run-format";
import type { StepProgress } from "@/components/bridge";

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [active]);

  return now;
}

function StepMarker({ step }: { step: StepProgress }) {
  const base = "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold";

  if (step.status === "running") {
    return (
      <span className={`${base} border-2 border-blue-700 border-t-transparent animate-spin`} role="img" aria-label="Running" />
    );
  }
  if (step.status === "passed") {
    return <span className={`${base} bg-emerald-100 text-emerald-900`} role="img" aria-label="Passed">✓</span>;
  }
  if (step.status === "failed") {
    return <span className={`${base} bg-red-100 text-red-900`} role="img" aria-label="Failed">✕</span>;
  }
  if (step.status === "stopped") {
    return <span className={`${base} bg-amber-100 text-amber-900`} role="img" aria-label="Stopped">■</span>;
  }

  return <span className={`${base} bg-slate-100 text-slate-700`} role="img" aria-label="Not run yet">{step.index}</span>;
}

// A run as it happens: every step with its state, what the tablet is doing
// now, the activity log, and the way to stop it. Also the result afterwards.
export default function RunPanel({ testId }: { testId?: string }) {
  const { run, running, state, stopRun } = useBridge();
  const [stopping, setStopping] = useState(false);
  const now = useNow(running);

  const shown = run && (!testId || run.testId === testId) ? run : null;

  if (!shown) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-700">
        No run yet. Press Run and every step appears here as it happens, with its result and timing.
      </p>
    );
  }

  const total = shown.steps.length;
  const done = shown.steps.filter((step) => step.status === "passed").length;
  const percent = total ? Math.round((done / total) * 100) : shown.status === "passed" ? 100 : 0;
  const elapsed = shown.durationMs ?? now - new Date(shown.startedAt).getTime();
  const failed = shown.steps.find((step) => step.status === "failed");
  const advice = explainFailure(shown.error);
  const delay = state?.stepDelaySeconds ?? 5;
  const log = (state?.events ?? []).filter((event) => event.runId === shown.runId);

  const stop = async () => {
    setStopping(true);
    try {
      await stopRun();
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-base font-semibold text-slate-900">
            <span className="truncate">{shown.title}</span>
            <RunStatusBadge status={shown.status} />
          </h3>
          <p className="mt-0.5 text-sm text-slate-700">
            {done} of {total} {total === 1 ? "step" : "steps"} passed · {formatDuration(Math.max(0, elapsed))}
          </p>
        </div>

        <div className="flex gap-2">
          {running ? (
            <button
              type="button"
              onClick={stop}
              disabled={stopping}
              className="min-h-[44px] rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-900 hover:bg-red-50 disabled:opacity-60"
            >
              {stopping ? "Stopping…" : "Stop run"}
            </button>
          ) : (
            <Link
              href={`/runs/${shown.runId}`}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Full report
            </Link>
          )}
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Steps passed"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className={`h-full transition-all ${shown.status === "failed" ? "bg-red-600" : shown.status === "stopped" ? "bg-amber-500" : "bg-emerald-600"}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {(shown.status === "failed" || shown.status === "stopped") && (
        <div
          className={`rounded-lg border p-4 text-sm ${
            shown.status === "failed" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
          }`}
          role="alert"
        >
          <p className="font-semibold text-slate-900">
            {shown.status === "stopped"
              ? "The run was stopped."
              : failed
                ? `Failed at step ${failed.index}: ${failed.action}`
                : "The run failed before any step started."}
          </p>
          {shown.error && shown.status === "failed" && <p className="mt-1 text-slate-900">{shown.error}</p>}
          {advice && shown.status === "failed" && (
            <p className="mt-2 text-slate-900"><strong>Likely cause:</strong> {advice}</p>
          )}
        </div>
      )}

      <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {shown.steps.map((step) => {
          const active = step.status === "running";

          return (
            <li key={step.nodeId} className={`flex gap-3 px-3 py-2.5 ${active ? "bg-blue-50/60" : ""}`}>
              <StepMarker step={step} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {step.action} <span className="font-normal text-slate-700">{step.detail}</span>
                </p>
                {active && (
                  <p className="text-sm text-blue-900">
                    {step.phase === "waiting"
                      ? `Waiting ${delay}s before it runs`
                      : "Working on the tablet…"}
                  </p>
                )}
                {step.error && <p className="mt-0.5 break-words text-sm text-red-900">{step.error}</p>}
              </div>
              <span className="shrink-0 text-xs text-slate-600">
                {step.status === "passed" || step.status === "failed" ? formatDuration(step.durationMs) : ""}
              </span>
            </li>
          );
        })}
      </ol>

      <div>
        <h4 className="mb-1 text-sm font-semibold text-slate-900">Activity</h4>
        <ActivityFeed events={log} empty="Activity for this run appears here." maxHeight="14rem" />
      </div>
    </div>
  );
}
