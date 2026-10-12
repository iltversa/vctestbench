"use server";

import { FlowNode } from "@/components/TestFlowBuilder";
import { createFullTestService, updateFullTestService } from "@/services/create-full-test";
import { requireUserIfEnabled } from "@/services/require-user";

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 2000;
const MAX_FLOW_BYTES = 1_000_000;

function validateTest(input: { title: unknown; description: unknown; flow?: unknown }) {
  if (typeof input.title !== "string" || !input.title.trim()) {
    return "Test title is required";
  }
  if (input.title.length > MAX_TITLE) {
    return `Test title must be ${MAX_TITLE} characters or fewer`;
  }
  if (typeof input.description !== "string" || input.description.length > MAX_DESCRIPTION) {
    return `Description must be text of ${MAX_DESCRIPTION} characters or fewer`;
  }
  if (input.flow !== undefined) {
    if (!Array.isArray(input.flow)) return "Flow must be a list of steps";
    if (JSON.stringify(input.flow).length > MAX_FLOW_BYTES) return "Flow is too large";
  }
  return null;
}

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
    await requireUserIfEnabled();

    const problem = validateTest(input);
    if (problem) {
      return {
        success: false,
        message: problem,
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
    await requireUserIfEnabled();

    const problem = validateTest(input);
    if (problem || typeof input.id !== "string" || !input.id) {
      return {
        success: false,
        message: problem ?? "Test id is required",
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
