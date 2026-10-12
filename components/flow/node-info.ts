// How a step is described and drawn, shared by the editor and the run view.

import {
  faCheck,
  faCircleQuestion,
  faCodeBranch,
  faFloppyDisk,
  faHandPointer,
  faHourglassHalf,
  faKey,
  faPaste,
  faStop,
  faTimes,
  faUser,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import type { FlowNode } from "@/components/TestFlowBuilder";

const ICONS = { faUser, faTimes, faStop, faCheck, faPaste } as const;

// One icon for each kind of action, so a flow reads at a glance.
const BY_TITLE: Record<string, IconDefinition> = {
  CLICK: faHandPointer,
  PASTE: faPaste,
  AUTHENTICATION: faKey,
  DELAY: faHourglassHalf,
  CONFIRMATION: faCodeBranch,
  SAVE: faFloppyDisk,
};

// The built-in actions have their own icon; any other action keeps the one
// picked for it.
export function iconForAction(title?: string | null, stored?: string | null): IconDefinition {
  const known = BY_TITLE[String(title ?? "").trim().toUpperCase()];
  if (known) return known;
  if (stored && stored in ICONS) return ICONS[stored as keyof typeof ICONS];
  return title ? faUser : faCircleQuestion;
}

// One line saying what the step does.
export function nodeSubtitle(node: FlowNode): string | null {
  const title = node.actionTitle?.trim().toUpperCase();
  const data = node.actionData;

  if (title === "DELAY") return `Wait ${Number(data?.actionTimeout ?? 0)}s`;
  if (title === "PASTE") return data?.pasteText ? `Paste "${data.pasteText}"` : "No text set";
  if (title === "CLICK") return data?.clickOnText ? `Tap "${data.clickOnText}"` : "No text set";
  if (title === "AUTHENTICATION") return data?.email ? `Sign in as ${data.email}` : "No email set";
  if (title === "CONFIRMATION") {
    const count = data?.confirmationOptions?.length ?? 0;
    return `${count} ${count === 1 ? "option" : "options"}`;
  }
  return null;
}
