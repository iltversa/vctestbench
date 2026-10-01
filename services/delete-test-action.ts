"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { confirmationOptions } from "@/db/schema/confirmation-options";
import { testActions } from "@/db/schema/test-actions";

export type DeleteTestActionInput = {
  id: string;
};

export async function deleteTestActionService(input: DeleteTestActionInput) {
  await db.transaction(async (tx) => {
    await tx
      .delete(confirmationOptions)
      .where(eq(confirmationOptions.testActionId, input.id));

    const [deleted] = await tx
      .delete(testActions)
      .where(eq(testActions.id, input.id))
      .returning();

    if (!deleted) {
      throw new Error("Action not found");
    }
  });
}
