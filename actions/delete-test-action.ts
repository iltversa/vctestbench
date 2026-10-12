"use server";

import { deleteTestActionService } from "@/services/delete-test-action";
import { requireUserIfEnabled } from "@/services/require-user";

export async function deleteTestActionDefinition(input: { id: string }) {
  try {
    await requireUserIfEnabled();
    await deleteTestActionService(input);

    return {
      success: true,
    };
  } catch (error) {
    console.error("deleteTestActionDefinition error:", error);

    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete action.",
    };
  }
}
