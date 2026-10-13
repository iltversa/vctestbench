"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { FeedEvent } from "@/components/bridge";
import { formatClock } from "@/components/run-format";

const KIND: Record<FeedEvent["kind"], { mark: string; style: string; label: string }> = {
  success: { mark: "✓", style: "bg-emerald-100 text-emerald-900", label: "Succeeded" },
  warning: { mark: "!", style: "bg-red-100 text-red-900", label: "Problem" },
  info: { mark: "•", style: "bg-slate-100 text-slate-700", label: "Info" },
};

// How close to the bottom still counts as "following" the feed.
const NEAR_BOTTOM_PX = 48;

// What happens during a run, in the order it happened: oldest at the top,
// newest at the bottom. While it is live the list follows the newest entry;
// scroll up to read and it stays where you left it, and following resumes when
// you scroll back to the bottom.
export default function ActivityFeed({
  events,
  empty = "Nothing has happened yet.",
  maxHeight,
  follow = false,
}: {
  events: FeedEvent[];
  empty?: string;
  // Omit to let the parent decide the height (the list then fills it).
  maxHeight?: string;
  // Keep the newest entry in view as entries arrive.
  follow?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const newest = events[events.length - 1]?.id;

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;

    const onScroll = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
      following.current = distance <= NEAR_BOTTOM_PX;
    };

    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, []);

  // After each new entry is laid out, bring it into view if we are following.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!follow || !element || !following.current) return;

    element.scrollTop = element.scrollHeight;
  }, [newest, follow]);

  if (events.length === 0) {
    return <p className="px-1 py-4 text-sm text-slate-700">{empty}</p>;
  }

  return (
    <div
      ref={scroller}
      className="h-full overflow-y-auto"
      style={maxHeight ? { maxHeight } : undefined}
      tabIndex={0}
      aria-label="Activity log, oldest first"
    >
      <ol aria-live={follow ? "polite" : "off"} className="divide-y divide-slate-100">
        {events.map((event) => {
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
    </div>
  );
}
