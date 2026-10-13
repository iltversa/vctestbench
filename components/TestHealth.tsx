"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRunTrendsAction } from "@/actions/run-reports";
import type { TestTrend } from "@/services/run-reports";
import { formatDateTime, formatDuration } from "@/components/run-format";

// Pass rate and recent history per test, worst first.
export default function TestHealth({ onlyTestId }: { onlyTestId?: string }) {
  const [trends, setTrends] = useState<TestTrend[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await getRunTrendsAction();
      if (cancelled) return;

      if (result.success) {
        setTrends(result.trends);
      } else {
        setFailed(true);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <p className="mb-6 text-sm text-slate-700" role="alert">
        Test health could not be loaded.
      </p>
    );
  }

  const shown = (trends ?? []).filter((trend) => !onlyTestId || trend.testId === onlyTestId);

  if (trends === null || shown.length === 0) return null;

  return (
    <section aria-labelledby="test-health">
      <h2 id="test-health" className="mb-3 text-lg font-semibold text-slate-900">
        Test health
        <span className="ml-2 text-sm font-normal text-slate-600">newest 20 runs of each test, oldest to newest</span>
      </h2>

      <div className="grid grid-cols-1 gap-3">
        {shown.map((trend) => {
          const healthy = trend.passRate >= 80;
          const colour = healthy ? "text-emerald-800" : trend.passRate >= 50 ? "text-amber-800" : "text-red-800";

          return (
            <article key={trend.key} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-900">{trend.title}</h3>
                  <p className="text-sm text-slate-600">
                    {trend.passed} of {trend.total} passed · last run {formatDateTime(trend.lastRunAt)}
                  </p>
                </div>
                <div className={`shrink-0 text-right ${colour}`}>
                  <div className="text-2xl font-semibold leading-none">{trend.passRate}%</div>
                  {trend.change !== null && trend.change !== 0 && (
                    <div className="mt-1 text-xs font-medium">
                      {trend.change > 0 ? "▲" : "▼"} {Math.abs(trend.change)} pts vs earlier
                    </div>
                  )}
                </div>
              </div>

              <ol className="mt-3 flex flex-wrap gap-1" aria-label={`Results, oldest to newest, for ${trend.title}`}>
                {trend.results.map((result) => (
                  <li key={result.runId}>
                    <Link
                      href={`/runs/${result.runId}`}
                      title={`${result.status === "passed" ? "Passed" : "Failed"} · ${formatDateTime(result.startedAt)}`}
                      aria-label={`${result.status === "passed" ? "Passed" : "Failed"} ${formatDateTime(result.startedAt)}`}
                      className={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold ${
                        result.status === "passed"
                          ? "bg-emerald-100 text-emerald-900"
                          : "bg-red-100 text-red-900"
                      }`}
                    >
                      {result.status === "passed" ? "✓" : "✕"}
                    </Link>
                  </li>
                ))}
              </ol>

              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="text-slate-600">Now</dt>
                  <dd className="font-medium text-slate-900">
                    {trend.streak.status === "passed" ? "Passing" : "Failing"} for {trend.streak.length}{" "}
                    {trend.streak.length === 1 ? "run" : "runs"}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-slate-600">Average</dt>
                  <dd className="font-medium text-slate-900">{formatDuration(trend.avgDurationMs)}</dd>
                </div>
              </dl>

              {trend.commonFailure && (
                <p className="mt-2 text-sm text-slate-800">
                  <span className="text-slate-600">Most common failure:</span>{" "}
                  {trend.commonFailure.action} {trend.commonFailure.detail}
                  {" "}({trend.commonFailure.count}×)
                </p>
              )}

              {trend.testId && !onlyTestId && (
                <Link
                  href={`/runs?test=${trend.testId}`}
                  className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-slate-900 underline"
                >
                  Runs of this test
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
