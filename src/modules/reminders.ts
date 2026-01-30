import { getPlatform } from "../util/platform.js";
import type { Reminder } from "../schema.js";
import type { CollectOptions } from "../index.js";
import type { ModuleResult } from "../schema.js";

export async function collectReminders(_options: CollectOptions): Promise<ModuleResult<Reminder[]>> {
  if (getPlatform() === "linux") {
    return { data: [], timingMs: 0 };
  }
  // TODO: macOS osascript Reminders, permission handling
  return { data: [], timingMs: 0 };
}
