"use client";

import { useEffect, useRef } from "react";
import type { FeedEvent } from "@/components/bridge";
import { formatClock } from "@/components/run-format";

const KIND: Record<FeedEvent["kind"], { mark: string; style: string; label: string }> = {
  success: { mark: "✓", style: "bg-emerald-100 text-emerald-900", label: "Succeeded" },
  warning: { mark: "!", style: "bg-red-100 text-red-900", label: "Problem" },
  info: { mark: "•", style: "bg-slate-100 text-slate-700", label: "Info" },
};

// What is happening on the tablet and in the run, newest first. Every entry
// carries a real timestamp and, during a run, the step it belongs to.
export default function ActivityFeed({
  events,
  empty = "Nothing has happened yet.",
  maxHeight = "20rem",
}: {
  events: FeedEvent[];
  empty?: string;
  maxHeight?: string;
}) {
  const list = useRef<HTMLOListElement>(null);
  const newest = events[events.length - 1]?.id;

  // Keep the newest entry in view when the feed is scrolled to the top.
  useEffect(() => {
    const element = list.current;
    if (element && element.scrollTop < 40) element.scrollTop = 0;
  }, [newest]);

  if (events.length === 0) {
    return <p className="px-1 py-4 text-sm text-slate-600">{empty}</p>;
  }

  return (
    <ol
      ref={list}
      aria-label="Activity, newest first"
      aria-live="polite"
      className="divide-y divide-slate-100 overflow-y-auto"
      style={{ maxHeight }}
    >
      {[...events].reverse().map((event) => {
        const kind = KIND[event.kind];

        return (
          <li key={event.id} className="flex gap-3 py-2.5">
            <span
              className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${kind.style}`}
              aria-label={kind.label}
            >
              {kind.mark}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-slate-900">
                  {event.step ? <span className="mr-1.5 text-slate-600">Step {event.step}</span> : null}
                  {event.label}
                </p>
                <time dateTime={event.at} className="shrink-0 text-xs text-slate-600">
                  {formatClock(event.at)}
                </time>
              </div>
              {event.detail && <p className="mt-0.5 break-words text-sm text-slate-700">{event.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
