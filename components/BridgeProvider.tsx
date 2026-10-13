"use client";

// One connection to the local bridge for the whole app. Every page reads the
// same state from here instead of polling on its own, and finished runs are
// copied into the database from here, whichever page happens to be open.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BRIDGE,
  bridgeStateKey,
  getRunBlockedReason,
  type RunProgress,
  type TabletState,
} from "@/components/bridge";
import { getRunPayloadAction } from "@/actions/get-run-payload";
import {
  filterUnsavedRunIdsAction,
  saveRunReportAction,
  saveRunStepImagesAction,
} from "@/actions/run-reports";

const POLL_MS = 1500;

type StartResult = { ok: true; runId: string } | { ok: false; message: string };

type BridgeContextValue = {
  state: TabletState | null;
  // The bridge process answers.
  online: boolean;
  // The bridge answers and a tablet is attached.
  connected: boolean;
  // Why a run cannot start right now, or "" when it can.
  blockedReason: string;
  // The run in progress, or the most recent one.
  run: RunProgress | null;
  running: boolean;
  starting: boolean;
  // Increments after a report is stored, so lists know to reload.
  reportsVersion: number;
  startRun: (testId: string) => Promise<StartResult>;
  stopRun: () => Promise<void>;
  openSandbox: () => Promise<void>;
  refresh: () => Promise<void>;
};

const BridgeContext = createContext<BridgeContextValue | null>(null);

export function useBridge(): BridgeContextValue {
  const value = useContext(BridgeContext);
  if (!value) throw new Error("useBridge must be used inside <BridgeProvider>");
  return value;
}

export function BridgeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TabletState | null>(null);
  const [online, setOnline] = useState(false);
  const [starting, setStarting] = useState(false);
  const [reportsVersion, setReportsVersion] = useState(0);

  const keyRef = useRef("");
  const pollRef = useRef<() => Promise<void>>(async () => {});
  const handled = useRef<Set<string>>(new Set());
  const syncing = useRef(false);

  // --- Polling: only while the page is visible --------------------------
  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(BRIDGE + "/state", { cache: "no-store" });
        if (!response.ok) throw new Error();

        const next = (await response.json()) as TabletState;
        if (cancelled) return;

        const key = bridgeStateKey(next);
        if (key !== keyRef.current) {
          keyRef.current = key;
          setState(next);
        }
        setOnline(true);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };

    pollRef.current = poll;

    const start = () => {
      if (timer !== undefined) return;
      void poll();
      timer = window.setInterval(poll, POLL_MS);
    };

    const stop = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // --- Copy finished runs into the database ------------------------------
  // The bridge holds the last few runs in memory. Saving is idempotent on the
  // run id, so a reload or a second open tab cannot create duplicates.
  const runKey = state?.runIds?.join(",") ?? "";

  useEffect(() => {
    const runIds = runKey ? runKey.split(",") : [];
    const fresh = runIds.filter((id) => !handled.current.has(id));

    if (fresh.length === 0 || syncing.current) return;

    syncing.current = true;

    (async () => {
      try {
        const unsaved = await filterUnsavedRunIdsAction(fresh);
        if (!unsaved.success) return;

        let savedAny = false;

        if (unsaved.runIds.length > 0) {
          const response = await fetch(BRIDGE + "/runs", { cache: "no-store" });
          if (!response.ok) return;

          const reports = (await response.json()) as {
            runId: string;
            images?: Record<string, unknown>;
          }[];

          for (const { images, ...report } of reports) {
            if (!unsaved.runIds.includes(report.runId)) continue;

            const result = await saveRunReportAction(report);
            if (!result.success) return;
            savedAny = true;

            // The step pictures follow in small batches, so no single call is
            // large; a failure here costs pictures, never the report.
            const pictures = Object.entries(images ?? {});

            for (let from = 0; from < pictures.length; from += 3) {
              const batch = Object.fromEntries(pictures.slice(from, from + 3));
              const stored = await saveRunStepImagesAction({ runId: report.runId, images: batch });
              if (!stored.success) break;
            }
          }
        }

        fresh.forEach((id) => handled.current.add(id));
        if (savedAny) setReportsVersion((version) => version + 1);
      } catch (error) {
        console.error("Run report sync failed:", error);
      } finally {
        syncing.current = false;
      }
    })();
  }, [runKey]);

  // --- Commands ---------------------------------------------------------
  const refresh = useCallback(() => pollRef.current(), []);

  const startRun = useCallback(
    async (testId: string): Promise<StartResult> => {
      setStarting(true);

      try {
        // Stored passwords are encrypted; the server decrypts them for this run only.
        const payload = await getRunPayloadAction({ id: testId });
        if (!payload.success) return { ok: false, message: payload.message };

        const response = await fetch(BRIDGE + "/run-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload.data),
        });

        if (response.status === 409) {
          return { ok: false, message: "A test is already running on the tablet." };
        }

        if (!response.ok) {
          return { ok: false, message: "The bridge did not accept the test." };
        }

        const body = (await response.json()) as { runId: string };
        await pollRef.current();

        return { ok: true, runId: body.runId };
      } catch {
        return {
          ok: false,
          message: "Could not reach the bridge. Start it with npm run bridge.",
        };
      } finally {
        setStarting(false);
      }
    },
    []
  );

  const stopRun = useCallback(async () => {
    try {
      await fetch(BRIDGE + "/stop", { method: "POST" });
    } finally {
      await pollRef.current();
    }
  }, []);

  const openSandbox = useCallback(async () => {
    try {
      await fetch(BRIDGE + "/launch-sand", { method: "POST" });
    } finally {
      window.setTimeout(() => void pollRef.current(), 1200);
    }
  }, []);

  const value = useMemo<BridgeContextValue>(() => {
    const run = state?.run ?? null;

    return {
      state,
      online,
      connected: online && Boolean(state?.connected),
      blockedReason: getRunBlockedReason(online, state),
      run,
      running: run?.status === "running",
      starting,
      reportsVersion,
      startRun,
      stopRun,
      openSandbox,
      refresh,
    };
  }, [state, online, starting, reportsVersion, startRun, stopRun, openSandbox, refresh]);

  return <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>;
}
