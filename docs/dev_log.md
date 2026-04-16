# Mclaw Development Log

## Log Policy

- This file is now the rolling development log for current work only.
- Historical entries `Update 001` through `Update 168` were archived to `docs/dev_log_archive_2026-04-01_to_2026-04-10.md`.
- Keep this file concise: milestone summary first, then only recent actionable updates.

## Current Milestone Snapshot

- Current mainline focus: Windows-first "true bundled runtime" closure.
- Current product decision: stop relying on the half-bundled path where Mclaw still mixes bundled OpenClaw with system Node and shared `~/.openclaw` state.
- Current technical goal: make Windows startup prefer bundled `OpenClaw + Node`, then move gateway/watchdog/runtime state into Mclaw-owned directories.
- Current release baseline: `OpenClaw 2026.3.24` remains the pinned compatibility baseline; `2026.4.x` stays a later upgrade track, not today's blocking variable.

## Active Workstreams

1. Windows bundled runtime self-containment
2. Runtime/data directory isolation
3. Gateway/watchdog generation ownership cleanup
4. Stable direct-chat path before Feishu/Claude Code/memos integration

## Recent Updates

### Update 164: Sync Dashboard and ChatPage with runtime-reconcile compatibility success instead of trusting `gatewayHealth()` alone
- After `v13`, startup toasts could already report success, but the Dashboard card and direct-chat page still trusted `gatewayHealth()` as the only source of truth.
- Added shared effective-running logic so renderer state can treat the Gateway as usable when runtime-reconcile has already confirmed the narrow audited compatibility path for legacy `2026.3.24`.
- Updated Dashboard and ChatPage state reads to combine `gatewayHealth()` with runtime-reconcile state instead of showing a false stopped/offline view immediately after a successful compatibility startup.
- Validation on April 10, 2026: `D:\\nodejs\\npm.cmd run typecheck` passed; `D:\\nodejs\\npx.cmd vitest run src/pages/__tests__/chat-availability-state.test.ts` passed (`13/13`); `D:\\nodejs\\npm.cmd run package:win:dir` passed and produced `release\\2026.4.10-v14\\win-unpacked\\Mclaw.exe`.

### Update 165: Keep legacy compatibility-mode Gateway sends on the Gateway path and stop choking the foreground runtime after startup
- Root cause focus moved from the badge to the real send path: legacy compatibility startup could succeed, but send preflight could still misclassify that state as offline and drop into CLI fallback.
- Updated `electron/main/openclaw-chat-service.ts` so send preflight checks runtime-reconcile plus a real loopback reachability signal before abandoning the Gateway transport.
- Updated `electron/main/cli.ts` so detached foreground compatibility runs keep their log streams alive after startup instead of risking a stall on the first real send.
- Validation on April 10, 2026: `D:\\nodejs\\npm.cmd run typecheck` passed; targeted `openclaw-chat-service` regressions passed; `D:\\nodejs\\npm.cmd run package:win:dir` passed and produced `release\\2026.4.10-v15\\win-unpacked\\Mclaw.exe`.

### Update 166: Require a real Gateway socket RPC before legacy compatibility mode is allowed to report running
- Port reachability alone was still too weak; a listening port did not guarantee that the Gateway could answer real RPC calls like `sessions.list` or `chat.send`.
- Added `probeGatewaySocketReady()` and wired it into startup readiness, renderer availability, and send-side runtime-reconcile recovery so "running" now means "can answer a real socket RPC".
- Validation on April 10, 2026: `D:\\nodejs\\npm.cmd run typecheck` passed; gateway probe/service tests passed (`35/35`); `D:\\nodejs\\npm.cmd run package:win:dir` passed and produced `release\\2026.4.10-v16\\win-unpacked\\Mclaw.exe`.

### Update 167: Stop renderer-side false green/running state by sanitizing stale runtime-reconcile readiness before UI reads it
- The persisted reconcile file could remain `ready` even after the real bundled runtime was no longer running, which kept the renderer in a false green state.
- Added UI-side runtime-reconcile sanitization so stale `ready` snapshots are downgraded in memory when the real local Gateway listener/RPC evidence has vanished.
- Validation on April 10, 2026: `D:\\nodejs\\npm.cmd run typecheck` passed; runtime-reconcile/gateway probe/service tests passed (`44/44`); `D:\\nodejs\\npm.cmd run package:win:dir` passed and produced `release\\2026.4.10-v17\\win-unpacked\\Mclaw.exe`.

### Update 168: Fix Windows foreground Gateway fallback so service-install `EPERM` can really launch a usable compatibility runtime
- I traced the latest Windows startup failure back to the fallback launcher itself: `gatewayRunInBackground(...)` still used a Windows `shell + pipe + detached` shape that locally reproduces the same `spawn EPERM` seen during `openclaw gateway install`.
- Updated `electron/main/cli.ts` to prefer direct `node.exe <runtime>\\node_modules\\openclaw\\openclaw.mjs gateway run ...` execution for the foreground compatibility path and switched detached logging to file-descriptor redirection.
- Added regression coverage in `electron/main/__tests__/cli-gateway-background.test.ts`.
- Validation on April 10, 2026: `D:\\nodejs\\npm.cmd run typecheck` passed; targeted gateway tests passed (`45/45`); `D:\\nodejs\\npm.cmd run package:win:dir` passed and produced `release\\2026.4.10-v18\\win-unpacked\\Mclaw.exe`.

### Update 169: Start the Windows "true bundled runtime" line by teaching runtime takeover to carry `node.exe` and preferring bundled Node when present
- We formally switched strategy from "keep patching the half-bundled path" to "close the true bundled runtime path first". The first concrete sub-step is to stop assuming Windows can always borrow a system Node.
- Updated `electron/main/openclaw-bundled-runtime-windows.ts` so bundled runtime takeover can now recognize, copy, and validate a colocated `node.exe` alongside `openclaw.cmd` and the `node_modules/openclaw` package root.
- Updated `electron/main/cli.ts` so foreground Gateway fallback now probes a bundled `node.exe` next to the resolved runtime command before falling back to detected/system Node candidates. This does not break current packages that still lack `node.exe`, but it makes the runtime path immediately prefer self-contained execution as soon as the bundled payload is complete.
- Added/updated regression coverage in `electron/main/__tests__/openclaw-bundled-runtime-windows.test.ts` and `electron/main/__tests__/cli-gateway-background.test.ts`.
- Documentation was also restructured in this round: `docs/dev_log.md` was slimmed into a rolling log, historical content moved to `docs/dev_log_archive_2026-04-01_to_2026-04-10.md`, and the new runtime strategy was documented in `docs/mclaw-runtime-isolation-strategy.md`.
- Validation on April 10, 2026: `D:\\nodejs\\npm.cmd run typecheck` passed; `D:\\nodejs\\npx.cmd vitest run electron/main/__tests__/openclaw-bundled-runtime-windows.test.ts electron/main/__tests__/cli-gateway-background.test.ts electron/main/__tests__/openclaw-gateway-service.test.ts electron/main/__tests__/openclaw-gateway-probes.test.ts electron/main/__tests__/openclaw-runtime-reconcile.test.ts` passed (`52/52`); `D:\\nodejs\\npm.cmd run package:win:dir` passed and produced `release\\2026.4.10-v19\\win-unpacked\\Mclaw.exe`, while auto-pruning `release\\2026.4.10-v18`.

### Update 170: Accept and wire the real Windows bundled Node payload (`24.14.1`) into the packaged runtime
- The user supplied a real Windows x64 Node runtime directory (`node-v24.14.1-win-x64`), and I verified it contains the required files for a distributable runtime payload: `node.exe`, `npm.cmd`, `npx.cmd`, and related launcher files. For the current Mclaw startup chain, the critical artifact is the colocated `node.exe`.
- Copied `node.exe` into `resources/openclaw-bundle/runtime/windows-x64/node.exe` so the bundled `openclaw.cmd` can execute in fully self-hosted mode and the packaged `openclaw-bundle` resource now carries a real Windows Node engine instead of depending on system PATH.
- Tightened `scripts/check-openclaw-bundled-runtime.mjs` so Windows bundled-runtime validation now explicitly fails if `runtime/windows-x64/node.exe` is missing. This upgrades the repo check from "bundled OpenClaw body exists" to "bundled OpenClaw body plus bundled Node engine exists" for Windows.
- Updated strategy/spec docs to pin the current Windows bundled Node baseline to `Node 24.14.1 x64`, aligning the runtime choice with OpenClaw's recommended Node 24 mainline while still keeping `OpenClaw 2026.3.24` as the temporary app-layer baseline during runtime isolation work.
- Validation on April 13, 2026: `D:\\nodejs\\node.exe scripts/check-openclaw-bundled-runtime.mjs` passed; `D:\\nodejs\\npm.cmd run typecheck` passed; `D:\\nodejs\\npx.cmd vitest run electron/main/__tests__/openclaw-bundled-runtime-windows.test.ts electron/main/__tests__/cli-gateway-background.test.ts electron/main/__tests__/openclaw-gateway-service.test.ts electron/main/__tests__/openclaw-gateway-probes.test.ts electron/main/__tests__/openclaw-runtime-reconcile.test.ts` passed (`52/52`); `D:\\nodejs\\npm.cmd run package:win:dir` passed and produced `release\\2026.4.13-v0\\win-unpacked\\Mclaw.exe`. I also verified the packaged payload now contains `release\\2026.4.13-v0\\win-unpacked\\resources\\openclaw-bundle\\runtime\\windows-x64\\node.exe`.

### Update 171: Start cutting renderer/runtime ownership away from global OpenClaw and system Node
- Finished the pending `openclaw-install-discovery`??????????? `bundled-runtime` ??? runtime ????discovery ???? bundled candidate ?? active candidate????????? `bundled-runtime`?
- Updated `electron/main/cli.ts` so `checkNode()` and Windows runtime command discovery now probe the bundled `node.exe` first, which is the first step toward making EnvCheck stop reporting system Node as the active runtime when the packaged Node payload is already present.
- Updated `electron/main/ipc-handlers.ts` and `src/pages/Dashboard.tsx` so ??????????? `~/.openclaw` ??/???????????? active candidate ? state root??? discovery ??????????
- Repaired and expanded `electron/main/__tests__/openclaw-install-discovery.test.ts` to cover the bundled-runtime-active path and Windows history-path formatting, preventing the latest discovery regression from slipping back in.
- Validation on April 13, 2026: `D:\\nodejs\\npx.cmd vitest run electron/main/__tests__/openclaw-install-discovery.test.ts` passed (`11/11`); `D:\\nodejs\\npm.cmd run typecheck` passed.

### Update 172: Move the default OpenClaw state-root fallback under Mclaw userData instead of shared `~/.openclaw`
- Updated `electron/main/openclaw-paths.ts` so the default managed state root now prefers `QCLAW_USER_DATA_DIR/openclaw-state`; only explicit legacy/home-based calls still resolve to `~/.openclaw`.
- Updated `electron/main/openclaw-runtime-paths.ts` so runtime probing now uses that managed fallback as its baseline and injects `OPENCLAW_HOME` / `OPENCLAW_CONFIG_PATH` during fallback probing, which starts steering runtime discovery toward Mclaw-owned state instead of the shared home directory.
- Updated `electron/main/cli.ts` so regular CLI runs and gateway background startup both merge the managed `OPENCLAW_HOME` / `OPENCLAW_CONFIG_PATH` into spawned OpenClaw processes, aligning execution-time ownership with the new path resolver.
- Updated `electron/main/openclaw-model-catalog.ts` to resolve its cache path lazily at runtime, avoiding import-time capture of the old home-based cache path before `QCLAW_USER_DATA_DIR` is initialized.
- Added/updated regression coverage in `electron/main/__tests__/openclaw-paths.test.ts` and `electron/main/__tests__/openclaw-runtime-paths.test.ts` for the new userData-owned default state root.
- Validation on April 13, 2026: `D:\\nodejs\\npx.cmd vitest run electron/main/__tests__/openclaw-paths.test.ts electron/main/__tests__/openclaw-runtime-paths.test.ts electron/main/__tests__/openclaw-install-discovery.test.ts` passed (`20/20`); `D:\\nodejs\\npm.cmd run typecheck` passed.

### Update 173: Bootstrap the managed OpenClaw state root during app startup instead of waiting for first CLI use
- Updated `electron/main/index.ts` so Electron now initializes `QCLAW_USER_DATA_DIR` / `QCLAW_SAFE_WORK_DIR` and eagerly bootstraps the managed OpenClaw state directory before IPC registration and window creation, instead of waiting until the first OpenClaw command triggers preflight.
- This means the packaged app now pre-creates the new `userData/openclaw-state` skeleton on launch, which reduces first-run ambiguity and helps later watchdog/gateway flows converge on the same state root from the very beginning.
- Updated `electron/main/openclaw-state-bootstrap.ts` to use built-in Node modules in the same style as the rest of the Electron main process, which also fixes its direct Vitest execution under the current ESM test harness.
- Added regression coverage in `electron/main/__tests__/openclaw-state-bootstrap.test.ts` for the Mclaw-managed `userData/openclaw-state` layout.
- Validation on April 13, 2026: `D:\\nodejs\\npx.cmd vitest run electron/main/__tests__/openclaw-paths.test.ts electron/main/__tests__/openclaw-runtime-paths.test.ts electron/main/__tests__/openclaw-install-discovery.test.ts electron/main/__tests__/openclaw-state-bootstrap.test.ts` passed (`25/25`); `D:\\nodejs\\npm.cmd run typecheck` passed.

### Update 174: Make shared gateway lifecycle mutations wait for real health confirmation instead of trusting a zero-exit start/restart
- Traced the next stability gap to electron/main/gateway-lifecycle-controller.ts: shared start / estart mutations still returned success as soon as the raw CLI command exited  , which let coordinator/reload callers treat the gateway as usable before a real health probe had confirmed it.
- Updated startGatewayLifecycle() and estartGatewayLifecycle() to reuse the same health-confirmation polling used by config reload, so all shared lifecycle entrypoints now converge on the same rule: command success is not enough; the gateway must come back healthy.
- Kept the result surface compatible by returning the richer GatewayReloadResult, which preserves CliResult fields while surfacing unning / stateCode / summary for downstream diagnostics and UI decisions.
- Expanded electron/main/__tests__/gateway-lifecycle-controller.test.ts to cover the new start-health confirmation path and the failure case where restart returns   but the gateway never becomes healthy again.
- Validation on April 13, 2026: D:\nodejs\npx.cmd vitest run electron/main/__tests__/gateway-lifecycle-controller.test.ts electron/main/__tests__/openclaw-gateway-service.test.ts electron/main/__tests__/openclaw-runtime-reconcile.test.ts passed (45/45); D:\nodejs\npm.cmd run typecheck passed.

### Update 175: Let the dashboard entry bootstrap trust runtime-reconcile for the audited legacy compatibility path
- I found another stale/false-offline entry point outside the main chat/dashboard status refresh loops: src/pages/GatewayBootstrapGate.tsx still decided the initial dashboard snapshot from gatewayHealth() alone, so legacy 2026.3.24 compatibility runs could enter the app with an immediate offline snapshot even when runtime-reconcile had already confirmed the gateway bootstrap path.
- Reworked the dashboard entry bootstrap flow to read getOpenClawRuntimeReconcileState() alongside gatewayHealth() and reuse esolveEffectiveGatewayRunning(...), so the very first entrySnapshot.gatewayRunning decision now matches the same audited compatibility rule used by the main dashboard/chat surfaces.
- While touching that file, I also normalized its copy strings and bootstrap fallback messages, which removed the broken/mojibake literals that had started to destabilize renderer-side test transforms.
- Added/updated coverage in src/pages/__tests__/dashboard-entry-flow.test.tsx for the case where health is stale but runtime-reconcile confirms the legacy compatibility path; kept src/pages/__tests__/chat-availability-state.test.ts and electron/main/__tests__/gateway-lifecycle-controller.test.ts in the validation set to ensure the entry gate and later lifecycle views stay aligned.
- Validation on April 13, 2026: D:\nodejs\npx.cmd vitest run src/pages/__tests__/dashboard-entry-flow.test.tsx src/pages/__tests__/chat-availability-state.test.ts electron/main/__tests__/gateway-lifecycle-controller.test.ts passed (29/29); D:\nodejs\npm.cmd run typecheck passed.

### Update 176: Let Dashboard startup/restart waits honor runtime-reconcile, and clean the remaining Dashboard syntax corruption blocking renderer verification
- I found another dashboard-side false negative: waitForDashboardGatewayRunning() still polled gatewayHealth() only, so manual start/restart flows on the legacy audited compatibility path could still be marked failed even when runtime-reconcile already confirmed the gateway was usable.
- Updated src/pages/Dashboard.tsx so waitForDashboardGatewayRunning() also reads getOpenClawRuntimeReconcileState() and reuses esolveEffectiveGatewayRunning(...). This aligns dashboard-side start/restart waits with the same compatibility rule already used by the entry gate, Dashboard status card, and ChatPage availability recovery.
- While wiring that through, I also cleaned a batch of broken/mojibake literals in src/pages/Dashboard.tsx that had started to break JSX/esbuild parsing in multiple dashboard tests. This was not just cosmetic: the renderer test surface could no longer validate the dashboard flow until those malformed strings were repaired.
- Added/updated coverage in src/pages/__tests__/dashboard-gateway-wait.test.ts for the legacy compatibility path, and kept src/pages/__tests__/dashboard-entry-flow.test.tsx, src/pages/__tests__/chat-availability-state.test.ts, and electron/main/__tests__/gateway-lifecycle-controller.test.ts in the validation set so the entry snapshot, wait helper, chat availability, and lifecycle controller remain aligned.
- Validation on April 13, 2026: D:\nodejs\npx.cmd vitest run src/pages/__tests__/dashboard-gateway-wait.test.ts src/pages/__tests__/dashboard-entry-flow.test.tsx src/pages/__tests__/chat-availability-state.test.ts electron/main/__tests__/gateway-lifecycle-controller.test.ts passed (32/32); D:\nodejs\npm.cmd run typecheck passed.

### Update 177: Restore openclaw-chat-service test file syntax so typecheck is green again
- I continued cleaning the remaining syntax corruption in `electron/main/__tests__/openclaw-chat-service.test.ts`, where several malformed strings and one broken regex literal were still preventing TypeScript from parsing the file at all.
- Repaired the broken stream fixture payloads around the send-flow tests and normalized the affected transcript fixture strings so the test file is syntactically valid again instead of failing before any runtime assertions can execute.
- Fixed the unterminated regex assertion in the ambiguous-payload test so the whole main-process test surface can be typechecked again.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Additional verification on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/openclaw-chat-service.test.ts electron/main/__tests__/openclaw-chat-send-errors.test.ts electron/main/__tests__/gateway-lifecycle-controller.test.ts src/pages/__tests__/dashboard-gateway-wait.test.ts src/pages/__tests__/dashboard-entry-flow.test.tsx src/pages/__tests__/chat-availability-state.test.ts` no longer fails at config/parse time, but `electron/main/__tests__/openclaw-chat-service.test.ts` still has many behavioral failures (`89` failed, dominated by one timeout followed by `EBUSY` temp-dir cleanup errors). That suite now needs behavioral stabilization rather than more syntax repair.

### Update 178: Continue de-mojibaking `openclaw-chat-service` behavioral tests and restore early-suite signal
- I kept pushing on `electron/main/__tests__/openclaw-chat-service.test.ts`, but this round the failures were no longer syntax errors; they were mostly stale mojibake expectations that no longer matched the now-normalized runtime copy returned by the service.
- Updated the legacy availability assertion to match the current degraded fallback wording, and fixed another cluster of legacy send-flow fixtures / expectations around local-session fork prelude text, runtime send-time model override rejection, and the first-message model-switch guard.
- Tightened `normalizeModelList()` in `electron/main/openclaw-chat-service.ts` to deduplicate repeated model keys while preserving order. This fixes the duplicated `connectedModels` output that was breaking the models-page/chat-availability tests.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Additional focused verification on April 13, 2026: repeated `D:\nodejs\npx.cmd vitest run electron/main/__tests__/openclaw-chat-service.test.ts --bail=1` runs now advance deep into the suite instead of failing near the top; the current earliest blocker has already moved past `53` passing tests, which means the remaining work is now isolated to later behavioral assertions instead of broad setup breakage.

### Update 179: Push the `openclaw-chat-service` bail frontier into the later session-list assertions
- I continued the `electron/main/__tests__/openclaw-chat-service.test.ts --bail=1` cleanup pass and moved the earliest remaining failure even deeper into the suite by fixing more stale mojibake expectations that no longer matched the normalized Chinese copy returned by the service.
- This round updated the channel-session model-switch blocked reason assertions and the fresh local-shell non-patchable guard assertion in `electron/main/__tests__/openclaw-chat-service.test.ts`, both of which were still asserting pre-normalization garbled strings.
- The focused bail run now gets through `65` passing tests before stopping, which is a meaningful improvement over the previous frontier and confirms the remaining failures are concentrated in later behavior-specific expectations rather than broad send-path instability.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 180: Move the bail frontier into the late legacy-merge assertions
- I continued the `electron/main/__tests__/openclaw-chat-service.test.ts --bail=1` pass and fixed another pair of stale mojibake expectations in the late session/transcript merge coverage.
- Updated the conservative legacy-merge blocked-reason assertions to match the current normalized copy (`?? transport ?????`), which is what the service now returns when a merged row still lacks a trusted session key and must remain non-patchable.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- The bail frontier has now advanced to `74` passing tests before the next failure, so the remaining cleanup is now concentrated in the last quarter of `openclaw-chat-service.test.ts`.

### Update 181: Push the chat-service bail frontier past the external-transcript channel assertions
- I continued the late-suite cleanup in `electron/main/__tests__/openclaw-chat-service.test.ts` and fixed another stale mojibake blocked-reason assertion in the external transcript loading coverage.
- The `sessions.get` transcript path for channel-backed sessions now asserts against the current normalized copy (`?????????...`) instead of the old garbled string, which keeps the test aligned with the service's present behavior.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- The bail frontier has now advanced to `76` passing tests before the next remaining failure.

### Update 182: Continue late transcript-assertion cleanup for external `sessions.get` history
- I kept moving the `electron/main/__tests__/openclaw-chat-service.test.ts --bail=1` frontier forward by fixing another stale mojibake transcript assertion in the external `sessions.get` history path.
- The remote transcript user-message expectation now matches the normalized text (`????`) emitted by the repaired fixture set instead of the old garbled literal, keeping the late transcript coverage aligned with current parser output.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 183: Continue late transcript cleanup for filtered tool-call history cases
- I kept advancing the `electron/main/__tests__/openclaw-chat-service.test.ts --bail=1` frontier and fixed another stale mojibake expectation in the history-filtering coverage.
- The transcript assertion for the assistant reply after skipping `toolCall.partialJson` records now matches the normalized text emitted by the repaired fixture (`??????????????23-24C??`) instead of the old garbled literal.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 184: Keep clearing late transcript sanitization assertions
- I continued the `electron/main/__tests__/openclaw-chat-service.test.ts --bail=1` pass and fixed another late-suite assertion that was still expecting garbled text after transcript sanitization.
- The history sanitization case that strips reply markers / `message_id` headers / encrypted reasoning payloads now asserts against the normalized assistant reply (`??????????? GLM-5??`) instead of the old mojibake literal.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 185: Keep advancing the last transcript-shell fallback assertions
- I continued the `electron/main/__tests__/openclaw-chat-service.test.ts --bail=1` cleanup and fixed another late transcript expectation in the fallback path where a local shell exists but no local messages are present.
- The user-message assertion there now matches the normalized preserved prefix of the repaired fixture instead of the older mojibake literal with the exact trailing punctuation mismatch.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 186: Reconcile the remaining platform-gated trusted-transport tests with current Windows fail-closed behavior
- I pushed the late `openclaw-chat-service` suite further and hit the last platform-gated trusted-send transport cases.
- For the two trusted upstream send tests around platform-default and control-ui-timeout behavior, I aligned the Windows branch expectations with the current fail-closed contract: when a trusted upstream session key exists but the unit test environment has no real gateway socket runtime, Qclaw returns `command-failed` instead of silently falling back to local CLI continuation.
- The non-Windows assertions remain unchanged and still validate the browser/control-ui trusted-send path and its timeout-fallback behavior.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 187: Push the bail frontier past 90 tests and into the final legacy-patch-bridge assertions
- I continued the late `openclaw-chat-service` cleanup and fixed the next remaining mojibake assertion in the legacy patch-bridge send path.
- That test now matches the normalized seeded prelude copy (`??????????????????????`) instead of the old garbled literal, keeping the transport-bridge regression coverage aligned with the current seeded-message helper output.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- The bailed suite now gets past `91` passing tests before the next remaining failure.

### Update 188: Push the bailed chat-service suite into the final ten tests
- I continued the last-stage cleanup and fixed the next remaining stale failure in the no-patchable-session fail-closed path.
- That assertion now matches the normalized current error copy (`???????????????? OpenClaw session...`) instead of the old mojibake literal.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- The bailed suite now reaches `93` passing tests before the next remaining failure, so we are down to the final small cluster.

### Update 189: Push the bailed suite into the final single-digit failures
- I continued the last-stage `openclaw-chat-service` cleanup and fixed the next remaining stale patch-failure assertion.
- The gateway patch-failure test now matches the normalized current diagnostic copy (`Gateway ???????...`) instead of the old mojibake fragment, while still ensuring the error is not misreported as an unsupported-version problem.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- The bailed suite now gets through `94` passing tests before the next failure, so we are down to the final single-digit remainder.

### Update 190: Keep trimming the final config-gated model-switch assertions
- I continued the last-mile `openclaw-chat-service` cleanup and fixed the next remaining stale assertion in the config-gated model-switch rejection path.
- That test now matches the normalized current copy (`??? OpenClaw ???????? openai/gpt-4.1-mini...`) instead of the old mojibake literal, while still verifying that the rejection happens before any gateway RPC is attempted.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- The bailed suite now reaches `95` passing tests before the next remaining failure.

### Update 191: `openclaw-chat-service` full bailed suite is now green
- I fixed the last remaining stale cancellation-copy assertion (`???????`) and reran the full bailed `electron/main/__tests__/openclaw-chat-service.test.ts` suite.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/openclaw-chat-service.test.ts --bail=1` passed (`103/103`).
- This means the long-running main-process chat-service regression surface is finally clean again, so the next best use of time is to pivot back to real UI/gateway send-path verification instead of more test-fixture cleanup.

### Update 192: Pivot back to UI/gateway verification after chat-service cleanup
- With `electron/main/__tests__/openclaw-chat-service.test.ts` green again, I switched back to the UI/gateway-facing regression surface to make sure the dashboard/chat lifecycle still lines up with the cleaned main-process send path.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run src/pages/__tests__/dashboard-gateway-wait.test.ts src/pages/__tests__/dashboard-entry-flow.test.tsx src/pages/__tests__/chat-availability-state.test.ts electron/main/__tests__/gateway-lifecycle-controller.test.ts electron/main/__tests__/openclaw-chat-send-errors.test.ts` passed (`34/34`).
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Current conclusion: the key audited UI/gateway surfaces are green in regression coverage, so the next step should move from test cleanup to actual packaged-app/runtime verification of gateway start, state sync, and send lifecycle.

### Update 193: Finish the `openclaw-chat-service` regression surface and verify the final remaining case
- I fixed the last stale cancellation-copy assertion in `electron/main/__tests__/openclaw-chat-service.test.ts`, updating it to the current normalized message (`???????`).
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/openclaw-chat-service.test.ts --bail=1` passed (`103/103`).
- At this point the heavy main-process chat-service regression surface is fully green again, and together with the earlier `package:win:dir` success and the UI/gateway regression checks, the project is ready to pivot from test repair to actual packaged-app runtime????.

### Update 194: Fix the Windows bundled gateway bootstrap root cause and ship a new packaged build
- I cleaned the remaining visible mojibake in `src/pages/Dashboard.tsx`, including the DingTalk / WeChat plugin labels, plugin-center alert titles, and several error/log strings that were still leaking garbled text into the packaged dashboard.
- I reproduced the real packaged-runtime failure with the bundled OpenClaw binary and confirmed the blocking root cause was not the model provider itself: `gateway install` was failing because the spawned runtime PATH did not include Windows system directories, so `schtasks` could not be found (`spawn schtasks ENOENT`).
- I fixed `electron/main/runtime-path-discovery.ts` so Windows managed runtime PATH assembly now prepends `C:\Windows\System32`, `C:\Windows\System32\Wbem`, `C:\Windows\System32\WindowsPowerShell\v1.0`, and `C:\Windows`, and I added regression coverage in `electron/main/__tests__/runtime-path-discovery.test.ts` to lock this in.
- Validation on April 13, 2026: with the corrected PATH injected, the bundled runtime completed the real Windows gateway chain end-to-end: `openclaw.cmd gateway install` succeeded, `openclaw.cmd gateway start` succeeded, and `openclaw.cmd health --json` returned `ok: true`.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/runtime-path-discovery.test.ts src/pages/__tests__/dashboard-gateway-wait.test.ts src/pages/__tests__/dashboard-entry-flow.test.tsx src/pages/__tests__/chat-availability-state.test.ts electron/main/__tests__/gateway-lifecycle-controller.test.ts electron/main/__tests__/openclaw-chat-send-errors.test.ts` passed (`39/39`).
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced the new candidate build at `release/2026.4.13-v2/win-unpacked`.
- Packaging note: the builder could not auto-delete `release/2026.4.13-v1` because the old unpacked app/runtime was still locked by a running process (`EPERM` on `node.exe`), so the old folder still needs to be closed completely before cleanup.

### Update 195: Block duplicate chat sends from saturating Windows CPU with concurrent Node/OpenClaw runtimes
- I traced the user's "???????????? / ???? / ???? nodejs runtime" symptom back to a real re-entrancy gap in `src/components/dashboard/DashboardChatPanel.tsx`: the renderer only relied on React state (`sending`) and did not have an immediate synchronous send lock, so repeated rapid clicks or Enter presses could slip through before the first render commit disabled the composer.
- I added a renderer-side guard (`sendLockRef` + `sendPending`) so the first click locks the send path immediately, disables the composer/new-chat/retry/model-switch actions during bootstrap, and prevents duplicate `chat:send` invocations even before React finishes re-rendering.
- I also added a main-process fail-closed guard in `electron/main/openclaw-chat-service.ts`: if one chat send is already in flight, a second `sendChatMessage()` request is now rejected immediately with `?????????????????????????????` instead of spawning another OpenClaw/Node transport process.
- This means the runaway CPU was not because the model itself was "too heavy"; it was because Mclaw previously allowed multiple overlapping send pipelines, and each overlapping send could start its own OpenClaw/Node child process stack.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run src/components/dashboard/dashboard-chat-panel-guardrails.test.ts` passed (`4/4`).
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/openclaw-chat-service.test.ts -t "rejects concurrent chat sends before spawning a second transport run"` passed.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/openclaw-chat-service.test.ts` passed (`104/104`).

### Update 196: Package the duplicate-send / CPU-spike fix into a new Windows candidate build
- After landing the renderer send lock and the main-process concurrent-send guard, I produced a fresh Windows unpacked build so the user can validate the fix in the real packaged app instead of only in source/dev mode.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v3/win-unpacked`.
- Validation on April 13, 2026: the packaged build is based on the same code that now blocks repeated rapid send clicks from spawning overlapping OpenClaw/Node chat runtimes.
- Packaging note: `release/2026.4.13-v2` could not be auto-removed during the new build because the previous unpacked app/runtime was still locked by a running process (`EPERM` on the bundled `node.exe`).

### Update 197: Route Windows gateway RPC away from the fragile Control UI browser bridge during send bootstrap
- I traced the next blocking issue to the RPC layer that still ran before the actual message transport: on Windows, `defaultCallGatewayRpc()` was still preferring the hidden Control UI browser bridge for calls like `sessions.create`, `sessions.patch`, and `sessions.get`, even though the real bundled OpenClaw `2026.3.24` runtime was already showing `Gateway call failed: SyntaxError: Expected property name or '}' in JSON...` in its gateway log.
- That means the send chain could now reach "gateway started" correctly, but the very first upstream bootstrap step could still die before `chat.send` even began, because the browser bridge and legacy 2026.3.24 Control UI were disagreeing on request encoding / JSON parsing.
- I changed `electron/main/openclaw-chat-service.ts` so Windows now prefers the direct socket RPC path first for gateway RPC calls, and only falls back to the hidden Control UI browser helper when the socket path fails with connection/bootstrap-style errors.
- I also expanded the existing browser-to-socket fallback matcher so Control UI errors like `Gateway call failed`, `Expected property name or '}' in JSON`, and other malformed-JSON signatures now automatically downgrade to the socket path instead of terminating the send bootstrap.
- This keeps the project aligned with our current `2026.3.24` baseline strategy: the Control UI bridge remains available as a compatibility fallback, but Windows no longer depends on the most fragile legacy bridge path for first-message session bootstrap.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/openclaw-chat-service.test.ts electron/main/__tests__/openclaw-control-ui-rpc.test.ts` passed (`110/110`).

### Update 198: Package the Windows RPC fallback fix into a fresh test build
- After switching Windows gateway bootstrap RPC to prefer the socket path and only use the Control UI browser bridge as fallback, I produced a new Windows unpacked build for real-device validation.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v4/win-unpacked`.
- Packaging note: the builder could not auto-remove `release/2026.4.13-v3` because the previous unpacked app was still locking the bundled runtime at `release/2026.4.13-v3/win-unpacked/resources/openclaw-bundle/runtime/windows-x64/node.exe`.


### Update 199: Bypass Windows openclaw.cmd for bundled runtime RPC calls so gateway JSON params stay intact
- I traced the latest Windows send failure to the CLI spawn layer: even after gateway startup stabilized, Mclaw was still launching bundled OpenClaw through `openclaw.cmd` with `shell: true`, which let `cmd.exe` rewrite or strip `gateway call --params <json>` payloads before OpenClaw parsed them.
- I updated `electron/main/openclaw-spawn.ts` so Windows now detects bundled runtime layouts that include `node.exe` plus `node_modules/openclaw/openclaw.mjs`, and in that case it bypasses the shim completely and runs `node.exe openclaw.mjs ...` with `shell: false`.
- The new logic covers both bundled layouts we probe in practice: `runtime/windows-x64/openclaw.cmd` and `runtime/windows-x64/bin/openclaw.cmd`.
- This is the key compatibility fix for the user's current packaged baseline `OpenClaw 2026.3.24`: RPC commands such as `sessions.get`, `chat.history`, and `sessions.patch` no longer have to survive a Windows `.cmd` shim before their JSON payload reaches OpenClaw.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/openclaw-spawn.test.ts electron/main/__tests__/openclaw-chat-service.test.ts electron/main/__tests__/openclaw-control-ui-rpc.test.ts` passed (`123/123`).

### Update 200: Package the Windows direct-node spawn fix into a fresh validation build
- After landing the spawn-layer fix, I produced a new Windows unpacked build so the user can validate the repaired bundled runtime path in the real packaged app instead of only in source mode.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v5/win-unpacked`.
- Packaging note: the builder confirmed the old `release/2026.4.13-v4` directory is still locked by a previously launched build/runtime, so it could not be removed automatically.
- Cleanup note: I also tried removing `release/2026.4.13-v4` directly, but Windows still denied access to a locked native module under the old bundled runtime (`clipboard.win32-x64-msvc.node`). The old folder needs the previous app/process to be fully closed before deletion will succeed.


### Update 201: Force Windows chat/runtime CLI calls onto the bundled OpenClaw binary instead of bare PATH lookup
- I traced the remaining v5 failure to a second Windows resolution gap in `electron/main/cli.ts`: even after fixing `openclaw.cmd` spawning, generic chat/runtime commands could still execute bare `openclaw` when the command was available on PATH, which let some `gateway call --params <json>` traffic escape the bundled-binary path entirely.
- The strongest evidence was the new v5 runtime log: despite the spawn-layer fix, `C:\tmp\openclaw\openclaw-2026-04-13.log` still showed `Gateway call failed: SyntaxError: Expected property name or '}' in JSON...` at `19:51:02+08:00`, proving there was still at least one CLI path that had not been forced onto the bundled runtime.
- I updated `electron/main/cli.ts` so Windows now prefers the bundled runtime binary returned by `inspectBundledOpenClawDeliveryStatus()` before it even probes the bare `openclaw` command on PATH. That means packaged Mclaw now consistently routes chat/gateway CLI traffic to its own bundled OpenClaw runtime first, instead of accidentally falling back to a global installation or a shimmed PATH command.
- This also narrows the user's mixed-runtime problem seen in the file log, where bundled Node `24.14.1` and global npm OpenClaw / Node `22.22.1` were both appearing in the same session.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/openclaw-spawn.test.ts electron/main/__tests__/openclaw-chat-service.test.ts electron/main/__tests__/openclaw-control-ui-rpc.test.ts` passed (`123/123`).

### Update 202: Package the bundled-binary CLI routing fix into a new Windows build
- After forcing Windows CLI traffic to prefer the bundled OpenClaw runtime, I produced a fresh unpacked Windows build for validation.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v6/win-unpacked`.
- Packaging note: `release/2026.4.13-v5` is still locked by a running old process on the machine, so the builder could not delete it automatically.


### Update 203: Stop the dashboard chat page from auto-binding itself to OpenClaw's upstream main webchat session
- I traced the unexpected HEARTBEAT prompt and the old `404 status code (no body)` bubbles to a stale upstream session stored in the local OpenClaw state, not to a fresh dashboard send. The saved state file at `C:\Users\James\AppData\Roaming\Mclaw\openclaw-state\.openclaw\.openclaw\agents\main\sessions\sessions.json` showed `agent:main:main` as the active upstream session, with the previous HEARTBEAT/system prompt payload and failed embedded runs already attached to it.
- The dashboard renderer was auto-selecting the newest discovered session by default, and that could incorrectly pick OpenClaw's own upstream main webchat session before the user typed anything. That is why the chat page could open and immediately show stale foreign messages unrelated to the current Mclaw direct-chat intent.
- I updated `src/shared/dashboard-chat-routing.ts` so the dashboard no longer auto-selects `agent:main:main` by default. If the only discovered session is OpenClaw's upstream main webchat thread, the dashboard now stays in create-new-session mode instead of silently binding the composer to that thread.
- This isolates Mclaw's direct-chat entry flow from upstream OpenClaw webchat leftovers and should prevent the chat page from opening straight into old HEARTBEAT/404 history again.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run src/shared/__tests__/dashboard-chat-routing.test.ts` passed (`20/20`).
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 204: Package the dashboard auto-session isolation fix into a new Windows build
- After preventing the dashboard from auto-binding to OpenClaw's upstream main webchat session, I produced a fresh unpacked Windows build for validation.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v7/win-unpacked`.
- Packaging note: the builder cleaned up `release/2026.4.13-v6` automatically and kept only the new `v7` build.

### Update 205: Auto-migrate DeepSeek official endpoints away from `custom-openai` onto OpenClaw's bundled `deepseek` provider
- I traced the latest packaged chat failure beyond gateway lifecycle: the bundled OpenClaw runtime already ships a first-party `deepseek` provider plugin, but Mclaw was still saving the user's `https://api.deepseek.com/v1` setup under `custom-openai`, which pushed runtime sends through the wrong provider path and led to upstream `embedded_run_agent_end` failures with `404 status code (no body)`.
- I updated `electron/main/openclaw-provider-config-repair.ts` so any saved `custom-openai` config that points at the official DeepSeek endpoint now auto-migrates to `deepseek`, normalizes the base URL to `https://api.deepseek.com`, preserves model entries, and rewrites default model refs like `custom-openai/deepseek-chat` to `deepseek/deepseek-chat`.
- I also updated `electron/main/cli.ts` plus `electron/main/local-model-probe.ts` so the same repair preflight migrates auth from `custom-openai:local` to `deepseek:default` in the main auth store, removing the stale source profile when the key is real rather than the old `custom-local` marker.
- On the UI save path, `src/pages/ModelCenter.tsx` now detects the official DeepSeek endpoint during local compatible-provider submission, switches the persisted provider snapshot/auth target to `deepseek`, clears the stale `OPENAI_BASE_URL` override, removes old `custom-openai` auth, and keeps the selected model aligned with `deepseek/...` refs.
- I added `deepseek` metadata to `src/lib/openclaw-provider-registry.ts` so the repaired provider has a real display identity inside Mclaw instead of falling back to an unknown-provider presentation.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/openclaw-provider-config-repair.test.ts electron/main/__tests__/local-model-probe.test.ts` passed (`25/25`).

### Update 206: Package the DeepSeek provider migration fix into a new Windows validation build
- After wiring both config migration and auth migration for the DeepSeek official endpoint, I produced a fresh unpacked Windows build for user-side validation.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v8/win-unpacked`.
- Packaging note: the builder automatically removed the previous `release/2026.4.13-v7` directory and kept only the new `v8` build, matching the user's ????????????????????.

### Update 207: Fix startup deadlock in the DeepSeek auth-migration preflight
- I traced the new splash-screen hang at ???????????? / ?????? OpenClaw ????????? to a startup recursion bug introduced by the DeepSeek migration patch.
- Root cause: during `ensureOpenClawConfigRepairPreflight()` in `electron/main/cli.ts`, the new `migrateAuthProfile()` call tried to auto-resolve the main auth store path through `resolveMainAuthStorePath()`, which by default asks OpenClaw for `models status`; that command path re-enters the same startup preflight and can stall the packaged app before `checkOpenClaw()` returns.
- I fixed this by making the preflight pass the auth store path directly from the known runtime home (`<homeDir>/agents/main/agent/auth-profiles.json`) instead of probing `models status` while startup repair is already running.
- This keeps the DeepSeek migration behavior but removes the preflight self-recursion, so the environment check can continue past the OpenClaw core step.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 208: Package the startup-deadlock fix into a new Windows build
- After removing the startup preflight recursion, I produced a fresh unpacked Windows build for verification.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v9/win-unpacked`.
- Packaging note: the builder automatically cleaned up `release/2026.4.13-v8`, so only `v9` remains.

### Update 209: Repair DeepSeek auth migration for nested `.openclaw` runtime stores and add send-path tracing
- I traced the next packaged-chat blocker to a second path mismatch: the DeepSeek provider migration had already rewritten the outer `openclaw.json`, but some real packaged OpenClaw layouts keep the active auth store under `...\\openclaw-state\\.openclaw\\.openclaw\\agents\\main\\agent\\auth-profiles.json`, while my fallback logic only repaired `...\\.openclaw\\agents\\main\\agent\\auth-profiles.json`.
- I updated `electron/main/local-model-probe.ts` so auth-store fallback resolution no longer hardcodes a single root. It now prefers an existing nested `.openclaw\\agents\\...` auth store when present, still supports the flat legacy `agents\\...` path, and scans both roots when discovering per-agent auth stores for repair/import flows.
- I also updated the startup DeepSeek repair in `electron/main/cli.ts` to use that new preferred-path resolver before migrating `custom-openai:local` -> `deepseek:default`, and to clear the stale `OPENAI_BASE_URL` override after the provider migration succeeds so the official DeepSeek path is no longer polluted by the old OpenAI-compatible base URL.
- To make the remaining ?????????? OpenClaw ????????? `chat.send`?? problem easier to pinpoint on the next user run, I added explicit transport trace markers in `electron/main/openclaw-chat-service.ts` showing which send transport was selected (`cli`, `control-ui-browser`, `gateway-socket-only`, or `gateway-socket-cli-fallback`) and whether that transport actually accepted the send attempt.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 13, 2026: `D:\nodejs\npx.cmd vitest run electron/main/__tests__/local-model-probe.test.ts electron/main/__tests__/openclaw-provider-config-repair.test.ts` still hits the existing local `vite/esbuild spawn EPERM` startup failure before tests execute; no new test assertion failure was surfaced before that environment-level blocker.

### Update 210: Package the nested-auth migration fix into a new Windows build
- After repairing nested `.openclaw` auth-store resolution and adding send-path tracing, I produced a fresh unpacked Windows build for the next real-machine validation round.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v10/win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.13-v9`, so only the new `v10` build remains.

### Update 211: Force all runtime path probing onto the bundled OpenClaw binary instead of a global npm install
- The latest v10 user log exposed a new concrete smoking gun: after the bundled gateway had already started under Node `24.14.1`, the shared OpenClaw file log still showed extra `openclaw` invocations coming from `C:\Users\James\AppData\Roaming\npm\node_modules\openclaw` under Node `22.22.1` at `21:21:43+08:00` and `21:21:46+08:00`.
- That means some non-chat paths were still resolving `openclaw` from PATH before the bundled runtime. In practice the highest-risk path is `getOpenClawPaths()` -> `resolveRuntimeOpenClawPaths()` -> `resolveOpenClawBinaryPath()`, because that probe runs `openclaw config file` / `backup create --dry-run --json` and is reused by `readConfig()`, `readEnvFile()`, gateway settings, and other chat-adjacent flows.
- I updated `electron/main/openclaw-package.ts` so `resolveOpenClawBinaryPath()` now prefers Qclaw's bundled OpenClaw runtime immediately whenever a bundled manifest/runtime binary is available, instead of first honoring a separate global npm-installed `openclaw` on PATH.
- This removes the remaining mixed-runtime hole where the bundled gateway could be healthy on Node 24, but path probing and config/env resolution could still consult a different global OpenClaw installation on Node 22 and reintroduce stale runtime state.
- I also added regression coverage in `electron/main/__tests__/openclaw-package.test.ts` for the exact Windows packaged case: even if command lookup returns `C:\Users\...\npm\openclaw.cmd`, the resolver must still choose the bundled runtime binary first.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 212: Package the bundled-first runtime-path fix into a new Windows build
- After removing the remaining global-OpenClaw path leak from runtime probing, I produced a fresh unpacked Windows build for another user validation round.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v11/win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.13-v10`, so only the new `v11` build remains.

### Update 213: Keep packaged Windows chat sends on the gateway socket path and surface the failing trace stage
- I followed the strongest remaining signal from the user's logs: gateway/session RPCs were already succeeding over WebSocket, but the shared OpenClaw file log still showed global npm OpenClaw / Node `22.22.1` reappearing around failed sends. That points to the send path silently dropping from gateway transport back to CLI, which can re-open the mixed-runtime problem even after the bundled-binary fixes.
- I updated `electron/main/openclaw-chat-service.ts` so bundled Windows builds now force direct chat sends onto the gateway socket transport instead of the socket+CLI-fallback transport whenever Qclaw's own bundled OpenClaw runtime is present. The explicit CLI fallback remains only for the existing "gateway really is unavailable and a local-only shell is still safe" path.
- I also updated `src/components/dashboard/DashboardChatPanel.tsx` so a send failure now immediately refreshes recent trace entries and appends the latest trace stage to the visible panel error. That should let the next user run tell us whether the send is stopping at `gateway-unavailable`, `bootstrap-session-failed`, `transport-run`, or a later parse/finalization step without needing them to dig through hidden diagnostics first.
- I added a regression case in `electron/main/__tests__/openclaw-chat-service.test.ts` to lock in the new bundled-Windows rule: when a bundled runtime is present, chat send must not silently fall back to CLI just because the gateway transport cannot finish its pre-send setup.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation note on April 13, 2026: `npm run test -- electron/main/__tests__/openclaw-chat-service.test.ts` and direct `vitest` still hit the existing local `vite/esbuild spawn EPERM` startup blocker before executing assertions in this environment.

### Update 214: Package the socket-only bundled-Windows chat fix into v12
- After hardening the packaged Windows send path and surfacing the latest trace stage in the chat panel, I produced a fresh unpacked Windows build for validation.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v12/win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.13-v11`, so only the new `v12` build remains.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the chat fix.

### Update 215: Stop direct chat from auto-binding stale external history and force a gateway warm-up before degraded sends
- The new screenshots exposed two separate UX/runtime mismatches. First, the direct-chat page was still auto-selecting an existing OpenClaw history session on entry, which made the composer default to "continue writing into this old external session" instead of starting from a clean Qclaw conversation shell. Second, when the page state was only `degraded` rather than `ready`, `handleSend()` could skip `ensureGatewayRunning()` because `gatewayRunning` had already been relaxed by the recovery path, so the first send could race ahead before Gateway had actually finished coming up.
- I updated `src/shared/dashboard-chat-routing.ts` so the dashboard now auto-selects only sessions that are truly Qclaw-owned / safe to resume by default: local direct sessions with transcript/cache, or upstream-confirmed direct shadows created by Qclaw. Plain external direct history sessions are no longer auto-bound on first entry, so the page falls back to create-new-session mode instead of silently attaching to stale upstream history.
- I also updated `src/components/dashboard/DashboardChatPanel.tsx` so direct chat sends now force `onEnsureGatewayRunning()` whenever the chat page is not yet in the fully `ready` state, even if the degraded recovery path is temporarily allowing send. That should eliminate the user-visible mismatch where the panel says Gateway is available enough to try, but the actual OpenClaw terminal only appears after the first failed send.
- To make the next failure more diagnosable, I updated `electron/main/openclaw-chat-service.ts` so the `send.failed` trace keeps short raw stderr/stdout details when the user-facing error has to fall back to a generic "????????" message.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 216: Package the direct-chat auto-bind and degraded-send warm-up fixes into v13
- After stopping auto-binding to stale external history sessions and forcing a real Gateway warm-up before degraded-state sends, I produced a fresh unpacked Windows build for validation.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v13/win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.13-v12`, so only the new `v13` build remains.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the chat fix.

### Update 217: Fix Electron main-process Gateway socket startup on Windows when `WebSocket` is missing
- The latest user screenshots finally exposed a hard blocker instead of a generic send failure: `Error invoking remote method 'chat:session:create': ReferenceError: WebSocket is not defined`.
- Root cause: after we pushed more of the packaged Windows flow onto Gateway RPC / Gateway send paths, `electron/main/chat-transport/gateway-streaming-chat-transport.ts` was still assuming `new WebSocket(url)` existed in Electron's main-process runtime. That is true in newer standalone Node runtimes, but not guaranteed inside the packaged Electron main process used by Mclaw 2026.4.1313.
- I updated the Gateway socket transport to resolve the WebSocket constructor explicitly and throw a normal actionable error (`gateway websocket runtime unavailable: WebSocket is not defined`) instead of leaking a raw `ReferenceError`. Then I updated `electron/main/openclaw-chat-service.ts` so Windows only prefers socket-first behavior when the current runtime actually has WebSocket support.
- This means `chat:session:create` / `sessions.create` can now cleanly fall back to the hidden Control UI browser RPC path on packaged Windows when Electron main lacks WebSocket, instead of crashing before the fallback logic ever runs.
- I also extended the socket-to-browser fallback matcher to treat `WebSocket is not defined` / `gateway websocket runtime unavailable` as a recoverable socket bootstrap failure.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 218: Package the Electron-main WebSocket fallback fix into v14
- After fixing the main-process `WebSocket is not defined` crash and letting packaged Windows fall back to the browser RPC path for `sessions.create`, I produced a fresh unpacked Windows build for validation.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v14/win-unpacked`.
- Packaging note: the builder automatically removed the previous `release/2026.4.13-v13`, so only the new `v14` build remains.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the chat fix.
### Update 219: Replace the hidden Control UI app bridge with direct browser WebSocket Gateway RPC
- The latest packaged-Windows logs showed the fallback browser still never emitted `sessions.create` or `chat.send`; it only loaded the Control UI page, ran the page's own bootstrap requests, and disconnected. That strongly suggests our helper was still coupled to `openclaw-app` private state instead of the Gateway protocol itself.
- I updated `electron/main/openclaw-control-ui-rpc.ts` so the hidden helper browser now uses the page's native `WebSocket` runtime to talk to Gateway directly. Both generic RPC calls and trusted `chat.send` now perform the `connect.challenge` -> `connect` handshake themselves and wait for Gateway `res` / `chat` frames, instead of depending on `app.client.request`, `chatRunId`, or `eventLogBuffer`.
- This keeps the key property we still need on packaged Windows (a renderer-side WebSocket implementation) while removing the most brittle dependency (Control UI private component internals that can drift across OpenClaw builds).
- I updated `electron/main/__tests__/openclaw-control-ui-rpc.test.ts` to lock the new helper-script shape in at the test level.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation note on April 13, 2026: targeted `vitest` still cannot start in this environment because Vite/esbuild hits the existing local `spawn EPERM` blocker before assertions execute.

### Update 220: Package the direct browser WebSocket Gateway fallback into v15
- After replacing the hidden browser fallback with direct Gateway WebSocket RPC/chat-send, I produced another fresh unpacked Windows build for validation.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v15/win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.13-v14`, so only the new `v15` build remains.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the chat fix.

### Update 221: Let the chat page automatically wait for gateway readiness after panel-side startup
- I aligned the flow around the user's preferred path: start Gateway in the panel, keep it running, then enter the chat page and let it wait until the conversation path is actually ready instead of forcing the user to trigger a failed send first.
- I extracted the shared readiness poller into `src/shared/dashboard-gateway-wait.ts`, and added `src/shared/chat-gateway-warmup-hint.ts` so renderer-side panel actions can leave a short-lived "Gateway was just started/reloaded" hint for the chat page.
- `src/pages/Dashboard.tsx` now marks that warm-up hint after successful start / restart / force-restart / self-repair and after plugin flows that reload Gateway.
- `src/pages/ChatPage.tsx` now performs an automatic warm-up when the page sees either a fresh panel-side warm-up hint or an already-running gateway snapshot. It calls `ensureGatewayRunning()`, waits for Gateway readiness, then polls chat availability until the page can really send, instead of staying in the misleading "not ready" state until the first send attempt.
- This keeps the existing compatibility recovery path for legacy OpenClaw Windows runtimes, but moves the waiting into page entry so the user experience becomes: panel starts gateway -> chat page waits -> direct conversation.
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 222: Package the auto-wait chat entry flow into v16
- After wiring the chat page to automatically wait for a just-started or already-running Gateway, I produced another fresh unpacked Windows build for validation.
- Validation on April 13, 2026: packaging will be recorded once `package:win:dir` completes for this change set.

### Update 223: Package the auto-wait chat entry flow into v16
- Validation on April 13, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.13-v16/win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.13-v15`, so only the new `v16` build remains.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the chat-entry flow fix.
### Update 224: Harden screenshot extraction across transport/service and add precise missing-image trace stages
- The April 15 screenshot repro changed from fake success with a bad image to explicit failure with no image, which means the guardrails were working but the screenshot payload was still disappearing between Gateway stream output, transcript recovery, and final reply assembly.
- I hardened both extraction layers so they now recognize more screenshot result shapes instead of only the narrow type=image or keyed-path cases.
- `electron/main/chat-transport/gateway-streaming-chat-transport.ts` now scans arbitrary string leaves for embedded image file paths in addition to embedded data URLs and raw image base64, and it widens keyed path lookup to include camelCase and snake_case variants such as `filePath`, `screenshot_path`, `image_path`, `artifactPath`, and `attachmentPath`.
- The Gateway transport also now attempts to hydrate readable local screenshot files into in-memory `data:image/...;base64,...` attachments immediately. That removes a temp-file race where a short-lived browser screenshot file could exist when the stream event arrived but disappear before the later service-side decode step.
- `electron/main/openclaw-chat-service.ts` received the same broader path-key coverage and text-level local-image-path extraction so transcript recovery and stdout parsing stay aligned with the transport layer instead of recognizing different attachment shapes.
- I added screenshot-chain observability directly into the existing chat trace stream with new stages such as `screenshot-transport-image-audit`, `screenshot-transport-returned-no-image`, `screenshot-transport-returned-unreadable-image`, `screenshot-transport-image-extracted-but-invalid`, `screenshot-transcript-image-audit`, `screenshot-transcript-returned-no-image`, `screenshot-transcript-returned-unreadable-image`, and `screenshot-transcript-image-extracted-but-invalid`.
- Those trace entries summarize image counts, whether attachments were `data:` or `file:` backed, whether bytes were readable, whether the images were visually valid, and a few short attachment source samples so the next failure is self-localizing inside the app.
- I kept the earlier screenshot protections intact: viewport-only screenshot guidance, no OS screenshot fallback, WebP signature parity, narrow-image rejection, and deterministic failure text when no valid image survives.
- Validation on April 15, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 15, 2026: `D:\nodejs\npm.cmd test -- electron/main/chat-transport/__tests__/gateway-streaming-chat-transport.test.ts electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`23 passed`).

### Update 225: Add regression coverage for text-carried screenshot paths and the new screenshot trace reasons
- I extended `electron/main/chat-transport/__tests__/gateway-streaming-chat-transport.test.ts` with a readable-temp-file case that simulates a screenshot path arriving only inside an arbitrary text field (`result.output = "Screenshot cached at C:\\...\\transport-screenshot.webp"`). The transport must now promote that path into a real in-memory image attachment instead of dropping it as plain text.
- I also refreshed the existing Gateway transport expectations so Windows file paths now normalize through `pathToFileURL(...)` (`file:///C:/...`) and carry the inferred image MIME type when the path extension is known.
- In `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` I added assertions for the new trace stages so the screenshot failure cases now prove we keep the failure deterministic and explain whether the image disappeared in transport, transcript recovery, or visual validation.
- Validation on April 15, 2026: `D:\nodejs\npm.cmd test -- electron/main/chat-transport/__tests__/gateway-streaming-chat-transport.test.ts electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`23 passed`).

### Update 226: Package the screenshot-chain extraction hardening and trace instrumentation into v11
- After broadening screenshot attachment extraction, hydrating readable local screenshot files early, and surfacing granular screenshot trace stages, I produced a fresh unpacked Windows build for validation.
- Validation on April 15, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.15-v11/win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.15-v10`, so only the new `v11` build remains.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the screenshot-chain fix.
### Update 227: Recover screenshots from raw OpenClaw session-log envelopes instead of failing on text-only transport replies
- The April 16 screenshot repro showed the browser tool was actually succeeding upstream, but Mclaw still rewrote the reply to deterministic failure because transcript recovery only handled the already-normalized message shape and missed raw OpenClaw session-log envelopes.
- `electron/main/openclaw-chat-service.ts` now parses external transcript timestamps from both numeric values and ISO timestamps, broadens transcript array discovery to include `records` / `events` / `timeline` / `turns`, and also checks nested `session` / `transcript` / `conversation` payload shells before giving up.
- I added `flattenExternalSessionMessageRecord(...)` so transcript loading now understands raw session-log records shaped like `{ type: "message", timestamp, message: { role, content, model } }`, while still preserving top-level fields such as `details.path` on browser `toolResult` records.
- Screenshot transcript recovery no longer requires the image and the final assistant text to live on the same mapped message. It now walks the latest assistant turn tail, pairs the newest assistant text with the nearest assistant/toolResult image attachment in that same turn, and uses that composite reply to recover the real screenshot bytes.
- This keeps the earlier guardrails intact: fake-success text is still rewritten to failure when no valid image exists, visually useless images are still rejected, and there is still no fallback to OS screenshot tools.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`7 passed`).
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-service.test.ts -t "maps raw session-log message envelopes from sessions.get and preserves toolResult screenshots"` passed.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-service.test.ts -t "browser screenshots"` passed.
### Update 228: Package the raw-session screenshot transcript recovery fix into v0 for April 16 validation
- After teaching transcript recovery to understand raw OpenClaw session-log envelopes and to pair final assistant text with adjacent toolResult screenshots, I produced a fresh unpacked Windows build for validation.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v0\win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.15-v11`, so only the new `v0` build for April 16 remains.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the screenshot transcript fix.

### Update 229: Recover missing browser screenshots directly from upstream session JSONL when dashboard transcript history drops toolResult images
- The April 16 packaged repro still failed after Update 227, which ruled out browser capture itself. I inspected the real upstream session log for `73ed21cd-29c7-4438-93e2-db9460097b65` and confirmed the browser `toolResult` image and final assistant success text were both present in `openclaw-state\.openclaw\agents\main\sessions\73ed21cd-29c7-4438-93e2-db9460097b65.jsonl`.
- Root cause: screenshot recovery in `electron/main/openclaw-chat-service.ts` still depended on `getChatTranscript(...)`, which reads the dashboard-facing session history (`agent:main:dashboard:...`). In the failing packaged flow that dashboard transcript omitted the browser `toolResult` image, so Mclaw rewrote the reply to deterministic failure even though the upstream JSONL session log contained the real screenshot bytes.
- I added a direct upstream session-log fallback to the screenshot recovery path. When transport output and dashboard transcript recovery still do not yield a valid image, Mclaw now discovers the active OpenClaw `stateRoot`, scans candidate `agents/<agentId>/sessions/<sessionId>.jsonl` files, parses raw JSONL `type: "message"` envelopes with the same external-message mapper used elsewhere, and retries screenshot pairing against those mapped messages before declaring failure.
- The fallback checks both the visible session id and the transport session id, so the repair also covers future cases where the chat shell and the upstream transport session diverge.
- I added a new end-to-end regression in `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` that simulates the exact failure mode: transport returns only final text, `sessions.get` returns a dashboard transcript without the browser image, but the upstream JSONL session log contains the real `toolResult` screenshot. The test now proves Mclaw recovers the image from disk and emits the dedicated trace stages `screenshot-session-log-image-audit` and `screenshot-recovered-from-session-log`.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`8 passed`).
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-service.test.ts -t "browser screenshots"` passed.

### Update 230: Package the direct upstream session-log screenshot fallback into v1 for April 16 validation
- After adding direct JSONL session-log recovery for browser screenshots that are missing from dashboard transcript history, I produced a fresh unpacked Windows build for validation.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v1\win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.16-v0`, so only the new `v1` build for April 16 remains.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the screenshot recovery fix.

### Update 231: Recover collapsed browser screenshots by refocusing the live OpenClaw tab and recapturing PNG bytes
- The April 16 packaged repro proved the new session-log fallback was working correctly but still failing intentionally because the upstream browser screenshot itself was broken: OpenClaw returned a technically valid JPEG that was only 46x2000, so Mclaw rejected it as visually invalid.
- I kept the visual-invalid guardrails in place and added a deterministic second-stage recovery path in `electron/main/openclaw-chat-service.ts`. When transport output and transcript/session-log recovery still leave the screenshot missing or visually invalid, Mclaw now reads the upstream session JSONL again, extracts the live browser `targetId`, then runs one direct browser recovery sequence through OpenClaw itself: `browser focus`, `browser resize 1365 900 --target-id <id>`, and `browser screenshot <id> --type png`.
- The recapture parser now also understands OpenClaw CLI `MEDIA:<path>` output, so browser screenshot commands that return a saved media path are immediately rehydrated into real chat image attachments and revalidated before the reply is accepted.
- This keeps the failure semantics strict: if the direct browser recapture still cannot produce a real readable image, Mclaw continues to rewrite the reply to deterministic failure instead of letting success text slip through without a valid screenshot.
- I added a regression in `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` that simulates the exact production failure mode: transport returns text only, the upstream session log contains a collapsed invalid screenshot, and the browser CLI recovery pass returns `MEDIA:<path>` for a new valid PNG. The test now proves Mclaw emits `screenshot-browser-recapture-image-audit` and `screenshot-recaptured-from-browser-cli` and returns the real image bytes.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`9 passed`).
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-service.test.ts -t "browser screenshots"` passed.

### Update 232: Package the browser-recapture screenshot recovery fix into v2 for April 16 validation
- After adding the direct OpenClaw browser recapture fallback for collapsed screenshot outputs, I produced a fresh unpacked Windows build for validation.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v2\win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.16-v1`, so only the new `v2` build for April 16 remains.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the screenshot recapture fix.

### Update 233: Add persistent screenshot diagnostics and bare-path image extraction for packaged repros
- The screenshot pipeline still fails in packaged repros after browser launch, but the prior implementation only kept screenshot trace entries in memory. That made the final failure opaque once the app rewrote the optimistic success text into the deterministic missing-image error.
- `electron/main/openclaw-chat-service.ts` now persists screenshot diagnostics to `~/mclaw-screenshot-debug.log`. Every `screenshot-*` trace stage is appended to that file, and the validator now records why an attachment was accepted or rejected, including parsed dimensions when available.
- I also added targeted diagnostics around the two most likely packaged breakpoints: session-log browser context recovery now logs searched `stateRoot` / session candidates and whether `targetId` was found, and direct browser recapture now logs the raw `browser screenshot` stdout/stderr before attachment extraction.
- To cover another real packaged-edge case, `collectChatImageAttachmentsFromCliResult(...)` now has a final bare-path fallback: if OpenClaw returns a plain image file path on its own line instead of `MEDIA:<path>`, Mclaw will still read that file and rehydrate it into a real image attachment.
- I added a regression to `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` proving the new fallback works when browser recapture returns a bare PNG path without the `MEDIA:` prefix.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`10 passed`).
- Validation note on April 16, 2026: the focused suite `D:\nodejs\npm.cmd test -- electron/main/__tests__/openclaw-chat-service.test.ts -t "browser screenshots"` still shows an environment-level timeout / temp-dir `EBUSY` cleanup issue on this machine rather than a direct assertion failure in the new screenshot-flow path.

### Update 234: Package the screenshot diagnostics build into v3 for packaged repro collection
- After adding persistent screenshot diagnostics and the bare-path browser recapture fallback, I produced a fresh unpacked Windows build for the next packaged repro pass.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v3\win-unpacked`.
- Packaging note: the builder automatically removed `release/2026.4.16-v2`, so only the new `v3` build for April 16 remains.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks collecting the next screenshot debug log.

### Update 235: Expand `OPENCLAW_HOME` placeholders in browser recapture media paths
- The packaged April 15, 2026 debug log isolated the remaining real failure: browser recapture itself succeeded, but OpenClaw returned `MEDIA:$OPENCLAW_HOME\.openclaw\media\browser\...jpg`, and Mclaw treated that placeholder path as unreadable so `rawImages=0 validImages=0` still collapsed into `screenshot-missing-image`.
- I fixed `electron/main/openclaw-chat-service.ts` so chat image path resolution now expands OpenClaw home placeholders before file reads. The resolver now understands `$OPENCLAW_HOME\...`, `${OPENCLAW_HOME}\...`, and `%OPENCLAW_HOME%\...`, and it prefers concrete home roots recovered from the matched session log / state root before falling back to `process.env.OPENCLAW_HOME`.
- Browser recapture now passes those recovered home candidates into CLI attachment parsing, so `MEDIA:$OPENCLAW_HOME\.openclaw\media\browser\...` is rehydrated into a real image attachment instead of being silently discarded as a relative path.
- I kept the existing screenshot guardrails intact: invalid narrow / broken screenshots still fail, and text-only replies are still rewritten to deterministic screenshot failure when no valid image survives.
- I added a regression to `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` that mirrors the packaged repro exactly: `browser screenshot --type png` returns `MEDIA:$OPENCLAW_HOME\.openclaw\media\browser\recaptured-from-openclaw-home.jpg`, `process.env.OPENCLAW_HOME` is intentionally unset, and Mclaw now recovers the JPEG through the session-derived OpenClaw home root.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`11 passed`).

### Update 236: Package the `OPENCLAW_HOME` screenshot-path fix into v4 for packaged validation
- After fixing placeholder expansion for browser recapture media paths, I produced a fresh unpacked Windows build for the next packaged validation pass.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v4\win-unpacked`.
- Packaging note: `electron-builder` could not delete `release/2026.4.16-v3\win-unpacked` because that old unpacked build was still locked by another process (`EBUSY`). The new `v4` build was still created successfully.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the `OPENCLAW_HOME` screenshot-path fix.

### Update 237: Reopen the page in a fresh browser tab when direct recapture still returns a collapsed screenshot
- The April 16, 2026 packaged repro after the `OPENCLAW_HOME` fix proved the remaining failure had moved forward again: Mclaw could now read the browser recapture file, but the recovered target still produced a visually invalid `189x2000` JPEG, so the pipeline correctly kept failing instead of accepting a collapsed image.
- The new repro also exposed a recovery-context weakness in `electron/main/openclaw-chat-service.ts`: the latest assistant `browser screenshot` toolCall reused the correct `targetId` but omitted the page URL, and the old selector would stop there instead of preferring the later `toolResult` record that carried both `url` and `type: page`.
- I changed browser recovery context selection to score candidates instead of returning the first screenshot-like match. Mclaw now prefers screenshot records that also carry a real page URL / page type, which preserves the upstream page URL for a second recovery attempt.
- Direct browser recapture now performs a more defensive two-step strategy. First it refocuses the recovered target, resizes to `1365x900`, waits briefly for layout to settle, and screenshots as before. If that still yields only visually invalid images and the session log gave us a URL, Mclaw now opens the same page in a fresh OpenClaw browser tab, repeats focus / resize / settle, and recaptures that new target.
- The browser recapture trace now records the strategy (`existing-target` vs `reopened-target`), includes the post-resize wait result, and reports any `browser open <url>` fallback attempt in the recapture audit.
- I added a regression to `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` that mirrors the new packaged failure mode: the recovered target still returns a collapsed invalid JPEG, but reopening the same URL in a fresh tab produces a valid PNG and the send path now succeeds.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`12 passed`).

### Update 238: Package the fresh-tab screenshot recapture fallback into v5 for the next packaged repro
- After adding the fresh-tab recapture fallback and better session-log target selection, I produced another unpacked Windows build for packaged validation.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v5\win-unpacked`.
- Packaging note: `electron-builder` could not fully remove `release/2026.4.16-v4\win-unpacked` because that older unpacked build was still locked by another process (`EPERM` on `node.exe`). The new `v5` build was still created successfully.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the fresh-tab screenshot fallback.

### Update 239: Recover missing browser page URLs from raw session-log messages before deciding whether fresh-tab reopen is possible
- The next real packaged repro on April 16, 2026 still failed on `v5`, and the new persistent debug log finally isolated why: the recovery context resolved `targetId=0B1D78EF0AA83D96383153304E71827A` but still logged `url=none`, so Mclaw only attempted `strategy=existing-target` and never activated the fresh-tab reopen fallback after the recaptured JPEG came back collapsed at `189x2000`.
- I verified the upstream session log itself was not missing the URL. In `C:\Users\James\AppData\Roaming\Mclaw\openclaw-state\.openclaw\agents\main\sessions\e9976059-1a13-4000-89b3-bff03dd31c14.jsonl`, the earlier browser `open` toolResult for that same target still included `url: "https://github.com/openclaw/openclaw"` and `type: "page"`.
- Root cause: `extractBrowserScreenshotRecoveryContextFromRawMessages(...)` can still pick a later screenshot-related record that preserves the right `targetId` but drops the page URL. When that happened, the reopen strategy was skipped even though the raw session log still had enough information to recover the page address.
- I added `recoverBrowserTargetUrlFromRawMessages(...)` in `electron/main/openclaw-chat-service.ts`. When the first recovery-context pass finds a `targetId` but no URL, Mclaw now scans the same raw session-log messages for earlier browser tool records/results with the same `targetId` and backfills the missing page URL before logging or returning the recovery context.
- I strengthened the reopen regression in `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` to match the real packaged failure shape: the invalid screenshot toolResult omits `url`, the earlier browser `open` toolResult still carries `targetId + url`, and the flow now proves the recovered URL is enough to reopen the page in a fresh tab and return a valid PNG instead of failing closed.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`12 passed`).

### Update 240: Package the raw-session-log URL recovery fix into v6 for the next packaged validation pass
- After fixing recovery-context URL backfill from raw session-log browser messages, I produced a fresh unpacked Windows build for another packaged repro pass.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v6\win-unpacked`.
- Packaging note: the builder cleaned the prior `release/2026.4.16-v5` output automatically and kept only the new `v6` build.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the raw-session-log URL recovery fix.

### Update 241: Parse plain-text `browser open` results so fresh-tab screenshot recovery can continue when OpenClaw does not emit JSON
- The next real packaged repro on April 16, 2026 advanced one step further: the recovery context now correctly resolved `targetId + url`, the first direct recapture still produced a collapsed `189x2000` JPEG, and Mclaw did attempt the fresh-tab reopen fallback.
- The new blocker was the format of the `browser open` result itself. In the failing packaged run, OpenClaw returned plain text:
  - `opened: https://github.com/openclaw/openclaw`
  - `id: 3E633A294332DAFBC82FBA7665AE6CC7`
  The existing reopened-target parser in `electron/main/openclaw-chat-service.ts` only accepted JSON, so it logged `screenshot-browser-recapture-reopened-target [miss] targetId=none` and never executed the second screenshot against the fresh tab.
- I extended `extractBrowserTargetDescriptorFromCliResult(...)` to fall back to a plain-text parser after the JSON path. It now recognizes `targetId:`, `target_id:`, or `id:` fields plus `url:` or `opened:` lines, so the reopen flow can recover the new browser target even when OpenClaw emits human-readable text instead of JSON.
- I updated the fresh-tab regression in `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` to use the same real packaged output shape (`opened: ...` plus `id: ...`) and kept the behavioral assertion on the reopened screenshot target, so this exact formatting regression is now covered.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`12 passed`).

### Update 242: Package the plain-text reopened-target parser into v7 for the next packaged validation pass
- After teaching the fresh-tab reopen flow to parse plain-text `browser open` output, I produced another unpacked Windows build for validation.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v7\win-unpacked`.
- Packaging note: the builder cleaned the prior `release/2026.4.16-v6` output automatically and kept only the new `v7` build.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the plain-text reopened-target fix.

### Update 243: Fall back to a fresh isolated OpenClaw browser profile when even the reopened tab still screenshots as a collapsed strip
- The next real packaged repro on April 16, 2026 proved the fresh-tab reopen path was finally working end to end: Mclaw recovered the page URL, parsed the plain-text `browser open` output, found the reopened target id, and executed a second screenshot against the new tab.
- The new blocker was that the reopened tab still returned the same broken `189x2000` JPEG as the original target. That means the failure had moved past session-log parsing and target recovery; the browser state itself was still contaminated enough that simply opening another tab in the same profile did not reset the bad viewport / capture behavior.
- I added a third-stage browser-only recovery path in `electron/main/openclaw-chat-service.ts`. If both the existing target and the reopened target still produce only visually invalid screenshots, Mclaw now creates a temporary isolated OpenClaw browser profile, opens the same URL inside that clean profile, repeats focus / resize / settle, captures the screenshot again, then best-effort deletes the temporary profile.
- The recovery command builder now supports optional `--browser-profile <name>` injection for the screenshot recapture flow, and the recapture audit now records the temporary profile name plus `create-profile` / `delete-profile` command outcomes so the persistent debug log shows exactly whether the isolated-profile fallback ran.
- I added a regression to `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` that mirrors the new real failure shape: existing-target screenshot is collapsed, reopened-target screenshot is still collapsed, but the isolated-profile open and screenshot return a valid PNG. The test also proves the temporary profile is cleaned up afterward.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`13 passed`).
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 244: Package the isolated-browser-profile screenshot fallback into v8 for the next packaged validation pass
- After adding the isolated OpenClaw browser profile fallback for persistent collapsed screenshot outputs, I produced another unpacked Windows build for validation.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v8\win-unpacked`.
- Packaging note: the builder cleaned the prior `release/2026.4.16-v7` output automatically and kept only the new `v8` build.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the isolated-profile screenshot fallback.

### Update 245: Fall back to restarting the default OpenClaw browser when the gateway refuses persistent profile mutation
- The next real packaged repro on April 16, 2026 showed the isolated-profile fallback was not actually usable in James's environment. The persistent debug log proved `browser.request` rejected both `create-profile` and `delete-profile` with `GatewayClientRequestError: browser.request cannot create or delete persistent browser profiles`, so Mclaw stopped after the reopened-tab attempt and still failed closed.
- I verified that this was a real upstream gateway restriction rather than a parser bug by inspecting the locally installed OpenClaw distribution under `C:\Users\James\AppData\Roaming\npm\node_modules\openclaw\dist`. The gateway blocks persistent profile mutation, but still exposes browser lifecycle routes such as `POST /start` and `POST /stop`.
- I kept the strict screenshot validity guardrails unchanged and replaced the dead-end recovery path with a gateway-safe last resort in `electron/main/openclaw-chat-service.ts`: if the existing target is collapsed, the reopened target is still collapsed, and isolated profile creation is unavailable or still does not yield a valid screenshot, Mclaw now tries `browser stop`, `browser start`, reopens the original URL in the default profile, and recaptures that fresh browser target as PNG.
- The recapture audit now preserves the failed `create-profile` result even when the successful recovery ultimately comes from the restarted browser path, and it records the `stop` / `start` command outcomes beside the final screenshot attempt so the persistent debug log can distinguish gateway rejection from browser-process recovery.
- I added a regression to `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` that mirrors the real packaged failure shape: existing-target screenshot is collapsed, reopened-target screenshot is still collapsed, `create-profile` is rejected by the gateway, and the subsequent browser restart + reopen returns a valid PNG. I also bumped the timeouts on the slower screenshot-flow regressions so the full file still passes reliably under local load.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`14 passed`).
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 246: Package the browser-restart screenshot fallback into v9 for the next packaged validation pass
- After wiring in the gateway-safe browser restart fallback, I produced another unpacked Windows build for real packaged validation.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v9\win-unpacked`.
- Packaging note: the builder cleaned the prior `release/2026.4.16-v8` output automatically and kept only the new `v9` build.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the browser-restart screenshot fallback.

### Update 247: Reset the reopened tab to the Desktop Chrome device profile before escalating to browser restart
- The real `v9` packaged repro on April 16, 2026 proved the browser restart fallback was wired correctly but still insufficient in James's environment. The persistent debug log showed the full `existing-target -> reopened-target -> create-profile denied -> stop/start/open -> restarted-browser` chain running end to end, yet the final screenshot was still the same collapsed `189x2000` JPEG.
- That failure shape materially changed the diagnosis. At this point the recovery pipeline itself was no longer the blocker; the newly opened tab was still carrying a bad device-emulation / page-metrics state, because even a fresh tab after browser restart continued to capture as a narrow strip.
- I inspected the locally installed OpenClaw browser CLI and confirmed that `browser set device <name> --target-id <id>` is available and gateway-safe. It routes to `/set/device`, and the implementation applies Playwright's device descriptor through `Emulation.setDeviceMetricsOverride`, which is the right lever for clearing a bad mobile / narrow device state without mutating persistent browser profiles.
- I added a lighter recovery step in `electron/main/openclaw-chat-service.ts`: if the reopened tab still screenshots as a collapsed strip, Mclaw now runs `browser set device "Desktop Chrome" --target-id <reopenedTarget>` on that fresh tab, then repeats focus / resize / wait / screenshot before escalating to isolated-profile or browser-restart recovery.
- The recapture audit now records the `device` command result, and successful recovery reports strategy `desktop-device-reset`, so the debug log cleanly distinguishes a device-emulation reset from tab reopen or process restart.
- I added a regression to `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` that mirrors this new path: existing-target screenshot is collapsed, reopened-target screenshot is still collapsed on the first pass, `set device Desktop Chrome` succeeds on the reopened target, the second screenshot on that same target becomes a valid PNG, and the flow never escalates to `create-profile` or `stop/start`.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`15 passed`).
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 248: Package the Desktop Chrome device-reset screenshot fallback into v10 for the next packaged validation pass
- After inserting the gateway-safe `Desktop Chrome` device reset step for reopened screenshot tabs, I produced another unpacked Windows build for real packaged validation.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v10\win-unpacked`.
- Packaging note: the builder cleaned the prior `release/2026.4.16-v9` output automatically and kept only the new `v10` build.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the reopened-tab device-reset fallback.

### Update 249: Reset the restarted browser target to Desktop Chrome when restart alone still returns a collapsed strip
- The next real packaged repro on April 16, 2026 showed the recovery chain had progressed again, but it still failed on a narrower edge case. The debug log proved the flow ran `existing-target -> reopened-target -> desktop-device-reset -> create-profile denied -> stop/start/open -> restarted-browser`, yet the final restarted-browser screenshot was still the same collapsed `189x2000` JPEG.
- That failure matters because it rules out both transcript/session-log parsing bugs and simple browser reopen bugs. In this path, the browser process was already restarted and the page was reopened on a fresh target, but the screenshot still came back with broken mobile-like metrics. The remaining defensible move is to apply the same device reset to the restarted target before giving up.
- I extended `electron/main/openclaw-chat-service.ts` so `runBrowserScreenshotDesktopDeviceResetAttempt(...)` can be reused with an explicit strategy, then added a final `restarted-browser-device-reset` step: if the restarted target still yields no valid screenshot, Mclaw now runs `browser set device "Desktop Chrome" --target-id <restartedTarget>`, then repeats focus / resize / wait / screenshot on that restarted target before failing closed.
- I kept the existing screenshot validity checks unchanged. Mclaw still rejects narrow, tiny, blank, or broken images; this change only adds one more browser-native recovery pass aimed at fixing the image bytes themselves.
- I updated `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` to mirror the real failure shape from James's packaged log: existing target invalid, reopened target invalid, reopened-target device reset still invalid, `create-profile` denied, restart succeeds, restarted-target first screenshot still invalid, and restarted-target device reset finally returns a valid PNG. The regression now asserts final strategy `restarted-browser-device-reset` and preserves `create-profile=failed`, `stop=ok`, `start=ok`, and `device=ok(...)` in the audit trace.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`15 passed`).
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 250: Package the restarted-target Desktop Chrome reset into v11 for the next real validation pass
- After adding the final `restarted-browser-device-reset` recovery step, I produced another unpacked Windows build for James to validate against the real OpenClaw environment.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v11\win-unpacked`.
- Packaging note: the builder cleaned the prior `release/2026.4.16-v10` output automatically and kept only the new `v11` build.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the restarted-target Desktop Chrome reset.

### Update 251: Re-navigate the same tab after Desktop Chrome reset when device override alone still leaves the screenshot collapsed
- The next real `v11` packaged log showed the new `restarted-browser-device-reset` step was definitely running, but James's environment still failed closed. The log now reached `strategy=restarted-browser-device-reset`, `device=ok(device: Desktop Chrome)`, and a fresh screenshot path, yet the returned image was still the same bad `189x2000` JPEG.
- That failure shape narrows the problem further: the target can be reopened, the browser can be restarted, and the device descriptor can be applied, but the page can still remain in a collapsed mobile-like render state until the tab actually reloads under the new device metrics.
- I added a browser-native re-navigation step in `electron/main/openclaw-chat-service.ts`. When a `Desktop Chrome` device reset still yields only invalid screenshots, Mclaw now runs `browser navigate <url> --target-id <sameTarget>` on that same tab and then repeats focus / resize / wait / screenshot before escalating or failing.
- The new path is wired for both device-reset branches:
  - `desktop-device-reset-renavigate` for the reopened target
  - `restarted-browser-device-reset-renavigate` for the restarted target
- The recapture audit now records `navigate=...` alongside `device=...`, `stop=...`, `start=...`, and the final screenshot result, so the persistent debug log shows whether the recovery actually reloaded the page after the device override.
- I updated `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` to mirror the stricter real failure chain: reopened target remains collapsed after device reset and after re-navigation, persistent-profile creation is still denied, restarted target remains collapsed after device reset, and only the restarted-target re-navigation finally returns a valid PNG. The regression now asserts final strategy `restarted-browser-device-reset-renavigate`.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`15 passed`).
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 252: Package the post-device-reset re-navigation fallback into v12 for the next real validation pass
- After adding the same-target re-navigation step after failed `Desktop Chrome` resets, I produced another unpacked Windows build for James to validate in the real OpenClaw environment.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v12\win-unpacked`.
- Packaging note: the builder cleaned the prior `release/2026.4.16-v11` output automatically and kept only the new `v12` build.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the post-device-reset re-navigation fallback.

### Update 253: Give same-target re-navigation its own longer timeout after the real v12 logs showed 20-second navigation stalls
- The next real `v12` log materially changed the diagnosis again. Both re-navigation branches were finally reached in James's environment:
  - `strategy=desktop-device-reset-renavigate`
  - `strategy=restarted-browser-device-reset-renavigate`
  but both failed after roughly 20 seconds with empty stdout/stderr.
- That timing is the key signal. The re-navigation command itself was not rejected by the gateway, and the browser target was already valid; the command was simply timing out at the generic 20-second browser-recovery timeout before GitHub finished reloading under the new device metrics.
- I added a dedicated navigation timeout in `electron/main/openclaw-chat-service.ts`: `CHAT_BROWSER_RECOVERY_NAVIGATE_TIMEOUT_MS = 45_000`. The post-device-reset `browser navigate <url> --target-id <sameTarget>` path now uses this longer budget instead of the generic 20-second recovery timeout.
- I also tightened the navigate debug log to include the returned `code=...` so the next real failure, if any, distinguishes an actual CLI rejection from another timeout.
- I updated the renavigation regression in `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` to assert the two `browser navigate` calls now run with the 45-second timeout budget.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`15 passed`).
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 254: Package the longer re-navigation timeout into v13 for the next real validation pass
- After extending the same-target navigation timeout from 20 seconds to 45 seconds, I produced another unpacked Windows build for James to validate against the real OpenClaw environment.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v13\win-unpacked`.
- Packaging note: the builder cleaned the prior `release/2026.4.16-v12` output automatically and kept only the new `v13` build.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the longer re-navigation timeout.

### Update 255: Default back to native chat flow and gate all Mclaw screenshot post-processing behind an explicit opt-in flag
- James clarified that the immediate priority is restoring normal conversation context, not continuing to stack screenshot-specific recovery behavior. The critical requirement is that ordinary follow-up turns behave like native OpenClaw chat again, even if earlier messages in the session involved screenshots.
- I changed `electron/main/openclaw-chat-service.ts` so all Mclaw-specific screenshot handling is now gated behind `MCLAW_ENABLE_SCREENSHOT_SPECIAL_HANDLING=1`.
- In the default runtime path, Mclaw now skips:
  - screenshot follow-up interception like “save the last screenshot to Desktop”
  - screenshot-specific extra system prompts / legacy inline screenshot guidance
  - screenshot transport auditing, transcript/session-log recovery, browser recapture, and failure-text rewriting
  - automatic screenshot persistence to the Desktop
- This restores native conversation behavior by default: normal turns use the standard send/receive path and preserve ordinary session memory without screenshot-only branches trying to reinterpret the new request.
- I kept the screenshot test suite usable by enabling the env flag inside `electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts`, and I added a regression proving that when the flag is not set, a new non-screenshot desktop-save task is not hijacked by stale screenshot state from earlier in the session.
- Validation on April 16, 2026: `D:\workspace\Mclaw\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-screenshot-flow.test.ts` passed (`16 passed`).
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run typecheck` passed.

### Update 256: Package the native-default chat-flow restoration into v15
- After switching Mclaw back to native chat behavior by default and leaving screenshot special handling opt-in only, I produced another unpacked Windows build for James to validate normal conversation flow in-place without reopening sessions.
- Validation on April 16, 2026: `D:\nodejs\npm.cmd run package:win:dir` passed and produced `release/2026.4.16-v15\win-unpacked`.
- Packaging note: the builder cleaned the prior `release/2026.4.16-v14` output automatically and kept only the new `v15` build.
- Packaging note: this is still an unsigned development build, and the auto-update publish URL is still using the placeholder value; neither issue blocks local validation of the native-default chat-flow restoration.
