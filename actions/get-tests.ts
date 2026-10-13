"use server";

<<<<<<< HEAD
import { getTests } from "@/services/get-tests";
import { requireUserIfEnabled } from "@/services/require-user";
=======
import { getTests, getTestById } from "@/services/get-tests";
>>>>>>> main

export async function getTestsAction() {
  try {
    await requireUserIfEnabled();
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