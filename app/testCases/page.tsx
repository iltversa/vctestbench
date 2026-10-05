"use client";

import { useState } from "react";
import { useEffect } from "react";
import { SavedTest } from "../page";
import ActionDialog, { TestAction } from "@/components/ActionDialog";
import { createTestActionAction } from "@/actions/create-test-action";
import { updateTestActionAction } from "@/actions/update-test-action";

type CreateTestButtonProps = {
  editingAction: SavedTest | TestAction | null;
  isDelayNode: boolean;
  isFlowPlacement?: boolean;
  onEditClose: () => void;
  onActionSaved?: () => void | Promise<void>;
  onFlowActionSave?: (action: TestAction) => void;
};

export default function CreateTestButton({ editingAction, onEditClose, isDelayNode, isFlowPlacement, onFlowActionSave, onActionSaved }: CreateTestButtonProps) {
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

  const transformedAction: TestAction | null = editingAction
    ? (() => {
        const source = editingAction as Partial<TestAction> & {
          confirmationOptions?: Array<string | { option?: string; isSelected?: boolean }>;
        };

        return {
          id: typeof (editingAction as any).id === "string" ? (editingAction as any).id : undefined,
          title: typeof (editingAction as any).title === "string" ? (editingAction as any).title : "",
          hasConfirmation: Boolean((editingAction as any).hasConfirmation),
          confirmationTimeout: (editingAction as any).confirmationTimeout ?? null,
          confirmationOptions: Array.isArray(source.confirmationOptions)
            ? source.confirmationOptions.map((opt) => {
                const value = typeof opt === "string" ? opt : (opt?.option ?? "");
                return {
                  option: value,
                  isSelected: typeof opt === "string" ? true : Boolean(opt?.isSelected),
                };
              })
            : [],
          actionTimeout: Number((editingAction as any).actionTimeout ?? 5),
        };
      })()
    : null;

  const handleSaveAction = async (action: TestAction) => {
    // If this is for flow placement, just call the callback and don't save to DB
    if (isFlowPlacement && onFlowActionSave) {
      onFlowActionSave(action);
      handleClose();
      return;
    }

    // Otherwise, save to database as normal
    try {
      const targetId = action.id ?? editingAction?.id;

      if (targetId) {
        const result = await updateTestActionAction({
          id: targetId,
          title: action.title,
          hasConfirmation: action.hasConfirmation,
          confirmationTimeout: action.confirmationTimeout ?? null,
          confirmationOptions: (action.confirmationOptions || []).map((option) => ({
            option: option.option,
            isSelected: option.isSelected,
          })),
          actionTimeout: action.actionTimeout,
        });

        console.log("Action updated:", result);
        await onActionSaved?.();
        handleClose();
        return;
      }

      const result = await createTestActionAction({
        ...action,
        testId: editingAction?.id || "",
        confirmationOptions: (action.confirmationOptions || []).map((option) => ({
          option: option.option,
          isSelected: option.isSelected,
        })),
      });
      console.log("Action saved:", result);
      await onActionSaved?.();
      handleClose();
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