import { useEffect, useState } from "react";

import { createTestAction } from "@/actions/tests/create-test";
import { SavedTest } from "@/app/page";
import { updateTestAction } from "@/actions/tests/update-test";
type ConfirmationOption = {
  id: number;
  value: string;
};
type TestCaseBuilderDialogProps = {
  test: SavedTest | null;
  onClose: () => void;
};
type Step = {
  id: number;

  action: string;
  actionTitle: string;
  customAction: string;

  hasConfirmation: boolean;
  confirmationTimeout: string;

  confirmationOptions: {
    id: number;
    value: string;
  }[];

  actionTimeout: string;
};

export default function TestCaseBuilderDialog({onClose, test}: TestCaseBuilderDialogProps) {
  
  const [isDialogOpen, setIsDialogOpen] = useState(true);
  const isEditMode = Boolean(test);
  const [testTitle, setTestTitle] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null);
  useEffect(() => {
    if (!test) {
      // CREATE
      setTestTitle("");
      setSteps([makeStep()]);
      return;
    }

    // EDIT
    setTestTitle(test.title);

    setSteps(
      test.actions.map((action) => ({
        id: action.id,
        action: action.action,
        actionTitle: action.title,
        customAction: action.customAction ?? "",
        hasConfirmation: action.hasConfirmation,
        confirmationTimeout:
          action.confirmationTimeout?.toString() ?? "5",
        confirmationOptions:
          action.confirmationOptions.map((option) => ({
            id: option.id,
            value: option.value,
          })),
        actionTimeout:
          action.actionTimeout.toString(),
      }))
    );
  }, [test]);
  const toggleStep = (id: number) => {
    setExpandedStepId((prev) => (prev === id ? null : id));
  };

  const makeStep = (overrides: Partial<Step> = {}): Step => ({
  id: Date.now() + Math.random(),

  action: "START",
  actionTitle: "START",
  customAction: "",

  hasConfirmation: false,
  confirmationTimeout: "5",

  confirmationOptions: [
    {
      id: Date.now() + Math.random(),
      value: "Yes",
    },
    {
      id: Date.now() + Math.random(),
      value: "No",
    },
  ],

  actionTimeout: "5",

  ...overrides,
  });

  const handleAddStep = () => {
    const step = makeStep();
    setSteps((prev) => [...prev, step]);
    setExpandedStepId(step.id); // open the newly added step
  };

  const handleDuplicateStep = (id: number) => {
    setSteps((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index === -1) return prev;

      const source = prev[index];
      const copy: Step = {
        ...source,
        id: Date.now() + Math.random(),
        actionTitle: `${source.actionTitle} (copy)`,
        confirmationOptions: source.confirmationOptions.map((o) => ({
          id: Date.now() + Math.random(),
          value: o.value,
        })),
      };

      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
  };

  const handleRemoveStep = (id: number) => {
    setSteps((prev) => prev.filter((s) => s.id !== id));
    setExpandedStepId((prev) => (prev === id ? null : prev));
  };

  const handleUpdateStep = (id: number, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleAddOption = (stepId: number) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? {
              ...s,
              confirmationOptions: [
                ...s.confirmationOptions,
                { id: Date.now() + Math.random(), value: "" },
              ],
            }
          : s
      )
    );
  };

  const handleUpdateOption = (stepId: number, optionId: number, value: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? {
              ...s,
              confirmationOptions: s.confirmationOptions.map((o) =>
                o.id === optionId ? { ...o, value } : o
              ),
            }
          : s
      )
    );
  };

  const handleRemoveOption = (stepId: number, optionId: number) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? {
              ...s,
              confirmationOptions: s.confirmationOptions.filter((o) => o.id !== optionId),
            }
          : s
      )
    );
  };
  const handleCreateTests = async () => {
    const result = await createTestAction({
      title: testTitle,
      steps,
    });

    if (!result.success) {
      alert(result.error);
      return;
    }

    console.log("Created test:", result.data);

    onClose();
  };
  const handleSaveTest = async () => {
  if (test) {
    // EDIT EXISTING TEST
    const result = await updateTestAction({
      testId: test.id,
      title: testTitle,
      steps,
    });

    if (!result.success) {
      alert(result.error);
      return;
    }

    console.log("Updated test:", result.data);
  } else {
    // CREATE NEW TEST
    const result = await createTestAction({
      title: testTitle,
      steps,
    });

    if (!result.success) {
      alert(result.error);
      return;
    }

    console.log("Created test:", result.data);
  }

  onClose();
};
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      {/* Reopen trigger */}
      {!isDialogOpen && (
        <div className="mx-auto flex max-w-4xl items-center justify-center pt-32">
          <button
            onClick={() => setIsDialogOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Open Test Case Builder
          </button>
        </div>
      )}

      {/* ============ THE ONLY DIALOG ============ */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          {/* Dialog panel */}
          <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Test Case Builder
                </h2>
                <p className="text-xs text-slate-500">
                  Configure your test steps and confirmation rules
                </p>
              </div>
              {/* ✅ FIXED close button */}
              <button
                type="button"
                onClick={onClose}
                className="..."
              >
                ×
              </button>
            </div>

            {/* Body (scrollable) */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {/* Test Title */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Test Title
                </label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="Enter test title..."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Steps header */}
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-800">
                  Steps{" "}
                  <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {steps.length}
                  </span>
                </h3>
                <button
                  onClick={handleAddStep}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Step
                </button>
              </div>

              {/* Steps list */}
              {steps.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-slate-200 py-12 text-center">
                  <p className="text-sm text-slate-400">
                    No steps yet. Click "Add Step" to get started.
                  </p>
                </div>
              ) : (
                <ol className="space-y-3">
                  {steps.map((step, index) => {
                    const isOpen = expandedStepId === step.id;
                    return (
                      <li
                        key={step.id}
                        className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                          isOpen ? "border-blue-300" : "border-slate-200"
                        }`}
                      >
                        {/* Step header (clickable to open/collapse) */}
                        <div
                          onClick={() => toggleStep(step.id)}
                          className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors ${
                            isOpen ? "bg-blue-50/60" : "bg-slate-50/60 hover:bg-slate-100/70"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {/* Chevron */}
                            <svg
                              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                                isOpen ? "rotate-90" : ""
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>

                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                              {index + 1}
                            </span>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-800">
                                {step.actionTitle || step.action}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {step.action}
                                {step.hasConfirmation &&
                                  ` · confirmation (${step.confirmationTimeout}s, ${step.confirmationOptions.length} options)`}
                              </p>
                            </div>
                          </div>

                          {/* Actions — stopPropagation so they don't toggle the collapse */}
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleDuplicateStep(step.id)}
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-blue-600"
                              aria-label="Duplicate step"
                              title="Duplicate step"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(step.id)}
                              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-red-500"
                              aria-label="Remove step"
                              title="Remove step"
                            >
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Step body (only rendered when open) */}
                        {isOpen && (
                          <div className="space-y-4 border-t border-slate-100 px-4 py-4">
                            {/* Action + Action Title */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                                  Action
                                </label>
                                <select
                                  value={step.action}
                                  onChange={(e) =>
                                    handleUpdateStep(step.id, { action: e.target.value })
                                  }
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="START">START</option>
                                  <option value="PAUSE">PAUSE</option>
                                  <option value="RESUME">RESUME</option>
                                  <option value="END">END</option>
                                  <option value="CUSTOM">CUSTOM</option>
                                </select>
                              </div>

                              <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                                  Action Title
                                </label>
                                <input
                                  type="text"
                                  value={step.actionTitle}
                                  onChange={(e) =>
                                    handleUpdateStep(step.id, { actionTitle: e.target.value })
                                  }
                                  placeholder="Enter action title..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {/* Custom Action */}
                            {step.action === "CUSTOM" && (
                              <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                                  Custom Action
                                </label>
                                <input
                                  type="text"
                                  value={step.customAction ?? ""}
                                  onChange={(e) =>
                                    handleUpdateStep(step.id, { customAction: e.target.value })
                                  }
                                  placeholder="Enter custom action..."
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            )}

                            {/* Has Confirmation toggle */}
                            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                              <input
                                type="checkbox"
                                id={`confirmation-${step.id}`}
                                checked={step.hasConfirmation}
                                onChange={(e) =>
                                  handleUpdateStep(step.id, {
                                    hasConfirmation: e.target.checked,
                                  })
                                }
                                className="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500"
                              />
                              <label
                                htmlFor={`confirmation-${step.id}`}
                                className="cursor-pointer text-sm font-medium text-slate-700"
                              >
                                Requires confirmation
                              </label>
                            </div>

                            {/* Confirmation details (inline inside the step) */}
                            {step.hasConfirmation && (
                              <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                                {/* Timeout */}
                                <div>
                                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                                    Confirmation Timeout (seconds)
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={step.confirmationTimeout}
                                    onChange={(e) =>
                                      handleUpdateStep(step.id, {
                                        confirmationTimeout: e.target.value,
                                      })
                                    }
                                    className="w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>

                                {/* Confirmation Options */}
                                <div>
                                  <div className="mb-2 flex items-center justify-between">
                                    <label className="text-xs font-medium text-slate-600">
                                      Confirmation Options
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleAddOption(step.id)}
                                      className="inline-flex items-center gap-1 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-blue-600 ring-1 ring-inset ring-blue-200 transition-colors hover:bg-blue-50"
                                    >
                                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                      </svg>
                                      Add Option
                                    </button>
                                  </div>

                                  <div className="space-y-2">
                                    {step.confirmationOptions.length === 0 ? (
                                      <p className="rounded-lg border border-dashed border-slate-200 bg-white py-3 text-center text-xs text-slate-400">
                                        No options. Click "Add Option" to add one.
                                      </p>
                                    ) : (
                                      step.confirmationOptions.map((opt, i) => (
                                        <div key={opt.id} className="flex items-center gap-2">
                                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
                                            {i + 1}
                                          </span>
                                          <input
                                            type="text"
                                            value={opt.value}
                                            onChange={(e) =>
                                              handleUpdateOption(step.id, opt.id, e.target.value)
                                            }
                                            placeholder={`Option ${i + 1}`}
                                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveOption(step.id, opt.id)}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-red-500"
                                            aria-label="Remove option"
                                          >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                          </button>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTest}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
  {isEditMode ? "Update Test" : "Save Test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}