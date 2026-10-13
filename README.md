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

Apply the SQL files in `db/migrations/` in order (`0013` adds the ROUTE action to
an existing database):

```bash
for f in db/migrations/*.sql; do
  case "$f" in *0009_drop_legacy*) continue ;; esac   # optional and destructive, see below
  psql "$DATABASE_URL" -f "$f"
done
```

`0006` seeds the built-in actions. **`0009_drop_legacy.sql` is optional and
destructive**, and the loop above skips it (run it by hand with
`psql "$DATABASE_URL" -f db/migrations/0009_drop_legacy.sql`): it deletes tables and columns the app no longer uses (an early
"test class" model). Skip it if you want to keep that data; nothing depends on
it either way.

### No PostgreSQL installed?

```bash
npm run db      # a local database on the port in DATABASE_URL; leave it running
```

It creates the database and applies the migrations (not the optional `0009`) the
first time, and keeps its data in `tools/dev-db/data`, so the data survives a
reboot. The server itself does not: after a restart `npm run dev` starts it again
by itself (in the background, with the same data), so there is nothing to
remember. If the app says the database did not respond, that is the server being
down, not lost data; `npm run db` starts it by hand. Do not delete
`tools/dev-db/data`. For a database that holds anything you care about, use a
real PostgreSQL and back it up.

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
| CLICK | Taps the element whose text matches "Click on text": the nearest clickable element around it, or the text itself when nothing around it looks clickable (a tap on the label reaches a handler on a plain wrapper) |
| PASTE | Fills the first text field with the given text |
| AUTHENTICATION | Fills the visible email and password fields and presses the sign-in button |
| DELAY | Waits the configured number of seconds, on top of the default wait |
| CONFIRMATION | Branches on the selected option |
| SAVE | Presses the save button |
| IF | Runs one of two branches, **If yes** or **Otherwise**, depending on a condition read from the tablet: the signed-in user (`subscription.status`, `profile.country`, ...), text on the screen, the page, or a JavaScript expression. Use it for roles, subscriptions or incomplete profiles |
| ROUTE | The tablet has to be on the page you set (`/home`, `/loginTS`). **Check only** waits for it and fails otherwise; **Go to it** opens the page through the app's own router (FlowRouter in the Sandbox), never a page load, then checks |

### IF: branching on the user, the screen or the page

Add an **IF** step, choose what to check, and build each branch under **If yes**
and **Otherwise**. Only the branch the answer picks runs, and the report says
which one and why (`If user subscription.status is true: yes`).

| Check | Example |
|---|---|
| The signed-in user | `subscription.status` is `true`; `subscription.tier` is `2`; `profile.country` is empty or missing |
| Text on the screen | "Upgrade to premium" is shown / is not shown |
| The page | the page is `/home` / is not `/loginTS` |
| JavaScript | `Meteor.user().subscription.tier >= 2` (one expression, run in the tablet's page) |

User fields are read from the signed-in user (`Meteor.user()`) by dotted path;
text is compared ignoring case. If the tablet cannot answer (nobody signed in,
the script throws) the step fails and says why. Apply migration `0014` to add the
IF action to an existing database. IF steps are not recorded: add them by hand.

### Recording a flow

On a new, empty flow with the tablet connected and the Sandbox app open, the
editor offers **Start recording**. Then use the tablet yourself: each tap becomes
a CLICK (with the text you tapped), text you enter becomes a PASTE, the sign-in
form becomes AUTHENTICATION, the save button becomes SAVE, each page you
move to becomes a ROUTE step set to **Go to it** (the page you started on is
the first), and a
button tapped in a dialog becomes a CONFIRMATION: the button you tapped is the
selected option and the dialog's other buttons are the alternatives. The steps appear
in the flow as you go; press **Stop recording**, check them, name the flow and
save.

- It reads the Sandbox page through the same DevTools connection runs use. It
  only watches; nothing is changed on the tablet, and the listener is removed
  when you stop.
- **Passwords are never recorded**: open the sign-in step and enter it.
- A tap on something with no readable text is kept as a CLICK with no text, to
  be filled in.
- It records what happens in the Sandbox page. Android's own dialogs (the
  keyboard, permission prompts) are not part of it.
- Recording and running cannot happen at the same time, and leaving the editor
  ends a recording.

### Timing

A step does not wait a fixed time for the screen. It tries its action straight
away and keeps looking every half second, up to **15 seconds**, for what it acts
on: the text to tap, the text field, the sign-in form, the save button. It acts
the moment the target appears; if it never does, the step fails with what was
missing and "looked for 15s". The time spent looking shows in the report's
*Waited* column. Before each step there is only a short **1 second** settle so a
screen is not caught half-drawn. Add a **DELAY** step when something needs a
fixed wait; DELAY itself gets no settle. Change the limits when starting the
bridge: `VC_ACTION_TIMEOUT_SECONDS=30 VC_STEP_DELAY_SECONDS=2 npm run bridge`.

A run ends when there is no next step: an empty slot at the end of a chain
completes the flow and nothing runs after it. Only one run can be active.

Each kind of action has its own icon (tap, paste, key for sign-in, hourglass for
delay, branch for confirmation, disk for save), on the flow cards, the actions
panel, the Tests list and the steps of a report.

### Reports

A report holds the result, start and finish time, the device, a record for each
step (when it started, how long it waited, how long it took, its error), the
activity log, and **two pictures of the tablet for every step**: one just before
the action (after the settle wait, so it shows what the action is about to act
on) and one 2 seconds after the action, so a dialog it opened is on screen. They appear in a *Screen* column after *Took*,
labelled *Before* and *After*; click one to open it large, then use the arrow
keys to move through them in order. The activity log sits
to the right of the steps, in the order things happened. A failed run also keeps
a full screenshot of the moment it failed. Steps after a failure are listed as
*Not run*.

Step pictures are small JPEGs (about 40 KB each, 600px wide) kept in their own
table, so a run of 20 steps adds about 1.6 MB. Only the pictures of the newest 50
runs are kept (`VC_KEEP_RUN_PICTURES`); an older run keeps its report, its steps
and its log, just not the pictures. **Run again** starts the test as it is
saved now.

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
| `VC_STEP_DELAY_SECONDS` | Short settle before every step (bridge, default `1`). |
| `VC_ACTION_TIMEOUT_SECONDS` | How long a step looks for its target before failing (bridge, default `15`). |
| `VC_AFTER_SHOT_DELAY_SECONDS` | Wait after an action before its "after" picture (bridge, default `2`). |
| `VC_KEEP_RUN_PICTURES` | How many of the newest runs keep their step pictures (web app, default `50`). |
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
- The bridge's search and click code is tested against a fake DevTools socket,
  not a real tablet.
