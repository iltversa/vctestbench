// Turns what the bridge recorded on the tablet into a flow the editor can show.
// Pure: steps in, nodes out.

import type { FlowNode, TestActionDefinition } from "../TestFlowBuilder";

export type RecordedStep = {
  id: number;
  action: "CLICK" | "PASTE" | "AUTHENTICATION" | "SAVE";
  // CLICK: the text tapped. PASTE: the text typed.
  text?: string;
  email?: string;
  // A password was typed. Its value is never recorded.
  hasPassword?: boolean;
  // A tap on something with no readable text.
  unlabeled?: boolean;
};

// One step per recorded action, in order, ending in the empty slot every chain
// ends with. The built-in action of the same title is used when there is one,
// so the saved flow points at the same library entry as a hand-made step.
export function flowFromRecording(steps: RecordedStep[], library: TestActionDefinition[]): FlowNode[] {
  const byTitle = new Map(library.map((action) => [action.title.trim().toUpperCase(), action]));

  let tail: FlowNode[] = [{ id: crypto.randomUUID(), nodeType: "action", paths: [] }];

  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    const base = byTitle.get(step.action);

    const actionData: TestActionDefinition = {
      id: base?.id ?? crypto.randomUUID(),
      title: step.action,
      hasConfirmation: false,
      confirmationTimeout: null,
      actionTimeout: base?.actionTimeout ?? 5,
      icon: base?.icon ?? null,
      confirmationOptions: [],
      clickOnText: step.action === "CLICK" ? step.text ?? "" : null,
      pasteText: step.action === "PASTE" ? step.text ?? "" : null,
      email: step.action === "AUTHENTICATION" ? step.email ?? "" : null,
      password: step.action === "AUTHENTICATION" ? "" : null,
    };

    tail = [
      {
        id: crypto.randomUUID(),
        nodeType: "action",
        actionId: actionData.id,
        actionTitle: actionData.title,
        actionData,
        paths: tail,
      },
    ];
  }

  return tail;
}

// What the person still has to do by hand after a recording.
export function recordingTodos(steps: RecordedStep[]): string[] {
  const todos: string[] = [];

  const unlabeled = steps.filter((step) => step.action === "CLICK" && !step.text).length;
  if (unlabeled > 0) {
    todos.push(
      `${unlabeled} ${unlabeled === 1 ? "tap has" : "taps have"} no text to find on screen: open ${unlabeled === 1 ? "it" : "them"} and enter the button's text.`
    );
  }

  if (steps.some((step) => step.action === "AUTHENTICATION")) {
    todos.push("Passwords are never recorded: open the sign-in step and enter the password.");
  }

  return todos;
}
