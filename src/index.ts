#!/usr/bin/env node
import { Command } from "commander";
import { SCHEMA_VERSION, type Output, type StructuredError } from "./schema.js";
import { createPermissionsState } from "./modules/permissions.js";
import { collectHost } from "./modules/host.js";
import { collectFrontmost } from "./modules/frontmost.js";
import { collectApps } from "./modules/apps.js";
import { collectClipboard } from "./modules/clipboard.js";
import { collectBattery } from "./modules/battery.js";
import { collectNetwork } from "./modules/network.js";
import { collectCalendar } from "./modules/calendar.js";
import { collectReminders } from "./modules/reminders.js";
import { updatePermission } from "./modules/permissions.js";
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
    .option("--timeout-ms <n>", "Per-module timeout in ms", (v) => parseInt(v, 10), DEFAULT_TIMEOUT_MS)
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
  const opts = program.opts();
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
  function setExit(code: 2 | 3 | 4): void {
    if (code === 2) exitCode = 2;
    else if (code === 3 && exitCode !== 2) exitCode = 3;
    else if (code === 4 && exitCode !== 2 && exitCode !== 3) exitCode = 4;
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

  // --- Apps (opt-in) ---
  let appsResult: { data?: unknown; warnings?: string[]; error?: StructuredError; timingMs?: number } = {};
  if (options.includeApps) {
    appsResult = await collectApps(options.timeoutMs);
    if (appsResult.timingMs != null) recordTiming("apps", appsResult.timingMs);
    if (appsResult.error) {
      addError("apps", appsResult.error.message, appsResult.error.code);
      if (appsResult.error.code === "timeout") setExit(3);
    }
    if (appsResult.warnings) warnings.push(...appsResult.warnings);
  }

  // --- Clipboard (opt-in) ---
  let clipboardResult: { data?: unknown; warnings?: string[]; error?: StructuredError; timingMs?: number } = {};
  if (options.includeClipboard) {
    clipboardResult = await collectClipboard(options);
    if (clipboardResult.timingMs != null) recordTiming("clipboard", clipboardResult.timingMs);
    if (clipboardResult.error) {
      addError("clipboard", clipboardResult.error.message, clipboardResult.error.code);
      if (clipboardResult.error.code === "timeout") setExit(3);
    }
    if (clipboardResult.warnings) warnings.push(...clipboardResult.warnings);
  }

  // --- Battery (opt-in) ---
  let batteryResult: { data?: unknown; warnings?: string[]; error?: StructuredError; timingMs?: number } = {};
  if (options.includeBattery) {
    batteryResult = await collectBattery(options.timeoutMs);
    if (batteryResult.timingMs != null) recordTiming("battery", batteryResult.timingMs);
    if (batteryResult.error) {
      addError("battery", batteryResult.error.message, batteryResult.error.code);
      if (batteryResult.error.code === "timeout") setExit(3);
    }
    if (batteryResult.warnings) warnings.push(...batteryResult.warnings);
  }

  // --- Network (opt-in) ---
  let networkResult: { data?: unknown; warnings?: string[]; error?: StructuredError; timingMs?: number } = {};
  if (options.includeNetwork) {
    networkResult = await collectNetwork(options.timeoutMs);
    if (networkResult.timingMs != null) recordTiming("network", networkResult.timingMs);
    if (networkResult.error) {
      addError("network", networkResult.error.message, networkResult.error.code);
      if (networkResult.error.code === "timeout") setExit(3);
    }
    if (networkResult.warnings) warnings.push(...networkResult.warnings);
  }

  // --- Calendar (opt-in) ---
  let calendarResult: {
    data?: unknown;
    warnings?: string[];
    error?: StructuredError;
    permission?: import("./schema.js").PermissionState;
    timingMs?: number;
  } = {};
  if (options.includeCalendar) {
    calendarResult = await collectCalendar(options);
    if (calendarResult.timingMs != null) recordTiming("calendar", calendarResult.timingMs);
    if (calendarResult.permission) updatePermission(permissions, "calendar", calendarResult.permission);
    if (calendarResult.error) {
      addError("calendar", calendarResult.error.message, calendarResult.error.code);
      if (calendarResult.permission === "denied") setExit(2);
      else if (calendarResult.error.code === "timeout") setExit(3);
      else setExit(4);
    }
    if (calendarResult.warnings) warnings.push(...calendarResult.warnings);
  }

  // --- Reminders (opt-in) ---
  let remindersResult: {
    data?: unknown;
    warnings?: string[];
    error?: StructuredError;
    permission?: import("./schema.js").PermissionState;
    timingMs?: number;
  } = {};
  if (options.includeReminders) {
    remindersResult = await collectReminders(options);
    if (remindersResult.timingMs != null) recordTiming("reminders", remindersResult.timingMs);
    if (remindersResult.permission) updatePermission(permissions, "reminders", remindersResult.permission);
    if (remindersResult.error) {
      addError("reminders", remindersResult.error.message, remindersResult.error.code);
      if (remindersResult.permission === "denied") setExit(2);
      else if (remindersResult.error.code === "timeout") setExit(3);
      else setExit(4);
    }
    if (remindersResult.warnings) warnings.push(...remindersResult.warnings);
  }

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

main();
