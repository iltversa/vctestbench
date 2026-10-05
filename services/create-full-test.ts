import { db } from "@/db";
import { tests } from "@/db/schema/tests";
import { testActions } from "@/db/schema/test-actions";
import { confirmationOptions } from "@/db/schema/confirmation-options";
import { FlowNode } from "@/components/TestFlowBuilder";
import { eq } from "drizzle-orm";
import { UpdateFullTestInput } from "@/actions/create-full-test";

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
        flow: input.flow ?? [],
      })
      .returning();

    if (!test) {
      throw new Error("Failed to create test");
    }

    return test;
  });
}
export async function updateFullTestService(input: UpdateFullTestInput) {
  
  return await db.transaction(async (tx) => {
    const [updatedTest] = await tx
      .update(tests)
      .set({
        title: input.title,
        description: input.description,
        flow: input.flow ?? [],
      })
      .where(eq(tests.id, input.id))
      .returning();

    if (!updatedTest) {
      throw new Error("Test not found");
    }    

    return updatedTest;
  });
}