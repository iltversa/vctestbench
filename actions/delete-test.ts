"use server";

import { deleteTestService } from "@/services/delete-test";

export async function deleteTestAction(input: { id: string }) {
  try {
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
