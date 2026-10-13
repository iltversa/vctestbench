// A local PostgreSQL for development, for when none is installed.
//
//   npm run db          (installs itself on first use)
//
// It listens where DATABASE_URL in .env says, keeps its data in tools/dev-db/data
// (so it survives a reboot) and applies the SQL migrations the first time.
// Leave it running; Ctrl+C stops it cleanly.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");

// DATABASE_URL from the environment, else from .env.
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envFile = path.join(root, ".env");
  if (!existsSync(envFile)) return "";

  const line = readFileSync(envFile, "utf8")
    .split("\n")
    .find((value) => value.startsWith("DATABASE_URL="));

  return line ? line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "") : "";
}

const url = databaseUrl();

if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env, for example:");
  console.error("  DATABASE_URL=postgres://postgres:postgres@localhost:54329/vctestbench");
  process.exit(1);
}

const target = new URL(url);

if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(target.hostname)) {
  console.error(`DATABASE_URL points at ${target.hostname}, not this machine. Nothing to start.`);
  process.exit(1);
}

const user = decodeURIComponent(target.username) || "postgres";
const password = decodeURIComponent(target.password) || "postgres";
const port = Number(target.port) || 5432;
const database = target.pathname.replace(/^\//, "") || "vctestbench";
const dataDir = path.join(here, "data");

const { default: EmbeddedPostgres } = await import("embedded-postgres");
const { default: postgres } = await import(path.join(root, "node_modules/postgres/src/index.js"));

const server = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: true,
  onLog: () => {},
  onError: (message) => console.error(String(message).trim()),
});

if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
  console.log("Creating the database for the first time…");
  await server.initialise();
}

await server.start();

// The database and its tables, only when they are not there yet.
const admin = postgres({ host: "127.0.0.1", port, user, password, database: "postgres", max: 1 });
const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${database}`;
if (exists.length === 0) await admin.unsafe(`CREATE DATABASE "${database.replace(/"/g, '""')}"`);
await admin.end();

const db = postgres({ host: "127.0.0.1", port, user, password, database, max: 1, onnotice: () => {} });
const [{ present }] = await db`SELECT to_regclass('public.tests') IS NOT NULL AS present`;

if (!present) {
  // 0009 deletes legacy tables and is optional: never applied automatically.
  const files = readdirSync(path.join(root, "db/migrations"))
    .filter((name) => name.endsWith(".sql") && !name.startsWith("0009_"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(path.join(root, "db/migrations", file), "utf8");

    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await db.unsafe(statement);
    }
  }

  console.log(`Applied ${files.length} migrations.`);
}

await db.end();

console.log(`Database ready on localhost:${port} (${database}). Data: tools/dev-db/data. Ctrl+C stops it.`);

const stop = async () => {
  try {
    await server.stop();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

// Stay alive while the server runs.
setInterval(() => {}, 1 << 30);
