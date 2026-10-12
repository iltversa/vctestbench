// How a step is described and drawn, shared by the editor and the run view.

import { faCheck, faPaste, faStop, faTimes, faUser } from "@fortawesome/free-solid-svg-icons";
import type { FlowNode } from "@/components/TestFlowBuilder";

const ICONS = { faUser, faTimes, faStop, faCheck, faPaste } as const;

export const iconFor = (name?: string | null) =>
  name && name in ICONS ? ICONS[name as keyof typeof ICONS] : faUser;

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
