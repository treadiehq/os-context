# os-context

A fast macOS & Linux CLI that prints a single JSON object describing your current local context for agents. Privacy-respecting, read-only, no network calls to external services.

os-context gives AI agents a quick, local snapshot of your machine (app, window, clipboard, battery, network, etc.) so they can give context-aware answers without screenshots or daemons. Sensitive data is opt-in; default output is minimal and private.

## Goals

- **Single command**: `os-context` outputs JSON to stdout.
- **Fast**: Target &lt;300ms typical; local-only, no external network.
- **Read-only**: No daemon, no always-on logging.
- **Privacy**: No screenshots, keystrokes, microphone/camera, or recording.
- **Clear permissions**: Only request macOS permissions when you use the matching flag (e.g. `--frontmost-window`, `--calendar`).
- **Feature flags**: Sensitive data (clipboard, window title, calendar, reminders) is opt-in.

## Install

```bash
npm install
npm run build
# Or link globally: npm link
```

## Usage

**Default (safe core context only):**

```bash
os-context
```

**Pretty-print with frontmost window and clipboard, redact sensitive fields:**

```bash
os-context --pretty --frontmost-window --clipboard --redact
```

**All optional features and debug timings:**

```bash
os-context --pretty --clipboard --frontmost-window --apps \
  --battery --network --calendar --reminders \
  --redact --debug
```

## Options

| Flag | Description |
|------|-------------|
| `--pretty` | Pretty-print JSON. |
| `--clipboard` | Include clipboard text (and types). |
| `--frontmost-window` | Include frontmost window title (requires Accessibility). |
| `--apps` | Include list of running apps (name, bundle_id, pid). |
| `--battery` | Include battery percentage and charging state. |
| `--network` | Include primary interface, SSID, local reachability. |
| `--calendar` | Include next calendar events (requires Calendar permission). |
| `--reminders` | Include reminders (requires Reminders permission). |
| `--redact` | Redact sensitive strings; output SHA-256 + length only. |
| `--timeout-ms <n>` | Per-module timeout in ms (default 250). |
| `--debug` | Include per-module timings in `_debug.timings_ms`. |

## Exit codes

- **0** — Success.
- **2** — Required permission missing (e.g. Accessibility or Calendar denied).
- **3** — Timeout.
- **4** — Other error.

JSON is always printed, even when exit code is non-zero.

## Platform support

- **macOS**: Full support. Calendar and Reminders are macOS-only (AppleScript).
- **Linux**: Host, frontmost (X11 via `xdotool`), apps (`ps`), clipboard (`xclip` or `xsel`), battery (`/sys/class/power_supply`), network (`ip`, `iwgetid`). Window title on Linux requires X11; on Wayland `xdotool` may not work. Calendar/Reminders return empty on Linux.
- **Optional Linux deps**: `xdotool` (frontmost/window), `xclip` or `xsel` (clipboard), `iwgetid` (WiFi SSID).

## Permissions

- **Default run** does not require Accessibility, Calendar, or Reminders. It only reads OS version, machine, locale, timezone, and frontmost app name/bundle ID.
- **Accessibility** (macOS) is only needed for `--frontmost-window` (to read window titles).
- **Calendar / Reminders** (macOS) are only used when you pass `--calendar` or `--reminders`.

See [docs/permissions.md](docs/permissions.md) for details and troubleshooting.

## Output schema

See [docs/schema.md](docs/schema.md) for the full JSON schema. Top-level keys include `schema_version`, `generated_at`, `host`, `frontmost`, optional `apps`, `clipboard`, `battery`, `network`, `calendar`, `reminders`, `permissions`, `warnings`, `errors`, and optionally `_debug`.

## Development

```bash
npm run dev -- --pretty
npm run build
npm test
```

## License

[FSL-1.1-MIT](LICENSE)
