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

// The tablet: its model and state in the heading, and its screen at the real
// proportions of the device, as large as the panel allows. When there is no
// tablet it says why and what to do.
export default function DevicePanel() {
  const { online, connected, state, openSandbox } = useBridge();
  const [copied, setCopied] = useState(false);
  const [src, setSrc] = useState("");
  const [opening, setOpening] = useState(false);

  // Fetch the next frame in the background and swap it in once loaded, so the
  // picture never flashes. Only while the page is visible.
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

  const heading = connected
    ? `Device - ${state?.model ?? "Tablet"} connected`
    : online
      ? "Device - no tablet connected"
      : "Device - bridge not running";

  const description = connected
    ? `Android ${state?.android ?? "?"} - ${
        state?.sandboxForeground ? `Sandbox open on ${state.route || "…"}` : "Sandbox is not in front"
      }`
    : online
      ? "Connect the tablet to see its screen here."
      : "Three steps, in order. This updates as each one completes.";

  return (
    <section id="device" aria-labelledby="device-title" className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 id="device-title" className="text-base font-semibold text-slate-900">{heading}</h2>
          <p className="text-sm text-slate-700">{description}</p>
        </div>

        {connected && !state?.sandboxForeground && (
          <button
            type="button"
            onClick={open}
            disabled={opening}
            className="min-h-[44px] shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
          >
            {opening ? "Opening…" : "Open Sandbox app"}
          </button>
        )}
      </header>

      {connected ? (
        // The picture keeps the device's own width and height: it is scaled
        // down to fit, never stretched, and the frame hugs it.
        <div className="flex min-h-0 flex-1 items-center justify-center p-3">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt="Live view of the tablet screen"
              className="h-auto max-h-full w-auto max-w-full rounded-md border border-slate-300 bg-slate-900 object-contain"
            />
          ) : (
            <p className="text-sm text-slate-700" role="status">Loading the screen…</p>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <ol className="flex flex-col gap-5">
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
              <p className="mt-1 text-sm leading-6 text-slate-700">Plug in the tablet and allow the debugging prompt.</p>
            </Step>

            <Step number={3} state="blocked" title="Open the Sandbox app">
              <p className="mt-1 text-sm leading-6 text-slate-700">TestBench can open it for you once the tablet is connected.</p>
            </Step>
          </ol>
        </div>
      )}
    </section>
  );
}
