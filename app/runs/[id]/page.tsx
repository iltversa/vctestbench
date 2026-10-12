"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getRunAction } from "@/actions/run-reports";
import { getRunPayloadAction } from "@/actions/get-run-payload";
import { BRIDGE, bridgeStateKey, getRunBlockedReason, type TabletState } from "@/components/bridge";
import RunStatusBadge from "@/components/RunStatusBadge";
import {
  explainFailure,
  formatClock,
  formatDateTime,
  formatDuration,
} from "@/components/run-format";
import type { RunStep } from "@/db/schema/test-runs";

type Run = {
  runId: string;
  testId: string | null;
  title: string;
  status: string;
  startedAt: string | Date;
  finishedAt: string | Date | null;
  durationMs: number | null;
  error: string | null;
  failedStep: number | null;
  stepDelaySeconds: number | null;
  device: { model: string | null; android: string | null } | null;
  steps: RunStep[];
  screenshot: string | null;
};

export default function RunReportPage() {
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<Run | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "error" | "ready">("loading");
  const [attempt, setAttempt] = useState(0);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [bridgeState, setBridgeState] = useState<TabletState | null>(null);
  const [rerun, setRerun] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [starting, setStarting] = useState(false);

  // Is the bridge up and the tablet ready? Decides whether Run again is offered.
  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const response = await fetch(BRIDGE + "/state", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const next = (await response.json()) as TabletState;
        if (stopped) return;
        setBridgeState((previous) => (bridgeStateKey(previous) === bridgeStateKey(next) ? previous : next));
        setBridgeOnline(true);
      } catch {
        if (!stopped) setBridgeOnline(false);
      }
    };

    poll();
    const timer = window.setInterval(poll, 2000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const load = async () => {
      const result = await getRunAction({ runId });
      if (cancelled) return;

      if (result.success) {
        setRun(result.run as unknown as Run);
        setState("ready");
        return;
      }

      if ("notFound" in result && result.notFound) {
        // A run that just finished is copied to the database by an open
        // page within a couple of seconds, so look again a few times.
        if (attempt < 5) {
          timer = window.setTimeout(() => setAttempt((count) => count + 1), 2000);
          return;
        }
        setState("missing");
        return;
      }

      setState("error");
    };

    load();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [runId, attempt]);

  const retry = () => {
    setState("loading");
    setAttempt(0);
  };

  const runAgain = async () => {
    if (!run?.testId || starting) return;

    setStarting(true);
    setRerun({ kind: "info", text: "Starting…" });

    try {
      // Always the test as it is saved now, not the version this run used.
      const payload = await getRunPayloadAction({ id: run.testId });

      if (!payload.success) {
        setRerun({ kind: "error", text: payload.message });
        return;
      }

      const response = await fetch(BRIDGE + "/run-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
      });

      if (response.status === 409) {
        setRerun({ kind: "error", text: "A test is already running on the tablet." });
        return;
      }

      if (!response.ok) {
        throw new Error(`The bridge answered ${response.status}.`);
      }

      setRerun({ kind: "info", text: "Started. The new report appears in Run history when it finishes." });
    } catch (error) {
      console.error("runAgain error:", error);
      setRerun({
        kind: "error",
        text: bridgeOnline
          ? "The bridge did not accept the test."
          : "Could not reach the bridge. Start it with npm run bridge.",
      });
    } finally {
      setStarting(false);
    }
  };

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f6fa]">
        <p className="text-slate-600" role="status">Loading report…</p>
      </main>
    );
  }

  if (state !== "ready" || !run) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f4f6fa] px-6 text-center" role="alert">
        <p className="text-base">
          <strong>{state === "missing" ? "This report was not found." : "The report could not be loaded."}</strong>{" "}
          <span className="text-slate-600">
            {state === "missing"
              ? "It may not have been saved yet, or it was removed."
              : "The database did not respond."}
          </span>
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={retry}
            className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Try again
          </button>
          <Link href="/runs" className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium">
            All runs
          </Link>
        </div>
      </main>
    );
  }

  const passed = run.steps.filter((step) => step.status === "passed").length;
  const failed = run.steps.filter((step) => step.status === "failed").length;
  const notRun = run.steps.filter((step) => step.status === "pending" || step.status === "running").length;
  const failedStep = run.steps.find((step) => step.status === "failed");
  const advice = explainFailure(run.error);
  const blockedReason = getRunBlockedReason(bridgeOnline, bridgeState);
  const canRerun = Boolean(run.testId) && !blockedReason && !starting;

  const download = () => {
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `run-${run.runId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-[#f4f6fa] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/runs"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-lg hover:bg-slate-100 print:hidden"
              aria-label="Back to run history"
            >
              ←
            </Link>
            <div>
              <p className="text-[13px] font-semibold tracking-[0.12em] text-slate-600">RUN REPORT</p>
              <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold">
                {run.title}
                <RunStatusBadge status={run.status} />
              </h1>
            </div>
          </div>

          <div className="flex gap-2 print:hidden">
            {run.testId && (
              <Link
                href={`/test/${run.testId}`}
                className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
              >
                Open test
              </Link>
            )}
            <button
              type="button"
              onClick={runAgain}
              disabled={!canRerun}
              title={!run.testId ? "The test this run came from no longer exists" : blockedReason || undefined}
              className="min-h-[44px] rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
            >
              {starting ? "Starting…" : "Run again"}
            </button>
            <button
              type="button"
              onClick={download}
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
            >
              Download JSON
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
            >
              Print
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1100px] flex-col gap-5 px-6 py-6">
        {(rerun || !run.testId || blockedReason) && (
          <p
            role={rerun?.kind === "error" ? "alert" : "status"}
            className={`rounded-lg border px-4 py-3 text-sm print:hidden ${
              rerun?.kind === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-slate-200 bg-white text-slate-800"
            }`}
          >
            {rerun?.text ??
              (!run.testId
                ? "The test this run came from no longer exists, so it cannot be run again."
                : `Run again is unavailable. ${blockedReason}`)}
            {rerun && !rerun.text.startsWith("Starting") && rerun.kind === "info" && (
              <>
                {" "}
                <Link href="/runs" className="font-semibold underline">Run history</Link>
              </>
            )}
          </p>
        )}

        <p className="-mt-2 text-sm text-slate-600 print:hidden">
          Run again uses the test as it is saved now, which may differ from the version this run used.
        </p>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
          {[
            { label: "Passed", value: `${passed} of ${run.steps.length}` },
            { label: "Failed", value: String(failed) },
            { label: "Not run", value: String(notRun) },
            { label: "Duration", value: formatDuration(run.durationMs) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">{item.label}</div>
              <div className="mt-1 text-xl font-semibold">{item.value}</div>
            </div>
          ))}
        </section>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm md:grid-cols-2">
          <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-600">Started</dt><dd>{formatDateTime(run.startedAt)}</dd></div>
          <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-600">Finished</dt><dd>{formatDateTime(run.finishedAt)}</dd></div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-slate-600">Device</dt>
            <dd>{run.device?.model ? `${run.device.model}${run.device.android ? `, Android ${run.device.android}` : ""}` : "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-slate-600">Wait per step</dt>
            <dd>{run.stepDelaySeconds === null ? "—" : `${run.stepDelaySeconds} s`}</dd>
          </div>
        </dl>

        {run.status === "failed" && (
          <section className="rounded-xl border border-red-200 bg-red-50 p-5" aria-label="Failure">
            <h2 className="text-base font-semibold text-red-900">
              {failedStep
                ? `Failed at step ${failedStep.index} of ${run.steps.length}: ${failedStep.action}`
                : "The run failed before any step started"}
            </h2>
            {failedStep && <p className="mt-1 text-sm text-slate-800">{failedStep.detail}</p>}
            <p className="mt-3 text-sm text-slate-900"><strong>What the bridge reported:</strong> {run.error ?? "No message."}</p>
            {advice && <p className="mt-2 text-sm text-slate-900"><strong>Likely cause:</strong> {advice}</p>}

            {run.screenshot && (
              <figure className="mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${run.screenshot}`}
                  alt="The tablet screen at the moment the run failed"
                  className="max-h-[420px] rounded-lg border border-red-200"
                />
                <figcaption className="mt-1 text-xs text-slate-700">Tablet screen when the run failed.</figcaption>
              </figure>
            )}
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Steps">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Step</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Waited</th>
                <th className="px-4 py-3">Took</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {run.steps.map((step) => (
                <tr key={`${step.index}-${step.nodeId}`} className={step.status === "failed" ? "bg-red-50/60" : undefined}>
                  <td className="px-4 py-3 align-top text-slate-600">{step.index}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{step.action}</div>
                    <div className="text-slate-600">{step.detail}</div>
                    {step.error && <div className="mt-1 text-red-900">{step.error}</div>}
                  </td>
                  <td className="px-4 py-3 align-top"><RunStatusBadge status={step.status} /></td>
                  <td className="px-4 py-3 align-top text-slate-700">{formatClock(step.startedAt)}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{step.waitedMs > 0 ? formatDuration(step.waitedMs) : "—"}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{formatDuration(step.durationMs)}</td>
                </tr>
              ))}
              {run.steps.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-600">This run had no steps.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
