# os-context Output Schema

The CLI prints a single JSON object to stdout. All fields are optional except `schema_version`, `generated_at`, and `permissions`.

## Top-level keys

| Key | Type | Description |
|-----|------|-------------|
| `schema_version` | string | Version of this schema (e.g. `"0.1.0"`). |
| `generated_at` | string | ISO8601 timestamp when the output was generated. |
| `host` | object | OS, version, machine, locale, timezone. Always present when host module succeeds. |
| `frontmost` | object | Frontmost app name, bundle id; optionally window title (or redacted). |
| `apps` | array | List of running apps (name, bundle_id, pid). Only with `--include-apps`. |
| `clipboard` | object | Clipboard availability, types, and optionally text (or redacted). Only with `--include-clipboard`. |
| `battery` | object | Percentage, charging state, power source. Only with `--include-battery`. |
| `network` | object | Primary interface, SSID, local reachability. Only with `--include-network`. |
| `calendar` | array | Next calendar events. Only with `--include-calendar`. |
| `reminders` | array | Incomplete reminders. Only with `--include-reminders`. |
| `permissions` | object | Best-effort accessibility, calendar, reminders permission state. |
| `warnings` | array | Non-fatal warnings from collectors. |
| `errors` | array | Per-module errors (module, message, code). |
| `_debug` | object | Per-module timings in ms. Only with `--debug`. |

## Object shapes

- **host**: `os` (`"macos"` or `"linux"`), `os_version`, `machine`, `locale`, `timezone`.
- **frontmost**: `app_name`, `bundle_id`; optionally `window_title` or `window_title_sha256` + `window_title_length`.
- **clipboard**: `available`, `types`; optionally `text` or `text_sha256` + `text_length`.
- **battery**: `percentage` (0–1), `is_charging`, `power_source` (`"ac"` \| `"battery"` \| `"unknown"`).
- **network**: `primary_interface`, optional `ssid`, `has_internet`.
- **permissions**: `accessibility`, `calendar`, `reminders` — each `"granted"` \| `"denied"` \| `"not_requested"` \| `"unknown"`.

Errors and warnings are always included when present so the output remains valid and informative even on partial failure.
