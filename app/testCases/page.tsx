"use client";

import { useState } from "react";
import TestCaseBuilderDialog from "../../components/TestCaseBuilder";

export default function CreateTestButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
      >
        <span className="text-lg leading-none">+</span>
        Create Test
      </button>

      {open && (
        <TestCaseBuilderDialog
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}