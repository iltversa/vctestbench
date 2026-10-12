// Pure helpers for the flow tree. No React, no bridge: everything here takes
// a tree and returns a new one, which is what makes it safe to test.
//
// The flow is a tree. Every action keeps what comes next in `paths`, and a
// chain always ends in an empty "drop here" slot.

import type { FlowNode, TestActionDefinition } from "../TestFlowBuilder";

/*  CREATE NODE */

export const createNode = (): FlowNode => ({
  id: crypto.randomUUID(),
  nodeType: "action",
  paths: [],
});

// A node as it is stored in the database: only the persisted fields, and none
// of the editor's own (`nodeType` and the labels are worked out when loading).
export type StoredNode = {
  id?: string;
  actionId?: string | null;
  actionTitle?: string;
  optionId?: string | null;
  optionLabel?: string;
  isSelected?: boolean | null;
  nodeType?: string;
  actionData?: TestActionDefinition | null;
  paths?: StoredNode[];
};

export const hydrateFlow = (
  flowNodes: StoredNode[],
  actionList: TestActionDefinition[]
): FlowNode[] => {
  return flowNodes.map((savedNode) => {
    if (savedNode.nodeType === "confirmation" || savedNode.optionId) {
      return {
        id: savedNode.id ?? crypto.randomUUID(),
        nodeType: "confirmation" as const,
        optionId: savedNode.optionId ?? undefined,
        optionLabel: savedNode.optionLabel ?? "Option",
        isSelected: Boolean(savedNode.isSelected),
        paths: savedNode.paths?.length ? hydrateFlow(savedNode.paths, actionList) : [],
      };
    }

    const matchedAction = savedNode.actionId
      ? actionList.find((action) => action.id === savedNode.actionId)
      : undefined;

    const savedAction = savedNode.actionData;

    const actionData: TestActionDefinition | undefined = savedAction
      ? {
        ...savedAction,
        confirmationOptions:
          savedAction.confirmationOptions?.map((option) => ({
            ...option,
            isSelected: Boolean(option.isSelected),
          })) ?? [],
      }
      : matchedAction
        ? {
          ...matchedAction,
          confirmationOptions:
            matchedAction.confirmationOptions?.map((option) => ({
              ...option,
              isSelected: Boolean(option.isSelected),
            })) ?? [],
        }
        : undefined;

    const isConfirmationAction =
      actionData?.title?.trim().toUpperCase() === "CONFIRMATION";

    /*
     * If this is a CONFIRMATION action, its paths are the
     * confirmation option branches.
     */
    if (isConfirmationAction) {
      return {
        id: savedNode.id ?? crypto.randomUUID(),
        nodeType: "action" as const,
        actionId: savedNode.actionId ?? actionData?.id,
        actionTitle:
          savedNode.actionTitle ??
          actionData?.title ??
          "CONFIRMATION",
        actionData,

        paths: (savedNode.paths ?? []).map((path) => {
          const option = actionData?.confirmationOptions?.find(
            (opt) => opt.id === path.optionId
          );

          return {
            id: path.id ?? crypto.randomUUID(),
            nodeType: "confirmation" as const,
            optionId: path.optionId ?? undefined,
            optionLabel: option?.option ?? "Option",
            isSelected:
              option?.isSelected ??
              Boolean(path.isSelected),

            paths: path.paths?.length
              ? hydrateFlow(path.paths, actionList)
              : [],
          };
        }),
      };
    }

    /*
     * Normal action.
     */
    return {
      id: savedNode.id ?? crypto.randomUUID(),
      nodeType: "action" as const,
      actionId: savedNode.actionId ?? actionData?.id,
      actionTitle:
        savedNode.actionTitle ??
        actionData?.title ??
        matchedAction?.title,
      actionData,
      paths: savedNode.paths?.length
        ? savedNode.paths.map((path) => {
            if (path.nodeType === "confirmation" || path.optionId) {
              const option = actionData?.confirmationOptions?.find(
                (item) => item.id === path.optionId
              );
              return {
                id: path.id ?? crypto.randomUUID(),
                nodeType: "confirmation" as const,
                optionId: path.optionId ?? undefined,
                optionLabel: path.optionLabel ?? option?.option ?? "Option",
                isSelected: path.isSelected ?? Boolean(option?.isSelected),
                paths: path.paths?.length ? hydrateFlow(path.paths, actionList) : [],
              };
            }
            return hydrateFlow([path], actionList)[0];
          })
        : [],
    };
  });
};






// ---------------------------------------------------------------------
// Tree helpers. The flow is a tree: every action keeps its children in
// `paths`, and a chain always ends in an empty "drop here" slot.
// ---------------------------------------------------------------------

export const isEmptySlot = (node: FlowNode) =>
  node.nodeType === "action" && !node.actionId && node.paths.length === 0;

export const isConfirmationAction = (node: FlowNode) =>
  node.nodeType === "action" &&
  node.paths.length > 0 &&
  node.paths.every((path) => path.nodeType === "confirmation");

// What a removed node leaves behind for its parent to adopt.
const childrenAfterRemoval = (node: FlowNode): FlowNode[] => {
  if (!isConfirmationAction(node)) return node.paths;

  // Only the chosen option carries a real branch; the others are empty.
  const chosen = node.paths.find((path) => path.isSelected) ?? node.paths[0];
  return chosen?.paths ?? [];
};

// Removes a node and joins the chain back together: its children move up to
// its parent. Returns the new tree and the node that was taken out.
export function removeFromTree(
  list: FlowNode[],
  nodeId: string
): { tree: FlowNode[]; removed: FlowNode | null } {
  let removed: FlowNode | null = null;

  const walk = (items: FlowNode[]): FlowNode[] => {
    const adopted = new Set<string>();

    const next = items.flatMap((node) => {
      if (node.id === nodeId) {
        removed = node;
        const children = childrenAfterRemoval(node);
        children.forEach((child) => adopted.add(child.id));
        return children;
      }

      const walked = walk(node.paths);
      // A branch that lost its only child still needs a slot to drop into.
      const paths = node.paths.length > 0 && walked.length === 0 ? [createNode()] : walked;
      return [{ ...node, paths }];
    });

    // An adopted empty slot next to real branches is just noise.
    const hasReal = next.some((node) => !isEmptySlot(node));
    return next.length > 1 && hasReal
      ? next.filter((node) => !(adopted.has(node.id) && isEmptySlot(node)))
      : next;
  };

  const tree = walk(list);
  return { tree: tree.length > 0 ? tree : [createNode()], removed };
}

// Puts `incoming` between `parentId` and its child `beforeId`; the old child
// (and everything below it) continues underneath the new node.
export function insertBeforeInTree(
  list: FlowNode[],
  parentId: string | null,
  beforeId: string,
  incoming: FlowNode
): FlowNode[] {
  const attach = (child: FlowNode): FlowNode => {
    if (isConfirmationAction(incoming)) {
      const chosen = Math.max(0, incoming.paths.findIndex((path) => path.isSelected));
      return {
        ...incoming,
        paths: incoming.paths.map((path, index) =>
          index === chosen ? { ...path, paths: [child] } : path
        ),
      };
    }

    return { ...incoming, paths: [child] };
  };

  if (parentId === null) {
    return list.map((node) => (node.id === beforeId ? attach(node) : node));
  }

  return list.map((node) =>
    node.id === parentId
      ? { ...node, paths: node.paths.map((child) => (child.id === beforeId ? attach(child) : child)) }
      : { ...node, paths: insertBeforeInTree(node.paths, parentId, beforeId, incoming) }
  );
}

export const parentIdOf = (list: FlowNode[], nodeId: string, parent: string | null = null): string | null | undefined => {
  for (const node of list) {
    if (node.id === nodeId) return parent;
    const found = parentIdOf(node.paths, nodeId, node.id);
    if (found !== undefined) return found;
  }
  return undefined;
};

// Plain data for storage: the editor-only fields are dropped.
export function extractFlowTree(flowNodes: FlowNode[]): FlowNode[] {
  return flowNodes.map(({ id, actionId, optionId, isSelected, paths, actionData }) => ({
    id,
    actionId: actionId ?? null,
    optionId: optionId ?? null,
    isSelected: isSelected ?? null,
    paths: extractFlowTree(paths),
    actionData: actionData ?? null,
  })) as unknown as FlowNode[];
}

export const buildChildrenForAction = (
  action: TestActionDefinition,
  existingPaths: FlowNode[] = []
): FlowNode[] => {
  // Only the action literally titled CONFIRMATION renders option branches.
  // Each option is visible, but only the selected option gets a child drop zone.
  const isConfirmationAction =
    action.title?.trim().toUpperCase() === "CONFIRMATION";

  if (isConfirmationAction) {
    return (action.confirmationOptions ?? []).map((option) => {
      const existingOption = existingPaths.find(
        (path) => path.nodeType === "confirmation" && path.optionId === option.id
      );
      const selected = Boolean(option.isSelected);

      return {
        id: existingOption?.id ?? crypto.randomUUID(),
        optionId: option.id,
        isSelected: selected,
        optionLabel: option.option,
        nodeType: "confirmation" as const,
        paths: selected
          ? existingOption?.paths?.length
            ? existingOption.paths
            : [{ id: crypto.randomUUID(), nodeType: "action" as const, paths: [] }]
          : [],
      };
    });
  }

  // Every non-CONFIRMATION action gets exactly one child drop zone.
  // Preserve the existing child branch when editing the action.
  const existingChild = existingPaths.find((path) => path.nodeType === "action");
  return [
    existingChild ?? {
      id: crypto.randomUUID(),
      nodeType: "action" as const,
      paths: [],
    },
  ];
};

export const updateNode = (
  nodes: FlowNode[],
  nodeId: string,
  updater: (node: FlowNode) => FlowNode
): FlowNode[] => {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return updater(node);
    }

    return {
      ...node,
      paths: updateNode(
        node.paths,
        nodeId,
        updater
      ),
    };
  });
};

// The empty slot at the end of the main chain: where a quick-added step goes.
export function findAppendSlot(list: FlowNode[]): FlowNode | null {
  for (const node of list) {
    if (isEmptySlot(node)) return node;

    // Follow the selected option of a confirmation, else the first branch.
    const next = isConfirmationAction(node)
      ? node.paths.find((path) => path.isSelected)?.paths ?? node.paths[0]?.paths ?? []
      : node.paths;

    const found = findAppendSlot(next);
    if (found) return found;
  }

  return null;
}

// Fills in a step's configuration from the action library when the saved node
// has none of its own (older flows).
export const syncActionDataInTree = (flowNodes: FlowNode[], actionList: TestActionDefinition[]): FlowNode[] =>
  flowNodes.map((node) => {
    // For a saved test, actionData from the flow is the test-specific
    // configuration and must NOT be replaced by the global action definition.
    if (node.actionData) {
      return {
        ...node,
        actionData: {
          ...node.actionData,
          confirmationOptions:
            node.actionData.confirmationOptions?.map((option) => ({
              ...option,
            })) ?? [],
        },
        paths: syncActionDataInTree(node.paths, actionList),
      };
    }

    // Only fall back to the global action definition when the flow node
    // doesn't already have actionData.
    const matchedAction = node.actionId
      ? actionList.find((action) => action.id === node.actionId)
      : undefined;

    return {
      ...node,
      actionData: matchedAction
        ? {
          ...matchedAction,
          confirmationOptions:
            matchedAction.confirmationOptions?.map((option) => ({
              ...option,
            })) ?? [],
        }
        : node.actionData,
      actionTitle:
        node.actionTitle ??
        matchedAction?.title ??
        undefined,
      paths: syncActionDataInTree(node.paths, actionList),
    };
  });
