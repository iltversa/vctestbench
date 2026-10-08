"use client";

import "../app/TestFlowBuilder.css";
import React, { useEffect, useRef, useState } from "react";
import CreateTestButton from "@/app/testCases/page";
import { SavedTest } from "@/app/page";
import getActionsAction from "@/actions/get-actions";
import { TestActionDefinition } from "@/services/get-test-actions";
import { createFullTestAction, updateFullTestAction } from "@/actions/create-full-test";
import { deleteTestActionDefinition } from "@/actions/delete-test-action";
import { TestAction } from "@/components/ActionDialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons/faUser";
import { faTimes, faStop, faCheck, faPaste } from "@fortawesome/free-solid-svg-icons";
import { useRouter } from "next/navigation";


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
        ? hydrateFlow(savedNode.paths, actionList)
        : [],
    };
  });
};





export default function TestFlowBuilder({ editingTest: initialTest }: { editingTest?: SavedTest }) {
  const [nodes, setNodes] = useState<FlowNode[]>([createNode()]);
  const [draggedAction, setDraggedAction] = useState<TestActionDefinition | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<TestActionDefinition | null>(null);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [actions, setActions] = useState<TestActionDefinition[]>([]);
  const [testTitle, setTestTitle] = useState(initialTest?.title ?? "");
  const [testDescription, setTestDescription] = useState(initialTest ? "" : "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!initialTest || actions.length === 0 || hydratedRef.current) return;
    hydratedRef.current = true;

    setTestTitle(initialTest.title ?? "");
    setNodes(
      initialTest.flow?.length
        ? hydrateFlow(initialTest.flow, actions)
        : [createNode()]
    );
  }, [initialTest, actions]);

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
    document.body.classList.remove("is-dragging");
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();

    event.dataTransfer.dropEffect = "copy";
  };
  const buildChildrenForAction = (
    action: TestActionDefinition
  ): FlowNode[] => {
    // If the action has confirmation options, those become children and each
    // confirmation value gets its own empty action drop zone beneath it.
    if (action.hasConfirmation && action.confirmationOptions.length > 0) {
      return action.confirmationOptions.map((option) => ({
        id: crypto.randomUUID(),
        optionId: option.id,
        isSelected: option.isSelected,
        optionLabel: option.option,
        nodeType: "confirmation" as const,
        paths: [
          {
            id: crypto.randomUUID(),
            nodeType: "action" as const,
            paths: [],
          },
        ],
      }));
    }

    // Otherwise, seed with one empty slot so the user can chain immediately.
    return [
      {
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
    const actionCopy: TestActionDefinition = {
      ...action,
      confirmationOptions:
        action.confirmationOptions?.map((option) => ({
          ...option,
          isSelected: Boolean(option.isSelected),
        })) ?? [],
    };

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
    const removeNodeRecursive = (
      nodes: FlowNode[]
    ): FlowNode[] => {
      return nodes
        .filter(
          (node) => node.id !== nodeId
        )
        .map((node) => ({
          ...node,

          paths: removeNodeRecursive(
            node.paths
          ),
        }));
    };

    setNodes((currentNodes) => {
      const updated =
        removeNodeRecursive(currentNodes);

      if (updated.length === 0) {
        return [createNode()];
      }

      return updated;
    });

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
    nodeId?: string
  ) => {
    const actionCopy: TestActionDefinition = {
      ...action,
      confirmationOptions:
        action.confirmationOptions?.map((option) => ({
          ...option,
          isSelected: Boolean(option.isSelected),
        })) ?? [],
    };

    setPendingNodeId(nodeId ?? null);
    setEditingAction(actionCopy);
  };

  const handleActionSavedToFlow = (configuredAction: TestAction) => {
    if (!pendingNodeId) return;

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
      pasteText: (configuredAction as any).pasteText ?? (configuredAction as any).paste_text ?? null,
      email: (configuredAction as any).email ?? null,
      password: (configuredAction as any).password ?? null,
      icon: (configuredAction as any).icon ?? null,
    };

    setNodes((currentNodes) =>
      updateNode(currentNodes, pendingNodeId, (node) => {
        if (node.actionId) {
          return {
            ...node,
            actionId: actionDef.id,
            actionTitle: actionDef.title,
            actionData: {
              ...actionDef,
              confirmationOptions: actionDef.confirmationOptions.map((option) => ({
                ...option,
              })),
            },
          };
        }

        // ADDING an action to an empty drop-zone:
        // create its initial children.
        const children = buildChildrenForAction(actionDef);

        return {
          ...node,
          actionId: actionDef.id,
          actionTitle: actionDef.title,
          nodeType: "action" as const,
          actionData: {
            ...actionDef,
            confirmationOptions: actionDef.confirmationOptions.map((option) => ({
              ...option,
            })),
          },
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

  const extractFlowTree = (flowNodes: FlowNode[]): any[] => {
    return flowNodes.map(({ id, actionId, optionId, isSelected, paths, actionData }) => ({
      id,
      actionId: actionId ?? null,
      optionId: optionId ?? null,
      isSelected: isSelected ?? null,
      paths: extractFlowTree(paths),
      actionData: actionData ?? null,
    }));
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

  const handleSaveTest = async () => {
    if (!testTitle.trim()) {
      alert("Please enter a test title");
      return;
    }

    const flowTree = extractFlowTree(nodes);

    setSaving(true);
    try {
      const payload = {
        title: testTitle.trim(),
        description: testDescription.trim(),
        flow: flowTree,
      };

      const result = initialTest
        ? await updateFullTestAction({ id: initialTest.id, ...payload })
        : await createFullTestAction(payload);

      if (result.success) {
        alert("Test saved successfully!");
        if (!initialTest) {
          setTestTitle("");
          setTestDescription("");
          setNodes([createNode()]);
        }
      }
    } catch (error) {
      console.error("Failed to save test:", error);
      alert("Failed to save test");
    } finally {
      setSaving(false);
    }
  };

  const STEM_H = 24;       // vertical drop before branching
  const CURVE_H = 28;      // height of the bezier curve section
  const STUB_H = 20;       // vertical stub into each child
  const CHILD_W = 200;     // width of each child column (must match CSS)
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

  const renderNode = (node: FlowNode, level: number = 0): React.ReactNode => {
    console.log(node.actionData, "node.actionData");
    const isConfirmation = node.nodeType === "confirmation";
    const isDropZone = node.nodeType === "action" && !node.actionId;
    const isDelayAction = node.actionTitle === "DELAY";
    const hasconfirmationChildren = node.nodeType === "action" && node.paths.length > 0 && node.paths.every((p) => p.nodeType === "confirmation");
    const canAddPath = isConfirmation || (!hasconfirmationChildren && !isDropZone);
    const canAcceptDrop = node.nodeType === "action";
    const isPasteAction = node.nodeType === "action" && node.actionTitle?.trim().toUpperCase() === "PASTE";
    const isAuthenticationAction = node.nodeType === "action" && node.actionTitle?.trim().toUpperCase() === "AUTHENTICATION";

    return (
      <div className="tree-node" key={node.id}>
        <div
          className={`node-card ${isConfirmation ? "confirmation" : "action"} ${isDropZone ? "empty" : ""}`}
          onDragOver={canAcceptDrop ? handleDragOver : undefined}
          onDrop={canAcceptDrop ? (e) => handleDrop(e, node.id) : undefined}
        >
          <div className="node-card-header">
            {isDropZone ? (
              <span className="node-card-title">Drop action here</span>
            ) : isConfirmation ? (
              <span className="node-card-title">
                {node.optionLabel ?? "Option"} <FontAwesomeIcon icon={getFaIcon(node.actionData?.icon)} />
              </span>
            ) : isDelayAction ? (
              <span className="node-card-title">
                {getDelayLabel(node.actionData)} <FontAwesomeIcon icon={getFaIcon(node.actionData?.icon)} />
              </span>
            ) : isPasteAction ? (
              <span className="node-card-title">
                {node.actionData?.pasteText || "PASTE"} <FontAwesomeIcon icon={getFaIcon(node.actionData?.icon)} />
              </span>
            ) : isAuthenticationAction ? (
              <div className="w-full space-y-2">
                <div className="font-semibold text-sm">
                  AUTHENTICATION  <FontAwesomeIcon icon={getFaIcon(node.actionData?.icon)} />

                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">Email:</span>{" "}
                  <span className="font-medium">
                    {node.actionData?.email || "—"}
                  </span>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-slate-500">Password:</span>{" "}
                  <span className="font-medium">
                    {node.actionData?.password || "—"}
                  </span>
                </div>
              </div>
            ) : (
              <span className="node-card-title">
                {node.actionTitle ?? "Unassigned"} <FontAwesomeIcon icon={getFaIcon(node.actionData?.icon)} />
              </span>
            )}
            {!isConfirmation && !isDropZone && isDelayAction && (
              <button
                className="edit-button"
                onClick={() => {
                  if (node.actionData) {
                    openActionEditor(node.actionData, node.id);
                  }
                }}
                type="button"
                title="Edit delay action"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontSize: "16px",
                }}
              >
                ✏️
              </button>
            )}

            {(canAddPath || !isConfirmation) && !isDelayAction && (
              <div className="node-card-menu">
                <button
                  className="menu-trigger"
                  onClick={() =>
                    setOpenMenu(openMenu === node.id ? null : node.id)
                  }
                >
                  ⋮
                </button>

                {openMenu === node.id && (
                  <div className="menu-dropdown">
                    {canAddPath && (
                      <button onClick={() => addPath(node.id)}>
                        Add path
                      </button>
                    )}
                    <button onClick={() => removeNode(node.id)}>Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
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
                  {renderNode(child, level + 1)}
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
  const BRIDGE = "http://localhost:3131";

  const handleRunTest = async (test: SavedTest) => {

    console.log(test);
    try {
      const response = await fetch(BRIDGE + "/run-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: test.title,
          actions: test.actions ?? [],
          flow: test.flow ?? []
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start test");
      }else router.push("/")

    } catch (error) {
      console.error("handleRunTest error:", error);
    } finally {
      console.log("happen");

    }
  };
  return (
    <div className="flow-builder">

      <aside className="flow-sidebar">
        <div className="test-configuration" id="test-config-zone">
          <div className="mb-8">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Test Configuration
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Select a test class and manage the actions available for your flow.
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
              isFlowPlacement={pendingNodeId !== null}
              onEditClose={() => {
                setEditingAction(null);
                setPendingNodeId(null);
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
              </div>
            </div>


          </div>
          <div className="flex space-between gap-5">
          <button
            className="save-test-button"
            // disabled={!canRun || starting}
            onClick={() => handleRunTest(initialTest)}
            type="button"
          >
            Run test
          </button>
          {/* SAVE TEST */}
          <button
            onClick={handleSaveTest}
            disabled={
              saving ||
              !testTitle.trim()
            }
            type="button"
            className="save-test-button"
            title={
              !testTitle.trim()
                ? "Enter a test title"
                : ""
            }
          >
            {saving ? "Saving..." : "Save Test"}
          </button>
          </div>
        </div>

        <div className="flow-area">
          <div className="flow-root">
            {nodes.map((node, index) =>
              renderNode(node, index)
            )}
          </div>
        </div>

      </main>
    </div>
  );
}



