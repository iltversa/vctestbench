"use client";

import "../../app/TestFlowBuilder.css";
import { useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Connector, { CHILD_GAP, CHILD_W } from "@/components/flow/Connector";
import { iconFor, nodeSubtitle } from "@/components/flow/node-info";
import type { FlowNode } from "@/components/TestFlowBuilder";
import type { StepProgress } from "@/components/bridge";

type Props = {
  nodes: FlowNode[];
  // The state of each step by node id; empty before a run.
  steps?: StepProgress[];
  // The step that is running now: kept in view.
  activeStep?: number | null;
};

const RUN_TEXT: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  stopped: "Stopped",
};

// The flow, read-only, with each step's state while a run happens. Uses the
// same cards and connectors as the editor so the two always look alike.
export default function FlowChart({ nodes, steps = [], activeStep = null }: Props) {
  const byNode = new Map(steps.map((step) => [step.nodeId, step]));
  const activeNodeId = steps.find((step) => step.index === activeStep)?.nodeId;
  const root = useRef<HTMLDivElement>(null);

  // Follow the run down the chart.
  useEffect(() => {
    if (!activeNodeId) return;

    const element = root.current?.querySelector<HTMLElement>(`[data-node="${activeNodeId}"]`);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    element?.scrollIntoView({ block: "center", inline: "center", behavior: calm ? "auto" : "smooth" });
  }, [activeNodeId]);

  const render = (node: FlowNode): React.ReactNode => {
    const empty = node.nodeType === "action" && !node.actionId && !node.optionId;
    const option = Boolean(node.optionId) && !node.actionId;
    const step = byNode.get(node.id);

    // An empty slot is the end of the chain: not a step, so not drawn.
    if (empty) return null;

    const subtitle = option ? null : nodeSubtitle(node);
    const state = step?.status ?? null;

    return (
      <div className="tree-node" key={node.id}>
        <div
          data-node={node.id}
          className={[
            "node-card",
            option ? "confirmation" : "action",
            state ? `run-${state}` : "",
          ].join(" ")}
        >
          {option ? (
            <div className="node-card-header">
              <span className="node-card-title">
                {node.optionLabel ?? "Option"}
                {node.isSelected ? <span className="option-badge">Selected</span> : null}
              </span>
            </div>
          ) : (
            <div className="node-card-header">
              <span className="node-icon" aria-hidden="true">
                <FontAwesomeIcon icon={iconFor(node.actionData?.icon)} />
              </span>
              <div className="node-text">
                <span className="node-card-title">{node.actionTitle ?? "Step"}</span>
                {subtitle && <span className="node-subtitle" title={subtitle}>{subtitle}</span>}
                {step && step.status !== "pending" && (
                  <span className={`node-run-state run-text-${step.status}`}>
                    {step.status === "running"
                      ? step.phase === "waiting" ? "Waiting…" : "Running…"
                      : `${RUN_TEXT[step.status]}${
                          step.status === "passed" && step.durationMs !== null
                            ? ` · ${(step.durationMs / 1000).toFixed(1)}s`
                            : ""
                        }`}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {node.paths.some((child) => !(child.nodeType === "action" && !child.actionId && !child.optionId)) && (
          <>
            <Connector>{node.paths.filter((child) => !(child.nodeType === "action" && !child.actionId && !child.optionId))}</Connector>
            <div className="children-row" style={{ gap: `${CHILD_GAP}px` }}>
              {node.paths
                .filter((child) => !(child.nodeType === "action" && !child.actionId && !child.optionId))
                .map((child) => (
                  <div className="child-column" key={child.id} style={{ width: `${CHILD_W}px` }}>
                    {render(child)}
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div ref={root} className="flow-chart">
      {nodes.map((node) => render(node))}
    </div>
  );
}
