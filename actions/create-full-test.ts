"use server";

import { createFullTestService } from "@/services/create-full-test";

export type CreateFullTestInput = {
  title: string;
  flow?: unknown[];
  actions: {
    id?: string;
    title: string;
    testClassId: string;
    hasConfirmation: boolean;
    confirmationTimeout?: number | null;
    confirmationOptions: string[];
    actionTimeout: number;
    sortOrder: number;
  }[];
};

export async function createFullTestAction(input: CreateFullTestInput) {
  try {
    if (!input.title.trim()) {
      return {
        success: false,
        message: "Test title is required",
      };
    }

    if (input.actions.length === 0) {
      return {
        success: false,
        message: "At least one action is required",
      };
    }

    const test = await createFullTestService(input);

    return {
      success: true,
      data: test,
      message: "Test created successfully",
    };
  } catch (error) {
    console.error("createFullTestAction error:", error);

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to save test.",
    };
  }
}
