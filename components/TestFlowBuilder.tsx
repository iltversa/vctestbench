"use client";

import "../app/TestFlowBuilder.css";
import React, { useState } from "react";
import CreateTestButton from "@/app/testCases/page";
import { SavedTest } from "@/app/page";

type ActionType =
  | "START"
  | "PAUSE"
  | "RESUME"
  | "END"
  | "DELETE"
  | "DISCARD"
  | "SAVE"
  | "STOP"
  | "CUSTOM";

type FlowNode = {
  id: string;
  action?: ActionType;
  customAction?: string;

  // Every node can have multiple paths
  paths: FlowNode[];
}; type TestClass = | "VIDEO_CLASS" | "WORKOUT" | "MONUMENTS";
type Action = { id: string; name: string; };
const PREDEFINED_ACTIONS: Record<TestClass, Action[]> =
{
  VIDEO_CLASS: [{ id: "video-start", name: "START", },],
  WORKOUT: [{ id: "workout-start", name: "START", },],
  MONUMENTS: [{ id: "monuments-start", name: "START", },],
};

const ACTIONS: ActionType[] = [
  "START",
  "PAUSE",
  "RESUME",
  "END",
  "DELETE",
  "DISCARD",
  "SAVE",
  "STOP",
  "CUSTOM",
];

/* =========================================================
   CREATE NODE
========================================================= */

const createNode = (): FlowNode => ({
  id: crypto.randomUUID(),
  action: undefined,
  customAction: "",
  paths: [],
});


export default function TestFlowBuilder() {

  const [nodes, setNodes] = useState<FlowNode[]>([
    createNode(),
  ]);

  const [draggedAction, setDraggedAction] =
    useState<ActionType | null>(null);

  const [openMenu, setOpenMenu] =
    useState<string | null>(null);

  const handleDragStart = (
    event: React.DragEvent,
    action: ActionType
  ) => {
    setDraggedAction(action);

    event.dataTransfer.effectAllowed = "copy";

    event.dataTransfer.setData(
      "action",
      action
    );
  };

  const handleDragEnd = () => {
    setDraggedAction(null);
  };


  const handleDragOver = (
    event: React.DragEvent
  ) => {
    event.preventDefault();

    event.dataTransfer.dropEffect = "copy";
  };

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
    event: React.DragEvent,
    nodeId: string
  ) => {
    event.preventDefault();

    const action =
      (event.dataTransfer.getData("action") ||
        draggedAction) as ActionType;

    if (!action) return;

    setNodes((currentNodes) =>
      updateNode(
        currentNodes,
        nodeId,
        (node) => ({
          ...node,

          action,

          customAction:
            action === "CUSTOM"
              ? node.customAction || ""
              : undefined,
        })
      )
    );

    setDraggedAction(null);
  };


  const addPath = (nodeId: string) => {
    setNodes((currentNodes) =>
      updateNode(
        currentNodes,
        nodeId,
        (node) => ({
          ...node,

          paths: [
            ...node.paths,
            createNode(),
          ],
        })
      )
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


  const updateCustomAction = (
    nodeId: string,
    value: string
  ) => {
    setNodes((currentNodes) =>
      updateNode(
        currentNodes,
        nodeId,
        (node) => ({
          ...node,
          customAction: value,
        })
      )
    );
  };


  const renderNode = (
    node: FlowNode,
    index: number,
    level: number = 0
  ) => {
    return (
      <div
        key={node.id}
        className="flow-node-tree"
      >
        {/* =================================================
            NODE
        ================================================= */}

        <div
          className={`flow-node ${node.action
              ? "filled"
              : "empty"
            }`}
          onDragOver={handleDragOver}
          onDrop={(event) =>
            handleDrop(
              event,
              node.id
            )
          }
        >
          {!node.action ? (
            <div className="empty-node">
              <div className="empty-plus">
                +
              </div>

              <span>
                Drag action here
              </span>
            </div>
          ) : (
            <div className="filled-node">
              {/* NODE NUMBER */}

              <div className="node-icon">
                {index + 1}
              </div>

              {/* CONTENT */}

              <div className="node-content">
                <span className="node-label">
                  ACTION
                </span>

                {node.action ===
                  "CUSTOM" ? (
                  <input
                    value={
                      node.customAction ||
                      ""
                    }
                    onChange={(event) =>
                      updateCustomAction(
                        node.id,
                        event.target.value
                      )
                    }
                    placeholder="Custom action"
                    className="custom-action-input"
                  />
                ) : (
                  <strong>
                    {node.action}
                  </strong>
                )}
              </div>

              {/* =================================================
                  THREE DOT MENU
              ================================================= */}

              <div className="node-menu-wrapper">
                <button
                  className="node-menu-button"
                  onClick={() =>
                    setOpenMenu(
                      openMenu === node.id
                        ? null
                        : node.id
                    )
                  }
                >
                  ⋮
                </button>

                {openMenu === node.id && (
                  <div className="node-menu">
                    <button
                      onClick={() =>
                        addPath(node.id)
                      }
                    >
                      <span>＋</span>

                      Add path
                    </button>

                    <button
                      className="danger"
                      onClick={() =>
                        removeNode(
                          node.id
                        )
                      }
                    >
                      <span>×</span>

                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* =================================================
            PATHS
        ================================================= */}

        {node.paths.length > 0 && (
          <div className="node-paths">
            {node.paths.map(
              (path, pathIndex) => (
                <div
                  key={path.id}
                  className="path-column"
                >
                  {/* PATH CONNECTOR */}

                  <div className="path-connector">
                    <div className="connector-horizontal" />

                    <div className="connector-vertical" />

                    <div className="connector-arrow">
                      ↓
                    </div>

                    <span className="path-label">
                      PATH {pathIndex + 1}
                    </span>
                  </div>

                  {/* CHILD NODE */}

                  {renderNode(
                    path,
                    pathIndex,
                    level + 1
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  };


  const handleDropAtEnd = (
    event: React.DragEvent
  ) => {
    event.preventDefault();

    const action =
      event.dataTransfer.getData(
        "action"
      ) as ActionType;

    if (!action) return;

    const newNode: FlowNode = {
      id: crypto.randomUUID(),
      action,
      customAction:
        action === "CUSTOM"
          ? ""
          : undefined,
      paths: [],
    };

    setNodes((current) => [
      ...current,
      newNode,
    ]);
  };
  const [editingTest, setEditingTest] = useState<SavedTest | null>(null);
  const [testTitle, setTestTitle] = useState("");
  const [selectedClass, setSelectedClass] = useState<TestClass>("VIDEO_CLASS");
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);
  const handleClassChange = (testClass: TestClass) => { setSelectedClass(testClass); };

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
            <div className="class-options"> {/* VIDEO CLASS */}
              <label className="class-option">
                <input type="radio" name="test-class" value="VIDEO_CLASS" checked={selectedClass === "VIDEO_CLASS"} onChange={() => handleClassChange("VIDEO_CLASS")} />
                <span> Video Class </span>
              </label>
              {/* WORKOUT */}
              <label className="class-option">
                <input type="radio" name="test-class" value="WORKOUT" checked={selectedClass === "WORKOUT"} onChange={() => handleClassChange("WORKOUT")} />
                <span> Workout </span>
              </label>
              {/* MONUMENTS */}
              <label className="class-option">
                <input type="radio" name="test-class" value="MONUMENTS" checked={selectedClass === "MONUMENTS"} onChange={() => handleClassChange("MONUMENTS")} />
                <span> Monuments </span>
              </label>
            </div>
          </div>
          {/* ================================================= PREDEFINED ACTIONS ================================================= */}
          <div className="configuration-section">
            <CreateTestButton
              editingAction={editingTest}
              onEditClose={() => setEditingTest(null)}
            />
          </div>
        </div>
        <div className="sidebar-header">
          <h2>Actions</h2>

          <p>
            Drag an action into the flow
          </p>
        </div>

        <div className="action-list">
          {ACTIONS.map((action) => (
            <div
              key={action}
              draggable
              className={`action-item ${draggedAction === action
                  ? "dragging"
                  : ""
                }`}
              onDragStart={(event) =>
                handleDragStart(
                  event,
                  action
                )
              }
              onDragEnd={
                handleDragEnd
              }
            >
              <span className="drag-icon">
                ⋮⋮
              </span>

              <span>
                {action}
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* ===================================================
          FLOW CANVAS
      =================================================== */}

      <main className="flow-canvas">

        <div className="canvas-header">
          <div>
            <h1>
              Test Flow
            </h1>

            <p>
              Build your test sequence by
              dragging actions into the flow.
            </p>
          </div>
        </div>

        <div className="flow-area">

          {/* =================================================
              ROOT NODES
          ================================================= */}

          <div className="flow-root">
            {nodes.map(
              (node, index) =>
                renderNode(
                  node,
                  index
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



