import assert from "node:assert/strict";
import test from "node:test";

// A DevTools socket that answers every evaluate with `reply`.
let reply;

globalThis.fetch = async () => ({
  json: async () => [{ type: "page", webSocketDebuggerUrl: "ws://tablet" }],
});

globalThis.WebSocket = class {
  constructor() {
    setTimeout(() => this.onopen?.(), 0);
  }
  send() {
    setTimeout(
      () => this.onmessage?.({ data: JSON.stringify({ id: 1, result: { result: { value: reply } } }) }),
      0
    );
  }
  close() {}
};

const { clickTextAround, clickSaveButton } = await import("../tools/bridge/webview.mjs");

test("a tap that lands resolves", async () => {
  reply = { success: true };
  assert.deepEqual(await clickTextAround("ADD USER"), { success: true });
});

test("text that is not on screen rejects with the page's reason", async () => {
  reply = { success: false, reason: 'Text "add user" was not found' };
  await assert.rejects(clickTextAround("ADD USER"), /was not found/);
});

test("a missing save button is reported by the page, not thrown here", async () => {
  reply = { success: false, reason: "data-save not currently in DOM" };
  assert.deepEqual(await clickSaveButton(), reply);
});

test("tapping the label itself is reported, not treated as a failure", async () => {
  reply = { success: true, viaLabel: true };
  assert.equal((await clickTextAround("ADD USER")).viaLabel, true);
});
