# VC TestBench

Plan a test flow, run it on a VersaClimber tablet, and see exactly what happened.

You build a flow out of steps (tap a button, paste text, wait, confirm, sign
in), press **Run**, and TestBench performs those steps in the Sandbox app on a
USB-connected tablet through a small local program, the **bridge**. Every run
leaves a report.

```
browser (this app, :3000) ──► bridge (tools/bridge, :3131) ──► adb ──► tablet
        │
        └──► Postgres: tests, actions, run reports
```

## What it does

| Need | Where it lives |
|---|---|
| **Plan a flow** by drag and drop, or in easy steps | Editor (`/test/<id>`): an **Actions** panel and the editor view. Press **Add**, press **Add step** on the canvas, or drag; insert between steps, move steps, delete a step and the chain joins. |
| **Run it on the device**, with a log, causes and results | Run view (`/test/<id>/run`), three panels: the **flow chart** (each step lights up as it runs), the **device** (at the tablet's real proportions, headed by its model and state), and a 300px **live activity** column that lists events in the order they happen and follows the newest one. **Stop** and the run's header sit in the flow panel. |
| **Report and insight** | Each flow on the Tests page carries a one-line insight (created, last tested, pass rate). `/runs`: **Test health** on the left and every run on the right, each scrolling on its own; `/runs/<id>`: the full report. |
| **Realtime feed** | **Activity**: flows created, changed and deleted and every run's result on the Tests page; the live feed of a run on the run view. Real timestamps, tagged with the step. |
| **Clean, navigable, responsive UI** | One shell with **Tests** and **Runs** and a device status that is always visible; works down to phone width. |
| **Device preview, or its connection status** | The **Device** panel on the run view: a live view of the tablet's screen, or the three steps to connect it. |

## Requirements

- Node.js 22 (`>=22.13`). The web app does not run on Node 20; the bridge also
  works on Node 20.10+ through `npm run bridge`, which enables its WebSocket.
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

Apply the SQL files in `db/migrations/` in order:

```bash
for f in db/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

`0006` seeds the built-in actions. **`0009_drop_legacy.sql` is optional and
destructive**: it deletes tables and columns the app no longer uses (an early
"test class" model). Skip it if you want to keep that data; nothing depends on
it either way.

## Run

```bash
npm run dev      # the web app, http://localhost:3000
npm run bridge   # in a second terminal, with the tablet connected
```

## Using it

1. **New test flow** on the Tests page, give it a title. Each flow shows when it
   was created, when it was last tested and its pass rate on one line; **Edit**
   and **Delete** (press twice to confirm) sit beside **Run**.
2. In the editor, add steps. Press **Add** next to an action, or **Add step**
   where the flow ends, or drag an action onto the flow; while dragging, an
   **Insert here** gap appears between steps. Drag a step to move it. **Delete
   step** joins its neighbours.
3. **Save and run** saves what is on screen, then runs that exact version and
   opens the run view.
4. Watch the flow chart, the device and the live activity; stop the run if you
   need to, and open the **Full report** when it is done.

| Action | What it does on the tablet |
|---|---|
| CLICK | Taps the element whose text matches "Click on text" |
| PASTE | Fills the first text field with the given text |
| AUTHENTICATION | Fills the visible email and password fields and presses the sign-in button |
| DELAY | Waits the configured number of seconds, on top of the default wait |
| CONFIRMATION | Branches on the selected option |
| SAVE | Presses the save button |

### Timing

Every step waits **5 seconds before it runs**, so a dialog or a screen change
from the previous step has time to settle. Add a **DELAY** step when something
needs longer. DELAY itself does not get the extra wait. AUTHENTICATION also
keeps looking for the email and password fields for up to 10 seconds. Change
the default when starting the bridge: `VC_STEP_DELAY_SECONDS=3 npm run bridge`.

A run ends when there is no next step: an empty slot at the end of a chain
completes the flow and nothing runs after it. Only one run can be active.

### Reports

A report holds the result, start and finish time, the device, a record for each
step (when it started, how long it waited, how long it took, its error), the
activity log, and **two pictures of the tablet for every step**: one just before
the action (after the settle wait, so it shows what the action is about to act
on) and one when the step ended. They appear in a *Screen* column after *Took*,
labelled *Before* and *After*; click one to open it large, then use the arrow
keys to move through them in order. The activity log sits
to the right of the steps, in the order things happened. A failed run also keeps
a full screenshot of the moment it failed. Steps after a failure are listed as
*Not run*.

Step pictures are small JPEGs (about 40 KB each, 600px wide) kept in their own
table, so a run of 20 steps adds about 1.6 MB. There is no automatic clean-up yet;
delete rows from `run_step_images` if you need the space back. **Run again** starts the test as
it is saved now.

The bridge keeps the last 20 runs in memory; whichever page is open copies runs
the database has not seen yet, so a report is saved even if you were on another
screen when it finished.

## Credentials

AUTHENTICATION passwords are encrypted with AES-256-GCM using `VC_SECRET_KEY`
before they are stored, in both the action definition and the saved flow. They
are decrypted only when a run is started, and sent to the local bridge. Test
lists and the editor only ever see ciphertext.

- **Back up `VC_SECRET_KEY`.** If it is lost or changed, stored passwords cannot
  be recovered and must be entered again.
- Passwords saved before encryption existed keep working. Encrypt them once:

  ```bash
  npm run secrets:encrypt -- --dry-run   # counts only
  npm run secrets:encrypt
  ```

## Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (web app). |
| `VC_SECRET_KEY` | 32 random bytes, base64. Encrypts stored passwords. |
| `VC_STEP_DELAY_SECONDS` | Wait before every step (bridge, default `5`). |
| `VC_ALLOWED_ORIGINS` | Origins allowed to call the bridge. Default `http://localhost:3000,http://127.0.0.1:3000`; set it if the UI runs on another port. |
| `VC_BRIDGE_PORT` | Port the bridge listens on (default `3131`; the web app expects 3131). |
| `REQUIRE_AUTH=true` | Reject server actions and the create API from callers with no signed-in user. Off by default for local use. |
| `ADB` | Path to the `adb` binary. |
| `VC_BRIDGE_DEBUG=1` | Verbose bridge logging. |

The bridge listens on `127.0.0.1` only, refuses requests from other origins or
host names, requires `application/json` for `/run-test`, and caps the body at
1 MB.

## How it is organised

```
app/                    pages: / (tests), /test/[id] (editor), /test/[id]/run, /runs, /runs/[id]
components/
  BridgeProvider.tsx    the one connection to the bridge; saves finished runs
  AppShell.tsx          header, navigation, device status
  DevicePanel.tsx       live screen preview, or the steps to connect
  ActivityTimeline.tsx  flow changes and run results, for the Tests page
  ActivityFeed.tsx      the live, timestamped feed of a run
  TestFlowBuilder.tsx   the editor
  flow/FlowChart.tsx    the read-only chart used by the run view
  flow/Connector.tsx    the lines between steps (shared with the editor)
  flow/tree.ts          pure flow-tree logic (insert, remove, move, load, store)
actions/  services/     server actions and the code behind them
db/                     schema and SQL migrations
tools/bridge/           config · state · adb · webview · device · runner · server
tests/                  unit tests for the flow tree and the run planner
```

## Scripts

| Command | |
|---|---|
| `npm run dev` / `build` / `start` | The web app (vinext) |
| `npm run bridge` | The tablet bridge |
| `npm test` | Unit tests (`node --test`; needs Node 22.18+ for TypeScript) |
| `npm run check` | Type-check, lint and tests |
| `npm run secrets:encrypt` | Encrypt any plaintext stored passwords |

## Known gaps

- Steps are matched by on-screen text, so a renamed button in the Sandbox app
  breaks a CLICK step; the run fails with a message naming the step.
- `db/migrations/meta` has snapshots only for `0000` and `0001`.
- The bridge has pure-logic tests but no end-to-end test against a real tablet.
