# Mclaw Runtime Isolation Strategy

## 1. Decision

Mclaw is moving from a half-bundled runtime model to a true bundled runtime model.

This means:

1. Mclaw should prefer its own bundled `OpenClaw` runtime.
2. Mclaw should prefer its own bundled `Node` runtime.
3. Gateway, watchdog, logs, and runtime state should migrate to Mclaw-owned directories.
4. Shared system state such as `~/.openclaw` should become an import/compatibility path, not the default live runtime.

## 2. Why this is now the mainline

Recent Windows failures are no longer isolated UI bugs. They expose the same deeper problem:

1. runtime ownership is ambiguous;
2. startup may still depend on system Node;
3. old OpenClaw generations can leak into the current Mclaw session;
4. renderer state, gateway state, and actual process state can drift apart.

As long as Mclaw remains half-bundled, the project will keep paying the same debugging tax.

## 3. Current state

As of April 10, 2026:

1. bundled `OpenClaw` payloads exist for:
   - `win32-x64`
   - `darwin-arm64`
   - `darwin-x64`
2. Windows startup can already use bundled `openclaw.cmd` and bundled `node_modules/openclaw`.
3. Windows bundled runtime does **not yet** guarantee a colocated bundled `node.exe` in every shipped payload.
4. Runtime state still shows evidence of shared/legacy `~/.openclaw` influence during startup and gateway generation checks.

As of April 13, 2026:

1. the Windows bundled Node baseline is now pinned to `Node 24.14.1 x64`;
2. this is chosen to align with OpenClaw's current recommended mainline (`Node 24`), while keeping `OpenClaw 2026.3.24` as the temporarily pinned app-layer baseline during runtime isolation work;
3. `Node 22.14+` remains a compatibility floor in upstream OpenClaw, but is no longer the preferred bundled runtime target for Mclaw.

## 4. Target architecture

### 4.1 Execution ownership

Windows target:

1. `Mclaw.exe`
2. bundled `node.exe`
3. bundled `openclaw.mjs`
4. Mclaw-owned gateway/watchdog lifecycle

No system Node should be required for the normal mainline.

### 4.2 State ownership

Default runtime data should move under Mclaw-owned paths, for example:

1. `%APPDATA%\\Mclaw\\runtime`
2. `%APPDATA%\\Mclaw\\gateway`
3. `%APPDATA%\\Mclaw\\logs`
4. `%APPDATA%\\Mclaw\\openclaw-data`

`~/.openclaw` may still be read for import, migration, or compatibility diagnostics, but it should stop being the default live runtime root.

### 4.3 Upgrade ownership

Runtime updates should update the bundled Mclaw runtime instead of assuming users maintain a separate global OpenClaw installation.

## 5. Delivery stages

### Stage A: Windows bundled Node closure

Goal:

1. ship `node.exe` with the Windows bundled runtime;
2. make runtime takeover copy it alongside `openclaw.cmd`;
3. make startup prefer colocated bundled Node before any system candidate.

Acceptance:

1. Windows startup works on a machine without a usable system Node on PATH;
2. bundled runtime validation can detect missing `node.exe`.

### Stage B: Runtime/data private directory pivot

Goal:

1. define Mclaw-owned runtime roots;
2. move gateway generation, pid, log, and reconcile data under those roots;
3. stop using shared live `~/.openclaw` state as the default runtime source.

Acceptance:

1. stale global OpenClaw daemons do not interfere with Mclaw startup;
2. Mclaw can explain whether data is imported, migrated, or local-only.

### Stage C: Watchdog/generation ownership cleanup

Goal:

1. align watchdog, gateway runtime, and renderer health views;
2. make generation state belong to the current Mclaw runtime instance only.

Acceptance:

1. "old generation still in use" no longer appears unless the Mclaw-owned runtime is genuinely stale;
2. dashboard and chat views converge on the same source of truth.

### Stage D: Feature work on top of the stable runtime

Only after Stages A-C are stable should Mclaw resume the mainline push for:

1. Feishu official integration
2. Claude Code integration
3. memos / memory capability integration
4. runtime self-update

## 6. Version strategy alignment

This runtime isolation strategy does **not** mean "upgrade to OpenClaw 4.6 immediately."

Current rule:

1. keep `2026.3.24` as the baseline while closing the true bundled runtime path;
2. treat `2026.4.x` as a later controlled upgrade track after the runtime boundary is stable.

This keeps architecture change and upstream version change from colliding in the same debugging window.
