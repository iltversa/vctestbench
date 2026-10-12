"use server";

import { deleteTestService } from "@/services/delete-test";
import { requireUserIfEnabled } from "@/services/require-user";

export async function deleteTestAction(input: { id: string }) {
  try {
    await requireUserIfEnabled();
    const deleted = await deleteTestService(input);

    return {
      success: true,
      data: deleted,
    };
  } catch (error) {
    console.error("deleteTestAction error:", error);

    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete test.",
    };
  }
}
