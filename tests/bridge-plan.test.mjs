import assert from "node:assert/strict";
import test from "node:test";
import { planFlow } from "../tools/bridge/runner.mjs";

const slot = (id) => ({ id, actionId: null, paths: [] });
const node = (id, title, data, paths = [slot(`${id}-end`)]) => ({
  id,
  actionId: `a-${id}`,
  actionData: { id: `a-${id}`, title, ...data },
  paths,
});

const plan = (flow) => planFlow(flow, new Map()).map((step) => `${step.index}. ${step.action}: ${step.detail}`);

test("the plan lists the steps in the order they will run, with what each does", () => {
  const flow = [
    node("a", "CLICK", { clickOnText: "ADD USER" }, [
      node("b", "DELAY", { actionTimeout: 5 }, [node("c", "AUTHENTICATION", { email: "me@example.com" })]),
    ]),
  ];

  assert.deepEqual(plan(flow), [
    '1. CLICK: Tap "ADD USER"',
    "2. DELAY: Wait 5s",
    "3. AUTHENTICATION: Sign in as me@example.com",
  ]);
});

test("the plan never includes the password", () => {
  const flow = [node("a", "AUTHENTICATION", { email: "me@example.com", password: "hunter2" })];

  assert.ok(!JSON.stringify(planFlow(flow, new Map())).includes("hunter2"));
});

test("only the chosen confirmation branch is planned", () => {
  const yes = { id: "yes-node", optionId: "yes", isSelected: true, actionId: null, paths: [node("y", "PASTE", { pasteText: "on yes" })] };
  const no = { id: "no-node", optionId: "no", isSelected: false, actionId: null, paths: [node("n", "PASTE", { pasteText: "on no" })] };
  const flow = [
    node(
      "q",
      "CONFIRMATION",
      { confirmationOptions: [{ id: "yes", option: "YES", isSelected: true }, { id: "no", option: "NO", isSelected: false }] },
      [yes, no]
    ),
  ];

  assert.deepEqual(plan(flow), ['1. CONFIRMATION: Choose "YES"', '2. PASTE: Paste "on yes"']);
});

test("empty slots are not steps", () => {
  assert.deepEqual(plan([slot("only")]), []);
});

test("an action in the lookup map wins over the copy stored in the node", () => {
  const flow = [{ id: "a", actionId: "x", actionData: { id: "x", title: "CLICK", clickOnText: "old" }, paths: [] }];
  const actions = new Map([["x", { id: "x", title: "CLICK", clickOnText: "new" }]]);

  assert.equal(planFlow(flow, actions)[0].detail, 'Tap "new"');
});

test("a ROUTE step is planned with the page it checks", () => {
  const flow = [node("r", "ROUTE", { route: "/loginTS" })];

  assert.deepEqual(plan(flow), ["1. ROUTE: On page /loginTS"]);
});

test("a ROUTE step that goes to a page says so", () => {
  const flow = [node("r", "ROUTE", { route: "/loginTS", routeMode: "go" })];

  assert.deepEqual(plan(flow), ["1. ROUTE: Go to /loginTS"]);
});

test("an IF step is planned alone: its branch is only known on the tablet", () => {
  const branch = (id, title) => ({
    id,
    optionId: id,
    paths: [node(`${id}-step`, title, {}, [slot(`${id}-end`)])],
  });

  const flow = [
    node("i", "IF", { condition: { kind: "user", field: "subscription.status", operator: "equals", value: "true" } }, [
      branch("if:then", "CLICK"),
      branch("if:else", "SAVE"),
    ]),
  ];

  assert.deepEqual(plan(flow), ['1. IF: If user subscription.status is true']);
});
