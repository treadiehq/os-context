import { run } from "../util/exec.js";
import { timer } from "../util/time.js";
import { getPlatform } from "../util/platform.js";
import type { AppEntry } from "../schema.js";
import type { ModuleResult } from "../schema.js";

const MAX_APPS = 50;

async function collectAppsDarwin(_timeoutMs: number): Promise<ModuleResult<AppEntry[]>> {
  // TODO: osascript System Events list of processes
  return { data: [], timingMs: 0 };
}

async function collectAppsLinux(timeoutMs: number): Promise<ModuleResult<AppEntry[]>> {
  const t = timer();
  try {
    // ps -e -o pid= -o comm= : list all processes with pid and command name
    const result = await run("ps", ["-e", "-o", "pid=", "-o", "comm="], { timeoutMs });
    if (result.timedOut || !result.ok) {
      return {
        data: [],
        error: result.timedOut
          ? { module: "apps", message: "Timeout", code: "timeout" }
          : { module: "apps", message: result.stderr.trim() || "Failed to list processes", code: "error" },
        timingMs: t.elapsed(),
      };
    }
    const lines = result.stdout.trim().split("\n").filter(Boolean).slice(0, MAX_APPS);
    const apps: AppEntry[] = lines.map((line) => {
      const match = line.trim().match(/^\s*(\d+)\s+(.+)$/);
      const pid = match ? parseInt(match[1], 10) : 0;
      const name = match ? match[2].trim() || "unknown" : "unknown";
      return { name, bundle_id: name, pid: Number.isNaN(pid) ? 0 : pid };
    }).filter((a) => a.pid > 0);
    return { data: apps, timingMs: t.elapsed() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: [],
      error: { module: "apps", message, code: "error" },
      timingMs: t.elapsed(),
    };
  }
}

export async function collectApps(timeoutMs: number): Promise<ModuleResult<AppEntry[]>> {
  const platform = getPlatform();
  if (platform === "darwin") return collectAppsDarwin(timeoutMs);
  if (platform === "linux") return collectAppsLinux(timeoutMs);
  return { data: [], timingMs: 0 };
}
