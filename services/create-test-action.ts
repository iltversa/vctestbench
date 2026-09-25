import { db } from "@/db";
import { testActions } from "@/db/schema/test-actions";
import { confirmationOptions } from "@/db/schema/confirmation-options";

export type CreateTestActionInput = {
  id?: string;
  // testId: string;
  testClassId: string;
  title: string;
  hasConfirmation: boolean;
  confirmationTimeout?: number | null;
  confirmationOptions: string[];
  actionTimeout: number;
  sortOrder: number;
};


export async function createTestActionService(
  input: CreateTestActionInput
) {
  return await db.transaction(async (tx) => {
    const [createdAction] = await tx
      .insert(testActions)
      .values({
        ...(input.id ? { id: input.id } : {}),

        // testId: input.testId,
        testClassId: input.testClassId,

        title: input.title,

        hasConfirmation: input.hasConfirmation,

        confirmationTimeout:
          input.hasConfirmation
            ? input.confirmationTimeout
            : null,

        actionTimeout: input.actionTimeout,

        sortOrder: input.sortOrder,
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
            option,
          }))
        );
    }

    return createdAction;
  });
}
