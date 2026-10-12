"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listRunsAction } from "@/actions/run-reports";
import { useBridge } from "@/components/BridgeProvider";
import RunStatusBadge from "@/components/RunStatusBadge";
import TestHealth from "@/components/TestHealth";
import { formatDateTime, formatDuration } from "@/components/run-format";

type RunRow = {
  runId: string;
  testId: string | null;
  title: string;
  status: string;
  startedAt: string | Date;
  durationMs: number | null;
  failedStep: number | null;
  error: string | null;
  stepCount: number;
  passedCount: number;
};

export default function RunsPage() {
  const { reportsVersion } = useBridge();

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The page can be opened for one test: /runs?test=<id>.
  const [testId, setTestId] = useState<string | undefined>(() =>
    typeof window === "undefined"
      ? undefined
      : new URLSearchParams(window.location.search).get("test") ?? undefined
  );
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await listRunsAction({ testId, limit: 100 });
      if (cancelled) return;

      if (!result.success) {
        setError(result.message);
      } else {
        setError("");
        setRuns(result.runs as RunRow[]);
      }
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [testId, reload, reportsVersion]);

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-slate-900">Runs</h1>
        <p className="text-sm text-slate-600">
          Every run of every test: how it went, how long it took, and why it failed.
        </p>
      </header>

      {!loading && testId && (
        <p className="mb-4 text-sm text-slate-800">
          Showing the runs of one test.{" "}
          <Link href="/runs" className="font-medium underline" onClick={() => setTestId(undefined)}>
            Show all runs
          </Link>
        </p>
      )}

      {!loading && !error && runs.length > 0 && <TestHealth onlyTestId={testId} />}

      {loading ? (
        <p className="text-sm text-slate-600" role="status">Loading runs…</p>
      ) : error ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
          <p className="text-sm"><strong>Runs could not be loaded.</strong> {error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setReload((count) => count + 1);
            }}
            className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-700">
          No runs yet. Run a test and its report will appear here.
        </div>
      ) : (
        <>
          {/* A table on wide screens, cards on narrow ones. */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="px-4 py-3">Test</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Steps</th>
                  <th className="px-4 py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {runs.map((run) => (
                  <tr key={run.runId}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{run.title}</div>
                      {run.status === "failed" && run.error && (
                        <div className="mt-0.5 max-w-[420px] truncate text-slate-700">
                          Step {run.failedStep ?? "?"}: {run.error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><RunStatusBadge status={run.status} /></td>
                    <td className="px-4 py-3 text-slate-800">{formatDateTime(run.startedAt)}</td>
                    <td className="px-4 py-3 text-slate-800">{formatDuration(run.durationMs)}</td>
                    <td className="px-4 py-3 text-slate-800">{run.passedCount} / {run.stepCount} passed</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/runs/${run.runId}`}
                        className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 font-medium text-slate-900 hover:bg-slate-50"
                      >
                        View report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {runs.map((run) => (
              <li key={run.runId} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-semibold text-slate-900">{run.title}</p>
                  <RunStatusBadge status={run.status} />
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {formatDateTime(run.startedAt)} · {formatDuration(run.durationMs)} · {run.passedCount}/{run.stepCount} steps
                </p>
                {run.status === "failed" && run.error && (
                  <p className="mt-1 text-sm text-red-900">Step {run.failedStep ?? "?"}: {run.error}</p>
                )}
                <Link
                  href={`/runs/${run.runId}`}
                  className="mt-3 inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-900"
                >
                  View report
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
