"use client";

import { getTestClassesAction } from "@/actions/get-classes";
import { useEffect, useState } from "react";

export type TestAction = {
    id?: string;
    title: string;
    hasConfirmation: boolean;
    confirmationTimeout?: number | null;
    confirmationOptions?: string[];
    // sortOrder: number;
    actionTimeout: number;
};

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

const DEFAULT_CONFIRMATION_OPTIONS = ["YES"];

export default function ActionDialog({
    test,
    isDelayNode,
    onClose,
    onSave,
}: ActionDialogProps) {
    const isEditing = Boolean(test?.id);

    const [classes, setClasses] = useState<TestClass[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(true);
    const [title, setTitle] = useState(test?.title ?? "");
    const [actionTimeout, setActionTimeout] = useState(
        test?.actionTimeout?.toString() ?? "5"
    );

    const [hasConfirmation, setHasConfirmation] = useState(
        test?.hasConfirmation ?? false
    );

    const [confirmationTimeout, setConfirmationTimeout] = useState(
        test?.confirmationTimeout?.toString() ?? "5"
    );

    const [confirmationOptions, setConfirmationOptions] = useState<string[]>(
        test?.confirmationOptions?.length
            ? test.confirmationOptions
            : DEFAULT_CONFIRMATION_OPTIONS
    );

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setTitle(test?.title ?? "");
        setActionTimeout(test?.actionTimeout?.toString() ?? "5");
        setHasConfirmation(test?.hasConfirmation ?? false);
        setConfirmationTimeout(
            test?.confirmationTimeout?.toString() ?? "5"
        );

        setConfirmationOptions(
            test?.confirmationOptions?.length
                ? test.confirmationOptions
                : DEFAULT_CONFIRMATION_OPTIONS
        );
    }, [test]);

    const addConfirmationOption = () => {
        setConfirmationOptions((current) => [...current, ""]);
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
                optionIndex === index ? value : option
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
            confirmationOptions.some((option) => !option.trim())
        ) {
            alert("Please fill in all confirmation options.");
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
                .map((option) => option.trim())
                .filter(Boolean)
            : [],

            actionTimeout: Number(actionTimeout),
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
                                                    type="text"
                                                    value={option}
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


