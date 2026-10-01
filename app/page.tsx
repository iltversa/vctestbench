"use client";
import { useCallback, useEffect, useState } from "react";
import CreateTestButton from "./testCases/page";
import { getTestsAction } from "@/actions/get-tests";
import { deleteTestAction } from "@/actions/delete-test";
import TestFlowBuilder from "@/components/TestFlowBuilder";
type FeedEvent = { id: number; at: string; label: string; detail: string; kind: "info" | "success" | "warning" };
type TabletState = { connected: boolean; device?: string; model?: string; android?: string; foregroundPackage?: string; sandboxForeground: boolean; route?: string; updatedAt: string; events: FeedEvent[]; test?: { status: "idle" | "running" | "passed" | "failed"; name?: string; step?: string; error?: string } };

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

  confirmationOptions: ConfirmationOption[];
};

export type SavedTest = {
  id: string;
  title: string;
  flow?: any[];
  actions?: SavedTestAction[];
};

export default function Home() {
    const [state, setState] = useState<TabletState | null>(null),
    [bridgeOnline, setBridgeOnline] = useState(false),
    [lastError, setLastError] = useState(""),
    [imageTick, setImageTick] = useState(0),
    [starting, setStarting] = useState(false),
    [launching, setLaunching] = useState(false);
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

    const activeTest = state?.test?.status === "running" ? state.test.name : "";

    const [savedTests, setSavedTests] = useState<SavedTest[]>([]);
    const handleRunTest = async (test: SavedTest) => {
        if (!canRun || starting) return;

        setStarting(true);
        setLastError("");
        console.log(test);
        try {
            const response = await fetch(BRIDGE + "/run-test", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: test.title,
                    actions: test.actions ?? [],
                    flow: test.flow ?? []
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to start test");
            }

            await refresh();
        } catch (error) {
            console.error("handleRunTest error:", error);
            setLastError(`Could not start ${test.title}`);
        } finally {
            setStarting(false);
        }
    };

    const handleDeleteTest = async (testId: string) => {
        if (!testId) return;

        const confirmed = window.confirm("Delete this saved test?");
        if (!confirmed) return;

        const result = await deleteTestAction({ id: testId });

        if (!result.success) {
            setLastError(result.message ?? "Could not delete test");
            return;
        }

        setSavedTests((current) => current.filter((test) => test.id !== testId));
    };

    useEffect(() => {
        const loadTests = async () => {
            const result = await getTestsAction();

            if (!result.success) {
                console.error(result.error);
                return;
            }

            setSavedTests((result.data) as []);
        };

        loadTests();
    }, []);
    return (
        <main className="min-h-screen bg-[#f4f6fa] text-slate-900">
            <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
                <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d60000] to-[#a10000] text-sm font-bold text-white shadow-sm">
                            VC
                        </div>

                        <div>
                            <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">
                                VERSACLIMBER AUTOMATION
                            </p>

                            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                                VC TestBench
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:ml-auto">
                        <button
                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!connected || launching}
                            onClick={launchSand}
                            type="button"
                        >
                            {launching ? "Launching…" : "Launch Sand"}
                        </button>

                        <div
                            className={[
                                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                                connected
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-red-200 bg-red-50 text-red-700",
                            ].join(" ")}
                        >
                            <span
                                className={[
                                    "h-2 w-2 rounded-full",
                                    connected ? "bg-emerald-500" : "bg-red-500",
                                ].join(" ")}
                            />

                            {connected ? "Lenovo tablet connected" : "Tablet disconnected"}
                        </div>
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.8fr)]">
                    <div className="h-200 flex min-w-0 flex-col gap-5">
                        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm h-100">
                            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                                <div>
                                    <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">
                                        REALTIME FEED
                                    </p>

                                    <h3 className="mt-1 text-sm font-semibold text-slate-900">
                                        Confirmed actions and screen changes
                                    </h3>
                                </div>

                                <span
                                    className={[
                                        "flex items-center justify-center h-3 w-3 rounded-full",
                                        connected ? "bg-emerald-500" : "bg-slate-400",
                                    ].join(" ")}
                                    aria-label={connected ? "Connected" : "Disconnected"}
                                    title={connected ? "Connected" : "Disconnected"}
                                />
                            </div>

                            <div className="max-h-[420px] overflow-y-auto h-[calc(100%-64px)]">
                                {!events.length ? (
                                    <div className="flex h-full flex-col items-center justify-center px-5 py-12 text-center">
                                        <div className="mb-3 text-2xl text-[#d60000]">◎</div>
                                        <strong className="text-sm text-slate-700">No tablet activity yet</strong>
                                        <span className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                                            VC TestBench will only show events it confirms on the real device.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-200">
                                        {[...events].reverse().map((event, index) => (
                                            <div className="flex gap-3 px-5 py-3" key={event.id}>
                                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-50 text-[10px] text-[#d60000]">
                                                    {index === 0 && connected ? "●" : "✓"}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <strong className="truncate text-xs font-medium text-slate-900">
                                                            {event.label}
                                                        </strong>

                                                        <span className="shrink-0 text-[10px] text-slate-500">
                                                            {event.at}
                                                        </span>
                                                    </div>

                                                    {event.detail && (
                                                        <span className="mt-0.5 block text-[11px] leading-4 text-slate-600">
                                                            {event.detail}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm h-100">
                            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                                <div>
                                    <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">
                                        TEST CASES
                                    </p>

                                    <h3 className="mt-1 text-sm font-semibold text-slate-900">Saved tests</h3>
                                </div>
                            </div>

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
                                                        className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
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

                        <section className="grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

                    <section className="h-full">
                        <div className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

                <section className="mt-5">
                    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <TestFlowBuilder />
                    </div>
                </section>
            </div>

            <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 backdrop-blur">
                <div className="mx-auto flex max-w-[1800px] items-center px-4 py-3 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 items-center gap-3">
                        <span
                            className={[
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                                connected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                            ].join(" ")}
                        >
                            {connected ? "✓" : "!"}
                        </span>

                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                                {state?.test?.status === "running"
                                    ? state.test.step ?? "Test running"
                                    : state?.test?.status === "passed"
                                        ? `${state.test.name ?? "Test"} passed`
                                        : connected
                                            ? "Choose a real test sequence"
                                            : "No tablet control active"}
                            </p>

                            <p className="truncate text-xs text-slate-500">
                                {lastError || state?.test?.error || "Only verified tablet actions appear in the feed"}
                            </p>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}
