import { z } from "zod";

export const SCHEMA_VERSION = "0.1.0";

// --- Host ---
export const HostSchema = z.object({
  os: z.enum(["macos", "linux"]),
  os_version: z.string(),
  machine: z.string(),
  locale: z.string(),
  timezone: z.string(),
});
export type Host = z.infer<typeof HostSchema>;

// --- Frontmost ---
export const FrontmostSchema = z.object({
  app_name: z.string(),
  bundle_id: z.string(),
  window_title: z.string().optional(),
  window_title_sha256: z.string().optional(),
  window_title_length: z.number().optional(),
});
export type Frontmost = z.infer<typeof FrontmostSchema>;

// --- Apps ---
export const AppEntrySchema = z.object({
  name: z.string(),
  bundle_id: z.string(),
  pid: z.number(),
});
export type AppEntry = z.infer<typeof AppEntrySchema>;

// --- Clipboard ---
export const ClipboardSchema = z.object({
  available: z.boolean(),
  types: z.array(z.string()),
  text: z.string().optional(),
  text_sha256: z.string().optional(),
  text_length: z.number().optional(),
});
export type Clipboard = z.infer<typeof ClipboardSchema>;

// --- Battery ---
export const BatterySchema = z.object({
  percentage: z.number(),
  is_charging: z.boolean(),
  power_source: z.enum(["ac", "battery", "unknown"]),
});
export type Battery = z.infer<typeof BatterySchema>;

// --- Network ---
export const NetworkSchema = z.object({
  primary_interface: z.string(),
  ssid: z.string().optional(),
  has_internet: z.boolean(),
});
export type Network = z.infer<typeof NetworkSchema>;

// --- Calendar ---
export const CalendarEventSchema = z.object({
  start: z.string(),
  end: z.string(),
  title: z.string().optional(),
  title_sha256: z.string().optional(),
  title_length: z.number().optional(),
  location: z.string().optional(),
  location_sha256: z.string().optional(),
  location_length: z.number().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

// --- Reminders ---
export const ReminderSchema = z.object({
  title: z.string().optional(),
  title_sha256: z.string().optional(),
  title_length: z.number().optional(),
  due: z.string().optional(),
  list: z.string().optional(),
});
export type Reminder = z.infer<typeof ReminderSchema>;

// --- Permissions ---
export const PermissionStateSchema = z.enum([
  "granted",
  "denied",
  "not_requested",
  "unknown",
]);
export type PermissionState = z.infer<typeof PermissionStateSchema>;

export const PermissionsSchema = z.object({
  accessibility: PermissionStateSchema,
  calendar: PermissionStateSchema,
  reminders: PermissionStateSchema,
});
export type Permissions = z.infer<typeof PermissionsSchema>;

// --- Errors ---
export const StructuredErrorSchema = z.object({
  module: z.string(),
  message: z.string(),
  code: z.string().optional(),
});
export type StructuredError = z.infer<typeof StructuredErrorSchema>;

// --- Debug ---
export const DebugSchema = z.object({
  timings_ms: z.record(z.string(), z.number()),
});
export type Debug = z.infer<typeof DebugSchema>;

// --- Output ---
export const OutputSchema = z.object({
  schema_version: z.string(),
  generated_at: z.string(),
  host: HostSchema.optional(),
  frontmost: FrontmostSchema.optional(),
  apps: z.array(AppEntrySchema).optional(),
  clipboard: ClipboardSchema.optional(),
  battery: BatterySchema.optional(),
  network: NetworkSchema.optional(),
  calendar: z.array(CalendarEventSchema).optional(),
  reminders: z.array(ReminderSchema).optional(),
  permissions: PermissionsSchema,
  warnings: z.array(z.string()).optional(),
  errors: z.array(StructuredErrorSchema).optional(),
  _debug: DebugSchema.optional(),
});
export type Output = z.infer<typeof OutputSchema>;

// --- Module result ---
export interface ModuleResult<T = unknown> {
  data?: T;
  warnings?: string[];
  error?: StructuredError;
  permission?: PermissionState;
  timingMs?: number;
}
