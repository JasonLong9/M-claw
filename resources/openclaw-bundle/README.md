# OpenClaw bundled payload

This directory defines the built-in OpenClaw delivery payload copied into packaged app resources as:

`resources/openclaw-bundle/`

Current delivery policy:

- Primary target: `bundled-runtime`
- Transitional fallback: `bundled-fallback` via offline `tgz`
- Last resort: `online-fallback`

Current repository state:

- `openclaw-2026.3.24.tgz` exists
- `runtime/windows-x64` now exists and has passed direct `openclaw.cmd --version` probing
- `runtime/darwin-arm64` exists and is declared as `bundled-runtime`
- `runtime/darwin-x64` exists and is declared as `bundled-runtime`
- `defaultDeliveryMode` is currently `bundled-runtime`
- `targetDeliveryMode` remains `bundled-runtime`
- `Phase 2` exit checks currently pass with three ready targets:
  - `win32-x64`
  - `darwin-arm64`
  - `darwin-x64`

## Accepted tgz filenames

- `openclaw-2026.3.24.tgz`
- `openclaw.tgz`

## Runtime directory layout

When real runtime payloads are added, place them under:

- `runtime/windows-x64`
- `runtime/darwin-arm64`
- `runtime/darwin-x64`

Minimum runtime requirements:

- Windows:
  - `openclaw.cmd`
  - optional `openclaw.ps1`
  - `node_modules/openclaw/package.json`
- macOS:
  - `openclaw` or `bin/openclaw`
  - `node_modules/openclaw/package.json`

## Packaging behavior

- `electron-builder` copies this directory into packaged app resources
- `manifest.json` declares active and target delivery modes
- install planning prefers:
  - `bundled-runtime`
  - `bundled-fallback`
  - `online-fallback`

## Local debug override

- Set `QCLAW_OPENCLAW_BUNDLED_TGZ` to an absolute `.tgz` path

## Validation commands

- Transitional repo check:
  - `npm run check:openclaw:bundle`
- Strict runtime check after real payloads are added:
  - `npm run check:openclaw:bundle:strict`
- Delivery status report for Windows/macOS targets:
  - `npm run report:openclaw:bundle`
- Candidate runtime intake report before manifest write-in:
  - `npm run report:openclaw:runtime-candidate -- --runtime-dir <path> --platform <platform> --arch <arch> --version <version>`
- Manifest runtime preview before editing `manifest.json`:
  - `npm run preview:openclaw:manifest-runtime -- --runtime <platform>:<arch>:<directoryName>:<version> [--runtime ...] [--enable-bundled-runtime]`
- Direct runtime probe before manifest write-in:
  - `npm run probe:openclaw:runtime -- --runtime-dir <path> --platform <platform> --arch <arch>`

## Notes

- Do not treat `tgz` as the final v1 delivery definition
- Do not add platform runtime payloads outside `runtime/<directoryName>/`
- Full payload specification is maintained in `docs/openclaw-bundled-runtime-spec.md`
- A ready-to-fill runtime manifest example is provided in `resources/openclaw-bundle/manifest.runtime-template.json`
- Runtime acceptance steps are maintained in `docs/openclaw-bundled-runtime-validation-checklist.md`
- Runtime acquisition and ingestion rules are maintained in `docs/openclaw-bundled-runtime-acquisition-sop.md`
- A short execution runbook is maintained in `docs/openclaw-runtime-intake-runbook.md`
- The current pending-item note is maintained in `docs/openclaw-runtime-pending-items.md`
- Intel Mac offline first-launch validation is maintained in `docs/darwin-x64-offline-first-launch-runbook.md`
- Extracting the npm tgz alone is not sufficient to claim a runnable bundled runtime; runtime payloads must include the full dependency closure and pass `--version` validation
