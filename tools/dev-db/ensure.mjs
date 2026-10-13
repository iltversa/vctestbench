// Runs before `npm run dev`: makes sure the local development database is up.
//
// If DATABASE_URL points at this machine and nothing is listening there, the
// database from tools/dev-db is started in the background (it keeps running
// after this script and the terminal are gone) and this waits until it
// answers. A remote DATABASE_URL, or one that is already up, is left alone.

import { spawn } from "node:child_process";
import { existsSync, openSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envFile = path.join(root, ".env");
  if (!existsSync(envFile)) return "";

  const line = readFileSync(envFile, "utf8")
    .split("\n")
    .find((value) => value.startsWith("DATABASE_URL="));

  return line ? line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "") : "";
}

const listening = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
    socket.setTimeout(800, () => (socket.destroy(), resolve(false)));
  });

const url = databaseUrl();
if (!url) process.exit(0);

let target;
try {
  target = new URL(url);
} catch {
  process.exit(0);
}

// Only a database on this machine is ours to start.
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.hostname)) process.exit(0);

const port = Number(target.port) || 5432;
if (await listening(port)) process.exit(0);

// Nothing here was ever set up with tools/dev-db: not ours either.
if (!existsSync(path.join(here, "data")) && !existsSync(path.join(here, "node_modules"))) {
  console.log(`No database is listening on localhost:${port}. Start one, or run: npm run db`);
  process.exit(0);
}

console.log(`Starting the local database on localhost:${port}…`);

const log = openSync(path.join(here, "db.log"), "a");
const child = spawn(process.execPath, [path.join(here, "start.mjs")], {
  cwd: root,
  detached: true,
  stdio: ["ignore", log, log],
});
child.unref();

const started = Date.now();
while (Date.now() - started < 90_000) {
  if (await listening(port)) {
    // Give it a moment to finish accepting connections.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("Database ready.");
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

console.error("The local database did not start in time. See tools/dev-db/db.log");
process.exit(0);
