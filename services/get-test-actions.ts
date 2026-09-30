import { db } from "@/db";
import { eq, asc } from "drizzle-orm";
import { confirmationOptions } from "@/db/schema/confirmation-options";
import { testActions } from "@/db/schema/test-actions";
export type TestActionDefinition = {
  id: string;
  title: string;
  hasConfirmation: boolean;
  confirmationTimeout: number | null;
  actionTimeout: number;
  confirmationOptions: {
    id: string;
    option: string;
    isSelected:boolean |null;
  }[];
};

export async function getActionsService(): Promise<TestActionDefinition[]> {
  const rows = await db
    .select({
      actionId: testActions.id,
      title: testActions.title,
      hasConfirmation: testActions?.hasConfirmation,
      confirmationTimeout: testActions.confirmationTimeout,
      actionTimeout: testActions.actionTimeout,
      confirmationOptionId: confirmationOptions.id,
      confirmationOption: confirmationOptions.option,
      confirmationisSelected: confirmationOptions.isSelected,
    })
    .from(testActions)
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
        hasConfirmation: row.hasConfirmation,
        confirmationTimeout: row.confirmationTimeout,
        actionTimeout: row.actionTimeout,

        confirmationOptions: [],
      };

      actionsMap.set(row.actionId, action);
    }

    if (
      row.confirmationOptionId &&
      row.confirmationOption && row.confirmationisSelected
    ) {
      action.confirmationOptions.push({
        id: row.confirmationOptionId,
        option: row.confirmationOption,
        isSelected:row.confirmationisSelected
      });
    }
  }

  return Array.from(actionsMap.values());
}
