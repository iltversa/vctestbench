"use server";

import { createTestActionService } from "@/services/create-test-action";

export type CreateTestActionInput = {
  id?: string;
  testId?: string;
  testClassId: string;
  title: string;
  hasConfirmation: boolean;
  confirmationTimeout?: number | null;
  confirmationOptions: string[];

  actionTimeout: number;

  sortOrder: number;
};


export async function createTestActionAction(
  input: CreateTestActionInput
) {
  try {
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
