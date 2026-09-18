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

export async function createTest(data: CreateTestInput) {
  return await db.transaction(async (tx) => {
    // 1. Create test
    const [test] = await tx
      .insert(tests)
      .values({
        title: data.title,
      })
      .returning();

    // 2. Create actions
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

      // 3. Create confirmation options
      if (
        action.hasConfirmation &&
        action.confirmationOptions.length > 0
      ) {
        await tx.insert(confirmationOptions).values(
          action.confirmationOptions.map((value, optionIndex) => ({
            actionId: createdAction.id,
            value,
            sortOrder: optionIndex + 1,
          }))
        );
      }
    }

    return test;
  });
}