"use server";

import { getTests, getTestById } from "@/services/get-tests";

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
export async function getTestActionById(testId:string) {
  try {
    const tests = await getTestById(testId);

    return {
      success: true,
      data: tests,
    };
  } catch (error) {
    console.error("getTestActionById error:", error);

    return {
      success: false,
      error: "Failed to load tests",
    };
  }
}