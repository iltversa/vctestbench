import { db } from "@/db";
import { eq, asc } from "drizzle-orm";
import { confirmationOptions } from "@/db/schema/confirmation-options";
import { testActions } from "@/db/schema/test-actions";
import { testClasses } from "@/db/schema/test-classes";
export type TestActionDefinition = {
  id: string;
  title: string;
  testClassId: string;
  testClassName: string;

  hasConfirmation: boolean;
  confirmationTimeout: number | null;
  actionTimeout: number;

  confirmationOptions: {
    id: string;
    option: string;
  }[];
};

export async function getActionsService(): Promise<TestActionDefinition[]> {
  const rows = await db
    .select({
      actionId: testActions.id,
      title: testActions.title,

      testClassId: testActions.testClassId,
      testClassName: testClasses.name,

      hasConfirmation: testActions?.hasConfirmation,
      confirmationTimeout: testActions.confirmationTimeout,
      actionTimeout: testActions.actionTimeout,

      confirmationOptionId: confirmationOptions.id,
      confirmationOption: confirmationOptions.option,
    })
    .from(testActions)
    .innerJoin(
      testClasses,
      eq(testActions.testClassId, testClasses.id)
    )
    .leftJoin(
      confirmationOptions,
      eq(
        confirmationOptions.testActionId,
        testActions.id
      ) || []
    ) 
    .orderBy(
      asc(testActions.title),
      asc(confirmationOptions.option)
    );

  const actionsMap = new Map<
    string,
    TestActionDefinition
  >();

  for (const row of rows) {
    let action = actionsMap.get(row.actionId);

    if (!action) {
      action = {
        id: row.actionId,
        title: row.title,

        testClassId: row.testClassId,
        testClassName: row.testClassName,

        hasConfirmation: row.hasConfirmation,
        confirmationTimeout: row.confirmationTimeout,
        actionTimeout: row.actionTimeout,

        confirmationOptions: [],
      };

      actionsMap.set(row.actionId, action);
    }

    if (
      row.confirmationOptionId &&
      row.confirmationOption
    ) {
      action.confirmationOptions.push({
        id: row.confirmationOptionId,
        option: row.confirmationOption,
      });
    }
  }

  return Array.from(actionsMap.values());
}
