"use client";

import { useState } from "react";
import TestCaseBuilderDialog from "../../components/TestCaseBuilder";


import { useEffect } from "react";
import { SavedTest } from "../page";

type CreateTestButtonProps = {
  editingTest: SavedTest | null;
  onEditClose: () => void;
};

export default function CreateTestButton({
  editingTest,
  onEditClose,
}: CreateTestButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (editingTest) {
      setOpen(true);
    }
  }, [editingTest]);

  const handleClose = () => {
    setOpen(false);
    onEditClose();
  };

  return (
    <>
      {/* Create button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
      >
        <span className="text-lg leading-none">+</span>
        Create Test
      </button>

      {/* Same popup for create/edit */}
      {open && (
        <TestCaseBuilderDialog
          test={editingTest}
          onClose={handleClose}
        />
      )}
    </>
  );
}