"use server";

import { getTests } from "@/services/tests/get-tests";

export async function getTestsAction() {
  try {
    const tests = await getTests();

    return {
      success: true,
      data: tests,
    };
  } catch (error) {
    console.error("getTestsAction error:", error);

    return {
      success: false,
      error: "Failed to load tests",
    };
  }
}