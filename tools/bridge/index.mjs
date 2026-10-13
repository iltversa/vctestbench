// VC TestBench bridge: drives the Sandbox app on a USB-connected tablet.
//
//   npm run bridge
//
// Modules: config (settings) · state (shared store) · adb · webview (DevTools)
// · device (connection polling) · runner (flow engine) · server (HTTP API).

// The bridge talks to the tablet's WebView over a WebSocket. Node only has one
// built in from 22 (20.10+ behind --experimental-websocket, which `npm run
// bridge` passes). Without it every step that touches the screen would fail
// halfway through a run with "WebSocket is not defined".
if (typeof WebSocket === "undefined") {
  console.error(
    "This Node.js has no built-in WebSocket. Start the bridge with `npm run bridge`, " +
      "or use Node 22 (nvm use 22)."
  );
  process.exit(1);
}

const { POLL_INTERVAL_MS } = await import("./config.mjs");
const { pollDevice } = await import("./device.mjs");
const { startServer } = await import("./server.mjs");

startServer();

// Polls never overlap: a slow adb call must not stack up behind itself.
let polling = false;

const tick = async () => {
  if (polling) return;
  polling = true;

  try {
    await pollDevice();
  } catch (error) {
    console.error("[bridge] poll failed:", error);
  } finally {
    polling = false;
  }
};

tick();
setInterval(tick, POLL_INTERVAL_MS);
