import assert from "node:assert/strict";
import test from "node:test";

// A short limit, set before the bridge reads its configuration.
process.env.VC_ACTION_TIMEOUT_SECONDS = "1";

const { untilFound } = await import("../tools/bridge/runner.mjs");

test("a step acts as soon as its target appears", async () => {
  const step = { waitedMs: 0 };
  let tries = 0;

  const result = await untilFound(step, async () => {
    tries += 1;
    if (tries < 3) throw new Error('Text "add user" was not found');
    return "tapped";
  });

  assert.equal(result, "tapped");
  assert.equal(tries, 3);
  assert.ok(step.waitedMs >= 900, "the time spent looking is recorded as waiting");
});

test("a target that never appears fails with what was missing", async () => {
  const step = { waitedMs: 0 };

  await assert.rejects(
    untilFound(step, async () => {
      throw new Error('Text "add user" was not found');
    }),
    /Text "add user" was not found \(looked for 1s\)/
  );
});

test("an error that is not 'not there yet' fails at once", async () => {
  let tries = 0;
  const started = Date.now();

  await assert.rejects(
    untilFound(null, async () => {
      tries += 1;
      throw new Error("AUTHENTICATION needs both an email and a password.");
    }),
    /needs both an email/
  );

  assert.equal(tries, 1);
  assert.ok(Date.now() - started < 500);
});

test("the first try is immediate and nothing is recorded when it works", async () => {
  const step = { waitedMs: 0 };
  assert.equal(await untilFound(step, async () => "ok"), "ok");
  assert.equal(step.waitedMs, 0);
});

test("a page that is not the expected one yet is looked for, then reported", async () => {
  const step = { waitedMs: 0 };
  let tries = 0;

  await untilFound(step, async () => {
    tries += 1;
    if (tries < 2) throw new Error("Expected the tablet to be on /loginTS but it is on /home");
  });

  assert.equal(tries, 2);

  await assert.rejects(
    untilFound(step, async () => {
      throw new Error("Expected the tablet to be on /loginTS but it is on /home");
    }),
    /Expected the tablet to be on \/loginTS but it is on \/home \(looked for 1s\)/
  );
});

test("routes are compared without a trailing slash or query", async () => {
  const { normalizeRoute } = await import("../tools/bridge/runner.mjs");

  assert.equal(normalizeRoute("home"), "/home");
  assert.equal(normalizeRoute("/home/"), "/home");
  assert.equal(normalizeRoute("/home?tab=1#top"), "/home");
  assert.equal(normalizeRoute("/"), "/");
  assert.equal(normalizeRoute(""), "");
});
