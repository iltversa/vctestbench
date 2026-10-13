# VC TestBench

Plan, record and run UI tests for the VersaClimber Sandbox app on a
USB-connected tablet, and get a report of every run.

## How it fits together

```
browser (web app :3000) ──► bridge (:3131) ──► adb + WebView DevTools ──► tablet
        └──► PostgreSQL: tests, actions, run reports, pictures
```

## Technologies

| Part | Used |
|---|---|
| Web app | Next.js 16 on vinext (Vite), React 19, TypeScript |
| Styling | Tailwind CSS 4, Font Awesome icons |
| Data | PostgreSQL, Drizzle ORM (`postgres` driver), SQL migrations |
| Bridge | Node.js 22, `adb`, Chrome DevTools Protocol over WebSocket |
| Pictures | `pngjs` + `jpeg-js`, shrunk to small JPEGs |
| Security | AES-256-GCM for stored passwords, origin allow-list |
| Quality | ESLint, `tsc`, `node --test` (`npm run check`) |

## Layout

| Folder | Holds |
|---|---|
| `app/` | Pages: tests, editor, run view, runs, report |
| `components/` | UI, bridge connection, flow editor and chart |
| `actions/`, `services/` | Server actions and the logic behind them |
| `db/` | Schema and migrations |
| `tools/bridge/` | The tablet bridge: runner, recorder, DevTools, adb |
| `tests/` | Unit tests |

# Features

## Plan
- Build a test flow from steps: **CLICK, PASTE, AUTHENTICATION, DELAY, CONFIRMATION, SAVE, ROUTE**.
- Add by button or drag and drop; insert, move and delete steps.
- Branch on a CONFIRMATION option.
- **Record from the tablet**: do the steps on the device and they become the flow, with the pages you visit as ROUTE (go to) steps and dialog buttons as CONFIRMATION.
- **ROUTE** step: the tablet must be on a page you set, e.g. `/home` or `/loginTS`; check it, or go to it.
- Each action type has its own icon.

## Run
- Runs on a USB-connected tablet through a local bridge.
- Each step looks for its target for up to 15 s, then fails with the reason.
- The flow ends when there is no next step.
- Live flow chart, device preview and activity log; Stop at any time.

## Report
- Result, timing, device, and every step's status, wait and duration.
- A picture of the tablet **before** and **after** each step, with a lightbox.
- Activity log beside the steps; failed steps explain why.
- Pass-rate and trend per test; Run again.

## Insight
- Tests page: created, last tested and pass rate on one line.
- Activity timeline of changes and run results.

## Safety
- Passwords encrypted at rest; never recorded.
- Bridge accepts only the TestBench origin on localhost.
- Optional sign-in gate; one run at a time.

## Housekeeping
- Pictures kept for the newest 50 runs.
- Runs and recording exclude each other.

Details and setup: [README.md](README.md).
