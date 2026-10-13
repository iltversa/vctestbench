"use client";

import Link from "next/link";
import { formatWhen } from "@/components/run-format";
import type { ActivityItem } from "@/services/activity";

const KINDS: Record<ActivityItem["kind"], { mark: string; style: string; verb: string }> = {
  "test.created": { mark: "+", style: "bg-blue-100 text-blue-900", verb: "Created" },
  "test.updated": { mark: "✎", style: "bg-slate-100 text-slate-800", verb: "Updated" },
  "test.deleted": { mark: "−", style: "bg-slate-200 text-slate-800", verb: "Deleted" },
  "run.passed": { mark: "✓", style: "bg-emerald-100 text-emerald-900", verb: "Passed" },
  "run.failed": { mark: "✕", style: "bg-red-100 text-red-900", verb: "Failed" },
  "run.stopped": { mark: "■", style: "bg-amber-100 text-amber-900", verb: "Stopped" },
};

// Flows being created, changed and deleted, and every run's result, in one
// timeline. Runs link to their report, flows to their editor.
export default function ActivityTimeline({
  items,
  empty = "Nothing has happened yet.",
}: {
  items: ActivityItem[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="py-3 text-sm text-slate-700">{empty}</p>;
  }

  return (
    <ol aria-label="Activity, newest first" className="divide-y divide-slate-100">
      {items.map((item) => {
        const kind = KINDS[item.kind];
        const href = item.runId
          ? `/runs/${item.runId}`
          : item.testId && item.kind !== "test.deleted"
            ? `/test/${item.testId}`
            : null;

        const label = (
          <>
            <span className="text-slate-700">{kind.verb}</span> <span className="font-semibold">“{item.title}”</span>
          </>
        );

        return (
          <li key={item.id} className="flex gap-3 py-3">
            <span
              className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${kind.style}`}
              aria-hidden="true"
            >
              {kind.mark}
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm text-slate-900">
                {item.kind.startsWith("run.") && <span className="mr-1 text-slate-700">Run</span>}
                {href ? (
                  <Link href={href} className="hover:underline">{label}</Link>
                ) : (
                  label
                )}
              </p>
              {item.detail && <p className="break-words text-sm text-slate-700">{item.detail}</p>}
              <time dateTime={item.at} className="text-xs text-slate-600">
                {formatWhen(item.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
