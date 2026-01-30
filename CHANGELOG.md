# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0] - 2025-01-30

### Added

- Initial release.
- CLI `context` (product: os-context) with commander: `--pretty`, `--clipboard`, `--frontmost-window`, `--apps`, `--battery`, `--network`, `--calendar`, `--reminders`, `--redact`, `--timeout-ms`, `--debug`.
- Output JSON with `schema_version`, `generated_at`, `permissions`, and optional `host`, `frontmost`, `apps`, `clipboard`, `battery`, `network`, `calendar`, `reminders`, `warnings`, `errors`, `_debug`.
- **host** module: OS version, machine, locale, timezone (safe default).
- **frontmost** module: frontmost app name and bundle ID; optional window title with `--frontmost-window` and Accessibility permission handling.
- Scaffolded modules: apps, clipboard, battery, network, calendar, reminders (stubs or minimal implementation).
- Exit codes: 0 success, 2 permission missing, 3 timeout, 4 other error. JSON always printed.
- Docs: `docs/schema.md`, `docs/permissions.md`, README with examples and troubleshooting.
- Linux support: host, frontmost (xdotool), apps, clipboard, battery, network; calendar/reminders empty on Linux.
- Shorter flags: `--clipboard`, `--frontmost-window`, `--apps`, etc. (no `include-` prefix).
