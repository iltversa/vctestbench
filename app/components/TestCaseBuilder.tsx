"use client";

import { useState } from "react";

const ACTIONS = [
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

type ConfirmationOption = {
  id: number;
  value: string;
};

type ActionRule = {
  id: number;
  action: string;
  customAction?: string;

  hasConfirmation: boolean;
  confirmationTimeout: string;
  confirmationOptions: ConfirmationOption[];

  actionTimeout: string;
};

export default function TestCaseBuilder() {
  const [action, setAction] = useState("START");
  const [customAction, setCustomAction] = useState("");

  const [hasConfirmation, setHasConfirmation] =
    useState(false);

  const [confirmationTimeout, setConfirmationTimeout] =
    useState("5");

  const [confirmationOptions, setConfirmationOptions] =
    useState<ConfirmationOption[]>([
      {
        id: Date.now(),
        value: "Yes",
      },
      {
        id: Date.now() + 1,
        value: "No",
      },
    ]);

  const [actionTimeout, setActionTimeout] =
    useState("10");

  const [savedActions, setSavedActions] =
    useState<ActionRule[]>([]);

  // ------------------------------------------
  // Confirmation options
  // ------------------------------------------

  function addConfirmationOption() {
    setConfirmationOptions((prev) => [
      ...prev,
      {
        id: Date.now(),
        value: "",
      },
    ]);
  }

  function updateConfirmationOption(
    id: number,
    value: string
  ) {
    setConfirmationOptions((prev) =>
      prev.map((option) =>
        option.id === id
          ? {
              ...option,
              value,
            }
          : option
      )
    );
  }

  function deleteConfirmationOption(
    id: number
  ) {
    setConfirmationOptions((prev) =>
      prev.filter(
        (option) => option.id !== id
      )
    );
  }

  // ------------------------------------------
  // Save
  // ------------------------------------------

  function saveAction() {
    if (
      action === "CUSTOM" &&
      !customAction.trim()
    ) {
      alert("Enter a custom action.");
      return;
    }

    const newAction: ActionRule = {
      id: Date.now(),

      action,

      customAction:
        action === "CUSTOM"
          ? customAction.trim()
          : undefined,

      hasConfirmation,

      confirmationTimeout:
        hasConfirmation
          ? confirmationTimeout
          : "",

      confirmationOptions:
        hasConfirmation
          ? confirmationOptions.filter(
              (option) =>
                option.value.trim() !== ""
            )
          : [],

      actionTimeout,
    };

    setSavedActions((prev) => [
      ...prev,
      newAction,
    ]);

    // Reset builder
    setAction("START");
    setCustomAction("");
    setHasConfirmation(false);
    setConfirmationTimeout("5");

    setConfirmationOptions([
      {
        id: Date.now(),
        value: "Yes",
      },
      {
        id: Date.now() + 1,
        value: "No",
      },
    ]);

    setActionTimeout("10");
  }

  // ------------------------------------------
  // Delete
  // ------------------------------------------

  function deleteAction(id: number) {
    setSavedActions((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );
  }

  // ------------------------------------------
  // Duplicate
  // ------------------------------------------

  function duplicateAction(
    item: ActionRule
  ) {
    const duplicate = {
      ...item,
      id: Date.now(),

      confirmationOptions:
        item.confirmationOptions.map(
          (option) => ({
            ...option,
            id: Date.now() + Math.random(),
          })
        ),
    };

    setSavedActions((prev) => [
      ...prev,
      duplicate,
    ]);
  }

  // ------------------------------------------
  // Edit
  // ------------------------------------------

  function editAction(item: ActionRule) {
    setAction(item.action);

    setCustomAction(
      item.customAction || ""
    );

    setHasConfirmation(
      item.hasConfirmation
    );

    setConfirmationTimeout(
      item.confirmationTimeout || "5"
    );

    setConfirmationOptions(
      item.confirmationOptions.length
        ? item.confirmationOptions
        : [
            {
              id: Date.now(),
              value: "Yes",
            },
            {
              id: Date.now() + 1,
              value: "No",
            },
          ]
    );

    setActionTimeout(
      item.actionTimeout || "10"
    );

    deleteAction(item.id);
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">

      {/* ======================================
          ACTION BUILDER
      ====================================== */}

      <div className="border rounded-xl p-5 bg-white shadow-sm">

        <h2 className="text-lg font-semibold mb-5">
          Add Action
        </h2>

        {/* ----------------------------------
            Row 1
        ---------------------------------- */}

        <div className="flex flex-wrap items-end gap-4">

          {/* Action */}

          <div className="min-w-[180px]">
            <label className="block text-sm font-medium mb-2">
              Action
            </label>

            <select
              value={action}
              onChange={(e) =>
                setAction(e.target.value)
              }
              className="w-full border rounded-lg px-3 py-2"
            >
              {ACTIONS.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Action */}

          {action === "CUSTOM" && (
            <div className="min-w-[220px]">
              <label className="block text-sm font-medium mb-2">
                Custom action
              </label>

              <input
                value={customAction}
                onChange={(e) =>
                  setCustomAction(
                    e.target.value
                  )
                }
                placeholder="Enter action"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          )}

          {/* Confirmation */}

          <div className="flex items-center gap-2 pb-2">
            <input
              id="confirmation"
              type="checkbox"
              checked={hasConfirmation}
              onChange={(e) =>
                setHasConfirmation(
                  e.target.checked
                )
              }
              className="w-4 h-4"
            />

            <label
              htmlFor="confirmation"
              className="text-sm font-medium"
            >
              Has confirmation?
            </label>
          </div>

          {/* Action timeout */}

          <div className="w-[160px]">
            <label className="block text-sm font-medium mb-2">
              Action timeout
            </label>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={actionTimeout}
                onChange={(e) =>
                  setActionTimeout(
                    e.target.value
                  )
                }
                className="w-full border rounded-lg px-3 py-2"
              />

              <span className="text-sm text-gray-500">
                sec
              </span>
            </div>
          </div>

        </div>

        {/* ======================================
            CONFIRMATION ROW
        ====================================== */}

        {hasConfirmation && (
          <div className="mt-5 border-t pt-5">

            <div className="flex flex-wrap gap-5">

              {/* Confirmation timeout */}

              <div className="w-[180px]">
                <label className="block text-sm font-medium mb-2">
                  Confirmation timeout
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={
                      confirmationTimeout
                    }
                    onChange={(e) =>
                      setConfirmationTimeout(
                        e.target.value
                      )
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />

                  <span className="text-sm text-gray-500">
                    sec
                  </span>
                </div>
              </div>

              {/* Options */}

              <div className="flex-1 min-w-[300px]">

                <label className="block text-sm font-medium mb-2">
                  Confirmation options
                </label>

                <div className="space-y-2">

                  {confirmationOptions.map(
                    (option) => (
                      <div
                        key={option.id}
                        className="flex gap-2"
                      >

                        <input
                          value={option.value}
                          onChange={(e) =>
                            updateConfirmationOption(
                              option.id,
                              e.target.value
                            )
                          }
                          placeholder="e.g. Yes"
                          className="flex-1 border rounded-lg px-3 py-2"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            deleteConfirmationOption(
                              option.id
                            )
                          }
                          className="px-3 border rounded-lg text-red-600 hover:bg-red-50"
                        >
                          −
                        </button>
                      </div>
                    )
                  )}

                  <button
                    type="button"
                    onClick={
                      addConfirmationOption
                    }
                    className="px-3 py-2 border rounded-lg text-sm"
                  >
                    + Add option
                  </button>

                </div>
              </div>

            </div>
          </div>
        )}

        {/* ======================================
            SAVE
        ====================================== */}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={saveAction}
            className="px-6 py-2 rounded-lg bg-black text-white hover:opacity-90"
          >
            Save
          </button>
        </div>

      </div>

      {/* ======================================
          SAVED ACTIONS
      ====================================== */}

      <div className="space-y-3">

        {savedActions.map((item) => (

          <div
            key={item.id}
            className="border rounded-xl p-4 bg-white"
          >

            <div className="flex items-center justify-between gap-4">

              {/* Action information */}

              <div className="flex flex-wrap items-center gap-3">

                <span className="font-semibold">
                  {item.action === "CUSTOM"
                    ? item.customAction
                    : item.action}
                </span>

                {item.hasConfirmation && (
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                    Confirmation
                  </span>
                )}

                <span className="text-sm text-gray-500">
                  Timeout:{" "}
                  {item.actionTimeout}s
                </span>

              </div>

              {/* Actions */}

              <div className="flex items-center gap-2">

                <button
                  type="button"
                  onClick={() =>
                    editAction(item)
                  }
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() =>
                    deleteAction(item.id)
                  }
                  className="px-3 py-1.5 border rounded-lg text-sm text-red-600"
                >
                  Delete
                </button>

                <button
                  type="button"
                  onClick={() =>
                    duplicateAction(item)
                  }
                  className="px-3 py-1.5 border rounded-lg text-sm"
                >
                  Duplicate
                </button>

              </div>

            </div>

            {/* Confirmation details */}

            {item.hasConfirmation && (
              <div className="mt-3 pt-3 border-t text-sm text-gray-600">

                <div>
                  Confirmation timeout:{" "}
                  {item.confirmationTimeout}s
                </div>

                <div className="flex gap-2 mt-2 flex-wrap">
                  {item.confirmationOptions.map(
                    (option) => (
                      <span
                        key={option.id}
                        className="px-2 py-1 border rounded-md"
                      >
                        {option.value}
                      </span>
                    )
                  )}
                </div>

              </div>
            )}

          </div>

        ))}

      </div>

    </div>
  );
}
