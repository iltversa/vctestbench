"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRIDGE } from "@/components/bridge";
import type { RecordedStep } from "@/components/flow/record";

type Snapshot = { active: boolean; steps: RecordedStep[]; error: string | null };

// Records a flow from the tablet through the bridge. While recording, the
// bridge's steps are polled and handed to `onSteps`; leaving the page stops it.
export function useRecorder(onSteps: (steps: RecordedStep[]) => void) {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [count, setCount] = useState(0);

  const onStepsRef = useRef(onSteps);
  const activeRef = useRef(false);
  // Answers can arrive out of order: only the newest request is applied.
  const sent = useRef(0);
  const applied = useRef(0);

  useEffect(() => {
    onStepsRef.current = onSteps;
  });

  const apply = useCallback((snapshot: Snapshot, order: number) => {
    if (order < applied.current) return;
    applied.current = order;

    activeRef.current = snapshot.active;
    setActive(snapshot.active);
    setCount(snapshot.steps.length);
    if (snapshot.error) setError(snapshot.error);

    onStepsRef.current(snapshot.steps);
  }, []);

  const call = useCallback(
    async (path: string, method: "GET" | "POST") => {
      const order = ++sent.current;
      const response = await fetch(BRIDGE + path, { method, cache: "no-store" });
      const body = (await response.json()) as Snapshot & { error?: string };

      if (!response.ok) throw new Error(body.error || "The bridge could not do that.");

      apply(body, order);
      return body;
    },
    [apply]
  );

  const start = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      await call("/record/start", "POST");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not reach the bridge.");
    } finally {
      setBusy(false);
    }
  }, [call]);

  const stop = useCallback(async (): Promise<RecordedStep[]> => {
    setBusy(true);

    try {
      const body = await call("/record/stop", "POST");
      return body.steps;
    } catch {
      setError("Could not reach the bridge.");
      return [];
    } finally {
      setBusy(false);
    }
  }, [call]);

  useEffect(() => {
    if (!active) return;

    const timer = window.setInterval(() => {
      call("/record", "GET").catch(() => {});
    }, 700);

    return () => window.clearInterval(timer);
  }, [active, call]);

  // Leaving the editor ends the recording rather than leaving the tablet
  // watched with nobody looking.
  useEffect(
    () => () => {
      if (activeRef.current) {
        fetch(BRIDGE + "/record/stop", { method: "POST", keepalive: true }).catch(() => {});
      }
    },
    []
  );

  return { active, busy, error, count, start, stop };
}
