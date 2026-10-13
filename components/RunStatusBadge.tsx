const STYLES: Record<string, string> = {
  passed: "bg-emerald-50 text-emerald-900 border-emerald-200",
  failed: "bg-red-50 text-red-900 border-red-200",
  running: "bg-blue-50 text-blue-900 border-blue-200",
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  stopped: "bg-amber-50 text-amber-900 border-amber-200",
};

const LABELS: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  running: "Running",
  pending: "Not run",
  stopped: "Stopped",
};

export default function RunStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        STYLES[status] ?? STYLES.pending
      }`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
