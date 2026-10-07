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
  pasteText?: string | null;
  icon?: string | null;
  email?: string | null;
  password?: string | null;
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
      email: testActions.email,
      password: testActions.password,
      pasteText: testActions.pasteText,
      icon: testActions.icon,
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
    const actionId = String(row.actionId);
    const action = actionsMap.get(actionId) ?? {
      id: actionId,
      title: String(row.title),
      hasConfirmation: Boolean(row.hasConfirmation),
      confirmationTimeout: row.confirmationTimeout ?? null,
      actionTimeout: Number(row.actionTimeout ?? 0),
      pasteText: row.pasteText ?? null,
      icon: row.icon ?? null,
      email: row.email ?? null,
      password: row.password ?? null,
      confirmationOptions: [],
    };

    if (!actionsMap.has(actionId)) {
      actionsMap.set(actionId, action);
    }

    const optionId = row.confirmationOptionId ? String(row.confirmationOptionId) : null;
    const optionValue = row.confirmationOption ? String(row.confirmationOption) : null;

    if (optionId && optionValue) {
      action.confirmationOptions.push({
        id: optionId,
        option: optionValue,
        isSelected: Boolean(row.confirmationisSelected),
      });
    }
  }

  return Array.from(actionsMap.values());
}
