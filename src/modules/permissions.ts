import type { PermissionState, Permissions } from "../schema.js";

const DEFAULT: PermissionState = "not_requested";

export function createPermissionsState(): Permissions {
  return {
    accessibility: DEFAULT,
    calendar: DEFAULT,
    reminders: DEFAULT,
  };
}

export function updatePermission(
  state: Permissions,
  key: keyof Permissions,
  value: PermissionState
): void {
  state[key] = value;
}
