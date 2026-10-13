// How a step is described and drawn, shared by the editor and the run view.

import {
  faCheck,
  faCircleQuestion,
  faCodeBranch,
  faCodeFork,
  faFloppyDisk,
  faHandPointer,
  faHourglassHalf,
  faKey,
  faLocationDot,
  faPaste,
  faStop,
  faTimes,
  faUser,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import type { FlowNode, IfCondition } from "@/components/TestFlowBuilder";

const ICONS = { faUser, faTimes, faStop, faCheck, faPaste } as const;

// One icon for each kind of action, so a flow reads at a glance.
const BY_TITLE: Record<string, IconDefinition> = {
  CLICK: faHandPointer,
  PASTE: faPaste,
  AUTHENTICATION: faKey,
  DELAY: faHourglassHalf,
  CONFIRMATION: faCodeBranch,
  SAVE: faFloppyDisk,
  ROUTE: faLocationDot,
  IF: faCodeFork,
};

// The built-in actions have their own icon; any other action keeps the one
// picked for it.
export function iconForAction(title?: string | null, stored?: string | null): IconDefinition {
  const known = BY_TITLE[String(title ?? "").trim().toUpperCase()];
  if (known) return known;
  if (stored && stored in ICONS) return ICONS[stored as keyof typeof ICONS];
  return title ? faUser : faCircleQuestion;
}

// What an IF step asks, in a few words.
export function describeCondition(condition?: IfCondition | null): string {
  const c = condition ?? undefined;
  if (!c) return "no condition set";

  if (c.kind === "text") return c.text ? `"${c.text}" is ${c.operator === "hidden" ? "not shown" : "shown"}` : "no text set";
  if (c.kind === "route") return c.route ? `page ${c.operator === "is not" ? "is not" : "is"} ${c.route}` : "no route set";
  if (c.kind === "script") return c.script ? "script is true" : "no script set";

  if (c.kind === "user") {
    if (!c.field) return "no user field set";
    if (c.operator === "exists") return `user has ${c.field}`;
    if (c.operator === "missing") return `user has no ${c.field}`;

    const word = c.operator === "not equals" ? "is not" : c.operator === "contains" ? "contains" : "is";
    return `user ${c.field} ${word} ${c.value ?? ""}`.trim();
  }

  return "no condition set";
}

// One line saying what the step does.
export function nodeSubtitle(node: FlowNode): string | null {
  const title = node.actionTitle?.trim().toUpperCase();
  const data = node.actionData;

  if (title === "DELAY") return `Wait ${Number(data?.actionTimeout ?? 0)}s`;
  if (title === "PASTE") return data?.pasteText ? `Paste "${data.pasteText}"` : "No text set";
  if (title === "IF") return `If ${describeCondition(data?.condition)}`;
  if (title === "ROUTE") {
    if (!data?.route) return "No route set";
    return data.routeMode === "go" ? `Go to ${data.route}` : `On page ${data.route}`;
  }
  if (title === "CLICK") return data?.clickOnText ? `Tap "${data.clickOnText}"` : "No text set";
  if (title === "AUTHENTICATION") return data?.email ? `Sign in as ${data.email}` : "No email set";
  if (title === "CONFIRMATION") {
    const count = data?.confirmationOptions?.length ?? 0;
    return `${count} ${count === 1 ? "option" : "options"}`;
  }
  return null;
}
