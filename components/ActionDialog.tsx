"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faStop, faCheck, faPaste, faTimes } from "@fortawesome/free-solid-svg-icons";
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
    pasteText?: string | null;
    email?: string | null;
    password?: string | null;
    type?: string | null;
    icon?: string | null;
    clickOnText?: string | null;
    route?: string | null;
    routeMode?: "check" | "go" | null;
    condition?: IfCondition | null;
};

// What an IF step looks at on the tablet.
export type IfCondition = {
    kind: "text" | "route" | "user" | "script";
    text?: string | null;
    route?: string | null;
    field?: string | null;
    value?: string | null;
    script?: string | null;
    operator?: string | null;
};

// "home", "/home/" and "/home?x=1" all mean /home.
export function normalizeRoute(value: string): string {
    const path = value.trim().split(/[?#]/)[0];
    if (!path) return "";

    const withSlash = path.startsWith("/") ? path : `/${path}`;
    return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

const DEFAULT_CONFIRMATION_OPTIONS: ConfirmationChoice[] = [
    { option: "YES", isSelected: true },
];

type ActionDialogProps = {
    test?: TestAction | null;
    onClose: () => void;
    // isDelayNode: boolean;
    onSave?: (action: TestAction) => Promise<void>;
};

export default function ActionDialog({
    test,
    // isDelayNode,
    onClose,
    onSave,
}: ActionDialogProps) {
    // const isEditing = Boolean(test?.id);
    const isEditingAction = test?.type !== 'isEditingAction';
    const [title, setTitle] = useState(test?.title ?? "");
    const [actionTimeout, setActionTimeout] = useState(test?.actionTimeout?.toString() ?? "5");
    const [email, setEmail] = useState(test?.email ?? "");
    const [clickOnText, setClickOnText] = useState(test?.clickOnText ?? "");
    const [route, setRoute] = useState(test?.route ?? "");
    const [routeMode, setRouteMode] = useState<"check" | "go">(test?.routeMode === "go" ? "go" : "check");
    const [condKind, setCondKind] = useState<IfCondition["kind"]>(test?.condition?.kind ?? "user");
    const [condText, setCondText] = useState(test?.condition?.text ?? "");
    const [condRoute, setCondRoute] = useState(test?.condition?.route ?? "");
    const [condField, setCondField] = useState(test?.condition?.field ?? "");
    const [condValue, setCondValue] = useState(test?.condition?.value ?? "");
    const [condScript, setCondScript] = useState(test?.condition?.script ?? "");
    const [condOperator, setCondOperator] = useState(test?.condition?.operator ?? "");
    const [password, setPassword] = useState(test?.password ?? "");
    const [icon, setIcon] = useState(test?.icon ?? "");
    const [pasteText, setPasteText] = useState(test?.pasteText ?? "");
    const [hasConfirmation] = useState(test?.hasConfirmation ?? false);
    const [confirmationTimeout] = useState(test?.confirmationTimeout?.toString() ?? "5");
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

    // The fields above are initialised from `test` when the dialog opens. They
    // are deliberately NOT re-synced when the parent re-renders: the editor
    // re-renders whenever the tablet status changes, and doing so here wiped
    // whatever the user had typed.

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

    const toggleConfirmationOption = (selectedIndex: number) => {
        setConfirmationOptions((prev) =>
            prev.map((option, index) => ({
                ...option,
                isSelected: index === selectedIndex,
            }))
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
        const isRouteAction = title.trim().toUpperCase() === "ROUTE";
        const routePath = normalizeRoute(route);
        if (isRouteAction && !routePath) {
            alert("Enter the page route, for example /home.");
            return;
        }
        const isIfAction = title.trim().toUpperCase() === "IF";
        let condition: IfCondition | null = null;
        if (isIfAction) {
            if (condKind === "text") {
                if (!condText.trim()) { alert("Enter the text to look for on the screen."); return; }
                condition = { kind: "text", text: condText.trim(), operator: condOperator === "hidden" ? "hidden" : "visible" };
            } else if (condKind === "route") {
                if (!normalizeRoute(condRoute)) { alert("Enter the page route, for example /home."); return; }
                condition = { kind: "route", route: normalizeRoute(condRoute), operator: condOperator === "is not" ? "is not" : "is" };
            } else if (condKind === "script") {
                if (!condScript.trim()) { alert("Enter the JavaScript expression."); return; }
                condition = { kind: "script", script: condScript.trim() };
            } else {
                const operator = condOperator || "equals";
                if (!condField.trim()) { alert("Enter the user field, for example subscription.status."); return; }
                if (!["exists", "missing"].includes(operator) && !condValue.trim()) { alert("Enter the value to compare with."); return; }
                condition = {
                    kind: "user",
                    field: condField.trim(),
                    operator,
                    value: ["exists", "missing"].includes(operator) ? null : condValue.trim(),
                };
            }
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
            email: email || null,
            password: password || null,
            icon: icon || null,
            clickOnText: clickOnText || null,
            route: isRouteAction ? routePath : null,
            routeMode: isRouteAction ? routeMode : null,
            condition,
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
                            {isEditingAction ? "Add Action" : "Edit Action"}
                        </h2>

                        <p className="mt-0.5 text-sm text-gray-500">
                            {isEditingAction ? "Configure the action for your test flow." : "Edit the action details."}
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
                        {!isEditingAction && (
                            <>
                                <div>
                                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                        Action Title
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(event) => setTitle(event.target.value)}
                                        placeholder="e.g. Start workout"
                                        disabled
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Icon
                                    </label>

                                    <div className="grid grid-cols-6 gap-2 rounded-md border border-slate-300 p-2">
                                        {[
                                            { name: "faUser", icon: faUser },
                                            { name: "faTimes", icon: faTimes },
                                            { name: "faStop", icon: faStop },
                                            { name: "faCheck", icon: faCheck },
                                            { name: "faPaste", icon: faPaste }
                                        ].map((item) => (
                                            <button
                                                key={item.name}
                                                type="button"
                                                onClick={() => setIcon(item.name)}
                                                title={item.name}
                                                className={`flex h-10 items-center justify-center rounded-md border transition ${icon === item.name
                                                        ? "border-blue-500 bg-blue-50 text-blue-600"
                                                        : "border-slate-200 hover:bg-slate-50"
                                                    }`}
                                            >
                                                <FontAwesomeIcon icon={item.icon || icon} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Paste Text */}
                        {isEditingAction && title.trim().toUpperCase() === "PASTE" && (
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
                        {/* Paste Text */}
                        {isEditingAction && title.trim().toUpperCase() === "CLICK" && (
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Action to be Clicked
                                </label>
                                <input
                                    type="text"
                                    value={clickOnText}
                                    onChange={(event) => setClickOnText(event.target.value)}
                                    placeholder="Start"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                                />
                            </div>
                        )}
                        {/* If */}
                        {isEditingAction && title.trim().toUpperCase() === "IF" && (
                            <div className="space-y-3">
                                <div>
                                    <label htmlFor="if-kind" className="mb-1.5 block text-sm font-medium text-gray-700">
                                        What to check
                                    </label>
                                    <select
                                        id="if-kind"
                                        value={condKind}
                                        onChange={(event) => {
                                            setCondKind(event.target.value as IfCondition["kind"]);
                                            setCondOperator("");
                                        }}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                                    >
                                        <option value="user">The signed-in user (role, subscription, profile)</option>
                                        <option value="text">Text on the screen</option>
                                        <option value="route">The page the tablet is on</option>
                                        <option value="script">Custom JavaScript</option>
                                    </select>
                                </div>

                                {condKind === "user" && (
                                    <>
                                        <div>
                                            <label htmlFor="if-field" className="mb-1.5 block text-sm font-medium text-gray-700">
                                                User field
                                            </label>
                                            <input
                                                id="if-field"
                                                type="text"
                                                value={condField}
                                                onChange={(event) => setCondField(event.target.value)}
                                                placeholder="subscription.status"
                                                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                                            />
                                            <p className="mt-1.5 text-xs text-gray-600">
                                                A path in the signed-in user, such as subscription.status,
                                                subscription.tier, subscription.hasPayment or profile.country.
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <select
                                                aria-label="Comparison"
                                                value={condOperator || "equals"}
                                                onChange={(event) => setCondOperator(event.target.value)}
                                                className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                                            >
                                                <option value="equals">is</option>
                                                <option value="not equals">is not</option>
                                                <option value="contains">contains</option>
                                                <option value="exists">is filled in</option>
                                                <option value="missing">is empty or missing</option>
                                            </select>
                                            {!["exists", "missing"].includes(condOperator || "equals") && (
                                                <input
                                                    type="text"
                                                    aria-label="Value"
                                                    value={condValue}
                                                    onChange={(event) => setCondValue(event.target.value)}
                                                    placeholder="true"
                                                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                                                />
                                            )}
                                        </div>
                                    </>
                                )}

                                {condKind === "text" && (
                                    <div className="flex gap-3">
                                        <select
                                            aria-label="Comparison"
                                            value={condOperator || "visible"}
                                            onChange={(event) => setCondOperator(event.target.value)}
                                            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                                        >
                                            <option value="visible">is shown</option>
                                            <option value="hidden">is not shown</option>
                                        </select>
                                        <input
                                            type="text"
                                            aria-label="Text"
                                            value={condText}
                                            onChange={(event) => setCondText(event.target.value)}
                                            placeholder="Upgrade to premium"
                                            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                                        />
                                    </div>
                                )}

                                {condKind === "route" && (
                                    <div className="flex gap-3">
                                        <select
                                            aria-label="Comparison"
                                            value={condOperator || "is"}
                                            onChange={(event) => setCondOperator(event.target.value)}
                                            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                                        >
                                            <option value="is">is</option>
                                            <option value="is not">is not</option>
                                        </select>
                                        <input
                                            type="text"
                                            aria-label="Page route"
                                            value={condRoute}
                                            onChange={(event) => setCondRoute(event.target.value)}
                                            placeholder="/home"
                                            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                                        />
                                    </div>
                                )}

                                {condKind === "script" && (
                                    <div>
                                        <label htmlFor="if-script" className="mb-1.5 block text-sm font-medium text-gray-700">
                                            JavaScript expression
                                        </label>
                                        <textarea
                                            id="if-script"
                                            rows={3}
                                            value={condScript}
                                            onChange={(event) => setCondScript(event.target.value)}
                                            placeholder="Meteor.user().subscription.tier >= 2"
                                            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-black focus:ring-1 focus:ring-black"
                                        />
                                        <p className="mt-1.5 text-xs text-gray-600">
                                            One expression that is true or false. It runs on the tablet&apos;s page.
                                        </p>
                                    </div>
                                )}

                                <p className="text-xs text-gray-600">
                                    If it is true the flow continues under <strong>If yes</strong>, otherwise under{" "}
                                    <strong>Otherwise</strong>.
                                </p>
                            </div>
                        )}
                        {/* Route */}
                        {isEditingAction && title.trim().toUpperCase() === "ROUTE" && (
                            <div>
                                <label htmlFor="route-path" className="mb-1.5 block text-sm font-medium text-gray-700">
                                    Page route
                                </label>
                                <input
                                    id="route-path"
                                    type="text"
                                    value={route}
                                    onChange={(event) => setRoute(event.target.value)}
                                    placeholder="/home"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-black focus:ring-1 focus:ring-black"
                                />
                                <p className="mt-1.5 text-xs text-gray-600">
                                    The page, such as /home or /loginTS.
                                </p>
                                <fieldset className="mt-3 space-y-2">
                                    <legend className="mb-1 text-sm font-medium text-gray-700">
                                        If the tablet is on another page
                                    </legend>
                                    <label className="flex items-start gap-2 text-sm text-gray-800">
                                        <input
                                            type="radio"
                                            name="route-mode"
                                            checked={routeMode === "check"}
                                            onChange={() => setRouteMode("check")}
                                            className="mt-1 h-4 w-4"
                                        />
                                        <span>
                                            <strong>Check only.</strong> Wait for the tablet to get there, and fail if
                                            it does not.
                                        </span>
                                    </label>
                                    <label className="flex items-start gap-2 text-sm text-gray-800">
                                        <input
                                            type="radio"
                                            name="route-mode"
                                            checked={routeMode === "go"}
                                            onChange={() => setRouteMode("go")}
                                            className="mt-1 h-4 w-4"
                                        />
                                        <span>
                                            <strong>Go to it.</strong> Open the page, then check the tablet is there.
                                            Skips tapping through the app.
                                        </span>
                                    </label>
                                </fieldset>
                            </div>
                        )}
                        {/* Delay */}
                        {isEditingAction && title.trim().toUpperCase() === "DELAY" && (
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
                        {isEditingAction && title.trim().toUpperCase() === "CONFIRMATION" && (
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
                                                    type="radio"
                                                    name="confirmation-option"
                                                    checked={option.isSelected}
                                                    onChange={() => toggleConfirmationOption(index)}
                                                    className="h-4 w-4 border-gray-300 text-black focus:ring-black"
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
                                                        onClick={() => removeConfirmationOption(index)}
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
                        {isEditingAction && title?.trim().toUpperCase() === "AUTHENTICATION" && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email ?? ""}
                                        onChange={(event) =>
                                            setEmail(event.target.value)
                                        }
                                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                                        placeholder="Enter email"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password ?? ""}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                                        placeholder="Enter password"
                                    />
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
                            : isEditingAction
                                ? "Save Changes"
                                : "Save Action"}
                    </button>
                </div>
            </div>
        </div>
    );
}


