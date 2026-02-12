import { run } from "../util/exec.js";
import { timer } from "../util/time.js";
import { getPlatform } from "../util/platform.js";
import type { AppEntry, ModuleResult } from "../schema.js";

const MAX_APPS = 50;

// AppleScript: name and unix id (pid) of every process whose background only is false.
// Returns "name\tpid\n" per line. Bundle ID from System Events (bundle identifier of process) if available.
const APPS_SCRIPT = `
tell application "System Events"
  set out to ""
  set procs to (every process whose background only is false)
  set n to (count of procs)
  if n > ${MAX_APPS} then set n to ${MAX_APPS}
  repeat with i from 1 to n
    set p to item i of procs
    set pname to name of p
    set pid to unix id of p
    set bid to ""
    try
      set bid to bundle identifier of p
    end try
    if bid is missing value then set bid to ""
    set out to out & pname & tab & (pid as string) & tab & bid & return
  end repeat
  return out
end tell
`;

async function collectAppsDarwin(timeoutMs: number): Promise<ModuleResult<AppEntry[]>> {
  const t = timer();
  try {
    const result = await run("osascript", ["-e", APPS_SCRIPT], { timeoutMs });
    if (result.timedOut || !result.ok) {
      return {
        data: [],
        error: result.timedOut
          ? { module: "apps", message: "Timeout", code: "timeout" }
          : { module: "apps", message: result.stderr.trim() || "Failed to list apps", code: "error" },
        timingMs: t.elapsed(),
      };
    }
    const normalized = result.stdout.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.trim().split("\n").filter(Boolean);
    const warnings: string[] = [];
    const apps: AppEntry[] = [];
    for (const line of lines) {
      const parts = line.split("\t");
      const name = (parts[0] ?? "").replace(/\r/g, "").trim() || "unknown";
      const pid = parseInt((parts[1] ?? "0").replace(/\r/g, ""), 10);
      const bundle_id = (parts[2] ?? "").replace(/\r/g, "").trim() || "unknown";
      if (Number.isNaN(pid) || pid <= 0) {
        warnings.push(`apps: skipped process "${name}" with unparseable PID`);
        continue;
      }
      apps.push({ name, bundle_id, pid });
    }
    return {
      data: apps.slice(0, MAX_APPS),
      warnings: warnings.length ? warnings : undefined,
      timingMs: t.elapsed(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: [],
      error: { module: "apps", message, code: "error" },
      timingMs: t.elapsed(),
    };
  }
}

async function collectAppsLinux(timeoutMs: number): Promise<ModuleResult<AppEntry[]>> {
  const t = timer();
  try {
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
    const lines = result.stdout.trim().split("\n").filter(Boolean);
    const warnings: string[] = [];
    const apps: AppEntry[] = [];
    for (const line of lines) {
      const match = line.trim().match(/^\s*(\d+)\s+(.+)$/);
      const pid = match ? parseInt(match[1], 10) : 0;
      const name = match ? match[2].trim() || "unknown" : "unknown";
      if (Number.isNaN(pid) || pid <= 0) {
        warnings.push(`apps: skipped process "${name}" with unparseable PID`);
        continue;
      }
      apps.push({ name, bundle_id: "unknown", pid });
    }
    apps.sort((a, b) => a.name.localeCompare(b.name));
    return {
      data: apps.slice(0, MAX_APPS),
      warnings: warnings.length ? warnings : undefined,
      timingMs: t.elapsed(),
    };
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
  return {
    data: [],
    warnings: [`apps: unsupported platform "${platform}", skipping`],
    timingMs: 0,
  };
}
