// Shapes shared between the pages, the editor and the dialogs.

import type { FlowNode } from "@/components/TestFlowBuilder";

export type SavedTestAction = {
  id: string;
  title: string;
  hasConfirmation: boolean;
  confirmationTimeout?: number | null;
  actionTimeout: number;
  confirmationOptions: { option: string; isSelected: boolean }[];
  pasteText?: string | null;
  email?: string | null;
  password?: string | null;
  icon?: string | null;
  clickOnText?: string | null;
};

export type SavedTest = {
  id: string;
  title: string;
  description?: string;
  createdAt?: string | Date;
  flow?: FlowNode[];
  actions?: SavedTestAction[];
};

// The titles of a flow's actions in the order they are drawn (depth first).
export function flowActionTitles(nodes: FlowNode[] = [], actions: SavedTestAction[] = []): string[] {
  const byId = new Map(actions.map((action) => [action.id, action.title]));
  const titles: string[] = [];

  const walk = (list: FlowNode[]) => {
    for (const node of list) {
      if (node.actionId) titles.push(node.actionTitle ?? node.actionData?.title ?? byId.get(node.actionId) ?? "");
      walk(node.paths ?? []);
    }
  };

  walk(nodes);
  return titles;
}

// How many steps a flow will run: every node that holds an action. Saved
// flows keep only the stored fields (no `nodeType`), so look at `actionId`.
export const countSteps = (nodes: FlowNode[] = []): number =>
  nodes.reduce(
    (total, node) => total + (node.actionId ? 1 : 0) + countSteps(node.paths ?? []),
    0
  );
