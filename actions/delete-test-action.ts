"use server";

import { deleteTestActionService } from "@/services/delete-test-action";

export async function deleteTestActionDefinition(input: { id: string }) {
  try {
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
