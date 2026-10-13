"use client";

import "../app/TestFlowBuilder.css";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ActionEditorDialog, { type ActionSource } from "@/components/ActionEditorDialog";
import { countSteps, type SavedTest } from "@/components/types";
import getActionsAction from "@/actions/get-actions";
import { createFullTestAction, updateFullTestAction } from "@/actions/create-full-test";
import { deleteTestActionDefinition } from "@/actions/delete-test-action";
import { TestAction, type IfCondition } from "@/components/ActionDialog";
export type { IfCondition };
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faEllipsisVertical, faTrash, faPlus } from "@fortawesome/free-solid-svg-icons";
import {
  buildChildrenForAction,
  createNode,
  extractFlowTree,
  findAppendSlot,
  hydrateFlow,
  syncActionDataInTree,
  insertBeforeInTree,
  isConfirmationAction,
  removeFromTree,
  updateNode,
} from "@/components/flow/tree";
import { useBridge } from "@/components/BridgeProvider";
import { flowFromRecording, recordingTodos, type RecordedStep } from "@/components/flow/record";
import { useRecorder } from "@/components/useRecorder";
import Connector, { CHILD_GAP, CHILD_W } from "@/components/flow/Connector";
import { iconForAction, nodeSubtitle } from "@/components/flow/node-info";
export type TestActionDefinition = {
  id: string;
  title: string;
  hasConfirmation: boolean;
  confirmationTimeout: number | null;
  actionTimeout: number;
  pasteText?: string | null;
  icon?: string | null;
  clickOnText?: string | null;
  // ROUTE: the page the tablet should be on, e.g. /home.
  route?: string | null;
  // ROUTE: "check" fails when the tablet is elsewhere; "go" navigates there.
  routeMode?: "check" | "go" | null;
  // IF: what to look at on the tablet.
  condition?: IfCondition | null;
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

export default function TestFlowBuilder({ editingTest: initialTest }: { editingTest?: SavedTest }) {
  // The saved flow is loaded once, when the editor opens. Saved nodes carry
  // their own action data, so nothing has to wait for the action list.
  const [initial] = useState(() => {
    const hydrated = initialTest?.flow?.length ? hydrateFlow(initialTest.flow, []) : [createNode()];

    return {
      nodes: hydrated,
      snapshot: initialTest
        ? JSON.stringify([
            (initialTest.title ?? "").trim(),
            (initialTest.description ?? "").trim(),
            extractFlowTree(hydrated),
          ])
        : null,
    };
  });
  const [nodes, setNodes] = useState<FlowNode[]>(initial.nodes);
  const [draggedAction, setDraggedAction] = useState<TestActionDefinition | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<ActionSource | null>(null);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [actions, setActions] = useState<TestActionDefinition[]>([]);
  const [testTitle, setTestTitle] = useState(initialTest?.title ?? "");
  const [testDescription, setTestDescription] = useState(initialTest?.description ?? "");
  const [saving, setSaving] = useState(false);
  // The row as last stored. Run always uses this, never the page's original prop.
  const [savedTest, setSavedTest] = useState<SavedTest | undefined>(initialTest);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(initial.snapshot);
  const [saveMessage, setSaveMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [runError, setRunError] = useState("");
  // The empty slot whose "pick an action" menu is open.
  const [quickAddFor, setQuickAddFor] = useState<string | null>(null);
  const bridge = useBridge();
  const router = useRouter();
  const flowArea = useRef<HTMLDivElement>(null);
  // What is left to do by hand after a recording.
  const [recordingTodo, setRecordingTodo] = useState<string[] | null>(null);
  // The recorded steps become the flow as they arrive.
  const recorder = useRecorder((steps: RecordedStep[]) => {
    setNodes(flowFromRecording(steps, actions));
  });
  // Drag and drop: a node being moved, the gap an action will be inserted
  // into, and the element currently under the pointer.
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [pendingInsert, setPendingInsert] = useState<{ parentId: string | null; beforeId: string } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);


  const handleDragStart = (
    event: React.DragEvent<HTMLElement>,
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
    route: action.route ?? "",
    routeMode: action.routeMode ?? "check",
    condition: action.condition ?? null,
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

  // const handleDragEnd = () => {
  //   setDraggedAction(null);
  // };


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
    setEditingAction(testAction);
  };

  const openActionEditor = (
  action: TestActionDefinition,
  nodeId?: string,
  flowTitle?: string
) => {
  const actionCopy = prepareActionForEditor(action, flowTitle);

  setPendingNodeId(nodeId ?? null);
  setEditingAction(actionCopy);

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
      pasteText: configuredAction.pasteText ?? null,
      clickOnText: configuredAction.clickOnText ?? null,
      route: configuredAction.route ?? null,
      routeMode: configuredAction.routeMode ?? null,
      condition: configuredAction.condition ?? null,
      email: configuredAction.email ?? null,
      password: configuredAction.password ?? null,
      icon: configuredAction.icon ?? null,
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



  // Used for the first load and again after the library changes.
  const applyActions = (list: TestActionDefinition[]) => {
    setActions(list);
    setNodes((currentNodes) => syncActionDataInTree(currentNodes, list));
  };

  const refreshActions = async () => {
    try {
      const result = await getActionsAction();

      if (result.success) applyActions(result.data);
    } catch (error) {
      console.error("Failed to refresh actions:", error);
    }
  };

  // Removes an action from the library. Steps already in flows keep their own
  // copy of its configuration, so existing tests are unaffected.
  const handleDeleteAction = async (action: TestActionDefinition) => {
    const confirmed = window.confirm(
      `Remove "${action.title}" from the list of steps you can add? Tests that already use it keep working.`
    );
    if (!confirmed) return;

    const result = await deleteTestActionDefinition({ id: action.id });

    if (!result.success) {
      setSaveMessage({ kind: "error", text: result.message ?? "The action could not be removed." });
      return;
    }

    await refreshActions();
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getActionsAction();
        if (cancelled) return;

        if (!result.success) throw new Error(result.message ?? "Failed to fetch actions");

        applyActions(result.data);
      } catch (error) {
        console.error("Failed to load actions:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
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
    setRunError("");

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
            <div className="slot">
              <span className="slot-label">{isDragging ? "Drop here" : "Next step"}</span>
              <button
                type="button"
                className="slot-add"
                aria-expanded={quickAddFor === node.id}
                onClick={() => setQuickAddFor(quickAddFor === node.id ? null : node.id)}
              >
                <FontAwesomeIcon icon={faPlus} aria-hidden="true" /> Add step
              </button>
              {quickAddFor === node.id && (
                <ul className="quick-add" aria-label="Choose an action to add">
                  {actions.map((action) => (
                    <li key={action.id}>
                      <button type="button" onClick={() => addAction(action, node.id)}>
                        {action.title}
                      </button>
                    </li>
                  ))}
                  {actions.length === 0 && <li className="quick-add-empty">No actions available.</li>}
                </ul>
              )}
            </div>
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
                <FontAwesomeIcon icon={iconForAction(node.actionTitle, node.actionData?.icon)} />
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
            <Connector>{node.paths}</Connector>
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
  // Press Add (or Add step on the canvas): the same dialog as dropping.
  const addAction = (action: TestActionDefinition, slotId?: string) => {
    if (recorder.active) return;

    const target = slotId ?? findAppendSlot(nodes)?.id;

    if (!target) {
      setSaveMessage({ kind: "error", text: "There is nowhere to add a step here." });
      return;
    }

    setQuickAddFor(null);
    setPendingInsert(null);
    setPendingNodeId(target);
    setEditingAction(prepareActionForEditor(action));
  };

  // Save what is on screen first when it changed, then run that exact version.
  const handleSaveAndRun = async () => {
    setRunError("");

    const stored = dirty || !savedTest ? await saveTest() : savedTest;
    if (!stored) return;

    const result = await bridge.startRun(stored.id);

    if (!result.ok) {
      setRunError(result.message);
      return;
    }

    router.push(`/test/${stored.id}/run`);
  };

  const runDisabled =
    saving || !testTitle.trim() || Boolean(bridge.blockedReason) || bridge.starting || recorder.active;
  const runLabel = saving
    ? "Saving…"
    : bridge.starting
      ? "Starting…"
      : dirty || !savedTest
        ? "Save and run"
        : "Run test";
  const stepCount = countSteps(nodes);

  // Recording is offered on an empty flow with the tablet ready.
  const canRecord =
    bridge.connected && Boolean(bridge.state?.sandboxForeground) && !bridge.running && !bridge.starting;

  // Follow the newest recorded step down the canvas.
  useEffect(() => {
    if (!recorder.active || recorder.count === 0) return;

    const area = flowArea.current;
    area?.scrollTo({ top: area.scrollHeight, behavior: "smooth" });
  }, [recorder.active, recorder.count]);

  const startRecording = async () => {
    setRecordingTodo(null);
    setSaveMessage(null);
    await recorder.start();
  };

  const stopRecording = async () => {
    const steps = await recorder.stop();
    setRecordingTodo(steps.length > 0 ? recordingTodos(steps) : null);
  };
  const statusMessage = runError
    ? { kind: "error" as const, text: runError }
    : saveMessage;

  return (
    <div className={`flow-builder ${recorder.active ? "is-recording" : ""}`}>
      {/* ------------------------- Actions panel ------------------------- */}
      <aside className="flow-sidebar" aria-label="Actions">
        <section className="side-section">
          <h2 className="side-title">Actions</h2>
          <p className="side-hint">Press Add, or drag an action onto the flow.</p>

          <ul className="action-list">
            {actions.map((action) => (
              <li
                key={action.id}
                draggable
                data-id={action.id}
                className={`action-item ${draggedAction?.id === action.id ? "dragging" : ""}`}
                onDragStart={(event) => handleDragStart(event, action)}
                onDragEnd={handleDragEnd}
              >
                <span className="drag-icon" aria-hidden="true">⋮⋮</span>
                <span className="node-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={iconForAction(action.title, action.icon)} />
                </span>
                <span className="action-title">{action.title}</span>

                <button
                  type="button"
                  className="action-add"
                  onClick={() => addAction(action)}
                  aria-label={`Add ${action.title} to the flow`}
                >
                  <FontAwesomeIcon icon={faPlus} aria-hidden="true" /> Add
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => handleEditAction(action)}
                  title="Change the title or icon"
                  aria-label={`Edit ${action.title}`}
                >
                  <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  onClick={() => handleDeleteAction(action)}
                  title="Remove this action from the list"
                  aria-label={`Delete ${action.title}`}
                >
                  <FontAwesomeIcon icon={faTrash} aria-hidden="true" />
                </button>
              </li>
            ))}
            {actions.length === 0 && (
              <li className="side-hint">No actions yet. Run the database migrations to add the built-in ones.</li>
            )}
          </ul>
        </section>

        <ActionEditorDialog
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
      </aside>

      {/* --------------------------- Editor view --------------------------- */}
      <main className="flow-canvas">
        <div className="canvas-header">
          <div className="canvas-fields">
            <nav aria-label="Breadcrumb" className="canvas-crumb">
              <Link href="/">Test flows</Link>
              <span aria-hidden="true">/</span>
              <span>{savedTest ? "Edit" : "New"}</span>
              <span className="canvas-count">
                · {stepCount} {stepCount === 1 ? "step" : "steps"}
                {dirty && !saving ? <span className="unsaved"> · Unsaved changes</span> : null}
              </span>
            </nav>

            <label htmlFor="test-title" className="sr-only">Title</label>
            <input
              id="test-title"
              type="text"
              value={testTitle}
              onChange={(event) => setTestTitle(event.target.value)}
              placeholder="Name this test flow"
              className="title-input"
            />

            <label htmlFor="test-description" className="sr-only">What it checks</label>
            <input
              id="test-description"
              type="text"
              value={testDescription}
              onChange={(event) => setTestDescription(event.target.value)}
              placeholder="What does it check? (optional)"
              className="description-input"
            />
          </div>

          <div className="canvas-actions">
            <div className="canvas-buttons">
              <button
                onClick={handleSaveTest}
                disabled={saving || !testTitle.trim() || !dirty || recorder.active}
                type="button"
                className="btn"
                title={!testTitle.trim() ? "Enter a title" : ""}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                className="btn primary"
                disabled={runDisabled}
                onClick={handleSaveAndRun}
                type="button"
              >
                {runLabel}
              </button>
            </div>
            {bridge.blockedReason && <p className="canvas-reason">{bridge.blockedReason}</p>}
          </div>
        </div>

        {statusMessage && (
          <p
            role={statusMessage.kind === "error" ? "alert" : "status"}
            className={`flow-message ${statusMessage.kind}`}
          >
            {statusMessage.text}
          </p>
        )}

        <div className="flow-area" ref={flowArea}>
          {recorder.active && (
            <section className="record-banner" role="status" aria-live="polite">
              <span className="record-dot" aria-hidden="true" />
              <div className="record-text">
                <strong>Recording from the tablet</strong>
                <span>
                  {recorder.count === 0
                    ? "Use the tablet as you normally would. Each tap and each text you enter becomes a step."
                    : `${recorder.count} ${recorder.count === 1 ? "step" : "steps"} so far. Keep going on the tablet.`}
                </span>
              </div>
              <button type="button" className="btn primary" onClick={stopRecording} disabled={recorder.busy}>
                Stop recording
              </button>
            </section>
          )}

          {!recorder.active && stepCount === 0 && bridge.connected && (
            <section className="record-card" aria-labelledby="record-title">
              <h2 id="record-title">Record this flow from the tablet</h2>
              <p>
                Press record, then do the steps on the tablet yourself. Each tap and each text you enter
                becomes a step here. You can adjust them afterwards.
              </p>
              <button type="button" className="btn primary" onClick={startRecording} disabled={!canRecord || recorder.busy}>
                {recorder.busy ? "Starting…" : "Start recording"}
              </button>
              {!canRecord && (
                <p className="record-reason">
                  {bridge.running
                    ? "A test is running on the tablet."
                    : "Open the Sandbox app on the tablet to record."}
                </p>
              )}
              {recorder.error && <p className="record-reason" role="alert">{recorder.error}</p>}
              <p className="record-or">Or add steps yourself from the Actions panel.</p>
            </section>
          )}

          {recordingTodo && !recorder.active && (
            <section className="record-done" role="status">
              <strong>Recording finished: {stepCount} {stepCount === 1 ? "step" : "steps"}.</strong>
              <span>Check them, then name the flow and save.</span>
              {recordingTodo.length > 0 && (
                <ul>
                  {recordingTodo.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              <button type="button" className="btn" onClick={() => setRecordingTodo(null)}>
                Dismiss
              </button>
            </section>
          )}

          <div className="flow-root">
            {nodes.map((node, index) => renderNode(node, index, null))}
          </div>
        </div>
      </main>
    </div>
  );
}
