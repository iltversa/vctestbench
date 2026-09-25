import { db } from "@/db";

import { tests } from "@/db/schema/tests";
import { testActions } from "@/db/schema/test-actions";
import { confirmationOptions } from "@/db/schema/confirmation-options";

import { eq, asc } from "drizzle-orm";

export async function getTests() {
  const testRows = await db
    .select()
    .from(tests);

  const result = [];

  for (const test of testRows) {
    const actions = await db
      .select()
      .from(testActions)
      .where(eq(testActions.testId, test.id))
      .orderBy(asc(testActions.sortOrder));

    const actionsWithOptions = [];

    for (const action of actions) {
      const options = await db
        .select()
        .from(confirmationOptions)
        .where(eq(confirmationOptions.actionId, action.id))
        .orderBy(asc(confirmationOptions.sortOrder));

      actionsWithOptions.push({
        ...action,
        confirmationOptions: options,
      });
    }

    result.push({
      ...test,
      actions: actionsWithOptions,
    });
  }

  return result;
}