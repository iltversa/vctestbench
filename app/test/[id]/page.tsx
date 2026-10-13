"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TestFlowBuilder from "@/components/TestFlowBuilder";
import { getTestsAction } from "@/actions/get-tests";
import type { SavedTest } from "@/components/types";

export default function TestConfigPage() {
  const params = useParams();
  const router = useRouter();
  const testId = params.id as string;

  const [test, setTest] = useState<SavedTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadTest = async () => {
      try {
        const result = await getTestsAction();
        if (cancelled) return;

        if (!result.success || !result.data) {
          setLoadFailed(true);
          return;
        }

        const foundTest = (result.data as SavedTest[]).find((t) => t.id === testId);
        setTest(foundTest ?? null);
      } catch (error) {
        if (cancelled) return;
        console.error("Failed to load test:", error);
        setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadTest();

    return () => {
      cancelled = true;
    };
  }, [testId, reloadCount]);

  const retryLoad = () => {
    setLoading(true);
    setLoadFailed(false);
    setReloadCount((count) => count + 1);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-slate-500">Loading test...</div>
      </div>
    );
  }

  if (loadFailed || !test) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
        <p className="text-base text-slate-900">
          <strong>{loadFailed ? "This test could not be loaded." : "This test no longer exists."}</strong>{" "}
          <span className="text-slate-600">
            {loadFailed ? "The database did not respond." : "It may have been deleted."}
          </span>
        </p>
        <div className="flex gap-3">
          {loadFailed && (
            <button
              type="button"
              onClick={retryLoad}
              className="min-h-[44px] rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Back to saved tests
          </button>
        </div>
      </div>
    );
  }

  // The shell above already carries navigation; the editor fills the rest.
  return <TestFlowBuilder editingTest={test} />;
}
