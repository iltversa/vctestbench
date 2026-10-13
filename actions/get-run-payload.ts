"use server";

import { getRunPayloadService } from "@/services/get-run-payload";
import { requireUserIfEnabled } from "@/services/require-user";

export async function getRunPayloadAction(input: { id: string }) {
  try {
    await requireUserIfEnabled();

    if (typeof input?.id !== "string" || !input.id) {
      return { success: false as const, message: "Test id is required" };
    }

    const payload = await getRunPayloadService(input.id);

    return { success: true as const, data: payload };
  } catch (error) {
    console.error("getRunPayloadAction error:", error);

    return {
      success: false as const,
      message:
        error instanceof Error && error.message === "Test not found"
          ? "This test no longer exists."
          : "Could not prepare the test to run. Check that VC_SECRET_KEY is set and the database is reachable.",
    };
  }
}
