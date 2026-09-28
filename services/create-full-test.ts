import { db } from "@/db";
import { tests } from "@/db/schema/tests";
import { testActions } from "@/db/schema/test-actions";
import { confirmationOptions } from "@/db/schema/confirmation-options";

export type CreateFullTestInput = {
  title: string;
  flow?: unknown[];
  actions: {
    id?: string;
    title: string;
    testClassId: string;
    hasConfirmation: boolean;
    confirmationTimeout?: number | null;
    confirmationOptions: string[];
    actionTimeout: number;
    sortOrder: number;
  }[];
};

export async function createFullTestService(input: CreateFullTestInput) {
  return await db.transaction(async (tx) => {
    const [test] = await tx
      .insert(tests)
      .values({
        title: input.title,
        flow: input.flow ?? [],
      })
      .returning();

    if (!test) {
      throw new Error("Failed to create test");
    }

    for (const action of input.actions) {
      const [createdAction] = await tx
        .insert(testActions)
        .values({
          testId: test.id,
          testClassId: action.testClassId,
          title: action.title,
          hasConfirmation: action.hasConfirmation,
          confirmationTimeout: action.hasConfirmation
            ? action.confirmationTimeout ?? null
            : null,
          actionTimeout: action.actionTimeout,
          sortOrder: action.sortOrder,
        })
        .returning();

      if (
        action.hasConfirmation &&
        action.confirmationOptions.length > 0
      ) {
        await tx.insert(confirmationOptions).values(
          action.confirmationOptions.map((option) => ({
            testActionId: createdAction.id,
            option,
          }))
        );
      }
    }

    return test;
  });
}
