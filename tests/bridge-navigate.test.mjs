import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

const { NAVIGATE_SCRIPT } = await import("../tools/bridge/runner.mjs");

// Runs the script as the page would, in a window made of whatever is given.
function run(path, window) {
  class PopStateEvent {
    constructor(type, init) {
      this.type = type;
      Object.assign(this, init);
    }
  }

  return vm.runInNewContext(NAVIGATE_SCRIPT(path), { window, PopStateEvent });
}

test("the app's own router is used, and no page load happens", () => {
  const calls = [];
  const window = {
    FlowRouter: { go: (path) => calls.push(["go", path]) },
    location: { assign: () => calls.push(["assign"]), reload: () => calls.push(["reload"]) },
  };

  assert.equal(run("/loginTS", window), "FlowRouter");
  assert.deepEqual(calls, [["go", "/loginTS"]]);
});

test("a router that follows the address bar is told, without a page load", () => {
  const calls = [];
  const window = {
    history: {
      state: null,
      pushState(state, _title, path) {
        this.state = state;
        calls.push(["push", path]);
      },
    },
    dispatchEvent: (event) => calls.push([event.type, event.state]),
    location: { assign: () => calls.push(["assign"]) },
  };

  assert.equal(run("/home", window), "history");
  // (objects made inside the vm differ in prototype: compare as JSON)
  assert.equal(JSON.stringify(calls), JSON.stringify([["push", "/home"], ["popstate", { path: "/home" }]]));
});

test("with no way to navigate in the app it does nothing, and never loads the page", () => {
  const calls = [];
  const window = { location: { assign: () => calls.push("assign"), reload: () => calls.push("reload") } };

  assert.equal(run("/home", window), "none");
  assert.deepEqual(calls, []);
});
