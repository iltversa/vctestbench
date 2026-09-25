import { eq } from "drizzle-orm";
import { db } from "@/db";

import { tests } from "@/db/schema/tests";
import { testActions } from "@/db/schema/test-actions";
import { confirmationOptions } from "@/db/schema/confirmation-options";
export type CreateTestInput = {
  title: string;

  actions: {
    title: string;
    action: string;
    customAction?: string;

    hasConfirmation: boolean;
    confirmationTimeout?: number;

    confirmationOptions: string[];

    actionTimeout: number;
  }[];
};
export async function updateTest(
  testId: string,
  data: CreateTestInput
) {
  return await db.transaction(async (tx) => {
    // Update test title
    const [test] = await tx
      .update(tests)
      .set({
        title: data.title,
      })
      .where(eq(tests.id, testId))
      .returning();

    if (!test) {
      throw new Error("Test not found");
    }

    // Remove existing actions.
    // Confirmation options should be removed first
    // because they reference test_actions.
    const existingActions = await tx
      .select()
      .from(testActions)
      .where(eq(testActions.testId, testId));

    for (const action of existingActions) {
      await tx
        .delete(confirmationOptions)
        .where(eq(confirmationOptions.actionId, action.id));
    }

    await tx
      .delete(testActions)
      .where(eq(testActions.testId, testId));

    // Re-create actions using the new form data
    for (const [index, action] of data.actions.entries()) {
      const [createdAction] = await tx
        .insert(testActions)
        .values({
          testId: test.id,
          title: action.title,
          action: action.action,
          customAction: action.customAction ?? null,
          hasConfirmation: action.hasConfirmation,
          confirmationTimeout: action.hasConfirmation
            ? action.confirmationTimeout ?? null
            : null,
          actionTimeout: action.actionTimeout,
          sortOrder: index + 1,
        })
        .returning();

      if (
        action.hasConfirmation &&
        action.confirmationOptions.length > 0
      ) {
        await tx.insert(confirmationOptions).values(
          action.confirmationOptions.map(
            (value, optionIndex) => ({
              actionId: createdAction.id,
              value,
              sortOrder: optionIndex + 1,
            })
          )
        );
      }
    }

    return test;
  });
}