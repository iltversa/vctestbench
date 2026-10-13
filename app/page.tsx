"use client";
<<<<<<< HEAD

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
=======
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getTestActionById, getTestsAction } from "@/actions/get-tests";
>>>>>>> main
import { deleteTestAction } from "@/actions/delete-test";
import { getTestsAction } from "@/actions/get-tests";
import { getActivityAction, getRunTrendsAction } from "@/actions/run-reports";
import ActivityTimeline from "@/components/ActivityTimeline";
import { useBridge } from "@/components/BridgeProvider";
import CreateTestModal from "@/components/CreateTestModal";
import { formatDate, formatWhen } from "@/components/run-format";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { iconForAction } from "@/components/flow/node-info";
import { countSteps, flowActionTitles, type SavedTest } from "@/components/types";
import type { ActivityItem } from "@/services/activity";
import type { TestTrend } from "@/services/run-reports";

<<<<<<< HEAD
const card = "rounded-xl border border-slate-200 bg-white";

// "Created 12 Oct 2026 · Last tested Today, 14:05 · 67% passed (8 of 12)"
// The kinds of step in a flow, in order, as small icons.
function ActionStrip({ titles }: { titles: string[] }) {
  if (titles.length === 0) return null;

  const shown = titles.slice(0, 10);

  return (
    <p className="mt-1 flex flex-wrap items-center gap-1" aria-label={`Steps: ${titles.join(", ")}`}>
      {shown.map((title, index) => (
        <span
          key={index}
          title={title}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs text-slate-800"
          aria-hidden="true"
        >
          <FontAwesomeIcon icon={iconForAction(title)} />
        </span>
      ))}
      {titles.length > shown.length && (
        <span className="text-xs text-slate-700" aria-hidden="true">+{titles.length - shown.length}</span>
      )}
    </p>
  );
}

function Insight({ test, trend }: { test: SavedTest; trend?: TestTrend }) {
  const tone =
    !trend ? "" : trend.passRate >= 80 ? "text-emerald-800" : trend.passRate >= 50 ? "text-amber-800" : "text-red-800";

  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-slate-700">
      <span>Created {formatDate(test.createdAt)}</span>
      <span aria-hidden="true" className="text-slate-400">·</span>
      {trend ? (
        <>
          <span>Last tested {formatWhen(trend.lastRunAt)}</span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className={`font-semibold ${tone}`}>
            {trend.passRate}% passed
            <span className="font-normal text-slate-700"> ({trend.passed} of {trend.total})</span>
          </span>
        </>
      ) : (
        <span>Not tested yet</span>
      )}
    </p>
  );
}

export default function Home() {
  const bridge = useBridge();
  const router = useRouter();
=======
const BRIDGE = "http://localhost:3131";
export type ConfirmationOption = {
    id: string;
    testActionId: string;
    option: string;
    isSelected: boolean;
};

export type SavedTestAction = {
    id: string;
    title: string;
    hasConfirmation: boolean;
    confirmationTimeout?: number | null;
    actionTimeout: number;
    confirmationOptions: { option: string; isSelected: boolean }[];
    pasteText?: string | null;
    email?: string | null;
    password?: string | null;
    icon?: string | null;
    clickOnText?: string | null;
};

export type SavedTest = {
    id: string;
    title: string;
    description: string;
    flow?: FlowNode[];
    createdAt: Date; updatedAt: Date;
    //   actions?: SavedTestAction[];

};

export default function Home() {
    const router = useRouter();
    const [state, setState] = useState<TabletState | null>(null),
        [bridgeOnline, setBridgeOnline] = useState(false),
        [lastError, setLastError] = useState(""),
        [imageTick, setImageTick] = useState(0),
        [starting, setStarting] = useState(false),
        [launching, setLaunching] = useState(false),
        [createModalOpen, setCreateModalOpen] = useState(false);
    const refresh = useCallback(async () => {
        try {
            const response = await fetch(BRIDGE + "/state", { cache: "no-store" });
            if (!response.ok) throw new Error();
            const next = (await response.json()) as TabletState;
            setState(next);
            setBridgeOnline(true);
            setLastError("");
            if (next.connected) setImageTick(Date.now());
        } catch {
            setBridgeOnline(false);
            setLastError("Local tablet monitor is not running");
        }
    }, []);

    const searchParams = useSearchParams();
    const hasTriggered = useRef(false);
    const testId = searchParams.get("testId");


    useEffect(() => {
        if (!testId || hasTriggered.current) return;

        const findButton = () => {
            const button = document.querySelector<HTMLButtonElement>(
                ".save-test-button"
            );

            if (!button) return;

            console.log("Button found:", button);
            console.log("Button disabled:", button.disabled);

            // if (button.disabled) return;

            hasTriggered.current = true;
            observer.disconnect();
            button.click();

            // Optional: remove the URL parameter after triggering.
            router.replace("/");
        };

        const observer = new MutationObserver(findButton);

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["disabled"],
        });

        findButton();

        return () => observer.disconnect();
    }, [testId, router]);

    useEffect(() => {
        refresh();
        const timer = window.setInterval(refresh, 1500);
        return () => window.clearInterval(timer);
    }, [refresh]);
    const connected = bridgeOnline && Boolean(state?.connected), events = state?.events ?? [];
    const canRun = connected && state?.sandboxForeground && state.route === "/home" && state.test?.status !== "running";
    // const runWorkout = async () => { setStarting(true); try { const response = await fetch(BRIDGE + "/run-workout", { method: "POST" }); if (!response.ok) throw new Error(); await refresh() } catch { setLastError("Could not start the workout test") } finally { setStarting(false) } };
    // const runVideoClass = async () => { setStarting(true); try { const response = await fetch(BRIDGE + "/run-video-class", { method: "POST" }); if (!response.ok) throw new Error(); await refresh() } catch { setLastError("Could not start the video class test") } finally { setStarting(false) } };
    // const runMonument = async () => { setStarting(true); try { const response = await fetch(BRIDGE + "/run-monument", { method: "POST" }); if (!response.ok) throw new Error(); await refresh() } catch { setLastError("Could not start the Monument test") } finally { setStarting(false) } };
    const launchSand = async () => { setLaunching(true); setLastError(""); try { const response = await fetch(BRIDGE + "/launch-sand", { method: "POST" }); if (!response.ok) throw new Error(); window.setTimeout(refresh, 1200) } catch { setLastError("Could not launch Sandbox") } finally { window.setTimeout(() => setLaunching(false), 1200) } };
>>>>>>> main

  const [creating, setCreating] = useState(false);
  const [tests, setTests] = useState<SavedTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [trends, setTrends] = useState<Record<string, TestTrend>>({});
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityReload, setActivityReload] = useState(0);

  // --- Tests ----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

<<<<<<< HEAD
    const load = async () => {
      try {
        const result = await getTestsAction();
        if (cancelled) return;
=======
    const handleEditTest = (testId: string) => {
        router.push(`/test/${testId}`);
    };

    const [savedTests, setSavedTests] = useState<SavedTest[]>([]);

    const handleRunTest = async (test: SavedTest) => {

        if (!canRun || starting) return;

        setStarting(true);
        setLastError("");

        try {
            let testToRun = test;

            // If the URL contains a test ID, load the saved test.
            if (!test || testId) {

                const result = await getTestActionById(testId || "");
                if (!result.success) {
                    throw new Error(result.error);
                }
                console.log("result", result.data)

                testToRun = result?.data?.data as SavedTest;
            }

            const response = await fetch(BRIDGE + "/run-test", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: testToRun.title,
                    // actions: testToRun.actions ?? [],
                    flow: testToRun.flow ?? [],
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to start test");
            }

            await refresh();
        } catch (error) {
            console.error("handleRunTest error:", error);
            setLastError(
                `Could not start ${test.title}`
            );
        } finally {
            setStarting(false);
        }
    };

    const handleDeleteTest = async (testId: string) => {
        if (!testId) return;

        const confirmed = window.confirm("Delete this saved test?");
        if (!confirmed) return;

        const result = await deleteTestAction({ id: testId });
>>>>>>> main

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

  // --- Insight and activity: reload when a report is stored or a flow changes ----
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [stats, feed] = await Promise.all([getRunTrendsAction(), getActivityAction({ limit: 40 })]);
      if (cancelled) return;

      if (stats.success) {
        const byTest: Record<string, TestTrend> = {};
        for (const trend of stats.trends) {
          if (trend.testId) byTest[trend.testId] = trend;
        }
        setTrends(byTest);
      }

      if (feed.success) setActivity(feed.items);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [bridge.reportsVersion, activityReload]);

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

    const result = await bridge.startRun(test.id);

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    router.push(`/test/${test.id}/run`);
  };

  const remove = async (test: SavedTest) => {
    // The first press arms it, the second confirms: no browser dialog.
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
    setActivityReload((count) => count + 1);
  };

  const live = bridge.running ? bridge.run : null;
  const liveDone = live ? live.steps.filter((step) => step.status === "passed").length : 0;

<<<<<<< HEAD
  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:h-[calc(100dvh-64px)]">
      <div className="grid gap-6 lg:h-full lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ------------------------------ Tests ------------------------------ */}
        <section className={`${card} flex min-h-0 min-w-0 flex-col`} aria-labelledby="tests-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <div>
              <h1 id="tests-title" className="text-xl font-semibold text-slate-900">Test flows</h1>
              {!loading && !loadError && (
                <p className="text-sm text-slate-700">
                  {tests.length} {tests.length === 1 ? "flow" : "flows"}
                </p>
              )}
=======
                            <div className="h-[calc(100%-56px)] overflow-y-auto">
                                {savedTests.length === 0 ? (
                                    <div className="px-5 py-8 text-center text-xs text-slate-500">
                                        No tests yet. Create one to get started.
                                    </div>
                                ) : (
                                    <ul className="divide-y divide-slate-200">
                                        {savedTests.map((test) => (
                                            <li key={test.id} className="flex items-center justify-between gap-3 px-5 py-3">
                                                <span className="min-w-0 truncate text-sm text-slate-700">{test.title}</span>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                                                        onClick={() => handleEditTest(test.id)}
                                                        type="button"
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        className="save-test-button shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                                        disabled={!canRun || starting}
                                                        onClick={() => handleRunTest(test)}
                                                        type="button"
                                                    >
                                                        {activeTest === test.title ? "Running…" : "Run"}
                                                    </button>

                                                    <button
                                                        className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                                                        onClick={() => handleDeleteTest(test.id)}
                                                        type="button"
                                                        aria-label={`Delete ${test.title}`}
                                                        title="Delete test"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </section>

                        <section className="flex-shrink-0 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="min-w-0 px-3 py-4 text-center">
                                <span className="block text-[9px] font-semibold tracking-wider text-slate-500">
                                    USB STATUS
                                </span>

                                <strong
                                    className={[
                                        "mt-1 block truncate text-xs",
                                        connected ? "text-emerald-600" : "text-red-600",
                                    ].join(" ")}
                                >
                                    {connected ? "Online" : "Offline"}
                                </strong>
                            </div>

                            <div className="min-w-0 px-3 py-4 text-center">
                                <span className="block text-[9px] font-semibold tracking-wider text-slate-500">
                                    APP STATE
                                </span>

                                <strong className="mt-1 block truncate text-xs text-slate-700">
                                    {state?.sandboxForeground ? "Visible" : "—"}
                                </strong>
                            </div>

                            <div className="min-w-0 px-3 py-4 text-center">
                                <span className="block text-[9px] font-semibold tracking-wider text-slate-500">
                                    ROUTE
                                </span>

                                <strong className="mt-1 block truncate text-xs text-slate-700">
                                    {state?.route ?? "—"}
                                </strong>
                            </div>
                        </section>
                    </div>

                    <section className="min-h-0 h-full">
                        <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            {connected ? (
                                <img
                                    src={BRIDGE + "/screen?t=" + imageTick}
                                    alt="Current Lenovo tablet screen"
                                    className="h-full w-full object-cover bg-[#111]"
                                />
                            ) : (
                                <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-100 text-center text-slate-600">
                                    <span className="grid h-12 w-12 place-items-center rounded-full border border-slate-300 bg-white text-xs font-black text-slate-500">
                                        USB
                                    </span>
                                    <strong className="text-lg text-slate-800">Tablet disconnected</strong>
                                    <small className="text-sm text-slate-500">
                                        Reconnect and authorize USB debugging
                                    </small>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
>>>>>>> main
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {tests.length > 5 && (
                <>
                  <label htmlFor="test-search" className="sr-only">Search test flows</label>
                  <input
                    id="test-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search"
                    className="min-h-[44px] w-40 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                New test flow
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

          <div className="min-h-0 flex-1 lg:overflow-y-auto">
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-slate-700" role="status">Loading test flows…</p>
          ) : loadError ? (
            <div className="m-4 flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
              <p className="text-sm text-slate-900"><strong>Test flows could not be loaded.</strong> {loadError}</p>
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
              <p className="text-base font-semibold text-slate-900">No test flows yet</p>
              <p className="mt-1 text-sm text-slate-700">
                A test flow is a list of steps that TestBench performs on the tablet for you.
              </p>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-4 min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Create your first test flow
              </button>
            </div>
          ) : visibleTests.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-700">No test flow matches “{query}”.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {visibleTests.map((test) => {
                const steps = countSteps(test.flow);
                const runningThis = bridge.running && bridge.run?.testId === test.id;
                const blocked = Boolean(bridge.blockedReason) || bridge.starting || steps === 0;
                const confirming = confirmDelete === test.id;

                return (
                  <li key={test.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-slate-900">
                        <Link href={`/test/${test.id}`} className="-my-2 inline-block py-2 hover:underline">
                          {test.title}
                        </Link>
                        <span className="ml-2 text-sm font-normal text-slate-700">
                          {steps} {steps === 1 ? "step" : "steps"}
                        </span>
                      </h2>
                      <ActionStrip titles={flowActionTitles(test.flow, test.actions)} />
                      <Insight test={test} trend={trends[test.id]} />
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {runningThis ? (
                        <Link
                          href={`/test/${test.id}/run`}
                          className="inline-flex min-h-[44px] items-center rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                          Watch run
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => run(test)}
                          disabled={blocked}
                          title={steps === 0 ? "Add steps to this test flow first" : bridge.blockedReason || undefined}
                          className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
                        >
                          Run
                        </button>
                      )}
                      <Link
                        href={`/test/${test.id}`}
                        className="inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(test)}
                        aria-label={confirming ? `Confirm deleting ${test.title}` : `Delete ${test.title}`}
                        className={`min-h-[44px] rounded-lg px-3 text-sm font-medium ${
                          confirming ? "bg-red-700 text-white hover:bg-red-800" : "text-red-900 hover:bg-red-50"
                        }`}
                      >
                        {confirming ? "Confirm delete" : "Delete"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          </div>
        </section>

        {/* ----------------------------- Activity ----------------------------- */}
        <aside className={`${card} flex min-h-0 min-w-0 flex-col p-4`} aria-labelledby="activity-title">
          <h2 id="activity-title" className="text-lg font-semibold text-slate-900">Activity</h2>
          <p className="mb-1 text-sm text-slate-700">
            Test flows created, changed and deleted, and how every run went.
          </p>

          {live && (
            <Link
              href={`/test/${live.testId}/run`}
              className="mt-2 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-slate-900 hover:bg-blue-100"
            >
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-semibold">Running “{live.title}”</span>
                <span className="block text-slate-700">
                  Step {Math.min(liveDone + 1, live.steps.length)} of {live.steps.length} · watch it live
                </span>
              </span>
            </Link>
          )}

          <div className="min-h-0 flex-1 lg:overflow-y-auto">
            <ActivityTimeline
              items={activity}
              empty="No activity yet. Create a test flow and run it; everything shows up here."
            />
          </div>
        </aside>
      </div>

      <CreateTestModal open={creating} onClose={() => setCreating(false)} />
    </main>
  );
}
