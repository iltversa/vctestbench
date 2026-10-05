"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type CreateTestModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function CreateTestModal({ open, onClose }: CreateTestModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      alert("Please enter a test title");
      return;
    }

    try {
      setCreating(true);

      const response = await fetch("/api/tests/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create test");
      }

      const { testId } = await response.json();

      onClose();
      setTitle("");
      setDescription("");

      router.push(`/test/${testId}`);
    } catch (error) {
      console.error("Failed to create test:", error);
      alert("Failed to create test");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Create New Test</h2>
            <p className="mt-0.5 text-sm text-gray-500">Start building your test flow</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label htmlFor="test-title" className="mb-1.5 block text-sm font-medium text-gray-700">
              Test Title
            </label>
            <input
              id="test-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Workout Login Flow"
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black"
              disabled={creating}
            />
          </div>

          <div>
            <label htmlFor="test-description" className="mb-1.5 block text-sm font-medium text-gray-700">
              Description (optional)
            </label>
            <textarea
              id="test-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this test validates..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black"
              disabled={creating}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create Test"}
          </button>
        </div>
      </div>
    </div>
  );
}
