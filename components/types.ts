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

// How many steps a flow will run: every node that holds an action. Saved
// flows keep only the stored fields (no `nodeType`), so look at `actionId`.
export const countSteps = (nodes: FlowNode[] = []): number =>
  nodes.reduce(
    (total, node) => total + (node.actionId ? 1 : 0) + countSteps(node.paths ?? []),
    0
  );
