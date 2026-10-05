"use client";

import "../app/TestFlowBuilder.css";
import React, { useEffect, useRef, useState } from "react";
import CreateTestButton from "@/app/testCases/page";
import { SavedTest } from "@/app/page";
import getActionsAction from "@/actions/get-actions";
import { TestActionDefinition } from "@/services/get-test-actions";
import { getTestClassesAction } from "@/actions/get-classes";
import { createFullTestAction, updateFullTestAction } from "@/actions/create-full-test";
import { deleteTestActionDefinition } from "@/actions/delete-test-action";
import { TestAction } from "@/components/ActionDialog";


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
  flow: any[],
  actionList: TestActionDefinition[],
  parentAction?: TestActionDefinition
): FlowNode[] =>
  (flow ?? []).map((n) => {
    const action = n.actionId
      ? actionList.find((a) => a.id === n.actionId)
      : undefined;
    const isConfirmation = !!n.optionId;
    const option = isConfirmation
      ? parentAction?.confirmationOptions.find((o) => o.id === n.optionId)
      : undefined;

    return {
      id: n.id,
      actionId: n.actionId ?? undefined,
      actionTitle: action?.title,
      actionData: action,
      optionId: n.optionId ?? undefined,
      optionLabel: option?.option,
      isSelected: n.isSelected,
      nodeType: isConfirmation ? "confirmation" : "action",
      paths: hydrateFlow(n.paths, actionList, action),
    } as FlowNode;
  });




  
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

  // useEffect(() => {
  //   if (initialTest) {
  //     console.log("Populating TestFlowBuilder with initial test:", initialTest);
  //     setTestTitle(initialTest.title ?? "");
  //     setTestDescription("");
  //     // Populate nodes from flow if it exists
  //     if (initialTest.flow && initialTest.flow.length > 0) {
  //       setNodes(initialTest.flow);
  //     } else {
  //       setNodes([createNode()]);
  //     }
  //     // Populate actions from test if they exist
  //     if (initialTest.actions && initialTest.actions.length > 0) {
  //       setActions(initialTest.actions as any[]);
  //     }
  //   }
  // }, [initialTest]);

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

    const actionId = event.dataTransfer.getData(
      "application/action-id"
    );

    if (!actionId) {
      setDraggedAction(null);
      return;
    }

    const action = actions.find(
      (item) => item.id === actionId
    );

    if (!action) {
      setDraggedAction(null);
      return;
    }

    // Store the target node and open the action editor
    setPendingNodeId(nodeId);
    setEditingAction(action);
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

  const handleEditAction = (node: TestActionDefinition) => {
    const testAction = {
      id: node.id,
      title: node.title,
      hasConfirmation: node.hasConfirmation,
      confirmationTimeout: node.confirmationTimeout,
      confirmationOptions: node.confirmationOptions.map((opt) => ({
        id: opt.id,
        option: opt.option,
        isSelected: Boolean(opt.isSelected),
      })),
      actionTimeout: node.actionTimeout,
    };
    // When editing an action from sidebar, no pending node ID
    setPendingNodeId(null);
    setEditingAction(testAction as any);
  };

  const openActionEditor = (action: TestActionDefinition) => {
    const testAction = {
      id: action.id,
      title: action.title,
      hasConfirmation: action.hasConfirmation,
      confirmationTimeout: action.confirmationTimeout,
      confirmationOptions: action.confirmationOptions.map((opt) => ({
        id: opt.id,
        option: opt.option,
        isSelected: Boolean(opt.isSelected),
      })),
      actionTimeout: action.actionTimeout,
    };
    // When opening from a node, no pending node ID
    setPendingNodeId(null);
    setEditingAction(testAction as any);
  };

  const handleActionSavedToFlow = (configuredAction: TestAction) => {
    if (!pendingNodeId) return;

    // Convert TestAction to a format that can be placed in the node
    const actionDef: TestActionDefinition = {
      id: configuredAction.id || crypto.randomUUID(),
      title: configuredAction.title,
      hasConfirmation: configuredAction.hasConfirmation,
      confirmationTimeout: configuredAction.confirmationTimeout || null,
      confirmationOptions: (configuredAction.confirmationOptions || []).map((opt) => ({
        id: opt.id || crypto.randomUUID(),
        option: opt.option,
        isSelected: opt.isSelected,
      })),
      actionTimeout: configuredAction.actionTimeout,
      pasteText: (configuredAction as any).pasteText || null,
    };

    // Add the configured action to the pending node
    setNodes((currentNodes) =>
      updateNode(currentNodes, pendingNodeId, (node) => {
        const children = buildChildrenForAction(actionDef);

        return {
          ...node,
          actionId: actionDef.id,
          actionTitle: actionDef.title,
          nodeType: "action" as const,
          actionData: actionDef,
          paths: children,
        };
      })
    );

    // Clear the pending state and close editor
    setPendingNodeId(null);
    setEditingAction(null);
  };

  const isDelayAction = (title?: string) =>
    title?.trim().toUpperCase() === "DELAY";

  const getDelayLabel = (action: TestActionDefinition | undefined) => {
    if (!action) return "0s";
    const seconds = Number(action.actionTimeout ?? 0);
    return `${seconds}s`;
  };

  const extractFlowTree = (flowNodes: FlowNode[]): any[] => {
  return flowNodes.map(({ id, actionId, optionId, isSelected,paths }) => ({
    id,
    actionId: actionId ?? null,
    optionId: optionId ?? null,
    isSelected: isSelected ?? null,
    paths: extractFlowTree(paths),
  }));
};

  const syncActionDataInTree = (
    flowNodes: FlowNode[],
    actionList: TestActionDefinition[]
  ): FlowNode[] =>
    flowNodes.map((node) => {
      const matchedAction = node.actionId
        ? actionList.find((action) => action.id === node.actionId)
        : undefined;

      return {
        ...node,
        actionData: matchedAction ?? node.actionData,
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
    const isConfirmation = node.nodeType === "confirmation";
    const isDropZone = node.nodeType === "action" && !node.actionId;
    const isDelayNode = node.nodeType === "action" && isDelayAction(node.actionTitle);

    const hasConfirmationChildren =
      node.nodeType === "action" &&
      node.paths.length > 0 &&
      node.paths.every((p) => p.nodeType === "confirmation");

    const canAddPath = isConfirmation || (!hasConfirmationChildren && !isDropZone);
    const canAcceptDrop = node.nodeType === "action";

    return (
      <div className="tree-node" key={node.id}>
        <div
          className={`node-card ${isConfirmation ? "confirmation" : "action"} ${isDropZone ? "empty" : ""}`}
          onDragOver={canAcceptDrop ? handleDragOver : undefined}
          onDrop={canAcceptDrop ? (e) => handleDrop(e, node.id) : undefined}
        // style={
        //   isConfirmation
        //     ? { minHeight: 80 }
        //     : undefined
        // }
        >
          <div className="node-card-header">
            <span className="node-card-title">
              {isDropZone
                ? "Drop action here"
                : isConfirmation
                  ? node.optionLabel ?? "Option"
                  : isDelayNode
                    ? getDelayLabel(node.actionData)
                    : node.actionTitle ?? "Unassigned"}
            </span>

            {!isConfirmation && !isDropZone && isDelayNode && (
              <button
                className="edit-button"
                onClick={() => node.actionData && openActionEditor(node.actionData)}
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

            {(canAddPath || !isConfirmation) && !isDelayNode && (
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

  return (
    <div className="flow-builder">

      <aside className="flow-sidebar">
        <div className="test-configuration" id="test-config-zone">
          <div className="configuration-header">
            <h2>Test Configuration</h2>
            <p> Select a test class and manage the actions available for your flow. </p>
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
              isDelayNode={isDelayAction(editingAction?.title)}
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
                draggable
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

            <div className="test-details-fields">

              <div className="test-field">
                <label htmlFor="test-description" className="configuration-label" >Test Title </label>
                <input id="test-title" type="text" value={testTitle} className="test-title-input"
                  onChange={(event) => setTestTitle(event.target.value)} placeholder="Enter test title" />
              </div>

              <div className="test-field">
                <label htmlFor="test-description" className="configuration-label" >Description </label>
                <textarea
                  id="test-description"
                  value={testDescription}
                  onChange={(event) =>
                    setTestDescription(event.target.value)
                  }
                  placeholder="Describe what this test validates..."
                  className="test-title-input" rows={2}
                />
              </div>
            </div>
          </div>

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



