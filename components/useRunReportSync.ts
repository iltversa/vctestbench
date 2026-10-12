"use client";

import { useEffect, useRef } from "react";
import { BRIDGE, type TabletState } from "@/components/bridge";
import { filterUnsavedRunIdsAction, saveRunReportAction } from "@/actions/run-reports";

// The bridge keeps finished runs in memory. Whichever page is open copies the
// ones the database has not seen yet; saving is idempotent, so two open pages
// (or a reload) cannot create duplicates.
export function useRunReportSync(
  state: TabletState | null,
  onSaved?: (runId: string) => void
) {
  const handled = useRef<Set<string>>(new Set());
  const busy = useRef(false);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  const key = state?.runIds?.join(",") ?? "";

  useEffect(() => {
    const runIds = key ? key.split(",") : [];
    const fresh = runIds.filter((id) => !handled.current.has(id));

    if (fresh.length === 0 || busy.current) return;

    busy.current = true;

    (async () => {
      try {
        const unsaved = await filterUnsavedRunIdsAction(fresh);
        if (!unsaved.success) return;

        if (unsaved.runIds.length > 0) {
          const response = await fetch(BRIDGE + "/runs", { cache: "no-store" });
          if (!response.ok) return;

          const reports = (await response.json()) as { runId: string }[];

          for (const report of reports) {
            if (!unsaved.runIds.includes(report.runId)) continue;

            const result = await saveRunReportAction(report);
            if (!result.success) return;

            onSavedRef.current?.(report.runId);
          }
        }

        fresh.forEach((id) => handled.current.add(id));
      } catch (error) {
        console.error("Run report sync failed:", error);
      } finally {
        busy.current = false;
      }
    })();
  }, [key]);
}
