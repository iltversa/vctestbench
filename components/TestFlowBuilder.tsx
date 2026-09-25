"use client";

import "../app/TestFlowBuilder.css";
import React, { useEffect, useState } from "react";
import CreateTestButton from "@/app/testCases/page";
import { SavedTest } from "@/app/page";
import getActionsAction from "@/actions/get-actions";
import { TestActionDefinition } from "@/services/get-test-actions";
import { getTestClassesAction } from "@/actions/get-classes";


type FlowNode = {
  id: string;
  actionId?: string;
  actionTitle?: string;
  optionId?: string;
  optionLabel?: string;
  nodeType: "action" | "confirmation";
  paths: FlowNode[];
};

type FlowPath = {
  id: string;
  label: string;
  nodes: FlowNode[];
};
// type TestClass = | "VIDEO_CLASS" | "WORKOUT" | "MONUMENTS";
type Action = { id: string; name: string; };
type TestClass = {
  id: string;
  name: string;
};

/* =========================================================
   CREATE NODE
========================================================= */

const createNode = (): FlowNode => ({
  id: crypto.randomUUID(),
  nodeType: "action",
  paths: [],
});
type ActionType = {
  id?: string;
  title: string;
  testClassId?: string;
  hasConfirmation: boolean;
  confirmationTimeout?: number | null;
  confirmationOptions?: string[];
  // sortOrder: number;
  actionTimeout: number;
};


export default function TestFlowBuilder() {
  const [nodes, setNodes] = useState<FlowNode[]>([createNode()]);
  const [draggedAction, setDraggedAction] = useState<TestActionDefinition | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [editingTest, setEditingTest] = useState<SavedTest | null>(null);
  const [classes, setClasses] = useState<TestClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [actions, setActions] = useState<TestActionDefinition[]>([]);
  const [testTitle, setTestTitle] = useState("");

  const filteredActions = selectedClassId ? actions.filter((action) => action.testClassId === selectedClassId) : actions;

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
  // If the action has confirmation options, those become children.
  if (action.hasConfirmation && action.confirmationOptions.length > 0) {
    return action.confirmationOptions.map((option) => ({
      id: crypto.randomUUID(),
      optionId: option.id,
      optionLabel: option.option,
      nodeType: "confirmation" as const,
      paths: [],
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

    setNodes((currentNodes) =>
  updateNode(currentNodes, nodeId, (node) => {
    const children = buildChildrenForAction(action);

    return {
      ...node,
      actionId: action.id,
      actionTitle: action.title,
      nodeType: "action" as const,
      paths: children,
    };
  })
);

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

  const STEM_H = 24;       // vertical drop before branching
const CURVE_H = 28;      // height of the bezier curve section
const STUB_H = 20;       // vertical stub into each child
const CHILD_W = 200;     // width of each child column (must match CSS)
const CHILD_GAP = 48;    // gap between child columns (must match CSS)
const DOT_R = 5;

const renderConnector = (parentId: string, children: FlowNode[]) => {
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

  // An action node with confirmation children owns its paths — can't add more.
  const hasConfirmationChildren =
    node.nodeType === "action" &&
    node.paths.length > 0 &&
    node.paths.every((p) => p.nodeType === "confirmation");

  // "Add path" is allowed on: confirmation nodes, and action nodes
  // that either have no children or don't have confirmation children.
  const canAddPath =
    isConfirmation || (!hasConfirmationChildren && !isDropZone);

  // Drop is allowed on action nodes only.
  const canAcceptDrop = node.nodeType === "action";

  return (
    <div className="tree-node" key={node.id}>
      {/* ------- NODE CARD ------- */}
      <div
        className={`node-card ${isConfirmation ? "confirmation" : "action"} ${
          isDropZone ? "empty" : ""
        }`}
        onDragOver={canAcceptDrop ? handleDragOver : undefined}
        onDrop={
          canAcceptDrop ? (e) => handleDrop(e, node.id) : undefined
        }
      >
        <div className="node-card-header">
          <span className="node-card-title">
            {isDropZone
              ? "Drop action here"
              : isConfirmation
              ? node.optionLabel ?? "Option"
              : node.actionTitle ?? "Unassigned"}
          </span>

          {/* Only show the ⋮ menu if this node can do anything */}
          {(canAddPath || !isConfirmation) && (
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

      {/* ------- CONNECTOR + CHILDREN ------- */}
     {node.paths.length > 0 && (
  <>
    {renderConnector(node.id, node.paths)}
    <div
      className="children-row"
      style={{
        gap: `${CHILD_GAP}px`,
      }}
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

  const handleDropAtEnd = (event: React.DragEvent) => {
    event.preventDefault();
    const actionId = event.dataTransfer.getData("application/action-id");
    if (!actionId) return;
    const action = actions.find((a) => a.id === actionId);
    if (!action) return;

    const confirmationNodes = action.hasConfirmation
      ? action.confirmationOptions.map((option) => ({
          id: crypto.randomUUID(),
          optionId: option.id,
          optionLabel: option.option,
          nodeType: "confirmation" as const,
          paths: [],
        }))
      : [];

    const newNode: FlowNode = {
      id: crypto.randomUUID(),
      actionId: action.id,
      actionTitle: action.title,
      nodeType: "action",
      paths: buildChildrenForAction(action),
    };

    setNodes((current) => [...current, newNode]);
  };
  useEffect(() => {
    async function loadActions() {
      try {

        const result = await getActionsAction();

        if (!result.success) {
          throw new Error(
            result.message ?? "Failed to fetch test classes"
          );
        }

        setActions(result.data);
      } catch (error) {
        console.error("Failed to load actions:", error);
      } finally {
        console.log("Failed to load actions:");
      }
    }
    async function loadClasses() {
      try {
        const result = await getTestClassesAction();

        if (!result.success) {
          throw new Error(
            result.message ?? "Failed to fetch test classes"
          );
        }

        setClasses(result.data);
      } catch (error) {
        console.error("Failed to load test classes:", error);
      } finally {
        console.log('hi');
      }
    }

    loadClasses();
    loadActions();
  }, []);




  return (
    <div className="flow-builder">

      <aside className="flow-sidebar">
        {/* <TestConfiguration /> */}
        <div className="test-configuration">
          <div className="configuration-header">
            <h2> Test Configuration </h2>
            <p> Configure your test before building the flow. </p>
          </div>
          {/* ================================================= TEST TITLE ================================================= */}
          <div className="configuration-section">
            <label htmlFor="test-title" className="configuration-label" > Test title </label>
            <input id="test-title" type="text" value={testTitle} onChange={(event) => setTestTitle(event.target.value)} placeholder="Enter test title" className="test-title-input" />
          </div>
          {/* ================================================= TEST CLASS ================================================= */}
          <div className="configuration-section">
            <label className="configuration-label"> Test class </label>
            <select
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              <option value="">All classes</option>
              {classes.map((testClass) => (
                <option key={testClass.id} value={testClass.id}>
                  {testClass.name}
                </option>
              ))}
            </select>
          </div>
          {/* ================================================= PREDEFINED ACTIONS ================================================= */}
        </div>
        <div className="sidebar-header">
          <h2>Actions</h2>
          <p>Drag an action into the flow</p>
           <CreateTestButton
              editingAction={editingTest}
              onEditClose={() => setEditingTest(null)}
            />
        </div>

        <div className="action-list">
          {filteredActions.map((action) => (
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
              <span className="drag-icon">⋮⋮</span>
              <span>{action.title}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* FLOW CANVAS */}
      <main className="flow-canvas">
        <div className="canvas-header">
          <div>
            <h1> Test Flow</h1>
            <p> Build your test sequence by dragging actions into the flow.</p>
          </div>
        </div>

        <div className="flow-area">

          {/*  ROOT NODES */}
          <div className="flow-root">
            {nodes.map((node, index) => renderNode(node, index
            )
            )}
          </div>

          {/* =================================================
              DROP AREA
          ================================================= */}

          <div
            className="end-drop-area"
            onDragOver={
              handleDragOver
            }
            onDrop={
              handleDropAtEnd
            }
          >
            <span>
              Drag another action here
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}



