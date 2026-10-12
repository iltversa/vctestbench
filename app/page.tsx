"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deleteTestAction } from "@/actions/delete-test";
import { getTestsAction } from "@/actions/get-tests";
import { getRunTrendsAction, listRunsAction } from "@/actions/run-reports";
import ActivityFeed from "@/components/ActivityFeed";
import { useBridge } from "@/components/BridgeProvider";
import CreateTestModal from "@/components/CreateTestModal";
import DevicePanel from "@/components/DevicePanel";
import RunPanel from "@/components/RunPanel";
import RunStatusBadge from "@/components/RunStatusBadge";
import { formatDateTime, formatDuration } from "@/components/run-format";
import { countSteps, type SavedTest } from "@/components/types";

type RecentRun = {
  runId: string;
  title: string;
  status: string;
  startedAt: string | Date;
  durationMs: number | null;
  stepCount: number;
  passedCount: number;
};

const card = "rounded-xl border border-slate-200 bg-white";

export default function Home() {
  const bridge = useBridge();

  const [creating, setCreating] = useState(false);
  const [tests, setTests] = useState<SavedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dismissedRun, setDismissedRun] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRun[]>([]);
  const [lastResult, setLastResult] = useState<Record<string, string>>({});

  // --- Tests -----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const result = await getTestsAction();
        if (cancelled) return;

        if (!result.success) {
          setLoadError("The database did not respond.");
          return;
        }

        setLoadError("");
        setTests((result.data ?? []) as SavedTest[]);
      } catch {
        if (!cancelled) setLoadError("The server could not be reached.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [reload]);

  // --- Run history: reloads whenever a report has been stored ----------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [runs, trends] = await Promise.all([listRunsAction({ limit: 5 }), getRunTrendsAction()]);
      if (cancelled) return;

      if (runs.success) setRecent(runs.runs as RecentRun[]);

      if (trends.success) {
        const byTest: Record<string, string> = {};
        for (const trend of trends.trends) {
          if (trend.testId) byTest[trend.testId] = trend.lastStatus;
        }
        setLastResult(byTest);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [bridge.reportsVersion]);

  const visibleTests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tests;

    return tests.filter(
      (test) =>
        test.title.toLowerCase().includes(needle) ||
        (test.description ?? "").toLowerCase().includes(needle)
    );
  }, [tests, query]);

  const run = async (test: SavedTest) => {
    setMessage("");
    setDismissedRun(null);

    const result = await bridge.startRun(test.id);
    if (!result.ok) setMessage(result.message);
  };

  const remove = async (test: SavedTest) => {
    if (confirmDelete !== test.id) {
      setConfirmDelete(test.id);
      window.setTimeout(() => setConfirmDelete((current) => (current === test.id ? null : current)), 4000);
      return;
    }

    setConfirmDelete(null);
    const result = await deleteTestAction({ id: test.id });

    if (!result.success) {
      setMessage(result.message ?? "The test could not be deleted.");
      return;
    }

    setTests((current) => current.filter((item) => item.id !== test.id));
  };

  const activeRun = bridge.run && bridge.run.runId !== dismissedRun ? bridge.run : null;
  const events = bridge.state?.events ?? [];

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
      {activeRun && (
        <section className={`${card} mb-6 p-4 sm:p-5`} aria-labelledby="live-run">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="live-run" className="text-lg font-semibold text-slate-900">
              {bridge.running ? "Running now" : "Latest run"}
            </h2>
            {!bridge.running && (
              <button
                type="button"
                onClick={() => setDismissedRun(activeRun.runId)}
                className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Dismiss
              </button>
            )}
          </div>
          <RunPanel />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* ------------------------------ Tests ------------------------------ */}
          <section className={card} aria-labelledby="tests-title">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
              <div>
                <h1 id="tests-title" className="text-xl font-semibold text-slate-900">Tests</h1>
                {!loading && !loadError && (
                  <p className="text-sm text-slate-600">
                    {tests.length} {tests.length === 1 ? "test" : "tests"}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {tests.length > 5 && (
                  <>
                    <label htmlFor="test-search" className="sr-only">Search tests</label>
                    <input
                      id="test-search"
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search tests"
                      className="min-h-[44px] w-44 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    />
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  New test
                </button>
              </div>
            </div>

            {(message || (bridge.blockedReason && tests.length > 0)) && (
              <p
                role={message ? "alert" : "status"}
                className={`border-b px-4 py-3 text-sm sm:px-5 ${
                  message ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-slate-50 text-slate-800"
                }`}
              >
                {message || `Run is unavailable. ${bridge.blockedReason}`}
              </p>
            )}

            {loading ? (
              <p className="px-5 py-8 text-center text-sm text-slate-600" role="status">Loading tests…</p>
            ) : loadError ? (
              <div className="m-4 flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
                <p className="text-sm text-slate-900"><strong>Tests could not be loaded.</strong> {loadError}</p>
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
            ) : tests.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-base font-semibold text-slate-900">No tests yet</p>
                <p className="mt-1 text-sm text-slate-600">
                  A test is a list of steps that TestBench performs on the tablet for you.
                </p>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-4 min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  Create your first test
                </button>
              </div>
            ) : visibleTests.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-600">No test matches “{query}”.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {visibleTests.map((test) => {
                  const steps = countSteps(test.flow);
                  const last = lastResult[test.id];
                  const runningThis = bridge.running && bridge.run?.testId === test.id;
                  const blocked = Boolean(bridge.blockedReason) || bridge.starting || steps === 0;

                  return (
                    <li key={test.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-slate-900">
                          <Link href={`/test/${test.id}`} className="-my-2 inline-block py-2 hover:underline">{test.title}</Link>
                        </h3>
                        {test.description && (
                          <p className="truncate text-sm text-slate-700">{test.description}</p>
                        )}
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                          <span>{steps} {steps === 1 ? "step" : "steps"}</span>
                          {last && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="flex items-center gap-1.5">
                                Last run <RunStatusBadge status={last} />
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => run(test)}
                          disabled={blocked}
                          title={steps === 0 ? "Add steps to this test first" : bridge.blockedReason || undefined}
                          className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
                        >
                          {runningThis ? "Running…" : "Run"}
                        </button>
                        <Link
                          href={`/test/${test.id}`}
                          className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove(test)}
                          aria-label={confirmDelete === test.id ? `Confirm deleting ${test.title}` : `Delete ${test.title}`}
                          className={`min-h-[44px] rounded-lg px-3 text-sm font-medium ${
                            confirmDelete === test.id
                              ? "bg-red-700 text-white hover:bg-red-800"
                              : "text-red-900 hover:bg-red-50"
                          }`}
                        >
                          {confirmDelete === test.id ? "Confirm delete" : "Delete"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* --------------------------- Recent runs --------------------------- */}
          <section className={card} aria-labelledby="recent-title">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
              <h2 id="recent-title" className="text-lg font-semibold text-slate-900">Recent runs</h2>
              <Link href="/runs" className="inline-flex min-h-[44px] items-center text-sm font-medium text-slate-900 underline">
                All runs and test health
              </Link>
            </div>

            {recent.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-600">
                No runs yet. After a run you get a report with every step, its timing and, if it failed, why.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {recent.map((item) => (
                  <li key={item.runId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-600">
                        {formatDateTime(item.startedAt)} · {formatDuration(item.durationMs)} · {item.passedCount}/{item.stepCount} steps
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <RunStatusBadge status={item.status} />
                      <Link
                        href={`/runs/${item.runId}`}
                        className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                      >
                        Report
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ------------------------- Device and activity ------------------------- */}
        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-20 lg:self-start" aria-label="Device and activity">
          <DevicePanel />

          <section className={`${card} p-4`} aria-labelledby="activity-title">
            <h2 id="activity-title" className="mb-1 text-lg font-semibold text-slate-900">Activity</h2>
            <p className="mb-2 text-sm text-slate-600">
              What the tablet and your runs are doing, with the time each thing happened.
            </p>
            <ActivityFeed
              events={events}
              empty={bridge.online ? "Nothing has happened yet." : "Activity appears once the bridge is running."}
              maxHeight="22rem"
            />
          </section>
        </aside>
      </div>

      <CreateTestModal open={creating} onClose={() => setCreating(false)} />
    </main>
  );
}
