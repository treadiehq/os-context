import { run } from "../util/exec.js";
import { readFile } from "node:fs/promises";
import { timer } from "../util/time.js";
import { getPlatform } from "../util/platform.js";
import type { Network } from "../schema.js";
import type { ModuleResult } from "../schema.js";

async function collectNetworkDarwin(_timeoutMs: number): Promise<ModuleResult<Network>> {
  // TODO: route get default, networksetup, ifconfig
  return {
    data: { primary_interface: "", has_internet: false },
    timingMs: 0,
  };
}

async function collectNetworkLinux(timeoutMs: number): Promise<ModuleResult<Network>> {
  const t = timer();
  try {
    const routeResult = await run("ip", ["route", "show", "default"], { timeoutMs });
    const defaultLine = routeResult.ok ? routeResult.stdout.trim().split("\n")[0] : "";
    const match = defaultLine.match(/dev\s+(\S+)/);
    const primary_interface = match ? match[1] : "";

    let ssid: string | undefined;
    if (primary_interface) {
      const iwResult = await run("iwgetid", ["-r", primary_interface], { timeoutMs });
      if (iwResult.ok && iwResult.stdout.trim()) ssid = iwResult.stdout.trim();
    }

    let has_internet = false;
    if (primary_interface) {
      try {
        const operstate = await readFile(
          `/sys/class/net/${primary_interface}/operstate`,
          "utf8"
        ).then((s) => s.trim()).catch(() => "");
        const hasCarrier = operstate === "up";
        if (hasCarrier) {
          const addrResult = await run("ip", ["-4", "addr", "show", primary_interface], { timeoutMs });
          has_internet = addrResult.ok && /inet\s+\d+\.\d+\.\d+\.\d+/.test(addrResult.stdout);
        }
      } catch {
        // ignore
      }
    }

    const data: Network = { primary_interface, ssid, has_internet };
    return { data, timingMs: t.elapsed() };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: { primary_interface: "", has_internet: false },
      error: { module: "network", message, code: "error" },
      timingMs: t.elapsed(),
    };
  }
}

export async function collectNetwork(timeoutMs: number): Promise<ModuleResult<Network>> {
  const platform = getPlatform();
  if (platform === "darwin") return collectNetworkDarwin(timeoutMs);
  if (platform === "linux") return collectNetworkLinux(timeoutMs);
  return {
    data: { primary_interface: "", has_internet: false },
    timingMs: 0,
  };
}
