"use client";

import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getRunAction, getRunStepImagesAction } from "@/actions/run-reports";
import ActivityFeed from "@/components/ActivityFeed";
import { useBridge } from "@/components/BridgeProvider";
import Lightbox, { type LightboxItem } from "@/components/Lightbox";
import RunStatusBadge from "@/components/RunStatusBadge";
import { iconForAction } from "@/components/flow/node-info";
import {
  explainFailure,
  formatClock,
  formatDateTime,
  formatDuration,
} from "@/components/run-format";
import type { FeedEvent } from "@/components/bridge";
import type { RunLogEntry, RunStep } from "@/db/schema/test-runs";

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
  log: RunLogEntry[];
  screenshot: string | null;
};

const outline =
  "inline-flex min-h-[44px] items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50";

export default function RunReportPage() {
  const params = useParams();
  const runId = params.id as string;
  const bridge = useBridge();

  const [run, setRun] = useState<Run | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "error" | "ready">("loading");
  const [attempt, setAttempt] = useState(0);
  const [rerun, setRerun] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  // Step pictures by step number, and which one is open in the lightbox.
  const [images, setImages] = useState<Record<number, { before?: string; after?: string }>>({});
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);

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
        // A run that just finished is copied to the database within a couple
        // of seconds, so look again a few times before giving up.
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

  const hasPictures = Boolean(run?.steps.some((step) => step.hasImage || step.hasBefore));
  const imagesLoading = hasPictures && !imagesLoaded;

  useEffect(() => {
    if (!run || !hasPictures) return;

    let cancelled = false;

    (async () => {
      const result = await getRunStepImagesAction({ runId: run.runId });
      if (cancelled) return;

      if (result.success) setImages(result.images);
      setImagesLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [run, hasPictures]);

  if (state === "loading") {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-slate-700" role="status">Loading report…</p>
      </main>
    );
  }

  if (state !== "ready" || !run) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
        <p className="text-base">
          <strong>{state === "missing" ? "This report was not found." : "The report could not be loaded."}</strong>{" "}
          <span className="text-slate-700">
            {state === "missing"
              ? "It may not have been saved yet, or it was removed."
              : "The database did not respond."}
          </span>
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setState("loading");
              setAttempt(0);
            }}
            className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Try again
          </button>
          <Link href="/runs" className={outline}>All runs</Link>
        </div>
      </main>
    );
  }

  const passed = run.steps.filter((step) => step.status === "passed").length;
  const failed = run.steps.filter((step) => step.status === "failed").length;
  const notRun = run.steps.filter((step) => step.status === "pending" || step.status === "running").length;
  const failedStep = run.steps.find((step) => step.status === "failed");
  const advice = explainFailure(run.error);
  const blocked = bridge.blockedReason;
  const canRerun = Boolean(run.testId) && !blocked && !bridge.starting;

  const events: FeedEvent[] = run.log.map((entry, index) => ({
    id: index + 1,
    at: entry.at,
    label: entry.label,
    detail: entry.detail,
    kind: entry.kind,
    runId: run.runId,
    step: entry.step,
  }));

  // Every picture in the order the run took them: a step's before, then its after.
  type Shot = { step: RunStep; phase: "before" | "after"; src: string };
  const shots: Shot[] = run.steps.flatMap((step) => {
    const found = images[step.index];
    const list: Shot[] = [];

    if (found?.before) list.push({ step, phase: "before", src: `data:image/jpeg;base64,${found.before}` });
    if (found?.after) list.push({ step, phase: "after", src: `data:image/jpeg;base64,${found.after}` });

    return list;
  });

  const lightboxItems: LightboxItem[] = shots.map(({ step, phase, src }) => ({
    src,
    title: `Step ${step.index} · ${step.action} · ${phase === "before" ? "before the action" : "after the action"}`,
    subtitle: `${step.detail}${step.finishedAt ? ` · ${formatClock(step.finishedAt)}` : ""}`,
  }));

  const openShot = (index: number, phase: "before" | "after") =>
    setViewing(shots.findIndex((shot) => shot.step.index === index && shot.phase === phase));

  const runAgain = async () => {
    if (!run.testId) return;

    setRerun({ kind: "info", text: "Starting…" });
    const result = await bridge.startRun(run.testId);

    setRerun(
      result.ok
        ? { kind: "info", text: "Started. Follow it on the Tests page; its report appears under Runs when it finishes." }
        : { kind: "error", text: result.message }
    );
  };

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
    <main className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm print:hidden">
        <Link href="/runs" className="font-medium text-slate-800 underline">Runs</Link>
        <span className="mx-2 text-slate-500" aria-hidden="true">/</span>
        <span className="text-slate-700">Report</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 text-xl font-semibold text-slate-900">
            {run.title}
            <RunStatusBadge status={run.status} />
          </h1>
          <p className="mt-1 text-sm text-slate-700">{formatDateTime(run.startedAt)}</p>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={runAgain}
            disabled={!canRerun}
            title={!run.testId ? "The test this run came from no longer exists" : blocked || undefined}
            className="min-h-[44px] rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700"
          >
            {bridge.starting ? "Starting…" : "Run again"}
          </button>
          {run.testId && <Link href={`/test/${run.testId}`} className={outline}>Open test</Link>}
          <button type="button" onClick={download} className={outline}>Download JSON</button>
          <button type="button" onClick={() => window.print()} className={outline}>Print</button>
        </div>
      </header>

      {(rerun || !run.testId || blocked) && (
        <p
          role={rerun?.kind === "error" ? "alert" : "status"}
          className={`rounded-lg border px-4 py-3 text-sm print:hidden ${
            rerun?.kind === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-slate-200 bg-white text-slate-800"
          }`}
        >
          {rerun?.text ??
            (!run.testId
              ? "The test this run came from no longer exists, so it cannot be run again."
              : `Run again is unavailable. ${blocked}`)}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-5">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4" aria-label="Summary">
        {[
          { label: "Passed", value: `${passed} of ${run.steps.length}` },
          { label: "Failed", value: String(failed) },
          { label: "Not run", value: String(notRun) },
          { label: "Duration", value: formatDuration(run.durationMs) },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">{item.label}</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{item.value}</div>
          </div>
        ))}
      </section>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm md:grid-cols-2">
        <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-700">Started</dt><dd>{formatDateTime(run.startedAt)}</dd></div>
        <div className="flex gap-2"><dt className="w-28 shrink-0 text-slate-700">Finished</dt><dd>{formatDateTime(run.finishedAt)}</dd></div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-slate-700">Device</dt>
          <dd>{run.device?.model ? `${run.device.model}${run.device.android ? `, Android ${run.device.android}` : ""}` : "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-slate-700">Wait per step</dt>
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
          {failedStep && <p className="mt-1 text-sm text-slate-900">{failedStep.detail}</p>}
          <p className="mt-3 text-sm text-slate-900"><strong>What happened:</strong> {run.error ?? "No message."}</p>
          {advice && <p className="mt-2 text-sm text-slate-900"><strong>Likely cause:</strong> {advice}</p>}

          {run.screenshot && (
            <figure className="mt-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${run.screenshot}`}
                alt="The tablet screen at the moment the run failed"
                className="max-h-[420px] rounded-lg border border-red-200"
              />
              <figcaption className="mt-1 text-xs text-slate-800">Tablet screen when the run failed.</figcaption>
            </figure>
          )}
        </section>
      )}

      {run.status === "stopped" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-900">
          This run was stopped by a person before it finished.
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Steps">
        <h2 className="border-b border-slate-200 px-4 py-3 text-base font-semibold text-slate-900">Steps</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Step</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Waited</th>
                <th className="px-4 py-3">Took</th>
                <th className="px-4 py-3">Screen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {run.steps.map((step) => (
                <tr key={`${step.index}-${step.nodeId}`} className={step.status === "failed" ? "bg-red-50/60" : undefined}>
                  <td className="px-4 py-3 align-top text-slate-700">{step.index}</td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-800"
                        aria-hidden="true"
                      >
                        <FontAwesomeIcon icon={iconForAction(step.action)} />
                      </span>
                      {step.action}
                    </div>
                    <div className="text-slate-700">{step.detail}</div>
                    {step.error && <div className="mt-1 text-red-900">{step.error}</div>}
                  </td>
                  <td className="px-4 py-3 align-top"><RunStatusBadge status={step.status} /></td>
                  <td className="px-4 py-3 align-top text-slate-800">{formatClock(step.startedAt)}</td>
                  <td className="px-4 py-3 align-top text-slate-800">{step.waitedMs > 0 ? formatDuration(step.waitedMs) : "—"}</td>
                  <td className="px-4 py-3 align-top text-slate-800">{formatDuration(step.durationMs)}</td>
                  <td className="px-4 py-3 align-top">
                    {images[step.index] ? (
                      <div className="flex gap-2">
                        {(["before", "after"] as const).map((phase) =>
                          images[step.index]?.[phase] ? (
                            <figure key={phase} className="m-0 text-center">
                              <button
                                type="button"
                                onClick={() => openShot(step.index, phase)}
                                aria-label={`Open the screenshot ${phase} the action, step ${step.index}`}
                                className="block overflow-hidden rounded-md border border-slate-300 bg-slate-900 hover:border-slate-900"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={`data:image/jpeg;base64,${images[step.index]![phase]}`}
                                  alt=""
                                  className="block h-20 w-auto"
                                />
                              </button>
                              <figcaption className="mt-0.5 text-xs text-slate-700">
                                {phase === "before" ? "Before" : "After"}
                              </figcaption>
                            </figure>
                          ) : null
                        )}
                      </div>
                    ) : (step.hasImage || step.hasBefore) && imagesLoading ? (
                      <span className="block h-20 w-12 animate-pulse rounded-md bg-slate-200" aria-label="Loading screenshots" />
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {run.steps.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-700">This run had no steps.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      </div>

      <aside
        className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-20 lg:h-[calc(100dvh-6.5rem)]"
        aria-label="Activity log"
      >
        <h2 className="text-base font-semibold text-slate-900">Activity log</h2>
        <p className="mb-2 text-sm text-slate-700">Everything the bridge did during this run, in the order it happened.</p>
        <div className="max-h-[32rem] min-h-0 flex-1 lg:max-h-none">
          <ActivityFeed events={events} empty="No log was recorded for this run." />
        </div>
      </aside>
      </div>

      <Lightbox
        items={lightboxItems}
        index={viewing}
        onChange={setViewing}
        onClose={() => setViewing(null)}
      />
    </main>
  );
}
