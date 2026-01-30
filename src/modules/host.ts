import { run } from "../util/exec.js";
import { timer } from "../util/time.js";
import { getPlatform } from "../util/platform.js";
import type { Host } from "../schema.js";
import type { ModuleResult } from "../schema.js";

async function collectHostDarwin(timeoutMs: number): Promise<ModuleResult<Host>> {
  const t = timer();
  const warnings: string[] = [];
  try {
    const [osVersion, machine] = await Promise.all([
      run("sw_vers", ["-productVersion"], { timeoutMs }),
      run("uname", ["-m"], { timeoutMs }),
    ]);
    if (osVersion.timedOut || machine.timedOut) {
      return {
        warnings: [...warnings, "host: timeout"],
        error: { module: "host", message: "Timeout", code: "timeout" },
        timingMs: t.elapsed(),
      };
    }
    const os_version = osVersion.ok ? osVersion.stdout.trim() || "unknown" : "unknown";
    const machine_arch = machine.ok ? machine.stdout.trim() || "unknown" : "unknown";
    const locale =
      typeof Intl !== "undefined" && Intl.DateTimeFormat
        ? new Intl.DateTimeFormat().resolvedOptions().locale
        : "en-US";
    const tz =
      typeof Intl !== "undefined" && Intl.DateTimeFormat
        ? new Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";
    const data: Host = {
      os: "macos",
      os_version,
      machine: machine_arch,
      locale,
      timezone: tz,
    };
    return { data, warnings: warnings.length ? warnings : undefined, timingMs: t.elapsed() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      warnings,
      error: { module: "host", message, code: "error" },
      timingMs: t.elapsed(),
    };
  }
}

function parseOsRelease(stdout: string): { version: string } {
  const version =
    stdout.match(/^VERSION_ID="?([^"\n]+)"?/m)?.[1] ??
    stdout.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1] ??
    "unknown";
  return { version };
}

async function collectHostLinux(timeoutMs: number): Promise<ModuleResult<Host>> {
  const t = timer();
  const warnings: string[] = [];
  try {
    const [osRelease, machine] = await Promise.all([
      run("cat", ["/etc/os-release"], { timeoutMs }),
      run("uname", ["-m"], { timeoutMs }),
    ]);
    if (osRelease.timedOut || machine.timedOut) {
      return {
        warnings: [...warnings, "host: timeout"],
        error: { module: "host", message: "Timeout", code: "timeout" },
        timingMs: t.elapsed(),
      };
    }
    const { version } = osRelease.ok ? parseOsRelease(osRelease.stdout) : { version: "unknown" };
    const machine_arch = machine.ok ? machine.stdout.trim() || "unknown" : "unknown";
    const locale =
      typeof Intl !== "undefined" && Intl.DateTimeFormat
        ? new Intl.DateTimeFormat().resolvedOptions().locale
        : "en-US";
    const tz =
      typeof Intl !== "undefined" && Intl.DateTimeFormat
        ? new Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC";
    const data: Host = {
      os: "linux",
      os_version: version,
      machine: machine_arch,
      locale,
      timezone: tz,
    };
    return { data, warnings: warnings.length ? warnings : undefined, timingMs: t.elapsed() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      warnings,
      error: { module: "host", message, code: "error" },
      timingMs: t.elapsed(),
    };
  }
}

export async function collectHost(timeoutMs: number): Promise<ModuleResult<Host>> {
  const platform = getPlatform();
  if (platform === "darwin") return collectHostDarwin(timeoutMs);
  if (platform === "linux") return collectHostLinux(timeoutMs);
  return {
    error: { module: "host", message: `Unsupported platform: ${process.platform}`, code: "unsupported" },
    timingMs: 0,
  };
}
