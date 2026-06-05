// ---------------------------------------------------------------------------
// Event time-window logic — shared by the server (upload enforcement) and the
// client (guest page gating). Single source of truth so both agree.
//
// An event is accessible from `startTime` until `endTime` plus a grace buffer,
// all interpreted in the event's own timezone. If a time isn't set, the event
// is treated as accessible for the whole calendar day (midnight to midnight) in
// that timezone.
// ---------------------------------------------------------------------------

/** Grace period after endTime during which uploads are still accepted. */
export const END_GRACE_MS = 30 * 60 * 1000; // 30 minutes

export type WindowState = "before" | "open" | "ended";

type EventTimeFields = {
  date: string; // "YYYY-MM-DD"
  startTime?: string; // "HH:mm" (24h) or empty
  endTime?: string; // "HH:mm" (24h) or empty
  timezone?: string; // IANA, e.g. "Asia/Kolkata"; defaults to UTC
};

/**
 * Returns the UTC offset (in ms) of `timeZone` at the given instant.
 * Positive for zones east of UTC (e.g. +19800000 for Asia/Kolkata).
 */
function getTimezoneOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  const asUTC = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour,
    map.minute,
    map.second,
  );
  return asUTC - date.getTime();
}

/**
 * Converts a wall-clock date+time in `timeZone` to a UTC timestamp (ms).
 * One-pass offset resolution — accurate except within the ~1h DST transition
 * window, which is acceptable for event scheduling.
 */
function zonedWallTimeToUtcMs(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = timeStr.split(":").map(Number);
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, 0);
  const offset = getTimezoneOffsetMs(timeZone, new Date(utcGuess));
  return utcGuess - offset;
}

export type EventWindow = {
  state: WindowState;
  /** UTC instant the event opens. */
  startsAt: Date;
  /** UTC instant the event closes (endTime + grace). */
  endsAt: Date;
};

/**
 * Resolves the current window state of an event.
 * @param now Override for the current time (defaults to system clock).
 */
export function getEventWindow(
  event: EventTimeFields,
  now: Date = new Date(),
): EventWindow {
  const tz = event.timezone || "UTC";
  const startMs = zonedWallTimeToUtcMs(event.date, event.startTime || "00:00", tz);
  const endMs =
    zonedWallTimeToUtcMs(event.date, event.endTime || "23:59", tz) + END_GRACE_MS;

  const t = now.getTime();
  const state: WindowState =
    t < startMs ? "before" : t > endMs ? "ended" : "open";

  return { state, startsAt: new Date(startMs), endsAt: new Date(endMs) };
}
