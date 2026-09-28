import { db } from "@/db";

import { tests } from "@/db/schema/tests";
import { testActions } from "@/db/schema/test-actions";
import { confirmationOptions } from "@/db/schema/confirmation-options";

import { eq, asc } from "drizzle-orm";

function flattenFlowSteps(flowNodes: any[] = [], ordered: any[] = []): any[] {
  for (const node of flowNodes) {
    if (!node) continue;

    if (node.nodeType === "action") {
      const actionData = node.actionData ?? {};
      const title = node.actionTitle ?? actionData.title ?? "Untitled";

      ordered.push({
        id: node.actionId ?? actionData.id ?? node.id,
        title,
        action: actionData.title ?? title,
        customAction: actionData.customAction ?? null,
        testClassId: actionData.testClassId ?? null,
        hasConfirmation: Boolean(actionData.hasConfirmation),
        confirmationTimeout: actionData.confirmationTimeout ?? null,
        confirmationOptions: Array.isArray(actionData.confirmationOptions)
          ? actionData.confirmationOptions.map((option: any) =>
              typeof option === "string" ? option : option.option ?? option.value ?? ""
            )
          : [],
        actionTimeout: Number(actionData.actionTimeout ?? 0),
        sortOrder: ordered.length,
      });
    }

    if (Array.isArray(node.paths)) {
      flattenFlowSteps(node.paths, ordered);
    }
  }

  return ordered;
}

export async function getTests() {
  const testRows = await db.select().from(tests);

  const result = [];

  for (const test of testRows) {
    const flowNodes = Array.isArray((test as any).flow) ? (test as any).flow : [];
    const flowActions = flowNodes.length > 0 ? flattenFlowSteps(flowNodes) : [];

    const actions =
      flowActions.length > 0
        ? flowActions
        : await db
            .select()
            .from(testActions)
            .where(eq(testActions.testId, test.id))
            .orderBy(asc(testActions.sortOrder));

    const actionsWithOptions = [];

    for (const action of actions) {
      const actionOptions = Array.isArray(action.confirmationOptions)
        ? action.confirmationOptions
        : await db
            .select()
            .from(confirmationOptions)
            .where(eq(confirmationOptions.testActionId, action.id));

      actionsWithOptions.push({
        ...action,
        confirmationOptions: actionOptions,
      });
    }

    result.push({
      ...test,
      flow: flowNodes,
      actions: actionsWithOptions,
    });
  }

  return result;
}