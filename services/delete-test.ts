"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tests } from "@/db/schema/tests";

export type DeleteTestInput = {
  id: string;
};

export async function deleteTestService(input: DeleteTestInput) {
  const [deleted] = await db
    .delete(tests)
    .where(eq(tests.id, input.id))
    .returning();

  if (!deleted) {
    throw new Error("Test not found");
  }

  return deleted;
}
