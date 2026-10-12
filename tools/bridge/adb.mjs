// adb helpers: shell commands and screenshots.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ADB } from "./config.mjs";

const run = promisify(execFile);

export async function adb(...args) {
  const { stdout } = await run(ADB, args, { encoding: "utf8", maxBuffer: 8_000_000 });
  return stdout.trim();
}

// PNG of the current screen, captured on demand. A short cache means several
// viewers (or a viewer and a failing run) share one capture.
let cached = { at: 0, png: null };
let inFlight = null;

export async function screenshot({ maxAgeMs = 700 } = {}) {
  if (cached.png && Date.now() - cached.at < maxAgeMs) return cached.png;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { stdout } = await run(ADB, ["exec-out", "screencap", "-p"], {
        encoding: "buffer",
        maxBuffer: 8_000_000,
      });
      cached = { at: Date.now(), png: stdout };
      return stdout;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

// Base64 for storing with a report; null when too large or unavailable.
export async function screenshotBase64(limit = 2_000_000) {
  const png = await screenshot({ maxAgeMs: 0 });
  if (!png) return null;

  const encoded = png.toString("base64");
  return encoded.length <= limit ? encoded : null;
}
