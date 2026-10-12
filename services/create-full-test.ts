import { db } from "@/db";
import { tests } from "@/db/schema/tests";
import { FlowNode } from "@/components/TestFlowBuilder";
import { eq } from "drizzle-orm";
import { UpdateFullTestInput } from "@/actions/create-full-test";
import { encryptFlowSecrets } from "@/services/secrets.mjs";
import { recordActivity } from "@/services/activity";
import { countSteps } from "@/components/types";

export type CreateFullTestInput = {
  title: string;
  description: string;
  flow?: FlowNode[];
};

export async function createFullTestService(input: CreateFullTestInput) {
  return await db.transaction(async (tx) => {
    const [test] = await tx
      .insert(tests)
      .values({
        title: input.title,
        description: input.description,
        // Passwords inside action data are stored encrypted.
        flow: encryptFlowSecrets(input.flow ?? []),
      })
      .returning();

    if (!test) {
      throw new Error("Failed to create test");
    }

    return test;
  }).then(async (test) => {
    await recordActivity({ kind: "test.created", testId: test.id, title: test.title });
    return test;
  });
}
export async function updateFullTestService(input: UpdateFullTestInput) {
  const [before] = await db.select().from(tests).where(eq(tests.id, input.id));

  const updated = await db.transaction(async (tx) => {
    const [updatedTest] = await tx
      .update(tests)
      .set({
        title: input.title,
        description: input.description,
        // Passwords inside action data are stored encrypted.
        flow: encryptFlowSecrets(input.flow ?? []),
        updatedAt: new Date(),
      })
      .where(eq(tests.id, input.id))
      .returning();

    if (!updatedTest) {
      throw new Error("Test not found");
    }

    return updatedTest;
  });

  // Say what changed, so the activity view is informative rather than a list
  // of "updated".
  const changes: string[] = [];
  if (before && before.title !== updated.title) changes.push(`Renamed from “${before.title}”`);

  const stepsBefore = before ? countSteps(before.flow) : 0;
  const stepsAfter = countSteps(updated.flow);
  if (stepsBefore !== stepsAfter) changes.push(`Steps ${stepsBefore} → ${stepsAfter}`);
  else if (before && JSON.stringify(before.flow) !== JSON.stringify(updated.flow)) changes.push("Steps changed");

  if (before && before.description !== updated.description) changes.push("Description changed");

  await recordActivity({
    kind: "test.updated",
    testId: updated.id,
    title: updated.title,
    detail: changes.length ? changes.join(" · ") : "Saved",
  });

  return updated;
}