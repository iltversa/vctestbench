import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChildrenForAction,
  extractFlowTree,
  findAppendSlot,
  hydrateFlow,
  insertBeforeInTree,
  isEmptySlot,
  parentIdOf,
  removeFromTree,
} from "../components/flow/tree.ts";

// --- builders -------------------------------------------------------------
const slot = (id) => ({ id, nodeType: "action", paths: [] });

const step = (id, title, paths = [slot(`${id}-end`)], extra = {}) => ({
  id,
  nodeType: "action",
  actionId: `a-${id}`,
  actionTitle: title,
  actionData: { id: `a-${id}`, title, hasConfirmation: false, confirmationOptions: [], ...extra },
  paths,
});

// CONFIRMATION with YES (selected) and NO branches.
const confirmation = (id, yesPaths = [slot(`${id}-yes-end`)]) => ({
  id,
  nodeType: "action",
  actionId: `a-${id}`,
  actionTitle: "CONFIRMATION",
  actionData: {
    id: `a-${id}`,
    title: "CONFIRMATION",
    confirmationOptions: [
      { id: `${id}-yes`, option: "YES", isSelected: true },
      { id: `${id}-no`, option: "NO", isSelected: false },
    ],
  },
  paths: [
    { id: `${id}-yes-node`, nodeType: "confirmation", optionId: `${id}-yes`, optionLabel: "YES", isSelected: true, paths: yesPaths },
    { id: `${id}-no-node`, nodeType: "confirmation", optionId: `${id}-no`, optionLabel: "NO", isSelected: false, paths: [] },
  ],
});

// A readable outline: CLICK > PASTE > (end)
const outline = (list) =>
  list
    .map((node) =>
      isEmptySlot(node)
        ? "(end)"
        : node.nodeType === "confirmation"
          ? `[${node.optionLabel}]${node.paths.length ? " > " + outline(node.paths) : ""}`
          : `${node.actionTitle}${node.paths.length ? " > " + outline(node.paths) : ""}`
    )
    .join(" | ");

// --- removing -------------------------------------------------------------
test("removing a middle step joins its neighbours", () => {
  const flow = [step("a", "CLICK", [step("b", "DELAY", [step("c", "PASTE")])])];
  const { tree, removed } = removeFromTree(flow, "b");

  assert.equal(outline(tree), "CLICK > PASTE > (end)");
  assert.equal(removed.id, "b");
});

test("removing the first step promotes the next one to the root", () => {
  const flow = [step("a", "CLICK", [step("b", "PASTE")])];
  assert.equal(outline(removeFromTree(flow, "a").tree), "PASTE > (end)");
});

test("removing the last real step leaves the end slot under its parent", () => {
  const flow = [step("a", "CLICK", [step("b", "PASTE")])];
  assert.equal(outline(removeFromTree(flow, "b").tree), "CLICK > (end)");
});

test("removing the only step leaves one empty slot, never an empty tree", () => {
  const { tree } = removeFromTree([step("a", "CLICK")], "a");

  assert.equal(tree.length, 1);
  assert.ok(isEmptySlot(tree[0]));
});

test("an unknown id changes nothing and removes nothing", () => {
  const flow = [step("a", "CLICK")];
  const { tree, removed } = removeFromTree(flow, "nope");

  assert.equal(removed, null);
  assert.equal(outline(tree), outline(flow));
});

test("removing a confirmation keeps only the chosen branch", () => {
  const flow = [step("a", "CLICK", [confirmation("q", [step("b", "PASTE")])])];
  assert.equal(outline(removeFromTree(flow, "q").tree), "CLICK > PASTE > (end)");
});

test("an adopted empty slot is dropped when real branches sit beside it", () => {
  // CLICK has two branches: [DELAY > (end)] and [PASTE > (end)].
  const flow = [step("a", "CLICK", [step("b", "DELAY"), step("c", "PASTE")])];
  const { tree } = removeFromTree(flow, "b");

  assert.equal(outline(tree), "CLICK > PASTE > (end)");
});

test("removing a branch step inside a confirmation option keeps the option", () => {
  const flow = [confirmation("q", [step("b", "PASTE")])];
  const { tree } = removeFromTree(flow, "b");

  assert.equal(outline(tree), "CONFIRMATION > [YES] > (end) | [NO]");
});

// --- inserting ------------------------------------------------------------
test("inserting between two steps continues the chain below the new one", () => {
  const flow = [step("a", "CLICK", [step("c", "PASTE")])];
  const inserted = step("b", "DELAY", []);
  const tree = insertBeforeInTree(flow, "a", "c", inserted);

  assert.equal(outline(tree), "CLICK > DELAY > PASTE > (end)");
});

test("inserting before the first step makes the new step the root", () => {
  const flow = [step("a", "CLICK")];
  const tree = insertBeforeInTree(flow, null, "a", step("n", "DELAY", []));

  assert.equal(outline(tree), "DELAY > CLICK > (end)");
});

test("inserting a confirmation puts the old chain under its selected option", () => {
  const flow = [step("a", "CLICK", [step("c", "PASTE")])];
  const tree = insertBeforeInTree(flow, "a", "c", confirmation("q", []));

  assert.equal(outline(tree), "CLICK > CONFIRMATION > [YES] > PASTE > (end) | [NO]");
});

test("inserting beside other branches only affects the targeted branch", () => {
  const flow = [step("a", "CLICK", [step("b", "DELAY"), step("c", "PASTE")])];
  const tree = insertBeforeInTree(flow, "a", "c", step("n", "SAVE", []));

  assert.equal(outline(tree), "CLICK > DELAY > (end) | SAVE > PASTE > (end)");
});

test("remove then insert moves a step", () => {
  const flow = [step("a", "CLICK", [step("b", "DELAY", [step("c", "PASTE")])])];
  const { tree, removed } = removeFromTree(flow, "c");
  const moved = { ...removed, paths: buildChildrenForAction(removed.actionData, []) };
  const result = insertBeforeInTree(tree, null, "a", moved);

  assert.equal(outline(result), "PASTE > CLICK > DELAY > (end)");
});

// --- looking things up ----------------------------------------------------
test("findAppendSlot returns the empty slot at the end of the chain", () => {
  const flow = [step("a", "CLICK", [step("b", "PASTE")])];
  assert.equal(findAppendSlot(flow).id, "b-end");
});

test("findAppendSlot follows the selected confirmation option", () => {
  const flow = [confirmation("q", [step("b", "PASTE")])];
  assert.equal(findAppendSlot(flow).id, "b-end");
});

test("parentIdOf finds the parent, null for the root, undefined when absent", () => {
  const flow = [step("a", "CLICK", [step("b", "PASTE")])];

  assert.equal(parentIdOf(flow, "b"), "a");
  assert.equal(parentIdOf(flow, "a"), null);
  assert.equal(parentIdOf(flow, "zzz"), undefined);
});

// --- storing and loading --------------------------------------------------
test("extractFlowTree keeps what is stored and drops editor-only fields", () => {
  const saved = extractFlowTree([step("a", "CLICK", [slot("end")], { clickOnText: "Start" })]);

  assert.deepEqual(Object.keys(saved[0]).sort(), ["actionData", "actionId", "id", "isSelected", "optionId", "paths"]);
  assert.equal(saved[0].actionData.clickOnText, "Start");
  assert.equal(saved[0].paths[0].actionId, null);
});

test("a saved flow loads back into the same shape", () => {
  const original = [step("a", "CLICK", [confirmation("q", [step("b", "PASTE")])])];
  const reloaded = hydrateFlow(JSON.parse(JSON.stringify(extractFlowTree(original))), []);

  assert.equal(outline(reloaded), outline(original));
});

test("every action but CONFIRMATION gets exactly one child slot", () => {
  const children = buildChildrenForAction({ id: "x", title: "CLICK", confirmationOptions: [] }, []);

  assert.equal(children.length, 1);
  assert.ok(isEmptySlot(children[0]));
});

// --- counting ---------------------------------------------------------------
import { countSteps } from "../components/types.ts";

test("steps are counted from a stored flow, which has no nodeType", () => {
  const stored = [
    { id: "a", actionId: "x", paths: [{ id: "b", actionId: "y", paths: [{ id: "end", actionId: null, paths: [] }] }] },
  ];

  assert.equal(countSteps(stored), 2);
});

test("a flow that is only an empty slot has no steps", () => {
  assert.equal(countSteps([{ id: "end", actionId: null, paths: [] }]), 0);
  assert.equal(countSteps(undefined), 0);
});

// --- recording ------------------------------------------------------------
import { flowFromRecording, recordingTodos } from "../components/flow/record.ts";

test("a recording becomes a chain of steps ending in the empty slot", () => {
  const library = [{ id: "click-id", title: "CLICK", actionTimeout: 5 }];
  const flow = flowFromRecording(
    [
      { id: 1, action: "CLICK", text: "ADD USER" },
      { id: 2, action: "PASTE", text: "Ann" },
    ],
    library
  );

  assert.equal(flow.length, 1);
  assert.equal(flow[0].actionTitle, "CLICK");
  assert.equal(flow[0].actionId, "click-id", "uses the library action when there is one");
  assert.equal(flow[0].actionData.clickOnText, "ADD USER");

  const second = flow[0].paths[0];
  assert.equal(second.actionTitle, "PASTE");
  assert.equal(second.actionData.pasteText, "Ann");
  assert.ok(isEmptySlot(second.paths[0]), "the chain ends in an empty slot");
});

test("an empty recording is just an empty slot", () => {
  const flow = flowFromRecording([], []);
  assert.equal(flow.length, 1);
  assert.ok(isEmptySlot(flow[0]));
});

test("sign-in is recorded without a password and flagged for the person", () => {
  const steps = [
    { id: 1, action: "AUTHENTICATION", email: "me@example.com", hasPassword: true },
    { id: 2, action: "CLICK", text: "", unlabeled: true },
  ];
  const flow = flowFromRecording(steps, []);

  assert.equal(flow[0].actionData.email, "me@example.com");
  assert.equal(flow[0].actionData.password, "");
  assert.equal(recordingTodos(steps).length, 2);
});

test("a recorded page becomes a ROUTE step with its route", () => {
  const flow = flowFromRecording([{ id: 1, action: "ROUTE", route: "/home" }], []);

  assert.equal(flow[0].actionTitle, "ROUTE");
  assert.equal(flow[0].actionData.route, "/home");
});

test("a recorded dialog choice is a CONFIRMATION whose chosen option continues the flow", () => {
  const flow = flowFromRecording(
    [
      { id: 1, action: "CONFIRMATION", text: "Delete", options: ["Cancel", "Delete"] },
      { id: 2, action: "CLICK", text: "Done" },
    ],
    []
  );

  const confirmation = flow[0];
  assert.equal(confirmation.actionTitle, "CONFIRMATION");
  assert.equal(confirmation.actionData.hasConfirmation, true);

  const [cancel, remove] = confirmation.paths;
  assert.equal(cancel.optionLabel, "Cancel");
  assert.equal(cancel.isSelected, false);
  assert.deepEqual(cancel.paths, []);
  assert.equal(remove.optionLabel, "Delete");
  assert.equal(remove.isSelected, true);
  assert.equal(remove.paths[0].actionTitle, "CLICK", "what follows hangs under the chosen option");

  const chosen = confirmation.actionData.confirmationOptions.find((option) => option.isSelected);
  assert.equal(chosen.id, remove.optionId, "the option and its branch share an id");
});
