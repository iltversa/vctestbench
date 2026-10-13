// Talking to the Sandbox app's WebView over Chrome DevTools (forwarded by adb).
//
// clickTextAround and clickSaveButton are the proven DOM routines from the
// original bridge and are kept as they were; only how they find the socket
// changed.

import { adb } from "./adb.mjs";
import { DEVTOOLS_PORT, debug } from "./config.mjs";

let forwardedPid = "";

// The DevTools socket of the page that is showing.
export async function webviewSocketUrl() {
  let pages;

  try {
    pages = await fetch(`http://127.0.0.1:${DEVTOOLS_PORT}/json`).then((r) => r.json());
  } catch {
    throw new Error("WebView DevTools unavailable");
  }

  const page = pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl) ?? pages[0];

  if (!page?.webSocketDebuggerUrl) {
    throw new Error("WebView DevTools unavailable");
  }

  return page.webSocketDebuggerUrl;
}

// Runs a script in the page and returns its value.
export async function evaluate(expression, timeoutMs = 4000) {
  const url = await webviewSocketUrl();

  return await new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("WebView action timeout"));
    }, timeoutMs);

    socket.onopen = () =>
      socket.send(
        JSON.stringify({
          id: 2,
          method: "Runtime.evaluate",
          params: { returnByValue: true, expression },
        })
      );

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 2) return;

      clearTimeout(timer);
      socket.close();
      resolve(message.result?.result?.value);
    };

    socket.onerror = () => {
      clearTimeout(timer);
      reject(new Error("WebView action error"));
    };
  });
}

// The route (path) the Sandbox app is on. Re-forwards the DevTools port only
// when the app's process changed, instead of on every poll.
export async function readRoute(pid) {
  if (!pid) return "";

  try {
    if (forwardedPid !== pid) {
      await adb("forward", "--remove", `tcp:${DEVTOOLS_PORT}`).catch(() => {});
      await adb("forward", `tcp:${DEVTOOLS_PORT}`, `localabstract:webview_devtools_remote_${pid}`);
      forwardedPid = pid;
    }

    const response = await fetch(`http://127.0.0.1:${DEVTOOLS_PORT}/json/list`, { cache: "no-store" });
    if (!response.ok) throw new Error(`DevTools HTTP ${response.status}`);

    const pages = await response.json();
    const page = pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl);

    return page ? new URL(page.url).pathname : "";
  } catch (error) {
    forwardedPid = "";
    debug("route read failed:", error?.message || error);
    return "";
  }
}

export async function clickSaveButton() {
  const url = await webviewSocketUrl();

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const timer = setTimeout(() => {
      ws.close();
      reject(
        new Error("Timeout waiting for SAVE")
      );
    }, 10000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          returnByValue: true,
          expression: `
            (() => {

              const save =
                document.getElementById("data-save");

              if (!save) {
                return {
                  success: false,
                  reason: "data-save not currently in DOM"
                };
              }

              const text =
                (
                  save.innerText ||
                  save.textContent ||
                  ""
                ).trim();

              try {
                save.click();

                return {
                  success: true,
                  text,
                  tag: save.tagName,
                  id: save.id,
                  className:
                    save.className || ""
                };

              } catch (error) {

                return {
                  success: false,
                  reason:
                    "SAVE exists but click failed: " +
                    error.message
                };
              }

            })()
          `
        }
      }));
    };

    ws.onmessage = event => {
      const message = JSON.parse(event.data);

      if (message.id !== 1) return;

      clearTimeout(timer);
      ws.close();

      return resolve(
        message.result?.result?.value
      );
    };

    ws.onerror = () => {
      clearTimeout(timer);
      ws.close();

      reject(
        new Error("WebView SAVE click error")
      );
    };
    
  });
}

export async function clickTextAround(targetText) {
  const url = await webviewSocketUrl();

  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(url);

    const timer = setTimeout(() => {
      ws.close();
      reject(
        new Error(`Timeout looking for "${targetText}"`)
      );
    }, 5000);

    ws.onopen = () => {

      ws.send(JSON.stringify({
        id: 1,
        method: "Runtime.evaluate",
        params: {
          returnByValue: true,
          expression: `
            (() => {

              const target = ${JSON.stringify(targetText)}
                .trim()
                .toLowerCase();

              function isClickable(el) {
                if (!el) return false;

                const tag = el.tagName?.toLowerCase();

                if (
                  tag === "button" ||
                  tag === "a" ||
                  tag === "input"
                ) {
                  return true;
                }

                if (
                  el.classList?.contains("monument-item")
                ) {
                  return true;
                }

                if (typeof el.onclick === "function") {
                  return true;
                }

                if (
                  el.getAttribute("role") === "button"
                ) {
                  return true;
                }

                if (
                  el.hasAttribute("data-button") ||
                  el.hasAttribute("data-action")
                ) {
                  return true;
                }

                // Other signs that something answers to a tap.
                if (
                  tag === "summary" ||
                  tag === "label" ||
                  el.hasAttribute("onclick") ||
                  typeof el.onmousedown === "function" ||
                  typeof el.onpointerdown === "function" ||
                  typeof el.ontouchstart === "function" ||
                  ["tab", "menuitem", "option", "link", "switch", "checkbox"].includes(
                    el.getAttribute("role")
                  )
                ) {
                  return true;
                }

                const style = window.getComputedStyle(el);

                if (style.cursor === "pointer") {
                  return true;
                }

                return false;
              }

              // -----------------------------------------
              // FIND TEXT
              // -----------------------------------------

              let textElement = null;

              for (
                const el of document.querySelectorAll("*")
              ) {

                const raw =
                  el.innerText ||
                  el.textContent ||
                  "";

                const text =
                  raw.trim().toLowerCase();

                if (!text) continue;

                if (
                  text === target ||
                  text.startsWith(target)
                ) {

                  let hasSmallerMatch = false;

                  for (
                    const child of el.querySelectorAll("*")
                  ) {

                    const childRaw =
                      child.innerText ||
                      child.textContent ||
                      "";

                    const childText =
                      childRaw.trim().toLowerCase();

                    if (
                      childText === target ||
                      childText.startsWith(target)
                    ) {
                      hasSmallerMatch = true;
                      break;
                    }
                  }

                  if (!hasSmallerMatch) {
                    textElement = el;
                    break;
                  }
                }
              }

              // -----------------------------------------
              // NOT FOUND
              // -----------------------------------------

              if (!textElement) {
                return {
                  success: false,
                  reason:
                    'Text "' +
                    target +
                    '" was not found'
                };
              }

              // -----------------------------------------
              // FIND CLICKABLE PARENT
              // -----------------------------------------

              let current = textElement;
              let clickedElement = null;

              const parentChain = [];

              while (
                current &&
                current !== document.documentElement
              ) {

                parentChain.push({
                  tag: current.tagName,
                  id: current.id || "",
                  className:
                    typeof current.className === "string"
                      ? current.className
                      : "",
                  text:
                    (
                      current.innerText ||
                      current.textContent ||
                      ""
                    ).trim()
                });

                if (isClickable(current)) {
                  clickedElement = current;
                  break;
                }

                current = current.parentElement;
              }

              // Nothing around the text looks clickable: that is not proof
              // it is not. A handler is often on a plain wrapper (attached by
              // the framework, no pointer cursor, no role), and a tap on the
              // label reaches it by bubbling. So tap the label itself, the
              // way a finger would, rather than fail.
              const viaLabel = !clickedElement;

              if (viaLabel) {
                clickedElement = textElement;
              }

              // -----------------------------------------
              // SCROLL
              // -----------------------------------------

              try {
                clickedElement.scrollIntoView({
                  block: "center",
                  inline: "center"
                });
              } catch (_) {}

              // -----------------------------------------
              // ELEMENT BEFORE CLICK
              // -----------------------------------------

              const beforeRect =
                clickedElement.getBoundingClientRect();

              const before = {
                tag: clickedElement.tagName,
                id: clickedElement.id || "",
                className:
                  typeof clickedElement.className === "string"
                    ? clickedElement.className
                    : "",

                text:
                  (
                    clickedElement.innerText ||
                    clickedElement.textContent ||
                    ""
                  ).trim(),

                rect: {
                  x: beforeRect.x,
                  y: beforeRect.y,
                  width: beforeRect.width,
                  height: beforeRect.height
                }
              };

              // -----------------------------------------
              // ACTUAL CLICK
              // -----------------------------------------

              if (viaLabel) {
                // The events of a real tap, in order, all bubbling.
                for (const type of [
                  "pointerdown",
                  "mousedown",
                  "pointerup",
                  "mouseup",
                ]) {
                  const EventType = type.startsWith("pointer")
                    ? PointerEvent
                    : MouseEvent;

                  clickedElement.dispatchEvent(
                    new EventType(type, {
                      bubbles: true,
                      cancelable: true,
                      view: window,
                    })
                  );
                }
              }

              clickedElement.click();

              // -----------------------------------------
              // RETURN RESULT
              // -----------------------------------------

              return {
                success: true,

                viaLabel,

                target,

                before,

                clickedTag:
                  clickedElement.tagName,

                clickedId:
                  clickedElement.id || "",

                clickedClass:
                  typeof clickedElement.className === "string"
                    ? clickedElement.className
                    : "",

                clickedText:
                  (
                    clickedElement.innerText ||
                    clickedElement.textContent ||
                    ""
                  ).trim(),

                parentChain
              };

            })()
          `
        }
      }));
    };

    ws.onmessage = event => {
  const message = JSON.parse(event.data);

  debug("devtools response:", JSON.stringify(message));

  if (message.id !== 1) {
    return;
  }

  clearTimeout(timer);

  if (message.error) {
    ws.close();

    reject(
      new Error(
        message.error.message ||
        "Runtime.evaluate failed"
      )
    );

    return;
  }

  const result = message.result?.result?.value;

  ws.close();

  if (result?.success) {
    // { success, viaLabel, ... }: whether the label itself was tapped because
    // nothing around it looked clickable.
    resolve(result);
  } else {
    reject(
      new Error(
        result?.reason ||
        `Unable to click "${targetText}"`
      )
    );
  }
};

    ws.onerror = () => {
      clearTimeout(timer);
      ws.close();

      reject(
        new Error("WebView click error")
      );
    };
  });
}
