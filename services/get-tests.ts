import { db } from "@/db";

import { tests } from "@/db/schema/tests";
import { testActions } from "@/db/schema/test-actions";
import { confirmationOptions } from "@/db/schema/confirmation-options";

import { eq, asc } from "drizzle-orm";



export async function getTests() {
  const testRows = await db.select().from(tests);

  

  return testRows;
}
export async function getTestById(testId: string) {
  try {
    const [test] = await db
    .select()
    .from(tests)
    .where(eq(tests.id, testId))
    .limit(1);
    

    if (!test) {
      return {
        success: false as const,
        error: "Test not found",
      };
    }

    return {
      success: true as const,
      data: test,
    };
  } catch (error) {
    console.error("getTestActionById error:", error);

    return {
      success: false as const,
      error: "Failed to load test",
    };
  }
}
