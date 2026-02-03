import { run } from "../util/exec.js";
import { timer } from "../util/time.js";
import { getPlatform } from "../util/platform.js";
import type { Network } from "../schema.js";
import type { ModuleResult } from "../schema.js";

async function collectNetworkDarwin(timeoutMs: number): Promise<ModuleResult<Network>> {
  const t = timer();
  try {
    const routeResult = await run("route", ["get", "default"], { timeoutMs });
    const ifMatch = routeResult.ok ? routeResult.stdout.match(/interface:\s*(\S+)/) : null;
    const primary_interface = ifMatch ? ifMatch[1].trim() : "";

    let ssid: string | undefined;
    if (primary_interface) {
      const ssidResult = await run("networksetup", ["-getairportnetwork", primary_interface], { timeoutMs });
      const ssidMatch = ssidResult.ok ? ssidResult.stdout.match(/Current Wi-Fi Network:\s*(.+)/) : null;
      if (ssidMatch && ssidMatch[1].trim()) ssid = ssidMatch[1].trim();
    }

    let has_internet = false;
    if (primary_interface) {
      const ifconfigResult = await run("ifconfig", [primary_interface], { timeoutMs });
      has_internet = ifconfigResult.ok && /inet\s+\d+\.\d+\.\d+\.\d+/.test(ifconfigResult.stdout);
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

async function collectNetworkLinux(timeoutMs: number): Promise<ModuleResult<Network>> {
  const t = timer();
  try {
    const routeResult = await run("ip", ["route", "show", "default"], { timeoutMs });
    const defaultLines = routeResult.ok
      ? routeResult.stdout.split("\n").map((line) => line.trim()).filter(Boolean)
      : [];
    let primary_interface = "";
    let bestMetric = Number.POSITIVE_INFINITY;
    for (const line of defaultLines) {
      const devMatch = line.match(/dev\s+(\S+)/);
      if (!devMatch) continue;
      const metricMatch = line.match(/metric\s+(\d+)/);
      const metric = metricMatch ? Number(metricMatch[1]) : 0;
      if (metric < bestMetric) {
        bestMetric = metric;
        primary_interface = devMatch[1];
      }
    }

    let ssid: string | undefined;
    if (primary_interface) {
      const iwResult = await run("iwgetid", ["-r", primary_interface], { timeoutMs });
      if (iwResult.ok && iwResult.stdout.trim()) ssid = iwResult.stdout.trim();
    }

    let has_internet = false;
    if (primary_interface) {
      try {
        const { readFile } = await import("node:fs/promises");
        const operstate = await readFile(
          `/sys/class/net/${primary_interface}/operstate`,
          "utf8"
        ).then((s) => s.trim()).catch(() => "");
        if (operstate === "up") {
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
