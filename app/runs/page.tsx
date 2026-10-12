"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listRunsAction } from "@/actions/run-reports";
import RunStatusBadge from "@/components/RunStatusBadge";
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
  }, [testId, reload]);

  const retry = useCallback(() => {
    setLoading(true);
    setReload((count) => count + 1);
  }, []);

  return (
    <main className="min-h-screen bg-[#f4f6fa] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-6 py-4">
          <Link
            href="/"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg hover:bg-slate-100"
            aria-label="Back to saved tests"
          >
            ←
          </Link>
          <div>
            <p className="text-[13px] font-semibold tracking-[0.12em] text-slate-600">TEST RUNS</p>
            <h1 className="text-xl font-semibold">Run history</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1100px] px-6 py-6">
        {!loading && testId && (
          <p className="mb-4 text-sm text-slate-700">
            Showing runs of one test.{" "}
            <Link href="/runs" className="font-medium underline" onClick={() => setTestId(undefined)}>
              Show all runs
            </Link>
          </p>
        )}

        {loading ? (
          <p className="text-sm text-slate-600" role="status">Loading runs…</p>
        ) : error ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
            <p className="text-sm"><strong>Runs could not be loaded.</strong> {error}</p>
            <button
              type="button"
              onClick={retry}
              className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Retry
            </button>
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            No runs yet. Run a test and its report will appear here.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                        <div className="mt-0.5 max-w-[420px] truncate text-slate-600">
                          Step {run.failedStep ?? "?"}: {run.error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3"><RunStatusBadge status={run.status} /></td>
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(run.startedAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDuration(run.durationMs)}</td>
                    <td className="px-4 py-3 text-slate-700">{run.passedCount} / {run.stepCount} passed</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/runs/${run.runId}`}
                        className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-50"
                      >
                        View report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
