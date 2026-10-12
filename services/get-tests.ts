import { desc } from "drizzle-orm";
import { db } from "@/db";
import { tests } from "@/db/schema/tests";

// Newest first. Each row carries its whole flow, which holds the configuration
// of every step, so nothing else needs to be joined.
export async function getTests() {
  return await db.select().from(tests).orderBy(desc(tests.createdAt));
}
