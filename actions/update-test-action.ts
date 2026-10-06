"use server";

import { updateTestActionService } from "@/services/update-test-action";

export type UpdateTestActionInput = {
  id: string;
  title: string;
  hasConfirmation: boolean;
  confirmationTimeout?: number | null;
  confirmationOptions: { option: string; isSelected: boolean }[];
  actionTimeout: number;
  pasteText?: string;
  email?: string;
  password?: string;
};

export async function updateTestActionAction(input: UpdateTestActionInput) {
  try {
    const action = await updateTestActionService(input);

    return {
      success: true,
      data: action,
    };
  } catch (error) {
    console.error("updateTestActionAction error:", error);

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update action.",
    };
  }
}
