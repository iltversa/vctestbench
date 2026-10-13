// The condition of an IF step: what to look at on the tablet, and how to read
// the answer. Pure apart from `evaluate`, which is handed in so it can be
// tested without a device.
//
//   { kind: "text",   text, operator: "visible" | "hidden" }
//   { kind: "route",  route, operator: "is" | "is not" }
//   { kind: "user",   field, operator: "equals" | "not equals" | "contains" | "exists" | "missing", value }
//   { kind: "script", script }       a JavaScript expression run in the page
//
// `user` reads the signed-in user's document (Meteor.user()) by dotted path,
// for example subscription.status or profile.country.

// The branch ids of an IF node's two children (kept in step with
// components/flow/tree.ts).
export const IF_THEN = "if:then";
export const IF_ELSE = "if:else";

export function describeCondition(condition) {
  const c = condition ?? {};

  if (c.kind === "text") {
    return c.text ? `"${c.text}" is ${c.operator === "hidden" ? "not shown" : "shown"} on screen` : "No text set";
  }

  if (c.kind === "route") {
    return c.route ? `page ${c.operator === "is not" ? "is not" : "is"} ${c.route}` : "No route set";
  }

  if (c.kind === "user") {
    if (!c.field) return "No user field set";
    const value = c.value === undefined || c.value === null ? "" : String(c.value);

    switch (c.operator) {
      case "not equals":
        return `user ${c.field} is not ${value}`;
      case "contains":
        return `user ${c.field} contains ${value}`;
      case "exists":
        return `user has ${c.field}`;
      case "missing":
        return `user has no ${c.field}`;
      default:
        return `user ${c.field} is ${value}`;
    }
  }

  if (c.kind === "script") return c.script ? "script is true" : "No script set";

  return "No condition set";
}

const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

// Whether a value read from the user matches. `found` is false when the field
// does not exist (or is null).
export function checkUserValue(value, found, operator, expected) {
  const has = found && value !== "" && !(Array.isArray(value) && value.length === 0);

  switch (operator) {
    case "exists":
      return has;
    case "missing":
      return !has;
    case "not equals":
      return !checkUserValue(value, found, "equals", expected);
    case "contains":
      if (Array.isArray(value)) return value.some((item) => same(item, expected));
      return found && String(value).toLowerCase().includes(String(expected).trim().toLowerCase());
    default:
      if (!found) return false;
      if (Array.isArray(value)) return value.some((item) => same(item, expected));
      return same(typeof value === "object" ? JSON.stringify(value) : value, expected);
  }
}

// True or false. Throws, with something a person can act on, when the
// tablet could not be asked.
export async function evaluateCondition(condition, { evaluate, normalizeRoute }) {
  const c = condition ?? {};

  if (c.kind === "text") {
    if (!c.text) throw new Error("The IF step has no text to look for.");

    const shown = await evaluate(
      `(() => (document.body.innerText || "").toLowerCase().includes(${JSON.stringify(String(c.text).toLowerCase())}))()`
    );

    if (typeof shown !== "boolean") throw new Error("The screen could not be read.");
    return c.operator === "hidden" ? !shown : shown;
  }

  if (c.kind === "route") {
    const expected = normalizeRoute(c.route);
    if (!expected) throw new Error("The IF step has no page route.");

    const current = normalizeRoute(await evaluate("location.pathname"));
    const equal = current.toLowerCase() === expected.toLowerCase();
    return c.operator === "is not" ? !equal : equal;
  }

  if (c.kind === "user") {
    const field = String(c.field ?? "").trim();
    if (!field) throw new Error("The IF step has no user field.");

    const answer = await evaluate(`((path) => {
      try {
        if (!window.Meteor || typeof window.Meteor.user !== "function") {
          return { ok: false, reason: "The app has no signed-in user to read." };
        }

        const user = window.Meteor.user();
        if (!user) return { ok: false, reason: "Nobody is signed in on the tablet." };

        let value = user;
        for (const key of path.split(".")) value = value == null ? undefined : value[key];

        const found = value !== undefined && value !== null;
        return { ok: true, found, value: found ? value : null };
      } catch (error) {
        return { ok: false, reason: String((error && error.message) || error) };
      }
    })(${JSON.stringify(field)})`);

    if (!answer) throw new Error("The signed-in user could not be read on the tablet.");
    if (!answer.ok) throw new Error(answer.reason);

    return checkUserValue(answer.value, answer.found, c.operator, c.value ?? "");
  }

  if (c.kind === "script") {
    const script = String(c.script ?? "").trim();
    if (!script) throw new Error("The IF step has no script.");

    const answer = await evaluate(`(() => {
      try {
        return { ok: true, value: Boolean((${script})) };
      } catch (error) {
        return { ok: false, reason: String((error && error.message) || error) };
      }
    })()`);

    if (!answer) throw new Error("The IF script could not be run (is it a single JavaScript expression?).");
    if (!answer.ok) throw new Error(`The IF script failed: ${answer.reason}`);

    return answer.value;
  }

  throw new Error("The IF step has no condition. Open it and set one.");
}
