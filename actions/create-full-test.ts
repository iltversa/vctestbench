"use server";

import { FlowNode } from "@/components/TestFlowBuilder";
import { createFullTestService, updateFullTestService } from "@/services/create-full-test";

export type CreateFullTestInput = {
  title: string;
  description: string;
  flow?: FlowNode[];
};
export type UpdateFullTestInput = {
  id: string;
  title: string;
  description: string;
  flow?: FlowNode[];
};

export async function createFullTestAction(input: CreateFullTestInput) {
  try {
    if (!input.title.trim()) {
      return {
        success: false,
        message: "Test title is required",
      };
    }

    // if (input.actions.length === 0) {
    //   return {
    //     success: false,
    //     message: "At least one action is required",
    //   };
    // }

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
export async function updateFullTestAction(input: UpdateFullTestInput) {
  try {
    if (!input.title.trim()) {
      return {
        success: false,
        message: "Test title is required",
      };
    }

    const test = await updateFullTestService(input);

    return {
      success: true,
      data: test,
      message: "Test updated successfully",
    };
  } catch (error) {
    console.error("updateFullTestService error:", error);

    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to save test.",
    };
  }
}
