import { run } from "../util/exec.js";
import { timer } from "../util/time.js";
import { redactString } from "../util/redact.js";
import { getPlatform } from "../util/platform.js";
import type { Clipboard } from "../schema.js";
import type { CollectOptions } from "../index.js";
import type { ModuleResult } from "../schema.js";

async function collectClipboardDarwin(options: CollectOptions): Promise<ModuleResult<Clipboard>> {
  const t = timer();
  const timeoutMs = options.timeoutMs;
  const redact = options.redact;
  try {
    const result = await run("pbpaste", [], { timeoutMs });
    const text = result.ok ? (result.stdout ?? "") : "";
    const types = text.length > 0 ? ["public.utf8-plain-text"] : [];
    const data: Clipboard = {
      available: result.ok,
      types,
    };
    if (text.length > 0) {
      if (redact) {
        const r = redactString(text);
        data.text_sha256 = r.sha256;
        data.text_length = r.length;
      } else {
        data.text = text;
        data.text_length = text.length;
      }
    }
    return { data, timingMs: t.elapsed() };
  } catch {
    return {
      data: { available: false, types: [] },
      timingMs: t.elapsed(),
    };
  }
}

/** xclip/xsel stderr when clipboard is empty (no content to read). */
function isLinuxClipboardEmptyStderr(stderr: string): boolean {
  const s = (stderr ?? "").toLowerCase();
  return (
    /not available|no selection|unable to get|clipboard.*empty|target.*not available|no clipboard owner/i.test(s)
  );
}

async function collectClipboardLinux(options: CollectOptions): Promise<ModuleResult<Clipboard>> {
  const t = timer();
  const timeoutMs = options.timeoutMs;
  const redact = options.redact;
  try {
    let result = await run("xclip", ["-selection", "clipboard", "-o"], { timeoutMs });
    if (!result.ok) {
      result = await run("xsel", ["--clipboard", "--output"], { timeoutMs });
    }
    if (result.timedOut) {
      return {
        data: { available: false, types: [] },
        error: { module: "clipboard", message: "Timeout", code: "timeout" },
        timingMs: t.elapsed(),
      };
    }
    if (!result.ok) {
      if (isLinuxClipboardEmptyStderr(result.stderr ?? "")) {
        return {
          data: { available: true, types: [] },
          timingMs: t.elapsed(),
        };
      }
      return {
        data: { available: false, types: [] },
        error: {
          module: "clipboard",
          message: (result.stderr ?? "").trim() || "Failed to get clipboard",
          code: "error",
        },
        timingMs: t.elapsed(),
      };
    }
    const text = result.stdout ?? "";
    const types = text.length > 0 ? ["text/plain"] : [];
    const data: Clipboard = {
      available: true,
      types,
    };
    if (text.length > 0) {
      if (redact) {
        const r = redactString(text);
        data.text_sha256 = r.sha256;
        data.text_length = r.length;
      } else {
        data.text = text;
        data.text_length = text.length;
      }
    }
    return { data, timingMs: t.elapsed() };
  } catch {
    return {
      data: { available: false, types: [] },
      timingMs: t.elapsed(),
    };
  }
}

export async function collectClipboard(options: CollectOptions): Promise<ModuleResult<Clipboard>> {
  const platform = getPlatform();
  if (platform === "darwin") return collectClipboardDarwin(options);
  if (platform === "linux") return collectClipboardLinux(options);
  return {
    data: { available: false, types: [] },
    timingMs: 0,
  };
}
