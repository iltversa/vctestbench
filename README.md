# VC TestBench

A web UI for building automated test flows and running them on a VersaClimber
tablet. You design a flow (paste text, tap a button, wait, confirm, sign in),
save it, and the local **bridge** drives the tablet's Sandbox app over `adb`.

```
browser (this app, :3000)  ──►  bridge (tools/vc-bridge.mjs, :3131)  ──►  adb  ──►  tablet
        │
        └──►  Postgres (tests, actions)
```

## Requirements

- Node.js `>=22.13` (use 22 LTS). The web app fails on Node 20; the bridge also runs on Node 20.10+ via `npm run bridge`, which enables its built-in WebSocket
- PostgreSQL 14+
- `adb` on your PATH (or set `ADB=/path/to/adb`) and a tablet with USB debugging

## Setup

```bash
npm install
```

Create `.env` (it is gitignored):

```bash
DATABASE_URL=postgres://user:password@localhost:5432/vctestbench
VC_SECRET_KEY=<output of: openssl rand -base64 32>
```

Apply the migrations in `db/migrations/` in order (`0000` … `0006`). They create
the tables and seed the built-in actions (PASTE, AUTHENTICATION, CLICK, DELAY,
CONFIRMATION, SAVE). For example:

```bash
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

## Run

```bash
npm run dev      # the web app, http://localhost:3000
npm run bridge   # in a second terminal, with the tablet connected
```

The Home screen shows a three-step checklist (bridge, USB debugging, Sandbox
app) and enables **Run** once the tablet is connected and the Sandbox app is open (any screen).

## Building a test

1. **New test** on Home, then add steps in the editor.
2. Drag an action from the sidebar onto the canvas. While dragging, an
   **Insert here** gap appears between steps; drop there to insert in the
   middle. Drag a step onto a gap to move it.
3. **Delete step** in a step's menu joins its neighbours back together.
4. **Save and run** saves what is on screen, then runs that exact version.

| Action | What it does on the tablet |
|---|---|
| CLICK | Taps the element whose text matches "Click on text" |
| PASTE | Fills the first text field with the given text |
| AUTHENTICATION | Fills the visible email and password fields and presses the sign-in button |
| DELAY | Waits the configured number of seconds |
| CONFIRMATION | Branches on the selected option |
| SAVE | Presses the save button |

## Credentials

AUTHENTICATION passwords are encrypted with AES-256-GCM using `VC_SECRET_KEY`
before they are stored, in both the action definition and the saved flow. They
are decrypted only when a run is started, and sent to the local bridge. Test
lists and the editor only ever see ciphertext.

- **Back up `VC_SECRET_KEY`.** If it is lost or changed, stored passwords cannot
  be recovered and the actions must be re-entered.
- Passwords saved before encryption existed keep working. Encrypt them once:

  ```bash
  npm run secrets:encrypt -- --dry-run   # counts only
  npm run secrets:encrypt
  ```

## Security settings

| Variable | Purpose |
|---|---|
| `VC_ALLOWED_ORIGINS` | Origins allowed to call the bridge. Default `http://localhost:3000,http://127.0.0.1:3000`. Set it if the UI runs on another port. |
| `REQUIRE_AUTH=true` | Reject server actions and the create API from callers with no signed-in user. Off by default for local use. |
| `ADB` | Path to the `adb` binary. |

The bridge listens on `127.0.0.1` only, rejects requests from other origins or
host names, requires `application/json` for `/run-test`, and caps the body at
1 MB.

## Scripts

| Command | |
|---|---|
| `npm run dev` / `build` / `start` | The web app (vinext) |
| `npm run bridge` | The tablet bridge |
| `npm run secrets:encrypt` | Encrypt any plaintext stored passwords |
| `npm run lint` | ESLint |
| `npm test` | Builds the app (there is no unit test suite yet) |

## Known gaps

- The bridge is one large file with Sandbox-specific smoke tests mixed in.
- Run steps are checked by screen text, so a renamed button in the Sandbox app
  breaks a CLICK step; the run fails with a message naming the step.
- `db/migrations/meta` has snapshots only for `0000` and `0001`.
