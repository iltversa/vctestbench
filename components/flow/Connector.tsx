// The lines between a step and the steps that follow it: one straight line, or
// a trunk with curved branches. Shared by the editor and the run view, so the
// geometry (which has to agree with the column widths below) lives in one place.

import type { FlowNode } from "@/components/TestFlowBuilder";

export const CHILD_W = 240; // width of each child column
export const CHILD_GAP = 48; // gap between child columns

const STEM_H = 24; // vertical drop before branching
const CURVE_H = 28; // height of the bezier curve section
const STUB_H = 20; // vertical stub into each child
const DOT_R = 5;
const LINE = "#d0d5dd";

export default function Connector({ children }: { children: Pick<FlowNode, "id">[] }) {
  const count = children.length;
  const height = STEM_H + CURVE_H + STUB_H;

  if (count === 0) return null;

  // One child: a straight line.
  if (count === 1) {
    return (
      <svg className="connector-svg" width={4} height={height} viewBox={`0 0 4 ${height}`} aria-hidden="true">
        <line x1={2} y1={0} x2={2} y2={height} stroke={LINE} strokeWidth={2} />
      </svg>
    );
  }

  // Several: a trunk and bezier branches.
  const width = count * CHILD_W + (count - 1) * CHILD_GAP;
  const cx = width / 2;
  const childCx = (index: number) => CHILD_W / 2 + index * (CHILD_W + CHILD_GAP);

  return (
    <svg
      className="connector-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <line x1={cx} y1={0} x2={cx} y2={STEM_H} stroke={LINE} strokeWidth={2} />
      <circle cx={cx} cy={STEM_H} r={DOT_R} fill="#14b8a6" />

      {children.map((child, index) => {
        const x = childCx(index);
        const y0 = STEM_H;
        const y1 = STEM_H + CURVE_H;
        // Leave the parent vertically and arrive at the child vertically.
        const k = CURVE_H * 0.6;
        const d = `M ${cx} ${y0} C ${cx} ${y0 + k}, ${x} ${y1 - k}, ${x} ${y1}`;

        return (
          <g key={child.id}>
            <path d={d} fill="none" stroke={LINE} strokeWidth={2} />
            <line x1={x} y1={y1} x2={x} y2={y1 + STUB_H} stroke={LINE} strokeWidth={2} />
            <circle cx={x} cy={y1} r={DOT_R - 1} fill="#14b8a6" />
          </g>
        );
      })}
    </svg>
  );
}
