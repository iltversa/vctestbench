import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tests } from "@/db/schema/tests";
import { decryptFlowSecrets } from "@/services/secrets.mjs";

// The only place stored credentials are turned back into plaintext: the
// payload for one run, sent to the local bridge. Everything else that
// leaves the server (test lists, the editor) still carries ciphertext.
export async function getRunPayloadService(testId: string) {
  const [test] = await db.select().from(tests).where(eq(tests.id, testId));

  if (!test) {
    throw new Error("Test not found");
  }

  return {
    title: test.title,
    actions: [],
    flow: decryptFlowSecrets(test.flow),
  };
}
