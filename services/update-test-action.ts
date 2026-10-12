import { eq } from "drizzle-orm";

import { db } from "@/db";
import { confirmationOptions } from "@/db/schema/confirmation-options";
import { testActions } from "@/db/schema/test-actions";

export type UpdateTestActionInput = {
  id: string;
  title: string;
  icon?: string | null;
};

export async function updateTestActionService(input: UpdateTestActionInput) {
  return await db.transaction(async (tx) => {
    const [updatedAction] = await tx
      .update(testActions)
      .set({
        title: input.title,
        icon: input.icon ?? null,
      })
      .where(eq(testActions.id, input.id))
      .returning();

    if (!updatedAction) {
      throw new Error("Action not found");
    }

    return updatedAction;
  });
}
