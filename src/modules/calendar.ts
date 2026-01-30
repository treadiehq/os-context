import { getPlatform } from "../util/platform.js";
import type { CalendarEvent } from "../schema.js";
import type { CollectOptions } from "../index.js";
import type { ModuleResult } from "../schema.js";

export async function collectCalendar(_options: CollectOptions): Promise<ModuleResult<CalendarEvent[]>> {
  if (getPlatform() === "linux") {
    return { data: [], timingMs: 0 };
  }
  // TODO: macOS osascript Calendar next 3 events, permission handling
  return { data: [], timingMs: 0 };
}
