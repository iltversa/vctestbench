import { db } from "@/db";
import { eq, asc } from "drizzle-orm";
import { confirmationOptions } from "@/db/schema/confirmation-options";
import { testActions } from "@/db/schema/test-actions";

export type TestActionDefinition = {
  id: string;
  title: string;
  icon?: string | null;
};

export async function getActionsService(): Promise<TestActionDefinition[]> {
  const rows = await db
    .select({
      actionId: testActions.id,
      title: testActions.title,
      icon: testActions.icon,
    })
    .from(testActions)
    .leftJoin(
      confirmationOptions,
      eq(confirmationOptions.testActionId, testActions.id)
    )
    .orderBy(asc(testActions.title), asc(confirmationOptions.option));

  const actionsMap = new Map<string, TestActionDefinition>();

  for (const row of rows) {
    const actionId = String(row.actionId);
    let action = actionsMap.get(actionId);

    if (!action) {
      action = {
        id: actionId,
        title: String(row.title),
        icon: row.icon ?? null,
      };
      actionsMap.set(actionId, action);
    }

  }

  return Array.from(actionsMap.values());
}
