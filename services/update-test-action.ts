import { eq } from "drizzle-orm";

import { db } from "@/db";
import { confirmationOptions } from "@/db/schema/confirmation-options";
import { testActions } from "@/db/schema/test-actions";

export type UpdateTestActionInput = {
  id: string;
  title: string;
  hasConfirmation: boolean;
  confirmationTimeout?: number | null;
  confirmationOptions: { option: string; isSelected: boolean }[];
  actionTimeout: number;
  pasteText?: string | null;
  email?: string | null;
  password?: string | null;
};

export async function updateTestActionService(input: UpdateTestActionInput) {
  return await db.transaction(async (tx) => {
    const [updatedAction] = await tx
      .update(testActions)
      .set({
        title: input.title,
        hasConfirmation: input.hasConfirmation,
        confirmationTimeout: input.hasConfirmation ? input.confirmationTimeout ?? null : null,
        actionTimeout: input.actionTimeout,
        pasteText: input.pasteText ?? null,
        email: input.email ?? null,
        password: input.password ?? null,
      })
      .where(eq(testActions.id, input.id))
      .returning();

    if (!updatedAction) {
      throw new Error("Action not found");
    }

    await tx
      .delete(confirmationOptions)
      .where(eq(confirmationOptions.testActionId, input.id));

    if (input.hasConfirmation && input.confirmationOptions.length > 0) {
      await tx.insert(confirmationOptions).values(
        input.confirmationOptions.map((option) => ({
          testActionId: input.id,
          isSelected: option.isSelected,
          option: option.option,
        }))
      );
    }

    return updatedAction;
  });
}
