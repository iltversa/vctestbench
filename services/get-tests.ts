import { desc } from "drizzle-orm";
import { db } from "@/db";
import { tests } from "@/db/schema/tests";

// Newest first. Each row carries its whole flow, which holds the configuration
// of every step, so nothing else needs to be joined.
export async function getTests() {
<<<<<<< HEAD
  return await db.select().from(tests).orderBy(desc(tests.createdAt));
=======
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
>>>>>>> main
}
