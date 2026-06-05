// Timezone helpers for the host-facing event forms. Uses the browser's own
// IANA database via Intl — no extra dependency. Falls back to a short common
// list on the rare browser that lacks Intl.supportedValuesOf.

const COMMON_FALLBACK = [
  "UTC",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
];

const intlWithSupported = Intl as typeof Intl & {
  supportedValuesOf?: (key: "timeZone") => string[];
};

/** Full IANA timezone list from the browser, or a common-zone fallback. */
export function getTimezones(): string[] {
  try {
    if (typeof intlWithSupported.supportedValuesOf === "function") {
      return intlWithSupported.supportedValuesOf("timeZone");
    }
  } catch {
    /* fall through */
  }
  return COMMON_FALLBACK;
}

/** The host's current browser timezone, e.g. "Asia/Kolkata". */
export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}
