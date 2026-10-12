// The script injected into the Sandbox page while recording. It only watches:
// real (trusted) taps and edits are queued, and the bridge drains the queue.
// Password values never leave the page: only the fact that one was typed.
//
// Written as a string so it can be sent through DevTools as-is. Installing it
// twice is harmless, which is how a page reload is survived: the bridge
// installs it again on its next poll.

export const RECORDER_SCRIPT = `(() => {
  if (window.__vcRec) return window.__vcRec.drain();

  const queue = [];
  const clean = (value) => String(value ?? "").replace(/\\s+/g, " ").trim();
  const CLICKABLE =
    'button,a,[role=button],[role=tab],[role=menuitem],[role=option],[role=link],' +
    'input[type=submit],input[type=button],summary,label,li,[onclick]';
  const FIELDS =
    'input:not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]),textarea,select';

  const labelOf = (element) => {
    for (let el = element, depth = 0; el && depth < 4; el = el.parentElement, depth += 1) {
      const text =
        clean(el.getAttribute && el.getAttribute("aria-label")) ||
        clean((el.innerText || "").split("\\n").find((line) => clean(line))) ||
        clean(el.value) ||
        clean(el.title) ||
        clean(el.querySelector && el.querySelector("img[alt]")?.alt);

      if (text) return text.slice(0, 60);
    }

    return "";
  };

  const onClick = (event) => {
    if (!event.isTrusted) return;

    const target = event.target;
    if (!(target instanceof Element)) return;
    // Focusing a field is not a step; what is typed in it is.
    if (target.closest(FIELDS)) return;

    const element = target.closest(CLICKABLE) || target;

    queue.push({
      kind: "click",
      label: labelOf(element),
      isSave: Boolean(target.closest("#data-save")),
    });
  };

  const onChange = (event) => {
    if (!event.isTrusted) return;

    const el = event.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    if (["checkbox", "radio", "submit", "button", "file"].includes(el.type)) return;

    const password = el.type === "password";

    queue.push({
      kind: "input",
      password,
      value: password ? "" : el.value,
      field: clean(el.getAttribute("aria-label") || el.placeholder || el.name || el.id || el.type),
    });
  };

  document.addEventListener("click", onClick, true);
  document.addEventListener("change", onChange, true);

  window.__vcRec = {
    drain: () => queue.splice(0),
    stop: () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
      delete window.__vcRec;
    },
  };

  return [];
})()`;

export const STOP_RECORDER_SCRIPT = `(() => { window.__vcRec && window.__vcRec.stop(); return true; })()`;
