"use client";

import "../app/TestFlowBuilder.css";
import React, { useEffect, useRef, useState } from "react";
import CreateTestButton from "@/app/testCases/page";
import { SavedTest } from "@/app/page";
import getActionsAction from "@/actions/get-actions";
import { getRunPayloadAction } from "@/actions/get-run-payload";
import { useRunReportSync } from "@/components/useRunReportSync";
import { createFullTestAction, updateFullTestAction } from "@/actions/create-full-test";
import { deleteTestActionDefinition } from "@/actions/delete-test-action";
import { TestAction } from "@/components/ActionDialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons/faUser";
import { faTimes, faStop, faCheck, faPaste, faPen, faEllipsisVertical } from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";
import { useTestFlowStore } from "@/store/testFlowStore";
import { BRIDGE, getRunBlockedReason, type TabletState } from "@/components/bridge";
export type TestActionDefinition = {
  id: string;
  title: string;
  hasConfirmation: boolean;
  confirmationTimeout: number | null;
  actionTimeout: number;
  pasteText?: string | null;
  icon?: string | null;
  clickOnText?: string | null;
  email?: string | null;
  password?: string | null;
  confirmationOptions: {
    id: string;
    option: string;
    isSelected:boolean |null;
  }[];
};
export type ActionDefinition=
{
  id?: string; 
  title: string; 
  icon?: string | null | undefined; 
  confirmationOptions?: { option: string; isSelected: boolean }[];
  hasConfirmation?: boolean; 
  actionTimeout?: number; 
  confirmationTimeout?: number | null;
}
export type FlowNode = {
  id: string;
  actionId?: string;
  actionTitle?: string;
  optionId?: string;
  isSelected?: boolean | null;
  optionLabel?: string;
  nodeType: "action" | "confirmation";
  paths: FlowNode[];
  actionData?: TestActionDefinition;
};

/*  CREATE NODE */

const createNode = (): FlowNode => ({
  id: crypto.randomUUID(),
  nodeType: "action",
  paths: [],
});

const hydrateFlow = (
  flowNodes: any[],
  actionList: TestActionDefinition[]
): FlowNode[] => {
  return flowNodes.map((savedNode) => {
    if (savedNode.nodeType === "confirmation" || savedNode.optionId) {
      return {
        id: savedNode.id ?? crypto.randomUUID(),
        nodeType: "confirmation" as const,
        optionId: savedNode.optionId,
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
          savedAction.confirmationOptions?.map((option: any) => ({
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

        paths: (savedNode.paths ?? []).map((path: any) => {
          const option = actionData?.confirmationOptions?.find(
            (opt) => opt.id === path.optionId
          );

          return {
            id: path.id ?? crypto.randomUUID(),
            nodeType: "confirmation" as const,
            optionId: path.optionId,
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
        ? savedNode.paths.map((path: any) => {
            if (path.nodeType === "confirmation" || path.optionId) {
              const option = actionData?.confirmationOptions?.find(
                (item) => item.id === path.optionId
              );
              return {
                id: path.id ?? crypto.randomUUID(),
                nodeType: "confirmation" as const,
                optionId: path.optionId,
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

const isEmptySlot = (node: FlowNode) =>
  node.nodeType === "action" && !node.actionId && node.paths.length === 0;

const isConfirmationAction = (node: FlowNode) =>
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
function removeFromTree(
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
function insertBeforeInTree(
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

const parentIdOf = (list: FlowNode[], nodeId: string, parent: string | null = null): string | null | undefined => {
  for (const node of list) {
    if (node.id === nodeId) return parent;
    const found = parentIdOf(node.paths, nodeId, node.id);
    if (found !== undefined) return found;
  }
  return undefined;
};

// Plain data for storage: the editor-only fields are dropped.
function extractFlowTree(flowNodes: FlowNode[]): FlowNode[] {
  return flowNodes.map(({ id, actionId, optionId, isSelected, paths, actionData }) => ({
    id,
    actionId: actionId ?? null,
    optionId: optionId ?? null,
    isSelected: isSelected ?? null,
    paths: extractFlowTree(paths),
    actionData: actionData ?? null,
  })) as unknown as FlowNode[];
}

export default function TestFlowBuilder({ editingTest: initialTest }: { editingTest?: SavedTest }) {
  const [nodes, setNodes] = useState<FlowNode[]>([createNode()]);
  const [draggedAction, setDraggedAction] = useState<TestActionDefinition | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<TestActionDefinition | null>(null);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [actions, setActions] = useState<TestActionDefinition[]>([]);
  const [testTitle, setTestTitle] = useState(initialTest?.title ?? "");
  const [testDescription, setTestDescription] = useState(initialTest?.description ?? "");
  const [saving, setSaving] = useState(false);
  // The row as last stored. Run always uses this, never the page's original prop.
  const [savedTest, setSavedTest] = useState<SavedTest | undefined>(initialTest);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [runMessage, setRunMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [bridgeState, setBridgeState] = useState<TabletState | null>(null);
  // Drag and drop: a node being moved, the gap an action will be inserted
  // into, and the element currently under the pointer.
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [pendingInsert, setPendingInsert] = useState<{ parentId: string | null; beforeId: string } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const router = useRouter();
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!initialTest || actions.length === 0 || hydratedRef.current) return;
    hydratedRef.current = true;

    const hydrated = initialTest.flow?.length
      ? hydrateFlow(initialTest.flow, actions)
      : [createNode()];

    setTestTitle(initialTest.title ?? "");
    setTestDescription(initialTest.description ?? "");
    setNodes(hydrated);
    setSavedSnapshot(
      JSON.stringify([
        (initialTest.title ?? "").trim(),
        (initialTest.description ?? "").trim(),
        extractFlowTree(hydrated),
      ])
    );
  }, [initialTest, actions]);

  // Poll the bridge so Run can say why it is unavailable and report the result.
  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const response = await fetch(BRIDGE + "/state", { cache: "no-store" });
        if (!response.ok) throw new Error();
        const next = (await response.json()) as TabletState;
        if (stopped) return;
        setBridgeState(next);
        setBridgeOnline(true);
      } catch {
        if (!stopped) setBridgeOnline(false);
      }
    };

    poll();
    const timer = window.setInterval(poll, 1500);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  const handleDragStart = (
    event: React.DragEvent<HTMLDivElement>,
    action: TestActionDefinition
  ) => {
    setDraggedAction(action);
    document.body.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("application/action-id", action.id);
  };

  const handleDragEnd = () => {
    setDraggedAction(null);
    setDraggedNodeId(null);
    setDragOverKey(null);
    document.body.classList.remove("is-dragging");
  };

  const handleNodeDragStart = (event: React.DragEvent<HTMLDivElement>, nodeId: string) => {
    setDraggedNodeId(nodeId);
    document.body.classList.add("is-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/node-id", nodeId);
  };

  const handleGapDragOver = (event: React.DragEvent<HTMLDivElement>, key: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = draggedNodeId ? "move" : "copy";
    if (dragOverKey !== key) setDragOverKey(key);
  };

  // Drop on the gap above `beforeId`: a sidebar action opens its dialog and is
  // inserted on save; an existing node is moved there straight away.
  const handleGapDrop = (
    event: React.DragEvent<HTMLDivElement>,
    parentId: string | null,
    beforeId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const movedNodeId = event.dataTransfer.getData("application/node-id");
    const actionId = event.dataTransfer.getData("application/action-id");

    if (movedNodeId) {
      moveNode(movedNodeId, parentId, beforeId);
      handleDragEnd();
      return;
    }

    const action = actions.find((item) => item.id === actionId);
    if (!action) {
      handleDragEnd();
      return;
    }

    setPendingNodeId(null);
    setPendingInsert({ parentId, beforeId });
    setEditingAction(prepareActionForEditor(action));
    handleDragEnd();
  };

  const moveNode = (nodeId: string, parentId: string | null, beforeId: string) => {
    setNodes((current) => {
      const { tree, removed } = removeFromTree(current, nodeId);
      if (!removed) return current;

      const definition = removed.actionData;
      const fresh: FlowNode = {
        ...removed,
        paths: definition ? buildChildrenForAction(definition, []) : [createNode()],
      };

      return insertBeforeInTree(tree, parentId, beforeId, fresh);
    });
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();

    event.dataTransfer.dropEffect = "copy";
  };
  const prepareActionForEditor = (
  action: TestActionDefinition,
  flowTitle?: string
): TestActionDefinition => {
  const title = flowTitle?.trim() || action.title;
  const options = action.confirmationOptions ?? [];

  return {
    ...action,
    title,
    clickOnText: action.clickOnText ?? "",
    pasteText: action.pasteText ?? "",
    hasConfirmation:
      action.hasConfirmation ??
      title.trim().toUpperCase() === "CONFIRMATION",
    actionTimeout: action.actionTimeout ?? 5000,
    confirmationTimeout: action.confirmationTimeout ?? 5000,
    confirmationOptions: options.map((option) => ({
      ...option,
      isSelected: Boolean(option.isSelected),
    })),
  };
};

  const buildChildrenForAction = (
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
  // const handleDragEnd = () => {
  //   setDraggedAction(null);
  // };

  const updateNode = (
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

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>,
    nodeId: string
  ) => {
    event.preventDefault();

    const actionId = event.dataTransfer.getData("application/action-id");

    if (!actionId) {
      setDraggedAction(null);
      return;
    }

    const action = actions.find((item) => item.id === actionId);

    if (!action) {
      setDraggedAction(null);
      return;
    }

    // IMPORTANT: never give the editor the action object from `actions`
    const actionCopy = prepareActionForEditor(action);

    setPendingNodeId(nodeId);
    setEditingAction(actionCopy);
    setDraggedAction(null);
  };

  const addPath = (nodeId: string) => {
    setNodes((current) =>
      updateNode(current, nodeId, (node) => ({
        ...node,
        paths: [
          ...node.paths,
          {
            id: crypto.randomUUID(),
            nodeType: "action",
            paths: [],
          },
        ],
      }))
    );
    setOpenMenu(null);
  };

  const removeNode = (nodeId: string) => {
    setNodes((current) => removeFromTree(current, nodeId).tree);
    setOpenMenu(null);
  };

  const handleEditAction = (action: TestActionDefinition) => {
    const testAction = {
      id: action.id,
      title: action.title,
      icon: action.icon,
      type: 'isEditingAction'
    };

    // When editing an action from sidebar, no pending node ID
    setPendingNodeId(null);
    setEditingAction(testAction as any);
  };

  const openActionEditor = (
  action: TestActionDefinition,
  nodeId?: string,
  flowTitle?: string
) => {
  const actionCopy = prepareActionForEditor(action, flowTitle);

  setPendingNodeId(nodeId ?? null);
  setEditingAction(actionCopy);

  // Also update the Zustand store if the popup reads from it.
  useTestFlowStore.getState().setEditingAction(actionCopy);
};

  const handleActionSavedToFlow = (configuredAction: TestAction) => {
    if (!pendingNodeId && !pendingInsert) return;

    const actionDef: TestActionDefinition = {
      id: configuredAction.id || crypto.randomUUID(),
      title: configuredAction.title,
      hasConfirmation: configuredAction.hasConfirmation,
      confirmationTimeout: configuredAction.confirmationTimeout || null,
      confirmationOptions: (configuredAction.confirmationOptions || []).map(
        (opt) => ({
          id: opt.id || crypto.randomUUID(),
          option: opt.option,
          isSelected: Boolean(opt.isSelected),
        })
      ),
      actionTimeout: configuredAction.actionTimeout,
      pasteText: (configuredAction as any).pasteText ?? (configuredAction as any).pasteText ?? null,
      clickOnText: (configuredAction as any).clickOnText ?? (configuredAction as any).clickOnText ?? null,
      email: (configuredAction as any).email ?? null,
      password: (configuredAction as any).password ?? null,
      icon: (configuredAction as any).icon ?? null,
    };

    if (pendingInsert) {
      const inserted: TestActionDefinition = {
        ...actionDef,
        confirmationOptions: (actionDef.confirmationOptions ?? []).map((option) => ({
          ...option,
          isSelected: Boolean(option.isSelected),
        })),
      };
      const newNode: FlowNode = {
        id: crypto.randomUUID(),
        nodeType: "action",
        actionId: inserted.id,
        actionTitle: inserted.title,
        actionData: inserted,
        paths: buildChildrenForAction(inserted, []),
      };

      setNodes((currentNodes) =>
        insertBeforeInTree(currentNodes, pendingInsert.parentId, pendingInsert.beforeId, newNode)
      );
      setPendingInsert(null);
      setEditingAction(null);
      return;
    }

    setNodes((currentNodes) =>
      updateNode(currentNodes, pendingNodeId as string, (node) => {
        const configuredData: TestActionDefinition = {
          ...actionDef,
          confirmationOptions: (actionDef.confirmationOptions ?? []).map((option) => ({
            ...option,
            isSelected: Boolean(option.isSelected),
          })),
        };
        const children = buildChildrenForAction(configuredData, node.paths);

        return {
          ...node,
          actionId: configuredData.id,
          actionTitle: configuredData.title,
          nodeType: "action" as const,
          actionData: configuredData,
          paths: children,
        };
      })
    );

    setPendingNodeId(null);
    setEditingAction(null);
  };

  const getDelayLabel = (action: TestActionDefinition | undefined) => {
    if (!action) return "0s";
    const seconds = Number(action.actionTimeout ?? 0);
    return `${seconds}s`;
  };

  const syncActionDataInTree = (flowNodes: FlowNode[], actionList: TestActionDefinition[]): FlowNode[] =>
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

  const loadActions = async () => {
    try {
      const result = await getActionsAction();

      if (!result.success) {
        throw new Error(
          result.message ?? "Failed to fetch test classes"
        );
      }

      setActions(result.data);
      setNodes((currentNodes) => syncActionDataInTree(currentNodes, result.data));
    } catch (error) {
      console.error("Failed to load actions:", error);
    }
  };

  const refreshActions = async () => {
    await loadActions();
  };

  const handleDeleteAction = async (actionId: string) => {
    if (!actionId) return;

    const confirmed = window.confirm("Delete this saved action?");
    if (!confirmed) return;

    const result = await deleteTestActionDefinition({ id: actionId });

    if (!result.success) {
      alert(result.message ?? "Could not delete action");
      return;
    }

    await refreshActions();
  };

  useEffect(() => {
    loadActions();
  }, []);

  const currentSnapshot = JSON.stringify([
    testTitle.trim(),
    testDescription.trim(),
    extractFlowTree(nodes),
  ]);
  const dirty = currentSnapshot !== savedSnapshot;

  // Saves the open test and returns the stored row, or null when it failed.
  const saveTest = async (): Promise<SavedTest | null> => {
    if (!testTitle.trim()) {
      setSaveMessage({ kind: "error", text: "Enter a test title before saving." });
      return null;
    }

    setSaving(true);
    setSaveMessage(null);
    setRunMessage(null);

    try {
      const payload = {
        title: testTitle.trim(),
        description: testDescription.trim(),
        flow: extractFlowTree(nodes),
      };

      const result = savedTest
        ? await updateFullTestAction({ id: savedTest.id, ...payload })
        : await createFullTestAction(payload);

      if (!result.success || !("data" in result) || !result.data) {
        setSaveMessage({
          kind: "error",
          text: result.message || "Could not save the test.",
        });
        return null;
      }

      const stored = result.data as unknown as SavedTest;
      setSavedTest(stored);
      setSavedSnapshot(currentSnapshot);
      setSaveMessage({ kind: "success", text: "Saved." });
      return stored;
    } catch (error) {
      console.error("Failed to save test:", error);
      setSaveMessage({ kind: "error", text: "Could not save: the server could not be reached." });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTest = async () => {
    await saveTest();
  };

  const STEM_H = 24;       // vertical drop before branching
  const CURVE_H = 28;      // height of the bezier curve section
  const STUB_H = 20;       // vertical stub into each child
  const CHILD_W = 240;     // width of each child column (must match CSS)
  const CHILD_GAP = 48;    // gap between child columns (must match CSS)
  const DOT_R = 5;

  const renderConnector = (children: FlowNode[]) => {
    const N = children.length;

    if (N === 0) return null;

    // Single child — just a straight line, no branching
    if (N === 1) {
      return (
        <svg
          className="connector-svg"
          width={4}
          height={STEM_H + CURVE_H + STUB_H}
          viewBox={`0 0 4 ${STEM_H + CURVE_H + STUB_H}`}
        >
          <line
            x1={2}
            y1={0}
            x2={2}
            y2={STEM_H + CURVE_H + STUB_H}
            stroke="#d0d5dd"
            strokeWidth={2}
          />
        </svg>
      );
    }

    // Multi-child — trunk + bezier branches
    const totalW = N * CHILD_W + (N - 1) * CHILD_GAP;
    const totalH = STEM_H + CURVE_H + STUB_H;
    const cx = totalW / 2;

    const childCx = (i: number) =>
      CHILD_W / 2 + i * (CHILD_W + CHILD_GAP);

    return (
      <svg
        className="connector-svg"
        width={totalW}
        height={totalH}
        viewBox={`0 0 ${totalW} ${totalH}`}
        style={{ overflow: "visible" }}
      >
        {/* Trunk: from parent bottom down to branch point */}
        <line
          x1={cx}
          y1={0}
          x2={cx}
          y2={STEM_H}
          stroke="#d0d5dd"
          strokeWidth={2}
        />

        {/* Junction dot at branch point */}
        <circle cx={cx} cy={STEM_H} r={DOT_R} fill="#14b8a6" />

        {children.map((child, i) => {
          const x = childCx(i);
          const y0 = STEM_H;
          const y1 = STEM_H + CURVE_H;

          // Cubic bezier: leave parent vertically, arrive at child vertically.
          // Control points sit at (cx, y0 + k) and (x, y1 - k) so both ends
          // are tangent to vertical, producing the Mailchimp "S" shape.
          const k = CURVE_H * 0.6;
          const d = `M ${cx} ${y0}
                   C ${cx} ${y0 + k},
                     ${x}  ${y1 - k},
                     ${x}  ${y1}`;

          return (
            <g key={child.id}>
              <path
                d={d}
                fill="none"
                stroke="#d0d5dd"
                strokeWidth={2}
              />

              {/* Stub from curve end into child card */}
              <line
                x1={x}
                y1={y1}
                x2={x}
                y2={y1 + STUB_H}
                stroke="#d0d5dd"
                strokeWidth={2}
              />

              {/* Entry dot above each child */}
              <circle cx={x} cy={y1} r={DOT_R - 1} fill="#14b8a6" />
            </g>
          );
        })}
      </svg>
    );
  };

  const nodeSubtitle = (node: FlowNode): string | null => {
    const title = node.actionTitle?.trim().toUpperCase();
    const data = node.actionData;

    if (title === "DELAY") return `Wait ${getDelayLabel(data)}`;
    if (title === "PASTE") return data?.pasteText ? `Paste "${data.pasteText}"` : "No text set";
    if (title === "CLICK") return data?.clickOnText ? `Tap "${data.clickOnText}"` : "No text set";
    if (title === "AUTHENTICATION") return data?.email ? `Sign in as ${data.email}` : "No email set";
    if (title === "CONFIRMATION") {
      const count = data?.confirmationOptions?.length ?? 0;
      return `${count} ${count === 1 ? "option" : "options"}`;
    }
    return null;
  };

  const renderNode = (
    node: FlowNode,
    level: number = 0,
    parentId: string | null = null
  ): React.ReactNode => {
    const isConfirmation = node.nodeType === "confirmation";
    const isDropZone = node.nodeType === "action" && !node.actionId;
    const isDelayAction = node.actionTitle?.trim().toUpperCase() === "DELAY";
    const hasconfirmationChildren = isConfirmationAction(node);
    const canAddPath = !isConfirmation && !hasconfirmationChildren && !isDropZone && !isDelayAction;
    const canAcceptDrop = node.nodeType === "action" && !draggedNodeId;
    const canDragNode = !isConfirmation && !isDropZone && !hasconfirmationChildren;
    const isDragging = Boolean(draggedAction || draggedNodeId);
    const dragIsNearby =
      draggedNodeId !== null && (node.id === draggedNodeId || parentId === draggedNodeId);
    const showInsertGap = isDragging && !isConfirmation && !isDropZone && !dragIsNearby;
    const gapKey = `gap:${node.id}`;
    const subtitle = isConfirmation ? null : nodeSubtitle(node);
    const replaceTarget = dragOverKey === `node:${node.id}` && !isDropZone && Boolean(draggedAction);

    return (
      <div className="tree-node" key={node.id}>
        {showInsertGap && (
          <div
            className={`insert-gap ${dragOverKey === gapKey ? "over" : ""}`}
            onDragOver={(event) => handleGapDragOver(event, gapKey)}
            onDragLeave={() => setDragOverKey((key) => (key === gapKey ? null : key))}
            onDrop={(event) => handleGapDrop(event, parentId, node.id)}
          >
            <span>{draggedNodeId ? "Move here" : "Insert here"}</span>
          </div>
        )}

        <div
          className={[
            "node-card",
            isConfirmation ? "confirmation" : "action",
            isDropZone ? "empty" : "",
            draggedNodeId === node.id ? "being-moved" : "",
            replaceTarget ? "replace-target" : "",
          ].join(" ")}
          draggable={canDragNode}
          onDragStart={canDragNode ? (event) => handleNodeDragStart(event, node.id) : undefined}
          onDragEnd={canDragNode ? handleDragEnd : undefined}
          onDragOver={
            canAcceptDrop
              ? (event) => {
                  handleDragOver(event);
                  setDragOverKey(`node:${node.id}`);
                }
              : undefined
          }
          onDragLeave={() => setDragOverKey((key) => (key === `node:${node.id}` ? null : key))}
          onDrop={canAcceptDrop ? (event) => handleDrop(event, node.id) : undefined}
        >
          {isDropZone ? (
            <span className="node-card-title">Drop action here</span>
          ) : isConfirmation ? (
            <div className="node-card-header">
              <span className="node-card-title">
                {node.optionLabel ?? "Option"}
                {node.isSelected ? <span className="option-badge">Selected</span> : null}
              </span>
            </div>
          ) : (
            <div className="node-card-header">
              <span className="node-icon" aria-hidden="true">
                <FontAwesomeIcon icon={getFaIcon(node.actionData?.icon)} />
              </span>
              <div className="node-text">
                <span className="node-card-title">{node.actionTitle ?? "Unassigned"}</span>
                {subtitle && <span className="node-subtitle" title={subtitle}>{subtitle}</span>}
                {node.actionTitle?.trim().toUpperCase() === "AUTHENTICATION" && (
                  <span className="node-subtitle">Password: {node.actionData?.password ? "••••••••" : "not set"}</span>
                )}
              </div>
              <button
                className="node-action-button"
                onClick={() => {
                  const actionToEdit =
                    node.actionData ??
                    actions.find((action) => action.id === node.actionId);

                  if (actionToEdit) {
                    openActionEditor(actionToEdit, node.id, node.actionTitle);
                  }
                }}
                type="button"
                title={`Edit ${node.actionTitle ?? "action"}`}
                aria-label={`Edit ${node.actionTitle ?? "action"}`}
              >
                <FontAwesomeIcon icon={faPen} />
              </button>
              <div className="node-card-menu">
                <button
                  className="node-action-button"
                  onClick={() => setOpenMenu(openMenu === node.id ? null : node.id)}
                  type="button"
                  aria-label={`More options for ${node.actionTitle ?? "action"}`}
                  aria-expanded={openMenu === node.id}
                >
                  <FontAwesomeIcon icon={faEllipsisVertical} />
                </button>

                {openMenu === node.id && (
                  <div className="menu-dropdown">
                    {canAddPath && (
                      <button onClick={() => addPath(node.id)} type="button">Add path</button>
                    )}
                    <button onClick={() => removeNode(node.id)} type="button">Delete step</button>
                  </div>
                )}
              </div>
            </div>
          )}
          {replaceTarget && <span className="replace-badge">Replace this step</span>}
        </div>

        {node.paths.length > 0 && (
          <>
            {renderConnector(node.paths)}
            <div
              className="children-row"
              style={{ gap: `${CHILD_GAP}px` }}
            >
              {node.paths.map((child) => (
                <div
                  className="child-column"
                  key={child.id}
                  style={{ width: `${CHILD_W}px` }}
                >
                  {renderNode(child, level + 1, node.id)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };
  const ACTION_ICONS = {
    faUser,
    faTimes,
    faStop,
    faCheck,
    faPaste,
  } as const;

  const getFaIcon = (name?: string | null) =>
    name && name in ACTION_ICONS
      ? ACTION_ICONS[name as keyof typeof ACTION_ICONS]
      : faUser;
  const runBlockedReason = getRunBlockedReason(bridgeOnline, bridgeState);

  const startRun = async (test: SavedTest) => {
    setRunMessage({ kind: "info", text: `Starting ${test.title}…` });

    try {
      // Stored passwords are encrypted; the server decrypts them for this run only.
      const payload = await getRunPayloadAction({ id: test.id });

      if (!payload.success) {
        setRunMessage({ kind: "error", text: payload.message });
        return;
      }

      const response = await fetch(BRIDGE + "/run-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload.data),
      });

      if (!response.ok) {
        throw new Error(`The bridge answered ${response.status}.`);
      }

      setRunMessage({ kind: "info", text: "Test sent to the tablet." });
    } catch (error) {
      console.error("startRun error:", error);
      setRunMessage({
        kind: "error",
        text: bridgeOnline
          ? "The bridge did not accept the test."
          : "Could not reach the bridge. Start it with npm run bridge.",
      });
    }
  };

  // Run what is on screen: save first when it changed, then run the stored row.
  const handleSaveAndRun = async () => {
    const stored = dirty || !savedTest ? await saveTest() : savedTest;
    if (stored) await startRun(stored);
  };

  // Keep the run history up to date from whichever page is open.
  useRunReportSync(bridgeState);

  const latestRunId = bridgeState?.runIds?.[bridgeState.runIds.length - 1];

  const runResult = (() => {
    if (!runMessage) return null;
    if (runMessage.kind === "error") return runMessage;

    const test = bridgeState?.test;
    if (test?.status === "running") {
      return { kind: "info" as const, text: `Running: ${test.step ?? test.name ?? "test"}` };
    }
    if (test?.status === "passed") {
      return { kind: "success" as const, text: `${test.name ?? "Test"} passed.`, reportId: latestRunId };
    }
    if (test?.status === "failed") {
      return {
        kind: "error" as const,
        text: `${test.name ?? "Test"} failed. ${test.error ?? ""}`.trim(),
        reportId: latestRunId,
      };
    }
    return runMessage;
  })();

  const runDisabled = saving || !testTitle.trim() || Boolean(runBlockedReason);
  const runLabel = saving ? "Saving…" : dirty || !savedTest ? "Save and run" : "Run test";
  const statusLine: { kind: "info" | "success" | "error"; text: string; reportId?: string } | null =
    runResult ?? saveMessage;

  return (
    <div className="flow-builder">

      <aside className="flow-sidebar">
        <div className="test-configuration" id="test-config-zone">
          <div className="mb-8">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Test Configuration
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Name your test and manage the actions you can add to its flow.
            </p>

            <div className="mt-6 space-y-5">
              {/* Test Title */}
              <div>
                <label
                  htmlFor="test-title"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Test Title
                </label>

                <input
                  id="test-title"
                  type="text"
                  value={testTitle}
                  onChange={(event) => setTestTitle(event.target.value)}
                  placeholder="Enter test title"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="test-description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Description
                </label>

                <textarea
                  id="test-description"
                  value={testDescription}
                  onChange={(event) =>
                    setTestDescription(event.target.value)
                  }
                  placeholder="Describe what this test validates..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-6 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="actions-section">
          <div className="sidebar-header">
            <div>
              <h2>Actions</h2>
              <p>Drag an action into the flow</p>
            </div>
            <CreateTestButton
              editingAction={editingAction}
              isFlowPlacement={pendingNodeId !== null || pendingInsert !== null}
              onEditClose={() => {
                setEditingAction(null);
                setPendingNodeId(null);
                setPendingInsert(null);
              }}
              onFlowActionSave={handleActionSavedToFlow}
              onActionSaved={refreshActions}
            />
          </div>

          {/* ONLY ACTIONS SCROLL */}
          <div className="action-list">
            {actions.map((action) => (
              <div
                key={action.id}
                draggable data-id={action.id}
                className={`action-item ${draggedAction?.id === action.id
                  ? "dragging"
                  : ""
                  }`}
                onDragStart={(event) =>
                  handleDragStart(event, action)
                }
                onDragEnd={handleDragEnd}
              >
                <button
                  className="edit-button"
                  onClick={() => handleEditAction(action)}
                  type="button"
                  title="Edit action"
                >
                  ✏️
                </button>
                <span className="drag-icon">⋮⋮</span>
                <span className="action-title"> {action.title}</span>

                <button
                  className="edit-button"
                  onClick={() => handleDeleteAction(action.id)}
                  type="button"
                  title="Delete action"
                  aria-label={`Delete ${action.title}`}
                  style={{ marginLeft: "auto" }}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="flow-canvas">
        <div className="canvas-header">
          <div className="test-details">
            <div className="test-details-heading">
              <div>
                <span className="eyebrow"> TEST DESIGN</span>
                <h1>Test Flow</h1>
                <p>
                  Define your test and build the sequence of
                  actions that should run on the tablet.
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Each step waits {bridgeState?.stepDelaySeconds ?? 5} seconds
                  before it runs. Add a DELAY step to wait longer, for example
                  after a screen or a dialog that opens slowly.
                </p>
              </div>
            </div>


          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex space-between gap-5">
              <button
                onClick={handleSaveTest}
                disabled={saving || !testTitle.trim() || !dirty}
                type="button"
                className="save-test-button"
                title={!testTitle.trim() ? "Enter a test title" : ""}
              >
                {saving ? "Saving..." : "Save Test"}
              </button>
              <button
                className="save-test-button"
                disabled={runDisabled}
                onClick={handleSaveAndRun}
                type="button"
              >
                {runLabel}
              </button>
            </div>
            {runBlockedReason && (
              <p className="text-sm text-slate-600">{runBlockedReason}</p>
            )}
            {dirty && !saving && (
              <p className="text-sm font-medium text-amber-800">Unsaved changes</p>
            )}
          </div>
        </div>

        {statusLine && (
          <p
            role={statusLine.kind === "error" ? "alert" : "status"}
            className={[
              "border-b px-6 py-3 text-sm",
              statusLine.kind === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : statusLine.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-800",
            ].join(" ")}
          >
            {statusLine.text}
            {statusLine.reportId && (
              <>
                {" "}
                <a href={`/runs/${statusLine.reportId}`} className="font-semibold underline">
                  View report
                </a>
              </>
            )}
          </p>
        )}

        <div className="flow-area">
          <div className="flow-root">
            {nodes.map((node, index) =>
              renderNode(node, index, null)
            )}
          </div>
        </div>

      </main>
    </div>
  );
}



