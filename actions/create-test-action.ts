"use server";

import { createTestActionService } from "@/services/create-test-action";
import { requireUserIfEnabled } from "@/services/require-user";

export type CreateTestActionInput = {
  id?: string;
  testId?: string;
  title: string;
  hasConfirmation: boolean;
  confirmationTimeout?: number | null;
  confirmationOptions: { option: string; isSelected: boolean }[];

  actionTimeout: number;
};


export async function createTestActionAction(
  input: CreateTestActionInput
) {
  try {
    await requireUserIfEnabled();
    const action = await createTestActionService(input);

    return {
      success: true,
      data: action,
    };
  } catch (error) {
    console.error(
      "createTestActionAction error:",
      error
    );

    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to save action.",
    };
  }
}
