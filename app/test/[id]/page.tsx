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

  useEffect(() => {
    const loadTest = async () => {
      try {
        const result = await getTestsAction();
        if (result.success && result.data) {
          const foundTest = (result.data as any[]).find((t) => t.id === testId);
          if (foundTest) {
            setTest(foundTest);
          } else {
            router.push("/");
          }
        }
      } catch (error) {
        console.error("Failed to load test:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    loadTest();
  }, [testId, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4f6fa]">
        <div className="text-slate-500">Loading test...</div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f4f6fa]">
        <div className="text-slate-500">Test not found</div>
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
