"use server";

import { updateTestActionService } from "@/services/update-test-action";
import { requireUserIfEnabled } from "@/services/require-user";

export type UpdateTestActionInput = {
  id: string;
  title: string;
  icon?: string | null;
};

export async function updateTestActionAction(input: UpdateTestActionInput) {
  try {
    await requireUserIfEnabled();
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
