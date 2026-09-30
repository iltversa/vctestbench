"use client";

import { useState } from "react";
import TestCaseBuilderDialog from "../../components/TestCaseBuilder";


import { useEffect } from "react";
import { SavedTest } from "../page";
import ActionDialog, { TestAction } from "@/components/ActionDialog";
import { createTestActionAction } from "@/actions/create-test-action";
import { updateTestActionAction } from "@/actions/update-test-action";

type CreateTestButtonProps = {
  editingAction: SavedTest | TestAction | null;
  isDelayNode:boolean;
  onEditClose: () => void;
};

export default function CreateTestButton({ editingAction, onEditClose, isDelayNode }: CreateTestButtonProps) {
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
    confirmationOptions: Array.isArray(editingAction.confirmationOptions)
      ? (editingAction.confirmationOptions as any[]).map((opt) =>
          typeof opt === "string" ? opt : opt.value
        )
      : [],
  } : null;

  const handleSaveAction = async (action: TestAction) => {
    try {
      const targetId = action.id ?? editingAction?.id;

      if (targetId) {
        const result = await updateTestActionAction({
          id: targetId,
          title: action.title,
          hasConfirmation: action.hasConfirmation,
          confirmationTimeout: action.confirmationTimeout ?? null,
          confirmationOptions: action.confirmationOptions || [],
          actionTimeout: action.actionTimeout,
        });

        console.log("Action updated:", result);
        return;
      }

      const result = await createTestActionAction({
        ...action,
        testId: editingAction?.id || "",
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
          isDelayNode={isDelayNode}
          onClose={handleClose}
          onSave={handleSaveAction}
        />
      )}
    </>
  );
}