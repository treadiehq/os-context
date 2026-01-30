---
name: os-context
description: Get current machine context (OS, frontmost app, clipboard, battery, network, calendar, reminders) via the os-context CLI. Use when the user asks what they're doing, what's on screen, battery status, calendar, reminders, or when you need local context to tailor your response.
homepage: https://github.com/treadiehq/os-context
metadata: {"openclaw":{"os":["darwin","linux"],"requires":{"anyBins":["context","npx"]},"emoji":"🖥️","install":[{"id":"npm","kind":"node","package":"os-context","bins":["context"],"label":"Install os-context (npm)"}]}}
---

# os-context

Get current machine context (frontmost app, clipboard, battery, network, calendar, reminders) as JSON. Run the CLI and parse the output to answer “what am I doing?”, “what’s on screen?”, battery/calendar/reminders, etc.

## Quick start

```bash
context --pretty --apps --clipboard --battery --network --calendar --reminders --timeout-ms 2000
```

If `context` is not in PATH, use `npx os-context` with the same flags. Use `--timeout-ms 2000` to reduce timeouts; omit `--calendar` or `--reminders` for faster basic context.

## Output (JSON)

- **host**: `os`, `os_version`, `machine`, `locale`, `timezone`
- **frontmost**: `app_name`, `bundle_id`, optionally `window_title` (if `--frontmost-window`)
- **apps**: list of running apps (name, bundle_id, pid) when `--apps`
- **clipboard**: `available`, `text` or redacted `text_sha256`/`text_length` when `--clipboard`
- **battery**: `percentage` (0–1), `is_charging`, `power_source` when `--battery`
- **network**: `primary_interface`, `ssid`, `has_internet` when `--network`
- **calendar**: next events (start, end, title, location) when `--calendar` (macOS only)
- **reminders**: incomplete reminders (title, due, list) when `--reminders` (macOS only)
- **permissions**: `accessibility`, `calendar`, `reminders` — granted/denied/not_requested
- **errors** / **warnings**: if something failed or timed out, still use whatever fields are present

Interpret the JSON and answer the user (e.g. “You’re in Cursor, battery at 80% and charging, next meeting in 15 minutes”). If a module failed or timed out, say so and use the rest of the context.

## Useful flags

- `--pretty` — pretty-print JSON
- `--frontmost-window` — include window title (macOS Accessibility)
- `--apps`, `--clipboard`, `--battery`, `--network`, `--calendar`, `--reminders` — include those modules
- `--redact` — redact sensitive strings (SHA-256 + length only)
- `--timeout-ms <n>` — per-module timeout (default 250)

## Notes

- Read-only and local; no external network. Sensitive data (clipboard, window title, calendar, reminders) only when you pass the matching flags. Default run is minimal (host + frontmost app name).
- To add this skill to OpenClaw: copy this file to `~/.openclaw/skills/os-context/SKILL.md` or to `<workspace>/skills/os-context/SKILL.md`; or run `clawhub install <slug>` if published on [ClawHub](https://clawhub.com). See [Skills](https://docs.openclaw.ai/tools/skills).
