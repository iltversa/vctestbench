import { db } from "@/db";

import { tests } from "@/db/schema/tests";
import { testActions } from "@/db/schema/test-actions";
import { confirmationOptions } from "@/db/schema/confirmation-options";

import { eq, asc } from "drizzle-orm";



export async function getTests() {
  const testRows = await db.select().from(tests);

  const result = [];

  for (const test of testRows) {
    const flowNodes = Array.isArray((test as any).flow)
      ? (test as any).flow
      : [];

    // -----------------------------------
    // Collect every actionId from flow
    // -----------------------------------

    const actionIds = new Set<string>();

    function collectActionIds(nodes: any[]) {
      for (const node of nodes) {
        if (node?.actionId) {
          actionIds.add(node.actionId);
        }

        if (Array.isArray(node?.paths)) {
          collectActionIds(node.paths);
        }
      }
    }

    collectActionIds(flowNodes);

    // -----------------------------------
    // Fetch actions referenced by this flow
    // -----------------------------------

    const actions = [];

    for (const actionId of actionIds) {
      const actionRows = await db
        .select()
        .from(testActions)
        .where(eq(testActions.id, actionId));

      if (actionRows.length === 0) {
        console.warn(
          `Action not found: ${actionId}`
        );

        continue;
      }

      const action = actionRows[0];

      // -----------------------------------
      // Fetch confirmation options
      // -----------------------------------

      const actionOptions = await db
        .select()
        .from(confirmationOptions)
        .where(
          eq(
            confirmationOptions.testActionId,
            action.id
          )
        );

      actions.push({
        ...action,

        confirmationOptions: actionOptions,
      });
    }

    result.push({
      ...test,

      // Original tree.
      // This determines execution order.
      flow: flowNodes,

      // Action definitions referenced by flow.
      actions,
    });
  }

  return result;
}