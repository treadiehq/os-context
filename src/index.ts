#!/usr/bin/env node
import { Command } from "commander";
import { SCHEMA_VERSION, type Output, type StructuredError } from "./schema.js";
import { createPermissionsState, updatePermission } from "./modules/permissions.js";
import { collectHost } from "./modules/host.js";
import { collectFrontmost } from "./modules/frontmost.js";
import { collectApps } from "./modules/apps.js";
import { collectClipboard } from "./modules/clipboard.js";
import { collectBattery } from "./modules/battery.js";
import { collectNetwork } from "./modules/network.js";
import { collectCalendar } from "./modules/calendar.js";
import { collectReminders } from "./modules/reminders.js";
import { stableStringify } from "./util/json.js";

export interface CollectOptions {
  pretty: boolean;
  includeClipboard: boolean;
  includeFrontmostWindow: boolean;
  includeApps: boolean;
  includeBattery: boolean;
  includeNetwork: boolean;
  includeCalendar: boolean;
  includeReminders: boolean;
  redact: boolean;
  timeoutMs: number;
  debug: boolean;
}

const DEFAULT_TIMEOUT_MS = 250;

function parseArgs(): CollectOptions {
  const program = new Command();
  program
    .name("context")
    .description(
      "Print a single JSON object describing your current local context (for agents). " +
        "Supports macOS and Linux. Privacy-respecting, read-only, no network calls to external services. " +
        "Sensitive data (clipboard, window title, calendar, reminders) is opt-in via flags."
    )
    .option("--pretty", "Pretty-print JSON")
    .option("--clipboard", "Include clipboard text (may prompt for pasteboard access)")
    .option(
      "--frontmost-window",
      "Include frontmost window title (requires Accessibility permission)"
    )
    .option("--apps", "Include list of running apps (name, bundle_id, pid)")
    .option("--battery", "Include battery percentage and charging state")
    .option("--network", "Include primary interface, SSID, local reachability")
    .option("--calendar", "Include next calendar events (requires Calendar permission)")
    .option("--reminders", "Include reminders (requires Reminders permission)")
    .option(
      "--redact",
      "Redact sensitive string fields (clipboard, window title, event/reminder titles); output sha256 + length"
    )
    .option("--timeout-ms <n>", "Per-module timeout in ms", (v) => {
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
    }, DEFAULT_TIMEOUT_MS)
    .option("--debug", "Include per-module timings in JSON under _debug")
    .addHelpText(
      "after",
      `
Privacy & permissions:
  By default, context only reads safe system info (OS, machine, locale, frontmost app name).
  It does NOT read clipboard, window titles, calendar, or reminders unless you pass the
  corresponding flag (--clipboard, --frontmost-window, etc.). Accessibility is only required for --frontmost-window.
  Calendar/Reminders permissions are only requested when --calendar or --reminders
  is used. No screenshots, keystrokes, or recording of any kind.
`
    );
  program.parse();
  const opts = program.opts<{
    pretty?: boolean;
    clipboard?: boolean;
    frontmostWindow?: boolean;
    apps?: boolean;
    battery?: boolean;
    network?: boolean;
    calendar?: boolean;
    reminders?: boolean;
    redact?: boolean;
    timeoutMs?: number;
    debug?: boolean;
  }>();
  return {
    pretty: opts.pretty ?? false,
    includeClipboard: opts.clipboard ?? false,
    includeFrontmostWindow: opts.frontmostWindow ?? false,
    includeApps: opts.apps ?? false,
    includeBattery: opts.battery ?? false,
    includeNetwork: opts.network ?? false,
    includeCalendar: opts.calendar ?? false,
    includeReminders: opts.reminders ?? false,
    redact: opts.redact ?? false,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    debug: opts.debug ?? false,
  };
}

export type ExitCode = 0 | 2 | 3 | 4;

export async function collectAll(options: CollectOptions): Promise<{ output: Output; exitCode: ExitCode }> {
  const permissions = createPermissionsState();
  const warnings: string[] = [];
  const errors: StructuredError[] = [];
  const timingsMs: Record<string, number> = {};
  let exitCode: ExitCode = 0;

  function addError(module: string, message: string, code?: string): void {
    errors.push({ module, message, code });
  }
  /**
   * Set the process exit code with priority ordering.
   * Higher-priority codes are never overwritten by lower-priority ones:
   *   2 (permission denied)  >  3 (timeout)  >  4 (general error)  >  0 (success)
   */
  function setExit(code: 2 | 3 | 4): void {
    // Priority map: lower numeric value = higher priority
    const priority: Record<ExitCode, number> = { 2: 0, 3: 1, 4: 2, 0: 3 };
    if (priority[code] < priority[exitCode]) exitCode = code;
  }
  function recordTiming(name: string, ms: number): void {
    timingsMs[name] = ms;
  }

  // --- Host (always) ---
  const hostResult = await collectHost(options.timeoutMs);
  if (hostResult.timingMs != null) recordTiming("host", hostResult.timingMs);
  if (hostResult.error) {
    addError("host", hostResult.error.message, hostResult.error.code);
    if (hostResult.error.code === "timeout") setExit(3);
    else setExit(4);
  }
  if (hostResult.warnings) warnings.push(...hostResult.warnings);

  // --- Frontmost (always: app name + bundle id; window only if flag) ---
  const frontmostResult = await collectFrontmost(options);
  if (frontmostResult.timingMs != null) recordTiming("frontmost", frontmostResult.timingMs);
  if (frontmostResult.permission) updatePermission(permissions, "accessibility", frontmostResult.permission);
  if (frontmostResult.error) {
    addError("frontmost", frontmostResult.error.message, frontmostResult.error.code);
    if (frontmostResult.permission === "denied") setExit(2);
    else if (frontmostResult.error.code === "timeout") setExit(3);
    else setExit(4);
  }
  if (frontmostResult.warnings) warnings.push(...frontmostResult.warnings);

  // --- Opt-in collectors (run concurrently for lower total latency) ---
  type SimpleResult = { data?: unknown; warnings?: string[]; error?: StructuredError; timingMs?: number };
  type PermResult = SimpleResult & { permission?: import("./schema.js").PermissionState };

  const [
    appsSettled,
    clipboardSettled,
    batterySettled,
    networkSettled,
    calendarSettled,
    remindersSettled,
  ] = await Promise.allSettled([
    options.includeApps      ? collectApps(options.timeoutMs)    : Promise.resolve(null),
    options.includeClipboard ? collectClipboard(options)         : Promise.resolve(null),
    options.includeBattery   ? collectBattery(options.timeoutMs) : Promise.resolve(null),
    options.includeNetwork   ? collectNetwork(options.timeoutMs) : Promise.resolve(null),
    options.includeCalendar  ? collectCalendar(options)          : Promise.resolve(null),
    options.includeReminders ? collectReminders(options)         : Promise.resolve(null),
  ]);

  /** Extract value from a settled result, logging unexpected rejections. */
  function unwrap<T>(settled: PromiseSettledResult<T | null>, module: string): T | null {
    if (settled.status === "fulfilled") return settled.value;
    addError(module, String(settled.reason));
    setExit(4);
    return null;
  }

  /** Process timing, errors, and warnings for a simple collector result. */
  function processSimple(result: SimpleResult | null, name: string): SimpleResult {
    if (!result) return {};
    if (result.timingMs != null) recordTiming(name, result.timingMs);
    if (result.error) {
      addError(name, result.error.message, result.error.code);
      if (result.error.code === "timeout") setExit(3);
      else setExit(4);
    }
    if (result.warnings) warnings.push(...result.warnings);
    return result;
  }

  /** Process a collector result that may include permission info. */
  function processPerm(
    result: PermResult | null,
    name: string,
    permKey: "calendar" | "reminders",
  ): PermResult {
    if (!result) return {};
    if (result.timingMs != null) recordTiming(name, result.timingMs);
    if (result.permission) updatePermission(permissions, permKey, result.permission);
    if (result.error) {
      addError(name, result.error.message, result.error.code);
      if (result.permission === "denied") setExit(2);
      else if (result.error.code === "timeout") setExit(3);
      else setExit(4);
    }
    if (result.warnings) warnings.push(...result.warnings);
    return result;
  }

  const appsResult      = processSimple(unwrap<SimpleResult>(appsSettled, "apps"), "apps");
  const clipboardResult = processSimple(unwrap<SimpleResult>(clipboardSettled, "clipboard"), "clipboard");
  const batteryResult   = processSimple(unwrap<SimpleResult>(batterySettled, "battery"), "battery");
  const networkResult   = processSimple(unwrap<SimpleResult>(networkSettled, "network"), "network");
  const calendarResult  = processPerm(unwrap<PermResult>(calendarSettled, "calendar"), "calendar", "calendar");
  const remindersResult = processPerm(unwrap<PermResult>(remindersSettled, "reminders"), "reminders", "reminders");

  const output: Output = {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    permissions,
    warnings: warnings.length ? warnings : undefined,
    errors: errors.length ? errors : undefined,
  };
  if (hostResult.data != null) output.host = hostResult.data as Output["host"];
  if (frontmostResult.data != null) output.frontmost = frontmostResult.data as Output["frontmost"];
  if (appsResult.data != null) output.apps = appsResult.data as Output["apps"];
  if (clipboardResult.data != null) output.clipboard = clipboardResult.data as Output["clipboard"];
  if (batteryResult.data != null) output.battery = batteryResult.data as Output["battery"];
  if (networkResult.data != null) output.network = networkResult.data as Output["network"];
  if (calendarResult.data != null) output.calendar = calendarResult.data as Output["calendar"];
  if (remindersResult.data != null) output.reminders = remindersResult.data as Output["reminders"];
  if (options.debug) output._debug = { timings_ms: timingsMs };

  return { output, exitCode };
}

async function main(): Promise<void> {
  const options = parseArgs();
  const { output, exitCode } = await collectAll(options);
  console.log(stableStringify(output, options.pretty));
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(4);
});
