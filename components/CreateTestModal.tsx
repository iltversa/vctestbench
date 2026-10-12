"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type CreateTestModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function CreateTestModal({ open, onClose }: CreateTestModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const titleInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) titleInput.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !creating) onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, creating, onClose]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Give the test a title.");
      titleInput.current?.focus();
      return;
    }

    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/tests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The test could not be created.");
      }

      const { testId } = (await response.json()) as { testId: string };

      onClose();
      setTitle("");
      setDescription("");
      router.push(`/test/${testId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The test could not be created.");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-test-title"
        className="w-full max-w-md rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 id="create-test-title" className="text-lg font-semibold text-slate-900">New test</h2>
              <p className="mt-0.5 text-sm text-slate-600">You will add its steps on the next screen.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              aria-label="Close"
              className="grid h-11 w-11 place-items-center rounded-lg text-xl text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              ×
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div>
              <label htmlFor="test-title" className="mb-1.5 block text-sm font-medium text-slate-800">
                Title
              </label>
              <input
                ref={titleInput}
                id="test-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Workout login flow"
                disabled={creating}
                maxLength={200}
                className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label htmlFor="test-description" className="mb-1.5 block text-sm font-medium text-slate-800">
                What it checks <span className="font-normal text-slate-600">(optional)</span>
              </label>
              <textarea
                id="test-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what this test validates"
                disabled={creating}
                rows={3}
                maxLength={2000}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="min-h-[44px] rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create test"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
