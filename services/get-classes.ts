import { db } from "@/db";
import { testClasses } from "@/db/schema/test-classes";

export async function getTestClasses() {
  return await db
    .select({
      id: testClasses.id,
      name: testClasses.name,
    })
    .from(testClasses)
    .orderBy(testClasses.name);
}
