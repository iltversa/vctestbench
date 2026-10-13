// What is the tablet doing? Polled, and turned into activity events when it
// changes.

import { adb } from "./adb.mjs";
import { SANDBOX_PACKAGE } from "./config.mjs";
import { addEvent, sleep, store } from "./state.mjs";
import { readRoute } from "./webview.mjs";

let previous = { connected: false, sandboxForeground: false, route: "" };

export async function pollDevice() {
  const next = {
    connected: false,
    sandboxForeground: false,
    device: null,
    model: null,
    android: null,
    foregroundPackage: "",
    route: "",
  };

  try {
    const devices = await adb("devices", "-l");
    const line = devices.split("\n").find((value) => /\sdevice\s/.test(value));
    if (!line) throw new Error("not connected");

    next.connected = true;
    next.device = line.trim().split(/\s+/)[0];
    next.model = await adb("shell", "getprop", "ro.product.model");
    next.android = await adb("shell", "getprop", "ro.build.version.release");

    const activities = await adb("shell", "dumpsys", "activity", "activities");
    // Android versions name the resumed activity differently. Only read the
    // active markers, never historical task entries that can include closed apps.
    const match =
      activities.match(/\btopResumedActivity\s*[:=][^\n]*?\s([a-zA-Z0-9._]+)\/[^\s}]+/) ??
      activities.match(/\bmResumedActivity\s*[:=][^\n]*?\s([a-zA-Z0-9._]+)\/[^\s}]+/);

    next.foregroundPackage = match?.[1] ?? "";
    next.sandboxForeground = next.foregroundPackage === SANDBOX_PACKAGE;

    const pid = next.sandboxForeground ? await adb("shell", "pidof", SANDBOX_PACKAGE) : "";
    next.route = await readRoute(pid);
  } catch {
    next.connected = false;
    next.sandboxForeground = false;
    next.route = "";
  }

  store.connection = next;

  if (next.connected !== previous.connected) {
    addEvent(
      next.connected ? "Tablet connected" : "Tablet disconnected",
      next.connected ? `${next.model} authorized through USB debugging` : "USB debugging connection was lost",
      next.connected ? "success" : "warning"
    );
  }

  if (next.connected && next.sandboxForeground !== previous.sandboxForeground) {
    addEvent(
      next.sandboxForeground ? "Sandbox app became visible" : "Sandbox app left foreground",
      next.sandboxForeground
        ? "Android confirms Sandbox is the active app"
        : `Foreground app: ${next.foregroundPackage || "unknown"}`
    );
  }

  if (next.connected && next.route && next.route !== previous.route) {
    addEvent(
      next.route === "/home" ? "Home screen is visible" : `Screen changed to ${next.route}`,
      `WebView route confirmed: ${next.route}`,
      "success"
    );
  }

  previous = {
    connected: next.connected,
    sandboxForeground: next.sandboxForeground,
    route: next.route,
  };
}

// Brings the Sandbox app to the front on its Home screen.
export async function launchSandbox() {
  if (!store.connection.connected) {
    throw new Error("The tablet is not connected");
  }

  if (!store.connection.sandboxForeground) {
    await adb("shell", "monkey", "-p", SANDBOX_PACKAGE, "-c", "android.intent.category.LAUNCHER", "1");

    const started = Date.now();
    while (Date.now() - started < 10_000 && !store.connection.sandboxForeground) {
      await sleep(350);
    }
  }

  if (!store.connection.sandboxForeground) {
    throw new Error("Sandbox could not be brought to the foreground");
  }

  const routeStarted = Date.now();
  while (Date.now() - routeStarted < 10_000 && store.connection.route !== "/home") {
    await sleep(350);
  }

  if (store.connection.route !== "/home") {
    throw new Error(
      `Sandbox opened but Home was not detected. Current route: ${store.connection.route || "unknown"}`
    );
  }

  addEvent("Sandbox launched", "App is in the foreground and Home is confirmed", "success");
}
