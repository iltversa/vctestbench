// Display helpers shared by the run list and the run report.

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;

  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;

  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return `${minutes} min ${String(rest).padStart(2, "0")} s`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// 12 Oct 2026
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// "Today, 14:05", "Yesterday, 18:30", "12 Oct, 09:12" (with the year when it is not this one).
export function formatWhen(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;

  const day = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });

  return `${day}, ${time}`;
}

export function formatClock(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// A plain-language reading of the bridge's error messages.
export function explainFailure(error: string | null | undefined): string | null {
  if (!error) return null;

  if (/Timeout looking for|Unable to click/i.test(error)) {
    return "The text to tap was not on the tablet's screen in time. Check the spelling of the CLICK text, and add a DELAY step before it if the screen opens slowly.";
  }
  if (/No (password|email) field/i.test(error)) {
    return "The sign-in form was not on screen. Add a step that opens it (for example CLICK \"ADD USER\") and a DELAY before AUTHENTICATION.";
  }
  if (/needs both an email and a password/i.test(error)) {
    return "The AUTHENTICATION action has no email or no password. Edit the action and fill both in.";
  }
  if (/No sign-in button/i.test(error)) {
    return "The email and password were filled in, but no sign-in button was found next to them.";
  }
  if (/WebSocket/i.test(error)) {
    return "The bridge could not talk to the tablet's WebView. Start it with npm run bridge.";
  }
  if (/DevTools|WebView/i.test(error)) {
    return "The Sandbox app's WebView was not reachable. Make sure the app is open on the tablet and USB debugging is allowed.";
  }
  if (/Action not found/i.test(error)) {
    return "This step refers to an action that no longer exists. Open the test and re-add the step.";
  }
  if (/decrypted|VC_SECRET_KEY/i.test(error)) {
    return "A stored password could not be decrypted. VC_SECRET_KEY may have changed since it was saved.";
  }

  return null;
}
