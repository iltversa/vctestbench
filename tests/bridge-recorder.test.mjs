import assert from "node:assert/strict";
import test from "node:test";
import { Recording } from "../tools/bridge/recorder.mjs";

const click = (label, extra = {}) => ({ kind: "click", label, ...extra });
const type = (value, field = "Name") => ({ kind: "input", value, field });
const password = () => ({ kind: "input", password: true, value: "", field: "Password" });

const record = (events) => {
  const recording = new Recording();
  recording.ingest(events);
  return recording.steps.map((step) => {
    const copy = { ...step };
    delete copy.id;
    return copy;
  });
};

test("taps become CLICK steps in order", () => {
  assert.deepEqual(record([click("ADD USER"), click("Next")]), [
    { action: "CLICK", text: "ADD USER", unlabeled: false },
    { action: "CLICK", text: "Next", unlabeled: false },
  ]);
});

test("typed text becomes PASTE, and editing the same field replaces it", () => {
  assert.deepEqual(record([type("Ann"), type("Anna")]), [{ action: "PASTE", text: "Anna", field: "Name" }]);
});

test("empty edits are not steps", () => {
  assert.deepEqual(record([type("")]), []);
});

test("email, password and the sign-in tap become one AUTHENTICATION", () => {
  const steps = record([type("me@example.com", "Email"), password(), click("Sign in")]);

  assert.equal(steps.length, 1);
  assert.equal(steps[0].action, "AUTHENTICATION");
  assert.equal(steps[0].email, "me@example.com");
  assert.equal(steps[0].hasPassword, true);
  assert.ok(!("password" in steps[0]), "the password is never part of a recording");
});

test("a tap after sign-in that is not the sign-in button is still a step", () => {
  const steps = record([type("me@example.com"), password(), click("Forgot password?")]);

  assert.deepEqual(steps.map((step) => step.action), ["AUTHENTICATION", "CLICK"]);
});

test("the save button becomes SAVE, once", () => {
  assert.deepEqual(
    record([click("Save", { isSave: true }), click("Save", { isSave: true })]).map((step) => step.action),
    ["SAVE"]
  );
});

test("a tap with no readable text is kept and flagged", () => {
  assert.deepEqual(record([click("")]), [{ action: "CLICK", text: "", unlabeled: true }]);
});

test("junk is ignored", () => {
  assert.deepEqual(record([null, { kind: "scroll" }, "x"]), []);
});

const route = (path) => ({ kind: "route", path });

test("the page the recording starts on, and each change of page, become ROUTE steps", () => {
  assert.deepEqual(record([route("/home"), click("ADD USER"), route("/loginTS")]), [
    { action: "ROUTE", route: "/home" },
    { action: "CLICK", text: "ADD USER", unlabeled: false },
    { action: "ROUTE", route: "/loginTS" },
  ]);
});

test("the same page twice in a row is one ROUTE step", () => {
  assert.deepEqual(record([route("/home"), route("/home"), route("")]), [{ action: "ROUTE", route: "/home" }]);
});

test("a page change right after sign-in does not stop the sign-in tap being absorbed", () => {
  const steps = record([type("me@example.com"), password(), click("Sign in"), route("/home")]);

  assert.deepEqual(steps.map((step) => step.action), ["AUTHENTICATION", "ROUTE"]);
});
