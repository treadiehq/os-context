import { run } from "../util/exec.js";
import { timer } from "../util/time.js";
import { redactString } from "../util/redact.js";
import { getPlatform } from "../util/platform.js";
import type { Reminder } from "../schema.js";
import type { CollectOptions } from "../index.js";
import type { ModuleResult } from "../schema.js";
import type { PermissionState } from "../schema.js";

const REMINDER_SEP = "\x1e";
const FIELD_SEP = "\x1f";

const REMINDERS_DENIED_PATTERNS = [
  /reminders/i,
  /permission/i,
  /privacy/i,
  /not authorised/i,
  /access denied/i,
];

function isRemindersDenied(stderr: string): boolean {
  return REMINDERS_DENIED_PATTERNS.some((p) => p.test(stderr));
}

// AppleScript: incomplete reminders due within 7 days, up to 10. title FIELD_SEP due FIELD_SEP list REMINDER_SEP
const REMINDERS_SCRIPT = `
tell application "Reminders"
  set startDate to current date
  set endDate to startDate + (7 * 24 * 60 * 60)
  set out to ""
  set d31 to character id 31
  set d30 to character id 30
  set count to 0
  repeat with aList in lists
    try
      set theReminders to (every reminder of aList whose completed is false and (due date is not missing value) and (due date <= endDate))
      repeat with r in theReminders
        if count >= 10 then exit repeat
        set titleStr to (name of r as string)
        set dueStr to ""
        try
          set dueStr to (due date of r as string)
        end try
        set listStr to (name of aList as string)
        set titleSafe to ""
        repeat with j from 1 to (length of titleStr)
          set c to character j of titleStr
          if c is d30 or c is d31 or c is return then
            set titleSafe to titleSafe & " "
          else
            set titleSafe to titleSafe & c
          end if
        end repeat
        set out to out & titleSafe & d31 & dueStr & d31 & listStr & d30
        set count to count + 1
      end repeat
    end try
  end repeat
  return out
end tell
`;

function parseRemindersOutput(raw: string): Reminder[] {
  const reminders: Reminder[] = [];
  const blocks = raw.split(REMINDER_SEP).filter((b) => b.trim().length > 0);
  for (const block of blocks) {
    const parts = block.split(FIELD_SEP);
    if (parts.length >= 3) {
      reminders.push({
        title: parts[0].trim(),
        due: parts[1].trim() || undefined,
        list: parts[2].trim() || undefined,
      });
    }
  }
  return reminders;
}

export async function collectReminders(options: CollectOptions): Promise<ModuleResult<Reminder[]>> {
  if (getPlatform() === "linux") {
    return { data: [], timingMs: 0 };
  }

  const t = timer();
  const timeoutMs = options.timeoutMs;
  const redact = options.redact;

  try {
    const result = await run("osascript", ["-e", REMINDERS_SCRIPT], { timeoutMs });

    if (result.timedOut) {
      return {
        data: [],
        error: { module: "reminders", message: "Timeout", code: "timeout" },
        timingMs: t.elapsed(),
      };
    }

    if (!result.ok) {
      if (isRemindersDenied(result.stderr)) {
        return {
          data: [],
          permission: "denied" as PermissionState,
          error: {
            module: "reminders",
            message: "Reminders permission required",
            code: "permission_denied",
          },
          timingMs: t.elapsed(),
        };
      }
      return {
        data: [],
        error: {
          module: "reminders",
          message: result.stderr.trim() || "Failed to get reminders",
          code: "error",
        },
        timingMs: t.elapsed(),
      };
    }

    const raw = result.stdout?.trim() ?? "";
    let reminders = raw ? parseRemindersOutput(raw) : [];

    if (redact && reminders.length > 0) {
      reminders = reminders.map((r) => {
        const titleRedacted = redactString(r.title ?? "");
        return {
          title_sha256: titleRedacted.sha256,
          title_length: titleRedacted.length,
          due: r.due,
          list: r.list,
        };
      });
    }

    return {
      data: reminders,
      permission: "granted" as PermissionState,
      timingMs: t.elapsed(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: [],
      error: { module: "reminders", message, code: "error" },
      timingMs: t.elapsed(),
    };
  }
}
