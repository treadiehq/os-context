# os-context Permissions

os-context is read-only and only uses macOS APIs that may require permission when you enable the corresponding feature.

## Default run (no extra permissions)

Running `os-context` with no flags only reads:

- System version and machine (e.g. `sw_vers`, `uname`)
- Locale and timezone (Node `Intl` or system)
- Frontmost application name and bundle ID (via AppleScript / System Events)

On most macOS setups this does **not** trigger any permission prompts. If your system restricts AppleScript/System Events, you may see a one-time prompt for automation.

## Opt-in features and permissions

| Flag | What it reads | Permission / note |
|------|----------------|--------------------|
| `--include-frontmost-window` | Title of the frontmost window | **Accessibility** (System Preferences → Privacy & Security → Accessibility). Required to query window names via System Events. |
| `--include-clipboard` | Clipboard text and types | Pasteboard access (often no prompt; may vary). |
| `--include-apps` | List of running apps (name, bundle_id, pid) | Uses System Events; same as default frontmost. |
| `--include-calendar` | Next calendar events | **Calendar** (Privacy & Security → Calendars). |
| `--include-reminders` | Incomplete reminders | **Reminders** (Privacy & Security → Reminders). |
| `--include-battery` | Battery % and charging | No special permission. |
| `--include-network` | Primary interface, SSID, local reachability | No special permission. |

## Exit code 2 (permission missing)

If you use `--include-frontmost-window`, `--include-calendar`, or `--include-reminders` and the required permission is denied, os-context will:

- Still print valid JSON.
- Set `permissions.accessibility` or `permissions.calendar` / `permissions.reminders` to `"denied"`.
- Include an error in `errors` for that module.
- Exit with code **2**.

Grant the required permission in System Settings and run again.

## Accessibility (window title) troubleshooting

1. Open **System Settings → Privacy & Security → Accessibility**.
2. Add your terminal app (Terminal, iTerm, Cursor, etc.) or the `node` binary if you run via `node dist/index.js`.
3. If you use `os-context` as a global CLI (`npm i -g` or `npx`), add **Terminal** (or the app that runs the script).
4. Restart the terminal after changing the list.
5. Run again: `os-context --include-frontmost-window`.

If permission is still denied, the JSON will contain `permissions.accessibility: "denied"` and an error entry; no window title will be included.
