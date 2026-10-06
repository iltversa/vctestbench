"use client";

import { useEffect, useState } from "react";

export type ConfirmationChoice = {
    option: string;
    isSelected: boolean;
    id?: string;
};

export type TestAction = {
    id?: string;
    title: string;
    hasConfirmation: boolean;
    confirmationTimeout?: number | null;
    confirmationOptions?: ConfirmationChoice[];
    actionTimeout: number;
    pasteText?: string;
};

const DEFAULT_CONFIRMATION_OPTIONS: ConfirmationChoice[] = [
    { option: "YES", isSelected: true },
];

type TestClass = {
    id: string;
    name: string;
};

type ActionDialogProps = {
    test?: TestAction | null;
    onClose: () => void;
    isDelayNode: boolean;
    onSave?: (action: TestAction) => Promise<void>;
};

export default function ActionDialog({
    test,
    isDelayNode,
    onClose,
    onSave,
}: ActionDialogProps) {
    const isEditing = Boolean(test?.id);
    const [title, setTitle] = useState(test?.title ?? "");
    const [actionTimeout, setActionTimeout] = useState( test?.actionTimeout?.toString() ?? "5" );
    const [pasteText, setPasteText] = useState(test?.pasteText ?? "");
    const [hasConfirmation, setHasConfirmation] = useState(test?.hasConfirmation ?? false);
    const [confirmationTimeout, setConfirmationTimeout] = useState( test?.confirmationTimeout?.toString() ?? "5" );
    const [confirmationOptions, setConfirmationOptions] = useState<ConfirmationChoice[]>(
        test?.confirmationOptions?.length
            ? test.confirmationOptions.map((option) => ({
                  option: option.option,
                  isSelected: Boolean(option.isSelected),
                  id: option.id,
              }))
            : DEFAULT_CONFIRMATION_OPTIONS
    );

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setTitle(test?.title ?? "");
        setActionTimeout(test?.actionTimeout?.toString() ?? "5");
        setPasteText(test?.pasteText ?? "");
        setHasConfirmation(test?.hasConfirmation ?? false);
        setConfirmationTimeout(
            test?.confirmationTimeout?.toString() ?? "5"
        );

        setConfirmationOptions(
            test?.confirmationOptions?.length
                ? test.confirmationOptions.map((option) => ({
                      option: option.option,
                      isSelected: Boolean(option.isSelected),
                      id: option.id,
                  }))
                : DEFAULT_CONFIRMATION_OPTIONS
        );
    }, [test]);

    const addConfirmationOption = () => {
        setConfirmationOptions((current) => [...current, { option: "", isSelected: false }]);
    };

    const removeConfirmationOption = (index: number) => {
        setConfirmationOptions((current) =>
            current.filter((_, optionIndex) => optionIndex !== index)
        );
    };

    const updateConfirmationOption = (
        index: number,
        value: string
    ) => {
        setConfirmationOptions((current) =>
            current.map((option, optionIndex) =>
                optionIndex === index ? { ...option, option: value } : option
            )
        );
    };

    const toggleConfirmationOption = (index: number) => {
        setConfirmationOptions((current) =>
            current.map((option, optionIndex) =>
                optionIndex === index ? { ...option, isSelected: !option.isSelected } : option
            )
        );
    };

    const handleSaveAction = async () => {
        if (!title.trim()) {
            alert("Please enter an action title.");
            return;
        }

        if (
            hasConfirmation &&
            confirmationOptions.some((option) => !option.option.trim())
        ) {
            alert("Please fill in all confirmation options.");
            return;
        }

        const isPasteAction = title.trim().toUpperCase() === "PASTE";
        if (isPasteAction && !pasteText.trim()) {
            alert("Please enter the text to paste.");
            return;
        }

        const payload: TestAction = {
            ...(test?.id ? { id: test.id } : {}),
            title: title.trim(),
            hasConfirmation,
            confirmationTimeout: hasConfirmation
            ? Number(confirmationTimeout)
            : null,

            confirmationOptions: hasConfirmation
            ? confirmationOptions
                .map((option) => ({
                    option: option.option.trim(),
                    isSelected: option.isSelected,
                }))
                .filter((option) => option.option)
            : [],

            actionTimeout: Number(actionTimeout),
            ...(isPasteAction ? { pasteText: pasteText.trim() } : {}),
        };

        try {
            setSaving(true);

            await onSave?.(payload);

            onClose();
        } catch (error) {
            console.error("Failed to save action:", error);
        } finally {
            setSaving(false);
        }
        };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div
                className="w-full max-w-2xl rounded-xl bg-white shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b px-6 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            {isEditing ? "Edit Action" : "Create Action"}
                        </h2>

                        <p className="mt-0.5 text-sm text-gray-500">
                            Configure the action for your test flow.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
                    >
                        ×
                    </button>
                </div>

                {/* Body */}
                <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
                    <div className="space-y-5">

                        {/* Title */}
                           {!isDelayNode && title.trim().toUpperCase() !== "CONFIRMATION" && ( 
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                Action Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(event) => setTitle(event.target.value)}
                                placeholder="e.g. Start workout"
                                disabled={title.trim().toUpperCase() === "PASTE"}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                            />
                        </div>
                            )}

                        {/* Paste Text */}
                        {title.trim().toUpperCase() === "PASTE" && (
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Text to Paste
                                </label>
                                <textarea
                                    value={pasteText}
                                    onChange={(event) => setPasteText(event.target.value)}
                                    placeholder="Enter the text to paste into the input field"
                                    rows={4}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                                />
                            </div>
                        )}


                        {/* Delay */}
                        {isDelayNode && (
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Delay
                                </label>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="0"
                                        value={actionTimeout}
                                        onChange={(event) =>
                                            setActionTimeout(event.target.value)
                                        }
                                        className="w-32 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                                    />

                                    <span className="text-sm text-gray-500">
                                        seconds
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Confirmation */}
                        {title.trim().toUpperCase() === "CONFIRMATION" && (
                            <div className="rounded-lg border border-gray-200 p-4">
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <label className="text-sm font-medium text-gray-700">
                                            Confirmation Options
                                        </label>

                                        <button
                                            type="button"
                                            onClick={addConfirmationOption}
                                            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                                        >
                                            + Add option
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {confirmationOptions.map((option, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-2"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={option.isSelected}
                                                    onChange={() => toggleConfirmationOption(index)}
                                                    className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                                                />

                                                <input
                                                    type="text"
                                                    value={option.option}
                                                    onChange={(event) =>
                                                        updateConfirmationOption(
                                                            index,
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder={`Option ${index + 1}`}
                                                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                                                />

                                                {confirmationOptions.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            removeConfirmationOption(index)
                                                        }
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t bg-gray-50 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-white disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleSaveAction}
                        disabled={saving}
                        className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving
                            ? "Saving..."
                            : isEditing
                                ? "Save Changes"
                                : "Save Action"}
                    </button>
                </div>
            </div>
        </div>
    );
}


