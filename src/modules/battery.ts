import { run } from "../util/exec.js";
import { readFile } from "node:fs/promises";
import { timer } from "../util/time.js";
import { getPlatform } from "../util/platform.js";
import type { Battery } from "../schema.js";
import type { ModuleResult } from "../schema.js";

function parsePmsetBatt(stdout: string): { percentage: number; is_charging: boolean; power_source: "ac" | "battery" | "unknown" } {
  const line = stdout.split("\n").find((l) => l.includes("%") || l.includes("InternalBattery")) || "";
  const pctMatch = stdout.match(/(\d+)%/);
  const percentage = pctMatch ? Math.min(1, Math.max(0, parseInt(pctMatch[1], 10) / 100)) : 0;
  const lower = stdout.toLowerCase();
  const statusMatch = line.toLowerCase().match(/;\s*([a-z ]+?)\s*;/);
  const status = statusMatch ? statusMatch[1].trim() : "";
  const is_charging = status === "charging" || status === "charged" || status === "full";
  let power_source: "ac" | "battery" | "unknown" = "unknown";
  if (lower.includes("ac power")) {
    power_source = "ac";
  } else if (lower.includes("battery power")) {
    power_source = "battery";
  } else if (status === "discharging") {
    power_source = "battery";
  } else if (is_charging) {
    power_source = "ac";
  }
  return { percentage, is_charging, power_source };
}

async function collectBatteryDarwin(timeoutMs: number): Promise<ModuleResult<Battery>> {
  const t = timer();
  try {
    const result = await run("pmset", ["-g", "batt"], { timeoutMs });
    if (result.timedOut || !result.ok) {
      return {
        data: { percentage: 0, is_charging: false, power_source: "unknown" },
        timingMs: t.elapsed(),
      };
    }
    const data = parsePmsetBatt(result.stdout);
    return { data, timingMs: t.elapsed() };
  } catch {
    return {
      data: { percentage: 0, is_charging: false, power_source: "unknown" },
      timingMs: t.elapsed(),
    };
  }
}

async function collectBatteryLinux(_timeoutMs: number): Promise<ModuleResult<Battery>> {
  const t = timer();
  try {
    const base = "/sys/class/power_supply";
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(base).catch(() => [] as string[]);
    let batDir = entries.find((name) => name.startsWith("BAT")) || "";
    if (!batDir) {
      for (const name of entries) {
        const typePath = `${base}/${name}/type`;
        const type = await readFile(typePath, "utf8").then((s) => s.trim().toLowerCase()).catch(() => "");
        if (type === "battery") {
          batDir = name;
          break;
        }
      }
    }
    const capacityPath = batDir ? `${base}/${batDir}/capacity` : "";
    const statusPath = batDir ? `${base}/${batDir}/status` : "";
    const capacity = capacityPath
      ? await readFile(capacityPath, "utf8").then((s) => parseInt(s.trim(), 10)).catch(() => NaN)
      : NaN;
    const status = statusPath
      ? await readFile(statusPath, "utf8").then((s) => s.trim().toLowerCase()).catch(() => "")
      : "";
    const percentage = Number.isNaN(capacity) ? 0 : Math.min(1, Math.max(0, capacity / 100));
    const is_charging = status === "charging" || status === "full";
    const power_source =
      status === "charging" || status === "full" || status === "not charging"
        ? "ac"
        : status === "discharging"
        ? "battery"
        : "unknown";
    const data: Battery = { percentage, is_charging, power_source };
    return { data, timingMs: t.elapsed() };
  } catch {
    return {
      data: { percentage: 0, is_charging: false, power_source: "unknown" },
      timingMs: t.elapsed(),
    };
  }
}

export async function collectBattery(timeoutMs: number): Promise<ModuleResult<Battery>> {
  const platform = getPlatform();
  if (platform === "darwin") return collectBatteryDarwin(timeoutMs);
  if (platform === "linux") return collectBatteryLinux(timeoutMs);
  return {
    data: { percentage: 0, is_charging: false, power_source: "unknown" },
    timingMs: 0,
  };
}
