"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTestsAction } from "@/actions/get-tests";
import { deleteTestAction } from "@/actions/delete-test";
import CreateTestModal from "@/components/CreateTestModal";
import { FlowNode } from "@/components/TestFlowBuilder";
import { BRIDGE, getRunBlockedReason, type TabletState } from "@/components/bridge";
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
  description?: string;
  flow?: FlowNode[];
  actions?: SavedTestAction[];
};

const countSteps = (nodes: FlowNode[] = []): number =>
  nodes.reduce(
    (total, node) =>
      total + (node.nodeType === "action" && node.actionId ? 1 : 0) + countSteps(node.paths),
    0
  );

export default function Home() {
    const router = useRouter();
    const [state, setState] = useState<TabletState | null>(null),
    [bridgeOnline, setBridgeOnline] = useState(false),
    [lastError, setLastError] = useState(""),
    [imageTick, setImageTick] = useState(0),
    [starting, setStarting] = useState(false),
    [launching, setLaunching] = useState(false),
    [createModalOpen, setCreateModalOpen] = useState(false),
    [testsLoading, setTestsLoading] = useState(true),
    [testsError, setTestsError] = useState(""),
    [testsReload, setTestsReload] = useState(0),
    [copied, setCopied] = useState(false);
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
        }
    }, []);
    useEffect(() => {
        refresh();
        const timer = window.setInterval(refresh, 1500);
        return () => window.clearInterval(timer);
    }, [refresh]);
    const connected = bridgeOnline && Boolean(state?.connected), events = state?.events ?? [];
    const canRun = connected && state?.sandboxForeground && state.route === "/home" && state.test?.status !== "running";
    const runBlockedReason = getRunBlockedReason(bridgeOnline, state);
    const copyBridgeCommand = async () => {
        try {
            await navigator.clipboard.writeText("npm run bridge");
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };
    // const runWorkout = async () => { setStarting(true); try { const response = await fetch(BRIDGE + "/run-workout", { method: "POST" }); if (!response.ok) throw new Error(); await refresh() } catch { setLastError("Could not start the workout test") } finally { setStarting(false) } };
    // const runVideoClass = async () => { setStarting(true); try { const response = await fetch(BRIDGE + "/run-video-class", { method: "POST" }); if (!response.ok) throw new Error(); await refresh() } catch { setLastError("Could not start the video class test") } finally { setStarting(false) } };
    // const runMonument = async () => { setStarting(true); try { const response = await fetch(BRIDGE + "/run-monument", { method: "POST" }); if (!response.ok) throw new Error(); await refresh() } catch { setLastError("Could not start the Monument test") } finally { setStarting(false) } };
    const launchSand = async () => { setLaunching(true); setLastError(""); try { const response = await fetch(BRIDGE + "/launch-sand", { method: "POST" }); if (!response.ok) throw new Error(); window.setTimeout(refresh, 1200) } catch { setLastError("Could not launch Sandbox") } finally { window.setTimeout(() => setLaunching(false), 1200) } };

    const activeTest = state?.test?.status === "running" ? state.test.name : "";

    const handleCreateTestClick = () => {
        setCreateModalOpen(true);
    };

    const handleEditTest = (testId: string) => {
        router.push(`/test/${testId}`);
    };

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

    const handleDeleteTest = async (test: SavedTest) => {
        if (!test.id) return;

        const confirmed = window.confirm(`Delete "${test.title}"? This cannot be undone.`);
        if (!confirmed) return;

        const result = await deleteTestAction({ id: test.id });

        if (!result.success) {
            setLastError(result.message ?? "Could not delete test");
            return;
        }

        setSavedTests((current) => current.filter((item) => item.id !== test.id));
    };

    const retryLoadTests = () => {
        setTestsLoading(true);
        setTestsError("");
        setTestsReload((count) => count + 1);
    };

    useEffect(() => {
        let cancelled = false;

        const loadTests = async () => {
            try {
                const result = await getTestsAction();
                if (cancelled) return;

                if (!result.success) {
                    console.error(result.error);
                    setTestsError("The database did not respond.");
                    return;
                }

                setSavedTests((result.data ?? []) as SavedTest[]);
            } catch (error) {
                if (cancelled) return;
                console.error("loadTests error:", error);
                setTestsError("The server could not be reached.");
            } finally {
                if (!cancelled) setTestsLoading(false);
            }
        };

        loadTests();

        return () => {
            cancelled = true;
        };
    }, [testsReload]);
    return (
        <main className="flex min-h-screen flex-col bg-[#f4f6fa] text-slate-900">
            <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
                <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d60000] to-[#a10000] text-sm font-bold text-white shadow-sm">
                            VC
                        </div>

                        <div>
                            <p className="text-[13px] font-semibold tracking-[0.12em] text-slate-600">
                                VERSACLIMBER AUTOMATION
                            </p>

                            <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                                VC TestBench
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:ml-auto">
                        <button
                            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={!connected || launching}
                            onClick={launchSand}
                            type="button"
                        >
                            {launching ? "Opening…" : "Open Sandbox app"}
                        </button>

                        <div
                            className={[
                                "flex min-h-[44px] items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
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

                            {connected ? "Lenovo tablet connected" : bridgeOnline ? "Tablet offline" : "Bridge not running"}
                        </div>
                    </div>
                </div>
            </header>

            <div className="mx-auto flex w-full max-w-[1800px] flex-1 px-4 py-5 sm:px-6 lg:px-8">
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(360px,0.8fr)]">
                    <div className="flex min-h-0 min-w-0 flex-col gap-5">
                        {connected && (
                            <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm h-[280px]">
                                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                                    <div>
                                        <p className="text-[13px] font-semibold tracking-[0.12em] text-slate-600">
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
                        )}

                        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex-1">
                            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                                <div>
                                    <p className="text-[13px] font-semibold tracking-[0.12em] text-slate-600">
                                        TEST CASES
                                    </p>

                                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                                        Saved tests
                                        {!testsLoading && !testsError && (
                                            <span className="ml-2 text-sm font-normal text-slate-600">
                                                {savedTests.length} {savedTests.length === 1 ? "test" : "tests"}
                                            </span>
                                        )}
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleCreateTestClick}
                                    className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                                >
                                    New test
                                </button>
                            </div>

                            {runBlockedReason && savedTests.length > 0 && (
                                <p className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-700" role="status">
                                    Run is unavailable. {runBlockedReason}
                                </p>
                            )}

                            <div className="h-[calc(100%-72px)] overflow-y-auto">
                                {testsLoading ? (
                                    <div className="px-5 py-8 text-center text-sm text-slate-600" role="status">
                                        Loading tests…
                                    </div>
                                ) : testsError ? (
                                    <div className="m-5 flex flex-col items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
                                        <p className="text-sm leading-6 text-slate-900">
                                            <strong>Tests could not be loaded.</strong> {testsError}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={retryLoadTests}
                                            className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                ) : savedTests.length === 0 ? (
                                    <div className="px-5 py-8 text-center text-sm text-slate-600">
                                        No tests yet. Choose New test to create your first one.
                                    </div>
                                ) : (
                                    <ul className="flex flex-col gap-3 p-4">
                                        {savedTests.map((test) => {
                                            const steps = countSteps(test.flow);

                                            return (
                                                <li
                                                    key={test.id}
                                                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                                                >
                                                    <div className="min-w-0">
                                                        <h3 className="truncate text-base font-semibold text-slate-900">{test.title}</h3>
                                                        {test.description && (
                                                            <p className="mt-0.5 truncate text-sm text-slate-600">{test.description}</p>
                                                        )}
                                                        <p className="mt-0.5 text-sm text-slate-600">
                                                            {steps} {steps === 1 ? "step" : "steps"}
                                                        </p>
                                                    </div>

                                                    <div className="flex shrink-0 items-center gap-2">
                                                        <button
                                                            className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                                                            disabled={!canRun || starting}
                                                            onClick={() => handleRunTest(test)}
                                                            title={runBlockedReason || undefined}
                                                            type="button"
                                                        >
                                                            {activeTest === test.title ? "Running…" : "Run"}
                                                        </button>

                                                        <button
                                                            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
                                                            onClick={() => handleEditTest(test.id)}
                                                            type="button"
                                                        >
                                                            Edit
                                                        </button>

                                                        <button
                                                            className="min-h-[44px] rounded-lg px-3 py-2 text-sm font-medium text-red-800 transition hover:bg-red-50"
                                                            onClick={() => handleDeleteTest(test)}
                                                            type="button"
                                                            aria-label={`Delete ${test.title}`}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </section>

                        {connected && (
                        <section className="flex-shrink-0 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="min-w-0 px-3 py-4 text-center">
                                <span className="block text-[13px] font-semibold tracking-wider text-slate-600">
                                    TABLET
                                </span>

                                <strong
                                    className={[
                                        "mt-1 block truncate text-sm",
                                        connected ? "text-emerald-600" : "text-red-600",
                                    ].join(" ")}
                                >
                                    {connected ? "Connected" : "Offline"}
                                </strong>
                            </div>

                            <div className="min-w-0 px-3 py-4 text-center">
                                <span className="block text-[13px] font-semibold tracking-wider text-slate-600">
                                    SANDBOX APP
                                </span>

                                <strong className="mt-1 block truncate text-sm text-slate-800">
                                    {state?.sandboxForeground ? "Visible" : "—"}
                                </strong>
                            </div>

                            <div className="min-w-0 px-3 py-4 text-center">
                                <span className="block text-[13px] font-semibold tracking-wider text-slate-600">
                                    CURRENT SCREEN
                                </span>

                                <strong className="mt-1 block truncate text-sm text-slate-800">
                                    {state?.route ?? "—"}
                                </strong>
                            </div>
                        </section>
                        )}
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
                                <div className="flex h-full flex-col gap-5 overflow-y-auto bg-white p-6">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Connect the tablet</h2>
                                        <p className="mt-1 text-sm leading-6 text-slate-600">
                                            Three steps, in order. This panel updates as each one completes.
                                        </p>
                                    </div>

                                    <ol className="flex flex-col gap-5">
                                        <li className="flex gap-3">
                                            <span className={["grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold text-white", bridgeOnline ? "bg-emerald-700" : "bg-red-700"].join(" ")} aria-hidden="true">
                                                {bridgeOnline ? "✓" : "1"}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-base font-semibold text-slate-900">
                                                    Start the bridge{" "}
                                                    <span className={["text-sm font-medium", bridgeOnline ? "text-emerald-800" : "text-red-800"].join(" ")}>
                                                        {bridgeOnline ? "Running" : "Not running"}
                                                    </span>
                                                </p>
                                                {!bridgeOnline && (
                                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                                        <code className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100">npm run bridge</code>
                                                        <button
                                                            type="button"
                                                            onClick={copyBridgeCommand}
                                                            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                                                        >
                                                            {copied ? "Copied" : "Copy"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </li>

                                        <li className="flex gap-3">
                                            <span className={["grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold", state?.connected ? "bg-emerald-700 text-white" : "bg-slate-300 text-slate-800"].join(" ")} aria-hidden="true">
                                                {state?.connected ? "✓" : "2"}
                                            </span>
                                            <div>
                                                <p className="text-base font-semibold text-slate-900">Connect with USB debugging</p>
                                                <p className="mt-1 text-sm leading-6 text-slate-600">Plug in the tablet and allow the debugging prompt.</p>
                                            </div>
                                        </li>

                                        <li className="flex gap-3">
                                            <span className={["grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold", state?.sandboxForeground ? "bg-emerald-700 text-white" : "bg-slate-300 text-slate-800"].join(" ")} aria-hidden="true">
                                                {state?.sandboxForeground ? "✓" : "3"}
                                            </span>
                                            <div>
                                                <p className="text-base font-semibold text-slate-900">Open the Sandbox app</p>
                                                <p className="mt-1 text-sm leading-6 text-slate-600">Use Open Sandbox app in the header once the tablet is connected.</p>
                                            </div>
                                        </li>
                                    </ol>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            {(lastError || (state?.test?.status && state.test.status !== "idle")) && (
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
                                        : state?.test?.status === "failed"
                                            ? `${state.test.name ?? "Test"} failed`
                                            : "Something went wrong"}
                            </p>

                            <p className="truncate text-sm text-slate-700" role="status">
                                {lastError || state?.test?.error || ""}
                            </p>
                        </div>
                    </div>
                </div>
            </footer>
            )}

            <CreateTestModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
        </main>
    );
}
