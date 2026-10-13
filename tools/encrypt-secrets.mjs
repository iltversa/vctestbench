// Encrypts credentials that were saved before encryption existed.
//
//   node --env-file=.env tools/encrypt-secrets.mjs --dry-run   # count only
//   node --env-file=.env tools/encrypt-secrets.mjs             # do it
//
// Needs DATABASE_URL and VC_SECRET_KEY. Safe to run again: values that are
// already encrypted are skipped. Only counts are printed, never secrets.

import postgres from "postgres";
import { encryptSecret, encryptFlowSecrets } from "../services/secrets.mjs";

const dryRun = process.argv.includes("--dry-run");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  // Fails fast, before touching any row, if the key is missing or malformed.
  encryptSecret("key check");

  const actions = await sql`
    select id, password from test_actions
    where password is not null and password <> '' and password not like 'enc:v1:%'`;

  const tests = await sql`select id, flow from tests`;
  const changedTests = tests
    .map((row) => ({ id: row.id, flow: encryptFlowSecrets(row.flow), before: JSON.stringify(row.flow) }))
    .filter((row) => JSON.stringify(row.flow) !== row.before);

  console.log(`Actions with a plaintext password: ${actions.length}`);
  console.log(`Tests with a plaintext password in their flow: ${changedTests.length}`);

  if (dryRun) {
    console.log("Dry run: nothing was changed.");
  } else {
    await sql.begin(async (tx) => {
      for (const row of actions) {
        await tx`update test_actions set password = ${encryptSecret(row.password)} where id = ${row.id}`;
      }
      for (const row of changedTests) {
        await tx`update tests set flow = ${tx.json(row.flow)} where id = ${row.id}`;
      }
    });
    console.log("Done. All stored passwords are now encrypted.");
  }
} catch (error) {
  console.error("Failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
