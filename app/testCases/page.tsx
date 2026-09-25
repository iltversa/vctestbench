"use client";

import { useState } from "react";
import TestCaseBuilderDialog from "../../components/TestCaseBuilder";


import { useEffect } from "react";
import { SavedTest } from "../page";
import ActionDialog, { TestAction } from "@/components/ActionDialog";
import { createTestActionAction } from "@/actions/create-test-action";

type CreateTestButtonProps = {
  editingAction: SavedTest | null;
  onEditClose: () => void;
};

export default function CreateTestButton({ editingAction, onEditClose }: CreateTestButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (editingAction) {
      setOpen(true);
    }
  }, [editingAction]);

  const handleClose = () => {
    setOpen(false);
    onEditClose();
  };

  const transformedAction = editingAction ? {
    ...editingAction,
    confirmationOptions: editingAction.confirmationOptions?.map(opt => opt.value) || [],
  } : null;

  const handleSaveAction = async (action: TestAction) => {
    try {
      const result = await createTestActionAction({
        ...action,
        testId: editingAction?.id || "",
        testClassId: action.testClassId || "",
        sortOrder: 0,
        confirmationOptions: action.confirmationOptions || [],
      });
      console.log("Action saved:", result);
    } catch (error) {
      console.error("Failed to save action:", error);
      throw error;
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
      >
        <span className="text-lg leading-none">+</span>
        Create Action
      </button>

      {open && (
        <ActionDialog
          test={transformedAction}
          onClose={handleClose}
          onSave={handleSaveAction}
        />
      )}
    </>
  );
}