import assert from "node:assert/strict";
import test from "node:test";
import { checkUserValue, describeCondition, evaluateCondition } from "../tools/bridge/condition.mjs";

const normalizeRoute = (value) => String(value ?? "").trim().replace(/\/+$/, "") || "/";

// An `evaluate` that answers with a canned value and remembers what it was asked.
const tablet = (answer) => {
  const asked = [];
  return {
    asked,
    evaluate: async (expression) => {
      asked.push(expression);
      return typeof answer === "function" ? answer(expression) : answer;
    },
    normalizeRoute,
  };
};

test("a user field is compared as text, ignoring case", () => {
  assert.equal(checkUserValue("Trainer", true, "equals", "trainer"), true);
  assert.equal(checkUserValue(true, true, "equals", "true"), true);
  assert.equal(checkUserValue(2, true, "equals", "3"), false);
  assert.equal(checkUserValue("a@b.com", true, "contains", "@b."), true);
  assert.equal(checkUserValue(["pro", "beta"], true, "contains", "PRO"), true);
});

test("filled in and missing treat null, empty text and empty lists as missing", () => {
  assert.equal(checkUserValue(null, false, "exists"), false);
  assert.equal(checkUserValue("", true, "exists"), false);
  assert.equal(checkUserValue([], true, "exists"), false);
  assert.equal(checkUserValue("x", true, "exists"), true);
  assert.equal(checkUserValue(null, false, "missing"), true);
  assert.equal(checkUserValue(false, true, "exists"), true, "false is a value");
});

test("not equals is true when the field is missing", () => {
  assert.equal(checkUserValue(null, false, "not equals", "premium"), true);
  assert.equal(checkUserValue("premium", true, "not equals", "premium"), false);
});

test("a user condition reads the field it names", async () => {
  const t = tablet({ ok: true, found: true, value: true });
  const yes = await evaluateCondition(
    { kind: "user", field: "subscription.status", operator: "equals", value: "true" },
    t
  );

  assert.equal(yes, true);
  assert.match(t.asked[0], /"subscription\.status"/);
});

test("a user condition explains why it could not be read", async () => {
  await assert.rejects(
    evaluateCondition({ kind: "user", field: "a", operator: "exists" }, tablet({ ok: false, reason: "Nobody is signed in on the tablet." })),
    /Nobody is signed in/
  );
});

test("text on screen can be required shown or hidden", async () => {
  assert.equal(await evaluateCondition({ kind: "text", text: "Upgrade", operator: "visible" }, tablet(true)), true);
  assert.equal(await evaluateCondition({ kind: "text", text: "Upgrade", operator: "hidden" }, tablet(true)), false);
});

test("the page can be required to be, or not to be, a route", async () => {
  assert.equal(await evaluateCondition({ kind: "route", route: "/home", operator: "is" }, tablet("/home")), true);
  assert.equal(await evaluateCondition({ kind: "route", route: "/home", operator: "is not" }, tablet("/home")), false);
});

test("a script is run as one expression and its truth is the answer", async () => {
  const t = tablet({ ok: true, value: true });
  assert.equal(await evaluateCondition({ kind: "script", script: "1 + 1 === 2" }, t), true);
  assert.match(t.asked[0], /\(1 \+ 1 === 2\)/);

  await assert.rejects(
    evaluateCondition({ kind: "script", script: "nope()" }, tablet({ ok: false, reason: "nope is not defined" })),
    /nope is not defined/
  );
});

test("a step with no condition set fails with something to act on", async () => {
  await assert.rejects(evaluateCondition(null, tablet(true)), /no condition/);
  await assert.rejects(evaluateCondition({ kind: "user", field: "" }, tablet(true)), /no user field/);
});

test("conditions read as a sentence", () => {
  assert.equal(describeCondition({ kind: "user", field: "subscription.tier", operator: "equals", value: "2" }), "user subscription.tier is 2");
  assert.equal(describeCondition({ kind: "user", field: "profile.country", operator: "missing" }), "user has no profile.country");
  assert.equal(describeCondition({ kind: "text", text: "Upgrade", operator: "hidden" }), '"Upgrade" is not shown on screen');
});
