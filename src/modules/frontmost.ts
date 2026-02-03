import { run } from "../util/exec.js";
import { timer } from "../util/time.js";
import { redactString } from "../util/redact.js";
import { getPlatform } from "../util/platform.js";
import type { Frontmost } from "../schema.js";
import type { CollectOptions } from "../index.js";
import type { ModuleResult } from "../schema.js";
import type { PermissionState } from "../schema.js";

const ACCESSIBILITY_DENIED_PATTERNS = [
  /not authorised to send apple events/i,
  /accessibility/i,
  /not allowed to send/i,
];

function isAccessibilityDenied(stderr: string): boolean {
  return ACCESSIBILITY_DENIED_PATTERNS.some((p) => p.test(stderr));
}

async function collectFrontmostDarwin(options: CollectOptions): Promise<ModuleResult<Frontmost>> {
  const t = timer();
  const timeoutMs = options.timeoutMs;
  const includeWindow = options.includeFrontmostWindow;
  const redact = options.redact;
  const warnings: string[] = [];

  try {
    const nameResult = await run("osascript", [
      "-e",
      'tell application "System Events" to get name of first application process whose frontmost is true',
    ], { timeoutMs });

    if (nameResult.timedOut) {
      return {
        warnings: [...warnings, "frontmost: timeout"],
        error: { module: "frontmost", message: "Timeout", code: "timeout" },
        timingMs: t.elapsed(),
      };
    }

    if (!nameResult.ok) {
      if (isAccessibilityDenied(nameResult.stderr)) {
        return {
          permission: "denied" as PermissionState,
          error: {
            module: "frontmost",
            message: "Accessibility permission required for frontmost app",
            code: "permission_denied",
          },
          timingMs: t.elapsed(),
        };
      }
      return {
        error: {
          module: "frontmost",
          message: nameResult.stderr.trim() || "Failed to get frontmost app",
          code: "error",
        },
        timingMs: t.elapsed(),
      };
    }

    const appName = nameResult.stdout.trim() || "Unknown";
    if (!appName) {
      return {
        data: { app_name: "Unknown", bundle_id: "unknown" },
        permission: "granted" as PermissionState,
        timingMs: t.elapsed(),
      };
    }

    const idResult = await run("osascript", [
      "-e",
      `id of application "${appName.replace(/"/g, '\\"')}"`,
    ], { timeoutMs });
    const bundle_id = idResult.ok ? idResult.stdout.trim() || "unknown" : "unknown";

    const frontmost: Frontmost = { app_name: appName, bundle_id };

    if (includeWindow) {
      const windowResult = await run("osascript", [
        "-e",
        'tell application "System Events" to tell (first application process whose frontmost is true) to get name of front window',
      ], { timeoutMs });

      if (windowResult.timedOut) {
        warnings.push("frontmost window: timeout");
      } else if (!windowResult.ok) {
        if (isAccessibilityDenied(windowResult.stderr)) {
          return {
            data: frontmost,
            permission: "denied" as PermissionState,
            error: {
              module: "frontmost",
              message: "Accessibility permission required for window title",
              code: "permission_denied",
            },
            warnings: warnings.length ? warnings : undefined,
            timingMs: t.elapsed(),
          };
        }
        warnings.push("frontmost window: " + (windowResult.stderr.trim() || "unknown"));
      } else {
        const rawTitle = windowResult.stdout.trim() ?? "";
        if (redact) {
          const r = redactString(rawTitle);
          frontmost.window_title_sha256 = r.sha256;
          frontmost.window_title_length = r.length;
        } else {
          frontmost.window_title = rawTitle;
          frontmost.window_title_length = rawTitle.length;
        }
      }
    }

    return {
      data: frontmost,
      permission: "granted" as PermissionState,
      warnings: warnings.length ? warnings : undefined,
      timingMs: t.elapsed(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      warnings,
      error: { module: "frontmost", message, code: "error" },
      timingMs: t.elapsed(),
    };
  }
}

async function collectFrontmostLinux(options: CollectOptions): Promise<ModuleResult<Frontmost>> {
  const t = timer();
  const timeoutMs = options.timeoutMs;
  const includeWindow = options.includeFrontmostWindow;
  const redact = options.redact;
  const warnings: string[] = [];

  try {
    // xdotool: get active window PID and title (X11; may not work on Wayland)
    const pidResult = await run("xdotool", ["getactivewindow", "getwindowpid"], { timeoutMs });
    const titleResult = includeWindow
      ? await run("xdotool", ["getactivewindow", "getwindowname"], { timeoutMs })
      : { ok: false, stdout: "", stderr: "", timedOut: false };

    if (pidResult.timedOut) {
      return {
        warnings: [...warnings, "frontmost: timeout"],
        error: { module: "frontmost", message: "Timeout", code: "timeout" },
        timingMs: t.elapsed(),
      };
    }

    let appName = "Unknown";
    let bundle_id = "unknown";

    if (pidResult.ok && pidResult.stdout.trim()) {
      const pid = pidResult.stdout.trim();
      const commResult = await run("cat", [`/proc/${pid}/comm`], { timeoutMs });
      if (commResult.ok && commResult.stdout.trim()) {
        appName = commResult.stdout.trim().replace(/\n$/, "");
        bundle_id = appName;
      }
    }

    const frontmost: Frontmost = { app_name: appName, bundle_id };

    if (includeWindow && titleResult.ok) {
      const rawTitle = titleResult.stdout.trim() ?? "";
      if (redact) {
        const r = redactString(rawTitle);
        frontmost.window_title_sha256 = r.sha256;
        frontmost.window_title_length = r.length;
      } else {
        frontmost.window_title = rawTitle;
        frontmost.window_title_length = rawTitle.length;
      }
    } else if (includeWindow && !pidResult.ok) {
      warnings.push("frontmost: xdotool not available or no X11 (e.g. Wayland); install xdotool for X11");
    }

    return {
      data: frontmost,
      warnings: warnings.length ? warnings : undefined,
      timingMs: t.elapsed(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      warnings,
      error: { module: "frontmost", message, code: "error" },
      timingMs: t.elapsed(),
    };
  }
}

export async function collectFrontmost(options: CollectOptions): Promise<ModuleResult<Frontmost>> {
  const platform = getPlatform();
  if (platform === "darwin") return collectFrontmostDarwin(options);
  if (platform === "linux") return collectFrontmostLinux(options);
  return {
    data: { app_name: "Unknown", bundle_id: "unknown" },
    error: { module: "frontmost", message: `Unsupported platform: ${process.platform}`, code: "unsupported" },
    timingMs: 0,
  };
}
