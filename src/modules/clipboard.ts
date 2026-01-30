import { run } from "../util/exec.js";
import { timer } from "../util/time.js";
import { redactString } from "../util/redact.js";
import { getPlatform } from "../util/platform.js";
import type { Clipboard } from "../schema.js";
import type { CollectOptions } from "../index.js";
import type { ModuleResult } from "../schema.js";

async function collectClipboardDarwin(_options: CollectOptions): Promise<ModuleResult<Clipboard>> {
  // TODO: pbpaste, types, redact
  return {
    data: { available: false, types: [] },
    timingMs: 0,
  };
}

async function collectClipboardLinux(options: CollectOptions): Promise<ModuleResult<Clipboard>> {
  const t = timer();
  const timeoutMs = options.timeoutMs;
  const redact = options.redact;
  try {
    // Try xclip first (primary selection -o), then xsel
    let result = await run("xclip", ["-selection", "clipboard", "-o"], { timeoutMs });
    if (!result.ok) {
      result = await run("xsel", ["--clipboard", "--output"], { timeoutMs });
    }
    if (!result.ok) {
      return {
        data: { available: false, types: [] },
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
