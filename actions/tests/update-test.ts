"use server";

import { updateTest } from "@/services/tests/update-test";

type UpdateTestActionInput = {
  testId: string;

  title: string;

  steps: {
    id: string;
    action: string;
    actionTitle: string;
    customAction: string;
    hasConfirmation: boolean;
    confirmationTimeout: string;
    confirmationOptions: {
      id: string;
      value: string;
    }[];
    actionTimeout: string;
  }[];
};

export async function updateTestAction(
  data: UpdateTestActionInput
) {
  if (!data.testId) {
    return {
      success: false,
      error: "Test ID is required",
    };
  }

  if (!data.title.trim()) {
    return {
      success: false,
      error: "Test title is required",
    };
  }

  if (data.steps.length === 0) {
    return {
      success: false,
      error: "At least one step is required",
    };
  }

  try {
    const test = await updateTest(data.testId, {
      title: data.title.trim(),

      actions: data.steps.map((step) => ({
        title: step.actionTitle.trim(),

        action: step.action,

        customAction:
          step.customAction.trim() || undefined,

        hasConfirmation: step.hasConfirmation,

        confirmationTimeout:
          step.hasConfirmation
            ? Number(step.confirmationTimeout)
            : undefined,

        confirmationOptions:
          step.hasConfirmation
            ? step.confirmationOptions
                .map((option) => option.value.trim())
                .filter(Boolean)
            : [],

        actionTimeout: Number(step.actionTimeout),
      })),
    });

    return {
      success: true,
      data: test,
    };
  } catch (error) {
    console.error("updateTestAction error:", error);

    return {
      success: false,
      error: "Failed to update test",
    };
  }
}