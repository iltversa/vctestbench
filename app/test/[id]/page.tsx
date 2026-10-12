"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import TestFlowBuilder from "@/components/TestFlowBuilder";
import { getTestsAction } from "@/actions/get-tests";
import { SavedTest } from "@/app/page";

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
      <div className="flex h-screen items-center justify-center bg-[#f4f6fa]">
        <div className="text-slate-500">Loading test...</div>
      </div>
    );
  }

  if (loadFailed || !test) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#f4f6fa] px-6 text-center" role="alert">
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

  return (
    <main className="min-h-screen bg-[#f4f6fa] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-slate-100 transition"
              type="button"
              title="Back to home"
            >
              ←
            </button>

            <div>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">
                TEST CONFIGURATION
              </p>

              <h1 className="text-lg font-semibold tracking-tight text-slate-900">
                {test.title}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1800px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <TestFlowBuilder editingTest={test} />
        </div>
      </div>
    </main>
  );
}
