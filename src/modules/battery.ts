import { readFile } from "node:fs/promises";
import { timer } from "../util/time.js";
import { getPlatform } from "../util/platform.js";
import type { Battery } from "../schema.js";
import type { ModuleResult } from "../schema.js";

async function collectBatteryDarwin(_timeoutMs: number): Promise<ModuleResult<Battery>> {
  // TODO: pmset -g batt
  return {
    data: { percentage: 0, is_charging: false, power_source: "unknown" },
    timingMs: 0,
  };
}

async function collectBatteryLinux(_timeoutMs: number): Promise<ModuleResult<Battery>> {
  const t = timer();
  try {
    const base = "/sys/class/power_supply";
    const batDir = "BAT0";
    const capacityPath = `${base}/${batDir}/capacity`;
    const statusPath = `${base}/${batDir}/status`;
    const capacity = await readFile(capacityPath, "utf8").then((s) => parseInt(s.trim(), 10)).catch(() => NaN);
    const status = await readFile(statusPath, "utf8").then((s) => s.trim().toLowerCase()).catch(() => "");
    const percentage = Number.isNaN(capacity) ? 0 : Math.min(1, Math.max(0, capacity / 100));
    const is_charging = status === "charging" || status === "full";
    const power_source =
      status === "charging" || status === "full" ? "ac" : status === "discharging" ? "battery" : "unknown";
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
