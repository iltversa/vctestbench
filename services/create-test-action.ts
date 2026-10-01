import { db } from "@/db";
import { testActions } from "@/db/schema/test-actions";
import { confirmationOptions } from "@/db/schema/confirmation-options";

export type CreateTestActionInput = {
  id?: string;
  title: string;
  hasConfirmation: boolean;
  confirmationTimeout?: number | null;
  confirmationOptions: { option: string; isSelected: boolean }[];
  actionTimeout: number;
};


export async function createTestActionService(
  input: CreateTestActionInput
) {
  return await db.transaction(async (tx) => {
    const [createdAction] = await tx
      .insert(testActions)
      .values({
        ...(input.id ? { id: input.id } : {}),
        title: input.title,
        hasConfirmation: input.hasConfirmation,
        confirmationTimeout:
          input.hasConfirmation
            ? input.confirmationTimeout
            : null,

        actionTimeout: input.actionTimeout,
      })
      .returning();

    if (
      input.hasConfirmation &&
      input.confirmationOptions.length > 0
    ) {
      await tx
        .insert(confirmationOptions)
        .values(
          input.confirmationOptions.map((option) => ({
            testActionId: createdAction.id,
            isSelected: option.isSelected,
            option: option.option,
          }))
        );
    }

    return createdAction;
  });
}
