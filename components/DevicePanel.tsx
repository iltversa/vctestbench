"use client";

import { useEffect, useState } from "react";
import { BRIDGE } from "@/components/bridge";
import { useBridge } from "@/components/BridgeProvider";

const PREVIEW_MS = 1500;

type StepState = "done" | "todo" | "blocked";

function Step({ number, state, title, children }: { number: number; state: StepState; title: string; children?: React.ReactNode }) {
  const style =
    state === "done"
      ? "bg-emerald-700 text-white"
      : state === "todo"
        ? "bg-red-700 text-white"
        : "bg-slate-300 text-slate-800";

  return (
    <li className="flex gap-3">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold ${style}`} aria-hidden="true">
        {state === "done" ? "✓" : number}
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold text-slate-900">
          {title}
          <span className="sr-only">{state === "done" ? " (done)" : ""}</span>
        </p>
        {children}
      </div>
    </li>
  );
}

// A live view of the tablet's screen, or the steps to get one.
export default function DevicePanel() {
  const { online, connected, state, openSandbox } = useBridge();
  const [copied, setCopied] = useState(false);
  const [src, setSrc] = useState("");
  const [opening, setOpening] = useState(false);

  // Preview: fetch the next frame in the background and swap it in when it has
  // loaded, so the picture never flashes. Only while the page is visible.
  useEffect(() => {
    if (!connected) return;

    let cancelled = false;

    const load = () => {
      if (document.hidden) return;

      const next = new Image();
      const url = `${BRIDGE}/screen?t=${Date.now()}`;
      next.onload = () => {
        if (!cancelled) setSrc(url);
      };
      next.src = url;
    };

    load();
    const timer = window.setInterval(load, PREVIEW_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [connected]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText("npm run bridge");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const open = async () => {
    setOpening(true);
    try {
      await openSandbox();
    } finally {
      window.setTimeout(() => setOpening(false), 1500);
    }
  };

  if (!connected) {
    return (
      <section id="device" aria-labelledby="device-title" className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 id="device-title" className="text-lg font-semibold text-slate-900">Connect the tablet</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {online
            ? "The bridge is running. Connect the tablet to see its screen here."
            : "Three steps, in order. This panel updates as each one completes."}
        </p>

        <ol className="mt-5 flex flex-col gap-5">
          <Step number={1} state={online ? "done" : "todo"} title={online ? "Bridge running" : "Start the bridge"}>
            {!online && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100">npm run bridge</code>
                <button
                  type="button"
                  onClick={copy}
                  className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </Step>

          <Step number={2} state={online ? "todo" : "blocked"} title="Connect with USB debugging">
            <p className="mt-1 text-sm leading-6 text-slate-600">Plug in the tablet and allow the debugging prompt.</p>
          </Step>

          <Step number={3} state="blocked" title="Open the Sandbox app">
            <p className="mt-1 text-sm leading-6 text-slate-600">TestBench can open it for you once the tablet is connected.</p>
          </Step>
        </ol>
      </section>
    );
  }

  return (
    <section id="device" aria-labelledby="device-title" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="device-title" className="text-lg font-semibold text-slate-900">{state?.model ?? "Tablet"}</h2>
          <p className="text-sm text-slate-600">
            Android {state?.android ?? "?"} ·{" "}
            {state?.sandboxForeground ? `Sandbox open${state.route ? ` on ${state.route}` : ""}` : "Sandbox is not in front"}
          </p>
        </div>
        {!state?.sandboxForeground && (
          <button
            type="button"
            onClick={open}
            disabled={opening}
            className="min-h-[44px] shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
          >
            {opening ? "Opening…" : "Open Sandbox app"}
          </button>
        )}
      </div>

      <div className="mt-3 flex min-h-[200px] items-center justify-center overflow-hidden rounded-lg bg-slate-900">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Live view of the tablet screen"
            className="max-h-[min(62vh,640px)] w-auto max-w-full object-contain"
          />
        ) : (
          <p className="p-6 text-sm text-slate-300" role="status">Loading the screen…</p>
        )}
      </div>
    </section>
  );
}
