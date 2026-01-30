import { run } from "../util/exec.js";
import { timer } from "../util/time.js";
import { redactString } from "../util/redact.js";
import { getPlatform } from "../util/platform.js";
import type { CalendarEvent } from "../schema.js";
import type { CollectOptions } from "../index.js";
import type { ModuleResult } from "../schema.js";
import type { PermissionState } from "../schema.js";

const EVENT_SEP = "\x1e"; // ASCII 30 Record Separator
const FIELD_SEP = "\x1f"; // ASCII 31 Unit Separator

const CALENDAR_DENIED_PATTERNS = [
  /calendar/i,
  /permission/i,
  /privacy/i,
  /not authorised/i,
  /access denied/i,
];

function isCalendarDenied(stderr: string): boolean {
  return CALENDAR_DENIED_PATTERNS.some((p) => p.test(stderr));
}

/**
 * AppleScript: get next 3 calendar events starting now, within 24h.
 * Returns: start FIELD_SEP end FIELD_SEP title FIELD_SEP location EVENT_SEP ...
 * (summary/location sanitized to remove FIELD_SEP and EVENT_SEP)
 */
const CALENDAR_SCRIPT = `
tell application "Calendar"
  set startDate to current date
  set endDate to startDate + (24 * 60 * 60)
  set eventList to {}
  repeat with aCal in calendars
    try
      set theseEvents to (every event of aCal whose start date >= startDate and start date <= endDate)
      repeat with e in theseEvents
        copy e to end of eventList
      end repeat
    end try
  end repeat
  set output to ""
  set d31 to character id 31
  set d30 to character id 30
  set total to (count of eventList)
  set maxToOutput to 20
  if total > maxToOutput then set total to maxToOutput
  repeat with i from 1 to total
    set e to item i of eventList
    set startStr to (start date of e as string)
    set endStr to (end date of e as string)
    set sumStr to (summary of e as string)
    set locStr to ""
    try
      set locStr to (location of e as string)
    end try
    set sumSafe to ""
    repeat with j from 1 to (length of sumStr)
      set c to character j of sumStr
      if c is d30 or c is d31 or c is return then
        set sumSafe to sumSafe & " "
      else
        set sumSafe to sumSafe & c
      end if
    end repeat
    set locSafe to ""
    repeat with j from 1 to (length of locStr)
      set c to character j of locStr
      if c is d30 or c is d31 or c is return then
        set locSafe to locSafe & " "
      else
        set locSafe to locSafe & c
      end if
    end repeat
    set output to output & startStr & d31 & endStr & d31 & sumSafe & d31 & locSafe & d30
  end repeat
  return output
end tell
`;

function parseCalendarOutput(raw: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const blocks = raw.split(EVENT_SEP).filter((b) => b.trim().length > 0);
  for (const block of blocks) {
    const parts = block.split(FIELD_SEP);
    if (parts.length >= 4) {
      events.push({
        start: parts[0].trim(),
        end: parts[1].trim(),
        title: parts[2].trim(),
        location: parts[3].trim() || undefined,
      });
    }
  }
  events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return events.slice(0, 3);
}

export async function collectCalendar(options: CollectOptions): Promise<ModuleResult<CalendarEvent[]>> {
  if (getPlatform() === "linux") {
    return { data: [], timingMs: 0 };
  }

  const t = timer();
  const timeoutMs = options.timeoutMs;
  const redact = options.redact;
  const warnings: string[] = [];

  try {
    const result = await run("osascript", ["-e", CALENDAR_SCRIPT], { timeoutMs });

    if (result.timedOut) {
      return {
        data: [],
        warnings: [...warnings, "calendar: timeout"],
        error: { module: "calendar", message: "Timeout", code: "timeout" },
        timingMs: t.elapsed(),
      };
    }

    if (!result.ok) {
      if (isCalendarDenied(result.stderr)) {
        return {
          data: [],
          permission: "denied" as PermissionState,
          error: {
            module: "calendar",
            message: "Calendar permission required",
            code: "permission_denied",
          },
          timingMs: t.elapsed(),
        };
      }
      return {
        data: [],
        error: {
          module: "calendar",
          message: result.stderr.trim() || "Failed to get calendar events",
          code: "error",
        },
        timingMs: t.elapsed(),
      };
    }

    const raw = result.stdout?.trim() ?? "";
    let events = raw ? parseCalendarOutput(raw) : [];

    if (redact && events.length > 0) {
      events = events.map((ev) => {
        const titleRedacted = redactString(ev.title);
        const out: CalendarEvent = {
          start: ev.start,
          end: ev.end,
          title_sha256: titleRedacted.sha256,
          title_length: titleRedacted.length,
        };
        if (ev.location != null && ev.location !== "") {
          const locRedacted = redactString(ev.location);
          out.location_sha256 = locRedacted.sha256;
          out.location_length = locRedacted.length;
        }
        return out;
      });
    }

    return {
      data: events,
      permission: "granted" as PermissionState,
      timingMs: t.elapsed(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: [],
      error: { module: "calendar", message, code: "error" },
      timingMs: t.elapsed(),
    };
  }
}
