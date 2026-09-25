"use server";

import { getTestClasses } from "@/services/get-classes";

export async function getTestClassesAction() {
  try {
    const classes = await getTestClasses();

    return {
      success: true,
      data: classes,
    };
  } catch (error) {
    console.error("getTestClassesAction error:", error);

    return {
      success: false,
      data: [],
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch test classes.",
    };
  }
}