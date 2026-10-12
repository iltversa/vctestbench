"use client";

import { useMemo } from "react";
import ActionDialog, { type TestAction } from "@/components/ActionDialog";
import { updateTestActionAction } from "@/actions/update-test-action";

// What the editor can hand over to be edited: a library action, or the saved
// configuration of a step in the flow. Options may carry ids and a null flag.
type OptionSource = string | { id?: string; option?: string; isSelected?: boolean | null };

export type ActionSource = Partial<Omit<TestAction, "confirmationOptions">> & {
  confirmationOptions?: OptionSource[];
};

type ActionEditorDialogProps = {
  editingAction: ActionSource | null;
  // True when the result belongs in the flow rather than the action library.
  isFlowPlacement?: boolean;
  onEditClose: () => void;
  onActionSaved?: () => void | Promise<void>;
  onFlowActionSave?: (action: TestAction) => void;
};

// Every field the dialog shows has to be passed through here: anything left
// out opens empty, and saving then blanks it.
function toTestAction(source: ActionSource): TestAction {
  return {
    id: typeof source.id === "string" ? source.id : undefined,
    title: typeof source.title === "string" ? source.title : "",
    hasConfirmation: Boolean(source.hasConfirmation),
    confirmationTimeout: source.confirmationTimeout ?? null,
    confirmationOptions: (source.confirmationOptions ?? []).map((option) =>
      typeof option === "string"
        ? { option, isSelected: true }
        : {
            // The id ties an option to its branch in the flow; keep it.
            id: option.id,
            option: option.option ?? "",
            isSelected: Boolean(option.isSelected),
          }
    ),
    actionTimeout: Number(source.actionTimeout ?? 5),
    pasteText: source.pasteText ?? null,
    email: source.email ?? null,
    password: source.password ?? null,
    icon: source.icon ?? null,
    type: source.type ?? null,
    clickOnText: source.clickOnText ?? null,
  };
}

// Opens the action dialog for the step or action being edited. Actions are
// added by dragging them into the flow, or with the Add buttons, so this has
// no button of its own: it is shown exactly while something is being edited.
export default function ActionEditorDialog({
  editingAction,
  onEditClose,
  isFlowPlacement,
  onFlowActionSave,
  onActionSaved,
}: ActionEditorDialogProps) {
  const action = useMemo(() => (editingAction ? toTestAction(editingAction) : null), [editingAction]);

  if (!action) return null;

  const handleSave = async (saved: TestAction) => {
    // A step in the flow: hand it back, nothing is written to the library.
    if (isFlowPlacement && onFlowActionSave) {
      onFlowActionSave(saved);
      onEditClose();
      return;
    }

    // A library action: only its title and icon can be changed here.
    if (saved.id) {
      await updateTestActionAction({
        id: saved.id,
        title: saved.title,
        icon: saved.icon ?? null,
      });

      await onActionSaved?.();
      onEditClose();
    }
  };

  return <ActionDialog test={action} onClose={onEditClose} onSave={handleSave} />;
}
