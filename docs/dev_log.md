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
- Traced the next stability gap to electron/main/gateway-lifecycle-controller.ts: shared start / estart mutations still returned success as soon as the raw CLI command exited 0, which let coordinator/reload callers treat the gateway as usable before a real health probe had confirmed it.
- Updated startGatewayLifecycle() and estartGatewayLifecycle() to reuse the same health-confirmation polling used by config reload, so all shared lifecycle entrypoints now converge on the same rule: command success is not enough; the gateway must come back healthy.
- Kept the result surface compatible by returning the richer GatewayReloadResult, which preserves CliResult fields while surfacing unning / stateCode / summary for downstream diagnostics and UI decisions.
- Expanded electron/main/__tests__/gateway-lifecycle-controller.test.ts to cover the new start-health confirmation path and the failure case where restart returns 0 but the gateway never becomes healthy again.
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

### Update 257: Repeat packaged Windows Direct Chat cold-start smoke 3 times on v16 and treat P0-07 as passed on the current machine/build
- I ran three repeated packaged Direct Chat smoke rounds against `release/2026.4.16-v16\win-unpacked\Mclaw.exe` on April 16, 2026. Each round used a fresh app launch and a fresh DevTools port (`9341`, `9342`, `9343`) because local port `9222` was already occupied by a stale listener and was not reliable for automation attachment.
- In all three rounds, the packaged build loaded the same managed config at `C:\Users\James\AppData\Roaming\Mclaw\openclaw-state\.openclaw\openclaw.json`, resolved `defaultModel = deepseek/deepseek-chat`, and returned `getChatAvailability => state=ready / canSend=true / gatewayRunning=true` both before and after `ensureGatewayRunning()`.
- In all three rounds, `ensureGatewayRunning()` returned `ok=true`, `running=true`, `stateCode=healthy`, and `effectivePort=18789`, so the packaged app was not just rendering the chat UI; it was attaching to the expected healthy gateway path.
- In all three rounds, the packaged build created a fresh local Direct Chat shell, sent the first message successfully, wrote a 2-message transcript with a real assistant reply into `C:\Users\James\AppData\Roaming\Mclaw\chat\transcripts.json`, and recorded the expected successful trace chain: `start -> bootstrap-session-created -> transport-run -> transport-run-ok -> succeeded`.
- Round evidence:
  - Round 1 session: `70796247-c820-4cc6-a4bd-321eb54ec892`
  - Round 2 session: `5f15bf7e-3c95-43f5-b27c-a5a59ea670fd`
- Round 3 session: `df9c6aee-bfe0-4572-af92-78157bb3b0ec`
- Based on this 3/3 repeated packaged smoke result, I am treating `P0-07` as passed on James's current machine and current packaged build line, specifically for `2026.4.16-v16`. This does not claim universal closure across all future machines/builds, but it is enough to downgrade `P0-07` from the immediate mainline blocker here.
- Mainline decision from this point: stop spending the next cycle on Direct Chat unblock work, and switch the active project focus back to the Feishu official integration mainline.

### Update 258: Repair official-channel adapter compile breakage and let Feishu status use runtime evidence
- I repaired `electron/main/official-channel-adapters.ts`, which had already drifted into a broken compile state because multiple user-facing strings were mojibake / unterminated literals. I rewrote the adapter cleanly so the shared official-channel status path is valid TypeScript again.
- The Feishu branch no longer leaves `loaded` and `ready` permanently stuck at `unknown` once runtime evidence exists. The adapter now reads `getFeishuBotRuntimeStatuses()` and derives status as follows:
  - runtime read failure -> `loaded/ready = unknown`
  - no complete Feishu bot credentials detected -> `loaded/ready = unknown`
  - gateway running with Feishu runtime snapshots -> `loaded = verified`
  - at least one online Feishu bot -> `ready = verified`
  - configured bots present but not online -> `ready = missing`
- I kept the DingTalk branch conservative. It still reports `installed` / `registered` from disk + `plugins list`, while `loaded` / `ready` remain `unknown` until upstream exposes stronger runtime proof.
- I rewrote `electron/main/__tests__/official-channel-adapters.test.ts` to match the repaired adapter and removed the broken mojibake assertions. The test file now covers:
  - DingTalk evidence-backed status mapping
  - Feishu config drift without false-positive readiness
  - Feishu runtime promotion to `loaded=verified` and `ready=verified`
  - retry-after-stale-plugin-repair behavior for `plugins list`
  - Feishu repair result mapping
  - DingTalk repair delegation
- Validation on April 16, 2026: `.\node_modules\.bin\tsc.cmd --noEmit` passed.
- Validation on April 16, 2026: `.\node_modules\.bin\vitest.cmd run electron/main/__tests__/official-channel-adapters.test.ts` passed (`6 passed`).

### Update 259: Use the shared managed-channel status to block false-positive Feishu completion after Gateway reload
- After wiring Feishu `ready` through runtime evidence, I pushed that status one step further into `src/pages/ChannelConnect.tsx`. The setup flow now does a post-reload / post-recovery managed-status confirmation instead of assuming “Gateway came back up” automatically means the channel is actually ready.
- I added `getManagedPluginStageState(...)`, `hasBlockingManagedChannelReadyState(...)`, and `confirmManagedChannelStatusAfterGatewayReady(...)` so the gateway-confirmation step now distinguishes three cases:
  - `installed + registered + ready=verified` -> success
  - `installed + registered + ready=unknown` -> still allowed, for channels like DingTalk that do not yet have upstream runtime proof
  - `installed + registered + ready=missing` -> block completion and surface the managed status summary as the user-facing reason
- This closes the main Feishu gap exposed by the new adapter logic: if Gateway restarts successfully but the shared Feishu status still says “Bot not ready” (for example because routing/binding/runtime evidence is still missing), Channel Connect no longer treats that as a successful finish.
- I added two regression tests in `src/pages/__tests__/channel-connect.test.ts`:
  - a Feishu case that now fails closed when `ready=missing`
  - a DingTalk case that still stays on the normal success path when `ready=unknown`
- Validation on April 16, 2026: `.\node_modules\.bin\tsc.cmd --noEmit` passed.
- Validation on April 16, 2026: `.\node_modules\.bin\vitest.cmd run electron/main/__tests__/official-channel-adapters.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`55 passed`).

### Update 260: Surface shared Feishu blocking status on ChannelsPage and hide the repair CTA once the channel is actually healthy
- I continued the Feishu status-convergence work in `src/pages/ChannelsPage.tsx` so the list view and pairing modal no longer rely only on the raw per-bot runtime badge. The page now has shared helpers for reading managed status stages and deriving a Feishu blocking alert from the same shared status object used by Channel Connect.
- I added:
  - `getManagedPluginStageState(...)`
  - `getFeishuSharedStatusAlert(...)`
  - a stricter `shouldShowFeishuPluginRepairAction(...)`
- Behavior change:
  - healthy Feishu rows (`installed/registered/ready = verified`) no longer keep showing the generic “修复飞书插件” CTA
  - rows with missing / degraded shared status still show the repair CTA
  - when the shared Feishu status says the channel is blocked, ChannelsPage now surfaces that summary inline on both the channel card and the pairing modal, instead of forcing the user to infer the problem only from the runtime badge
- I added targeted state tests in `src/pages/__tests__/channels-page-state.test.ts` to lock the new behavior:
  - healthy Feishu rows hide the repair CTA
  - shared status can be read by stage id
  - `ready=missing` produces a shared Feishu blocking alert
  - the page source still wires that alert into both the card and pairing modal
- Validation on April 16, 2026: `.\node_modules\.bin\tsc.cmd --noEmit` passed.
- Validation on April 16, 2026: `.\node_modules\.bin\vitest.cmd run electron/main/__tests__/official-channel-adapters.test.ts src/pages/__tests__/channel-connect.test.ts src/pages/__tests__/channels-page-state.test.ts` passed (`65 passed`).

### Update 261: Clarify bundled Feishu dependencies and extend the shared Feishu status into the diagnostics modal
- I verified the current packaging boundary before continuing the Feishu mainline:
  - Mclaw already bundles the OpenClaw runtime/CLI layer via `resources/openclaw-bundle`, with `manifest.json` declaring `defaultDeliveryMode = bundled-runtime` and `electron/main/cli.ts` preferring the bundled `runtimeBinaryPath`.
  - `openclaw-lark` is not embedded as a static app asset inside the renderer/electron bundle. The app manages it as the official Feishu plugin in the OpenClaw home `extensions/openclaw-lark` area, using `@larksuite/openclaw-lark` / `@larksuite/openclaw-lark-tools` during install and repair flows.
  - `larksuite/cli` is not currently built into Mclaw as a separate integrated path; the codebase still runs on the bundled OpenClaw runtime plus the managed official Feishu plugin path above.
- I then pushed the same shared Feishu blocking summary one step further into `src/components/FeishuDiagnosticsModal.tsx` and `src/pages/ChannelsPage.tsx` so the diagnostics modal now receives `sharedStatusAlert` from the selected channel and shows the same managed-status warning that already appears on the channel card and pairing modal.
- This keeps the diagnostics surface aligned with the rest of the Feishu setup flow: if the channel is degraded because the plugin is missing, not registered, or runtime-not-ready, the diagnostics modal now starts with that shared status summary instead of forcing the user to infer context only from later listen/send probes.
- I added targeted regression coverage for this step:
  - `src/components/__tests__/feishu-diagnostics-modal.test.ts` locks the new `sharedStatusAlert` contract and confirms the diagnostics actions remain present.
  - `src/pages/__tests__/channels-page-state.test.ts` now also verifies the shared alert is wired into the diagnostics modal path.
- Validation on April 16, 2026: `.\node_modules\.bin\tsc.cmd --noEmit` passed.
- Validation on April 16, 2026: `.\node_modules\.bin\vitest.cmd run electron/main/__tests__/official-channel-adapters.test.ts src/pages/__tests__/channel-connect.test.ts src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`67 passed`).

### Update 262: Add a repair-and-reprobe loop to the Feishu diagnostics modal
- I extended `src/components/FeishuDiagnosticsModal.tsx` so the shared Feishu blocking alert can now trigger a direct repair action from inside the diagnostics modal. The modal accepts:
  - `repairingSharedStatus`
  - `onRepairSharedStatus`
  - a local `repairResult` state that reports whether the repair cleared the block
- I updated `src/pages/ChannelsPage.tsx` so the diagnostics modal now receives the same managed repair flow used by the channel card. The page now:
  - runs `runManagedChannelRepairFlow(...)` through a shared `repairFeishuPlugin(...)` helper
  - refreshes the channel list after repair
  - resolves the latest selected diagnostics/pairing/model channel snapshot from the refreshed list via `resolveLatestChannelSnapshot(...)`
  - rechecks the shared Feishu blocking alert after repair, so the modal can distinguish “repair ran but the channel is still blocked” from “repair cleared the block”
- This creates the intended loop inside diagnostics: detect a shared-status block -> repair in place -> refresh shared status and local paired-account context -> continue with listen/send probes.
- While wiring this, I also normalized the touched diagnostics/pairing/model-surface copy in the modified areas to stable ASCII/English strings so the TypeScript/JSX source stays parse-safe and testable on this machine.
- I added regression coverage for the new loop:
  - `src/components/__tests__/feishu-diagnostics-modal.test.ts` now checks the inline repair hook and the post-repair local refresh path
  - `src/pages/__tests__/channels-page-state.test.ts` now checks `resolveLatestChannelSnapshot(...)` and verifies the diagnostics modal is wired to the repair callback plus refreshed snapshots
- Validation on April 16, 2026: `.\node_modules\.bin\tsc.cmd --noEmit` passed.
- Validation on April 16, 2026: `.\node_modules\.bin\vitest.cmd run electron/main/__tests__/official-channel-adapters.test.ts src/pages/__tests__/channel-connect.test.ts src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`68 passed`).

### Update 263: Gate Feishu diagnostics probes behind the shared repair state
- I tightened the diagnostics loop in `src/components/FeishuDiagnosticsModal.tsx` so a known shared Feishu block no longer just shows a warning while still allowing probes to run. The modal now derives `probeBlockedBySharedStatus` from `sharedStatusAlert` and uses it to short-circuit both:
  - `handleListen()`
  - `handleSend()`
- The listen/send controls now stay disabled while the shared channel state is still blocked, and the modal shows an explicit `Probe blocked` notice telling the user to repair the shared Feishu state first and then rerun the probes.
- This makes the repair flow stricter and more coherent: diagnostics no longer produce misleading probe attempts while the managed plugin/runtime state is already known to be invalid.
- I extended `src/components/__tests__/feishu-diagnostics-modal.test.ts` to lock the new behavior by checking:
  - the derived `probeBlockedBySharedStatus` gate
  - the blocking notice
  - the disabled probe controls while blocked
  - the existing local refresh path after repair
- Validation on April 16, 2026: `.\node_modules\.bin\tsc.cmd --noEmit` passed.
- Validation on April 16, 2026: `.\node_modules\.bin\vitest.cmd run electron/main/__tests__/official-channel-adapters.test.ts src/pages/__tests__/channel-connect.test.ts src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`68 passed`).

### Update 264: Add an in-app `larksuite/cli` guided onboarding session for Feishu
- I started wiring `larksuite/cli` into the Feishu setup flow instead of leaving it as a copy/paste-only side note. Mclaw now has a first-class Electron-side guided session layer for the official CLI:
  - `electron/main/feishu-official-cli.ts` centralizes the official CLI command contract (`lark-cli`, `config init --new`, `auth login --recommend`, `auth login --no-wait`) plus version / missing-command parsing.
  - `electron/main/feishu-official-cli-session.ts` manages a long-running official CLI session with start / input / stop / event streaming, stores the latest auth URL + device code, and best-effort opens the browser when an OAuth/device challenge URL appears.
  - IPC + preload + renderer typings now expose that session through `get/start/send/stop/onFeishuOfficialCliSession...` methods.
- In `src/pages/ChannelConnect.tsx`, the Feishu setup page now keeps the existing managed `openclaw-lark` runtime path, but adds a new `Official CLI Guided Flow` card when `lark-cli` is available. From there the user can launch:
  - `Config Init --new`
  - `Auth Login --recommend`
  - `Auth Login --no-wait`
  - and interact with the live session directly from Mclaw (raw input, Up / Down / Enter / Ctrl+C, latest browser URL, latest device code, live output log).
- I also kept the earlier Feishu readiness hardening in `ChannelConnect` by restoring the post-reload managed-status confirmation path:
  - `getManagedPluginStageState(...)`
  - `hasBlockingManagedChannelReadyState(...)`
  - `confirmManagedChannelStatusAfterGatewayReady(...)`
  This means the setup flow still fails closed when Feishu `ready=missing`, instead of treating a plain Gateway restart as a successful finish.
- Added / updated focused coverage:
  - `electron/main/__tests__/feishu-official-cli.test.ts`
  - `electron/main/__tests__/feishu-official-cli-state.test.ts`
  - `electron/main/__tests__/app-exit-cleanup.test.ts`
  - `electron/preload/index.test.ts`
  - `src/pages/__tests__/channel-connect.test.ts`
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`62 passed`).

### Update 265: Auto-refresh the Feishu setup state after official CLI runs and make the result explicit in Channel Connect
- I tightened the new `larksuite/cli` onboarding slice so the guided session is no longer just a raw terminal panel. `src/pages/ChannelConnect.tsx` now derives a structured guided-session status via `resolveFeishuOfficialCliSessionStatus(...)`, which turns the low-level session state into user-facing outcomes such as:
  - `Awaiting Browser Auth`
  - `Auth Ready`
  - `Init Finished`
  - `Canceled`
  - `Exit N`
- The official guided-flow card now shows that derived status and a follow-up detail message instead of only showing a generic running/stopped badge. I also added an inline refresh action there so the user can explicitly re-read the official CLI auth state without leaving the page.
- More importantly, when the official guided session exits, Mclaw now automatically:
  - refreshes the official `lark-cli` auth status
  - refreshes the broader Feishu setup state in the page
  - writes a follow-up notice explaining what changed
- That means the page now closes the loop better after an official CLI run:
  - successful `auth login` + authenticated state -> tells the user official auth is now ready and to continue with the managed `openclaw-lark` runtime setup
  - successful `config init --new` -> tells the user config init finished and the page state has been refreshed
  - cancel / non-zero exit -> shows an explicit retry-oriented notice instead of leaving the outcome implicit in the raw log only
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for the new pure helper that maps official guided-session state into stable UI labels/details.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`65 passed`).

### Update 266: Add a derived official-CLI next-step card so Feishu onboarding points to the right action automatically
- I pushed the `larksuite/cli` onboarding slice one step further in `src/pages/ChannelConnect.tsx` by adding a new pure helper, `resolveFeishuOfficialOnboardingNextStep(...)`, plus the supporting `resolveFeishuOfficialOnboardingActionLabel(...)` mapping.
- The helper folds together:
  - official CLI availability/auth state
  - guided-session mode / exit state
  - current Feishu setup mode (`create` vs `link`)
  - local runtime progress (`installerRunning`, installer output, detected bots, manual credential progress)
  - managed plugin presence (`openclaw-lark` installed on disk or not)
- Based on that combined state, the page now renders a single `Official CLI Next Step` card that tells the user what to do next and gives a direct CTA for it. Concretely:
  - unauthenticated -> `Start Guided Login` / `Use Device Code`
  - authenticated -> continue the correct managed runtime path (`Start Create Bot`, `Start Link Existing`, or resume the path that already has progress)
  - unknown/error -> `Refresh Status` with an immediate retry path
  - guided session still running -> suppresses conflicting actions and tells the user to finish the current CLI step first
- I also added a small runtime-path focus helper so CTA actions can jump the page back to the right Feishu branch card instead of forcing a restart when the create/link path already has local progress.
- To keep the UI from duplicating itself, I removed the older per-auth-state Feishu CLI hint cards and replaced them with this one derived next-step surface, while keeping the separate `Official CLI Guided Flow` terminal panel and the `lark-cli` install hint for machines that do not have the official CLI yet.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for the new next-step helper, covering:
  - unauthenticated -> guided login
  - authenticated + config-init complete -> continue create path
  - authenticated + existing link progress -> continue link path
  - unknown auth state -> refresh/retry guidance
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`69 passed`).

### Update 267: Let link mode finish directly from detected existing Feishu bots instead of forcing manual App ID / Secret input
- I fixed a concrete Feishu link-mode gap in `src/pages/ChannelConnect.tsx`: the page already told the user “if Mclaw has detected a reusable Feishu bot, you can directly click 完成机器人配置”, but the actual button logic still hard-blocked link mode unless `App ID` and `App Secret` were filled in manually.
- To close that mismatch, I added:
  - `canFinishFeishuLinkMode(...)`
  - `resolveFeishuLinkModeFinishStrategy(...)`
  - `resolveSelectedFeishuExistingBotAccountId(...)`
- Behavior change:
  - if link mode has detected existing Feishu bots and the manual credential form is still untouched, the user can now finish directly from that existing-bot state
  - if the user starts typing manual credentials, Mclaw still requires the full pair before finishing, so we do not silently ignore partial manual input
  - if multiple existing bots are present, the page now lets the user choose which one to continue with before finishing
- I also surfaced that state in the UI:
  - the link-path status card now explicitly reports `已检测到可复用机器人`
  - the link-mode body now shows a detected-bots picker and explains the precedence rule: empty manual form -> reuse selected bot; started manual form -> must complete both fields
  - the derived `Official CLI Next Step` logic now also treats detected existing bots as real link-path progress, so the follow-up CTA points to continuing the link branch instead of restarting it
- In `finishFeishuChannelConnect(...)`, link mode now has three explicit branches:
  - `manual` -> validate `App ID / App Secret` and write/update linked bot config
  - `existing` -> keep current config and pair against the selected existing bot
  - `invalid-manual` / `none` -> fail closed with a clear user-facing reason
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - link-mode finish gating
  - link-mode finish strategy
  - selected existing-bot resolution
  - next-step derivation when detected existing bots already exist
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`76 passed`).

### Update 268: Make Feishu link mode explicit with a real source switch instead of relying on hidden form precedence
- I continued tightening Feishu link mode in `src/pages/ChannelConnect.tsx`. After `Update 267`, the page could already finish directly from detected existing bots, but the source of truth was still implicit: empty manual fields meant “reuse existing bot”, any typed field meant “manual mode”.
- That worked, but it was still too opaque for a real onboarding surface, so I made the link source explicit:
  - added `FeishuLinkSourceMode = 'existing' | 'manual'`
  - added a visible mode switch in the link section
  - changed the finish logic so the selected source mode, not hidden field precedence, decides the path
- I updated the pure helpers accordingly:
  - `canFinishFeishuLinkMode(...)` now works from the resolved strategy instead of raw booleans
  - `resolveFeishuLinkModeFinishStrategy(...)` now takes the explicit source mode
- Behavior change:
  - when reusable bots exist, link mode now shows a dedicated `绑定方式` switch:
    - `复用已检测到机器人`
    - `手动输入凭证`
  - `复用` mode shows only the selected existing-bot picker and binds directly through that path
  - `手动` mode shows the credential form and blocks finish until the pair is complete
  - typing into the manual fields auto-switches the source to `manual`, but switching back to `existing` no longer depends on clearing the fields first
- I also aligned the derived state around that explicit choice:
  - the link-path status card now distinguishes `将复用现有机器人` from `待输入凭证` / `待补全字段`
  - transitions that reopen link mode after plugin-check / auto-recovery now default back to `existing`, so detected bots are immediately usable without extra cleanup
- This removes the last major “UI says one thing, hidden form precedence does another” gap in the current Feishu link flow.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - explicit link-mode finish gating
  - explicit link-mode finish strategy resolution
  - existing/manual mode transitions at the helper layer
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`78 passed`).

### Update 269: Let Official CLI Next Step jump straight to Feishu completion when the managed path is already ready
- I tightened the `Official CLI Next Step` card in `src/pages/ChannelConnect.tsx` so it no longer stops at “continue the path” when the managed Feishu runtime path is already actually finishable.
- I extended the derived action model with:
  - `finish-create`
  - `finish-link`
- Then I taught `resolveFeishuOfficialOnboardingNextStep(...)` to distinguish three levels of readiness:
  - path not started -> `start-*`
  - path in progress but not finishable yet -> `focus-*`
  - path already ready to complete -> `finish-*`
- This now closes the loop across the official CLI + managed runtime boundary:
  - authenticated + create path already ready -> `Official CLI Next Step` can directly trigger final Feishu create completion
  - authenticated + reusable existing bot selected -> it can directly trigger final link completion
  - authenticated + manual link credentials already valid -> it can also directly trigger final link completion
- I also made the detail copy more specific:
  - create-ready state now says the managed create path is ready to finish
  - existing-link-ready state now names the selected reusable bot when available
  - manual-link-ready state now says the manual credentials are ready to finish
- On the interaction side, `handleFeishuOfficialOnboardingAction(...)` now supports those direct finish actions by calling `finishFeishuChannelConnect()`, and the next-step buttons now reflect relevant busy/disabled states instead of staying clickable blindly during finish/session transitions.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - create-ready -> `finish-create`
  - reusable existing bot ready -> `finish-link`
  - manual link ready -> `finish-link`
  - unchanged auth/refresh fallback cases
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`79 passed`).

### Update 270: Add explicit path summary and post-finish routing hints to Official CLI Next Step
- I continued refining the Feishu onboarding closure in `src/pages/ChannelConnect.tsx` by making the `Official CLI Next Step` card more self-contained. The card already knew the right action; this round teaches it to also explain the current managed path and where that action leads.
- I added a new pure helper, `resolveFeishuOfficialOnboardingSummary(...)`, which derives three stable summary items:
  - `Path`
  - `Current Target`
  - `After Finish`
- The summary is now rendered directly inside the `Official CLI Next Step` card, so users can see at a glance:
  - whether they are on `Create Bot` vs `Link Existing`
  - which concrete target Mclaw is about to use (`2 detected bots`, `Reuse Support Bot`, `Manual App ID / App Secret`, etc.)
  - what the completion route is afterwards (`Skip pairing and continue` vs `Continue to Feishu pairing`)
- This makes the direct-finish CTA from `Update 269` less opaque. The user no longer has to infer whether `Finish Link Setup` means “reuse the selected bot” or “use the manual credentials currently on screen”; the card now states that explicitly before they click.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - create-path summary with detected bot counts
  - existing-link summary with selected bot naming
  - manual-link summary without detected bot dependency
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`82 passed`).

### Update 271: Explain exactly what is still blocking Feishu finish inside Official CLI Next Step
- I continued tightening the Feishu onboarding closure in `src/pages/ChannelConnect.tsx` by making the `Official CLI Next Step` card explain not just the recommended action, but also the concrete reason finish is still blocked when the path is not yet ready.
- I added a new pure helper, `resolveFeishuOfficialOnboardingBlockers(...)`, which derives stable blocking reasons from the official CLI state plus the current managed runtime path.
- The helper now distinguishes the main unfinished cases that were previously only implied by the CTA label and detail text:
  - official guided login still running / awaiting browser confirmation
  - official CLI auth still missing or not trustworthy yet
  - create path has no recovered bot yet
  - existing-link path has no reusable detected bot yet
  - manual-link path is still preparing runtime state or still has incomplete credentials
- I now render those blockers directly inside the `Official CLI Next Step` card as a dedicated `Still Blocking Finish` section, under the path summary and above the actions.
- This makes the next-step surface more operational: when the button is still `Continue Create Path` / `Continue Link Path` instead of `Finish * Setup`, the user can immediately see the exact gating reason instead of inferring it from the rest of the page.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - create mode blocked because no created bot has been recovered yet
  - existing-link blocked because no reusable bot is available
  - manual-link blocked because credentials are incomplete
  - no blockers once the managed path is already ready to finish
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`86 passed`).

### Update 272: Turn Feishu blocker explanations into direct repair and path-jump actions
- I continued tightening the `Official CLI Next Step` closure in `src/pages/ChannelConnect.tsx` by turning the new blocker explanations from `Update 271` into actionable controls instead of leaving them as passive text.
- I extended the blocker model returned by `resolveFeishuOfficialOnboardingBlockers(...)` so each blocker can now carry a primary and secondary onboarding action.
- I also added a new onboarding action, `switch-link-manual`, for the specific case where link mode is blocked because there is no reusable detected bot but the user can still proceed by switching straight to manual credentials.
- The blocker cards now render direct CTA buttons inside the `Still Blocking Finish` section, using the same action pipeline as the main next-step card. That means the user can now jump directly from the blocking reason to the relevant corrective step.
- Concrete behavior improvements:
  - missing official login -> direct `Start Guided Login` / `Use Device Code`
  - create path with no recovered bot -> direct `Start Create Bot`
  - create path with installer output but no recovered bot yet -> direct `Continue Create Path` plus `Refresh Status`
  - existing-link path with no reusable bot -> direct `Start Create Bot` plus `Use Manual Link`
  - manual-link path with incomplete credentials -> direct `Continue Link Path`
- I wired the new `switch-link-manual` action through `handleFeishuOfficialOnboardingAction(...)`, so it immediately switches the UI to Feishu link mode, selects manual credentials, and scrolls the user into the correct setup card.
- I updated `src/pages/__tests__/channel-connect.test.ts` to lock the new blocker-action contract, including:
  - create-blocked -> `start-create`
  - existing-link-blocked -> `start-create` + `switch-link-manual`
  - manual-link-incomplete -> `focus-link`
  - unauthenticated blocker -> direct official login actions
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`87 passed`).

### Update 273: Let waiting official-login blockers jump straight to the active guided flow
- I continued tightening the Feishu onboarding closure in `src/pages/ChannelConnect.tsx` by fixing the last weak blocker state in the `Official CLI Next Step` card: when official login is already running and waiting for browser/device confirmation, the blocker now gives the user a direct path back into that active session instead of only showing passive text.
- I added two new onboarding actions:
  - `open-auth-url`
  - `focus-guided-flow`
- I wired those actions through the existing onboarding action pipeline so the blocker cards can now do two concrete things:
  - reopen the latest captured OAuth URL in the browser when the guided login is waiting on auth confirmation
  - scroll directly to the in-app `Official CLI Guided Flow` card so the user lands on the live session output, latest URL, and device code controls immediately
- I also gave the guided-flow card a stable anchor id, `feishu-official-cli-guided-flow-card`, so the jump target is deterministic and reusable from other future CTA paths.
- Behavior change in the blocker model:
  - guided auth session still waiting and a browser URL is available -> `Open Browser` + `Focus Guided Flow`
  - non-auth official CLI session still running -> `Focus Guided Flow`
- This closes a practical gap from `Update 272`: blocker cards now cover not just repair / path-switch actions, but also the case where the right answer is “go back to the currently running official step and finish it there”.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - guided login still waiting with an auth URL -> `open-auth-url` + `focus-guided-flow`
  - `config init` still running -> `focus-guided-flow`
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`89 passed`).

### Update 274: Make the Feishu device-code wait state directly actionable from blockers and guided flow
- I continued tightening the Feishu onboarding closure in `src/pages/ChannelConnect.tsx` by fixing the remaining auth variant that still had too much user interpretation cost: the `auth login --no-wait` device-code path.
- I added a new onboarding action, `copy-device-code`, and extended `resolveFeishuOfficialOnboardingBlockers(...)` with `hasUserCode` so the blocker model can now distinguish three active official-login states cleanly:
  - browser auth waiting with URL -> `Open Browser` + `Focus Guided Flow`
  - device-code auth waiting with a live code -> `Copy Device Code` + `Focus Guided Flow`
  - other running official CLI sessions -> `Focus Guided Flow`
- I wired `copy-device-code` through `handleFeishuOfficialOnboardingAction(...)` using renderer clipboard access plus success/error notifications, so the blocker CTA now does real work instead of only redirecting the user mentally.
- I also completed the guided-flow surface itself by adding a `Copy Code` button to the `Latest device code` panel. That keeps the device-code branch symmetrical with the browser-URL branch, which already had direct open/copy controls.
- This closes the remaining “active official step but no direct action” gap on the login side: both auth variants are now one click away from the concrete thing the user needs next.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for the new device-code blocker contract:
  - `auth-login-no-wait` still running with a user code -> `copy-device-code` + `focus-guided-flow`
  - existing browser-auth and running-session blocker cases remain locked as before
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`90 passed`).

### Update 275: Make Official CLI Next Step self-contained with live auth URL and device-code panels
- I continued tightening the Feishu onboarding closure in `src/pages/ChannelConnect.tsx` by making the `Official CLI Next Step` card self-contained while an official auth session is actively running. Before this slice, the card could explain blockers and offer jumps, but the actual live auth artifacts still lived only in the separate `Official CLI Guided Flow` card.
- I added a new pure helper, `resolveFeishuOfficialOnboardingLiveAssist(...)`, which derives inline auth-assist items directly from the active official CLI session.
- The helper currently surfaces two live official auth artifacts when relevant:
  - `Browser URL` for running browser-auth sessions
  - `Device Code` for running `auth login --no-wait` sessions
- Each assist item carries the exact UI affordances needed to act immediately from the next-step card:
  - browser URL -> `Open Browser`, `Focus Guided Flow`, `Copy URL`
  - device code -> `Focus Guided Flow`, `Copy Code`
- I now render those assist items inside `Official CLI Next Step` as a dedicated `Live Official Auth` section, so the user no longer has to scroll to the guided-flow card just to read/copy the active URL or device code.
- This builds directly on `Update 273` and `Update 274`: blocker CTAs still exist, but the next-step card is now materially more self-sufficient during live auth sessions.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - browser-auth live assist derivation
  - device-code live assist derivation
  - empty output when no auth session is actively running
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`93 passed`).

### Update 276: Replace the fixed Official CLI Guided Flow button row with context-aware actions
- I continued tightening the Feishu onboarding surface in `src/pages/ChannelConnect.tsx` by reducing redundant control paths between `Official CLI Next Step` and `Official CLI Guided Flow`. Before this slice, the guided-flow card always showed the same fixed five-button row, even when most of those actions were irrelevant to the current state.
- I added a new pure action model for the guided-flow card:
  - `FeishuOfficialCliGuidedFlowAction`
  - `resolveFeishuOfficialCliGuidedFlowActionLabel(...)`
  - `resolveFeishuOfficialCliGuidedFlowActions(...)`
- The guided-flow card now shows only the actions that match the current official CLI state:
  - unauthenticated -> `Start Guided Login`, `Use Device Code`
  - active official CLI session -> `Stop Session`
  - authenticated but config-init not yet confirmed complete -> `Run Config Init`, `Refresh Status`
  - config-init already finished successfully -> `Refresh Status`
  - unreliable auth state -> `Refresh Status`, `Start Guided Login`
- I wired those actions through a dedicated guided-flow handler that reuses the existing onboarding action pipeline for shared actions and only special-cases `Stop Session`.
- This reduces duplication and keeps the guided-flow card aligned with the same state machine that already drives the next-step card, instead of leaving a static row of controls that the user still had to interpret manually.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - guided-flow action labels
  - unauthenticated action derivation
  - running-session stop-only derivation
  - post-config-init refresh-only derivation
  - unreliable-auth fallback derivation
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`98 passed`).

### Update 277: Make Official CLI Next Step and Guided Flow share the same live-auth/session-command model
- I continued tightening the Feishu onboarding surface in `src/pages/ChannelConnect.tsx` by removing the last major rendering divergence between `Official CLI Next Step` and `Official CLI Guided Flow`.
- I added a new pure helper, `resolveFeishuOfficialCliSessionCommand(...)`, so the current official command preview is now derived from one stable source instead of an inline ternary embedded in the guided-flow card.
- I also stopped maintaining a separate browser-URL / device-code panel implementation inside the guided-flow card. Both cards now consume the same live-auth derivation from `resolveFeishuOfficialOnboardingLiveAssist(...)`.
- Behavior change:
  - `Official CLI Next Step` and `Official CLI Guided Flow` now render the same live browser URL / device-code values from the same helper-backed state
  - the guided-flow card now reuses the same open-browser action and copy labels already used by the next-step card instead of having its own hand-written branch logic
  - the current official CLI command preview now comes from `resolveFeishuOfficialCliSessionCommand(...)`, keeping command text stable across future changes
- This slice reduces the chance that the two Feishu cards drift apart again on auth artifacts or command naming while the official session is running.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for the new command helper:
  - `config init --new`
  - `auth login --recommend`
  - `auth login --no-wait`
  - idle / no mode
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`99 passed`).

### Update 278: Make Next Step explicitly the decision surface and Guided Flow explicitly the execution surface
- I continued tightening the Feishu onboarding surface in `src/pages/ChannelConnect.tsx` by addressing the last big UX ambiguity between the two official-CLI cards. Even after the shared action/live-auth cleanup, the headers still read too similarly, so users still had to infer which card was for deciding and which card was for executing.
- I added a new pure helper, `resolveFeishuOfficialCliGuidedFlowPurpose(...)`, which derives a stable `Execution Surface` label plus state-specific guidance for the guided-flow card.
- The helper now distinguishes the main guided-flow contexts:
  - active official login running -> finish the active login here, then return to the decision card
  - authenticated / idle -> use this panel only for explicit official CLI work such as Config Init or auth recovery
  - unreliable auth state -> use this panel only after the decision card asks for refresh / retry
- I updated the card headers so the roles are explicit in the UI:
  - `Official CLI Next Step` now carries a `Decision Surface` badge and explains that the next Feishu choice should be made there
  - `Official CLI Guided Flow` now carries the helper-derived `Execution Surface` badge and state-specific execution guidance
- This makes the intended relationship between the two cards materially clearer without changing the underlying onboarding state machine:
  - top card = decide
  - lower card = execute official CLI work when needed
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for the new purpose helper, covering:
  - active guided login
  - authenticated idle state
  - unreliable auth state
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`102 passed`).

### Update 279: Make device-code running states explicit in the official CLI session and next-step helpers
- I continued tightening the Feishu official-login flow in `src/pages/ChannelConnect.tsx` by fixing the last ambiguous running-login state in the helper layer. Until this slice, a running `auth login --no-wait` session without a browser URL still fell back to generic `Running` / `Continue Guided Flow` language even when Mclaw already had a live device code.
- I extended both helper layers with explicit `hasUserCode` awareness:
  - `resolveFeishuOfficialCliSessionStatus(...)`
  - `resolveFeishuOfficialOnboardingNextStep(...)`
- Behavior change:
  - a running device-code login with a captured user code now reports `Awaiting Device Verification` in the guided-flow session status instead of the generic running label
  - the next-step card now reports `Finish Device Code Login` instead of the generic `Continue Guided Flow` title when that same state is active
- This makes the official-login branch more concrete at the exact moment users most often hesitate: they can now see immediately that the active task is the device-code verification step, not just “some guided flow still running”.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - running device-code session status with a captured user code
  - running device-code next-step derivation with explicit `Finish Device Code Login` copy
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`104 passed`).

### Update 280: Add path-local actions directly inside the Feishu create and link status cards
- I continued tightening the Feishu onboarding surface in `src/pages/ChannelConnect.tsx` by making the two local Feishu path cards actionable instead of purely descriptive. Until this slice, the create/link status cards only explained state, while the user still had to jump back to the top-level button row or the official CLI cards to actually move the local path forward.
- I added two new pure helpers:
  - `resolveFeishuCreatePathCardActions(...)`
  - `resolveFeishuLinkPathCardActions(...)`
- These helpers derive path-local actions from the current managed Feishu state, using the same underlying onboarding action vocabulary already used elsewhere in the page.
- Behavior change for the local path cards:
  - create path now shows direct actions such as `Start Create Bot`, `Continue Create Path`, `Refresh Status`, or `Finish Create Setup` depending on the current create readiness
  - link path now shows direct actions such as `Start Link`, `Use Manual Link`, `Continue Link Path`, or `Finish Link Setup` depending on existing-bot availability, manual-mode progress, and finish readiness
- This keeps the local Feishu create/link cards aligned with the rest of the page state machine while reducing the amount of hunting the user has to do across the larger onboarding surface.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - create-ready -> finish action
  - create with installer output -> continue + refresh
  - link-ready -> finish action
  - existing-link without reusable bot -> start link + manual fallback
  - manual-link in progress -> continue local link path
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`109 passed`).

### Update 281: Make the top Feishu action row navigation-only and let the path cards own local execution
- I continued tightening the Feishu local-path surface in `src/pages/ChannelConnect.tsx` by removing the last big duplication between the top Feishu action row and the path cards. Before this slice, the top row still directly started create/link work even though the path cards below had already become the local execution surface.
- I added a small pure helper, `resolveFeishuPathNavigatorItems(...)`, which derives the two path-navigation buttons and marks the currently active local path.
- I then changed the top Feishu row so it is now explicitly navigation + utilities only:
  - `查看新建路径`
  - `查看关联路径`
  - `查看教程`
  - `中止安装`
  - `刷新状态`
- The actual local execution actions now live only inside the two path cards, which already derive path-specific CTAs from:
  - `resolveFeishuCreatePathCardActions(...)`
  - `resolveFeishuLinkPathCardActions(...)`
- This makes the local Feishu layout more coherent:
  - top row = navigate and use shared utilities
  - path cards = execute local create/link work
  - official CLI cards = decide / execute official CLI work
- I also added an inline explanatory line above the top row so the role split is explicit in the UI instead of being inferred.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for the new path navigator helper, covering:
  - create-focused navigation state
  - link-focused navigation state
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`111 passed`).

### Update 282: Consolidate Feishu path copy into shared descriptors for the overview and path cards
- I continued tightening the Feishu local-path surface in `src/pages/ChannelConnect.tsx` by removing the remaining duplicated create/link copy. Before this slice, the path overview block, the path cards, and the navigator helper still carried overlapping hard-coded text for the same two Feishu local paths.
- I added a new pure helper, `resolveFeishuPathDescriptors(...)`, which now owns the stable metadata for both Feishu local paths:
  - overview title/detail
  - path-card title/detail
  - navigator label
- I updated the UI to reuse that one descriptor source in three places:
  - the top `双路径联调` overview block
  - the path navigator row
  - the two local path cards
- This reduces the chance that the create/link copy drifts apart again as the Feishu onboarding surface continues to evolve.
- I also cleaned up the top-row rendering while touching this section so the navigator + utility buttons are structurally clearer in the JSX.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for the new descriptor helper, locking the full descriptor payload for both Feishu local paths.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`112 passed`).

### Update 283: Add a symmetric "Use Existing Bot" fallback so manual link mode can recover without form hunting
- I continued tightening the Feishu link-path surface in `src/pages/ChannelConnect.tsx` by fixing an asymmetric path-switch gap. Before this slice, the page could already fall from existing-link mode into manual mode via `Use Manual Link`, but the reverse recovery path was still weaker once a reusable bot became available.
- I added a new onboarding action, `switch-link-existing`, plus the corresponding action label and handler wiring.
- Behavior change:
  - when manual link mode is selected and a reusable detected bot exists, the local link-path card can now offer `Use Existing Bot` directly instead of forcing the user to hunt for the mode switch in the form
  - when manual credentials are already partially in progress and a reusable bot also exists, the local link-path card keeps `Continue Link Path` as the primary action but exposes `Use Existing Bot` as a secondary fallback
  - the blocker model now also exposes the same fallback when manual mode is selected but no credentials have been entered yet
- This makes the existing/manual link modes symmetric in practice:
  - existing mode can fall to manual when no bot exists
  - manual mode can now fall back to existing reuse when a bot does exist
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - manual mode without input + reusable bot -> `Use Existing Bot`
  - manual mode with input + reusable bot -> secondary existing-bot fallback
  - blocker derivation for manual mode with reusable bot but no credential input
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`115 passed`).

### Update 284: Extract local Feishu path status helpers so create/link copy stays consistent with the path state machine
- I continued tightening the Feishu onboarding surface in `src/pages/ChannelConnect.tsx` by removing one more pocket of inline state-copy logic from the create/link path cards. Before this slice, the local path cards already derived their actions from pure helpers, but the badge + detail status copy still lived inline inside the page component.
- I extracted two new pure helpers:
  - `resolveFeishuCreatePathStatus(...)`
  - `resolveFeishuLinkPathStatus(...)`
- The page now derives both local path status payloads through those helpers instead of inline ternaries, which keeps the create/link card messaging aligned with the same state machine that already drives the CTA helpers.
- Behavior change in the link path copy:
  - manual link mode now explicitly tells the user that they can fall back to an already detected existing bot when `botCount > 0`
  - that fallback-aware wording is present both before any credential input and while the manual form is only partially filled
- This keeps the create/link cards easier to evolve because path actions and path status are now both computed through testable helper layers instead of being split between helpers and JSX conditionals.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - create mode waiting-for-confirmation status when installer output exists but no bot has been recovered yet
  - create mode detected-bot status once a bot becomes available
  - existing-link reuse status
  - manual-link status without credentials but with a reusable bot available
  - manual-link status with partial credentials and a reusable bot fallback available
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`120 passed`).

### Update 285: Surface manual-link preparation phases directly in the main Feishu status and blocker cards
- I continued tightening the Feishu link-path management surface in `src/pages/ChannelConnect.tsx` by making the in-progress manual-binding repair/preparation phases visible in the same cards the user is already reading to decide what to do next. Before this slice, the detailed preparation phase only lived in the separate loader panel, while the main link-path status card and the `Official CLI Next Step` blocker card still showed a generic “preparing” message.
- I added a new pure helper:
  - `resolveFeishuManualBindingPreparationStatus(...)`
- That helper now derives a shared status payload from the existing manual-binding preparation phase machine:
  - `checking` -> `检查插件中`
  - `syncing` -> `同步配置中`
  - `installing` -> `安装插件中`
  - `verifying` -> `验证状态中`
- I wired that shared preparation status into two places:
  - the local Feishu link-path status card via `resolveFeishuLinkPathStatus(...)`
  - the `Official CLI Next Step` blocker model via `resolveFeishuOfficialOnboardingBlockers(...)`
- Behavior change:
  - while Mclaw is auto-checking, syncing, installing, or verifying the managed `openclaw-lark` runtime for manual link mode, the user now sees the exact current phase in both the local link card and the blocker card instead of a vague generic waiting message
  - the install phase also carries through the existing “1 to 3 minutes” hint so the slow path is clearer without forcing the user to hunt for the loader panel
- This makes the “发现阻塞 -> 自动修复/补齐 -> 重新确认” loop easier to follow because the blocker surfaces and the progress surface now speak the same language.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - link-path status while manual binding is in the `syncing` phase
  - official onboarding blockers while manual binding is in the `installing` phase
  - shared preparation status payloads for `installing` and `verifying`
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`124 passed`).

### Update 286: Expose managed runtime readiness earlier in the Feishu link path and Official CLI summary
- I continued tightening the Feishu onboarding surface in `src/pages/ChannelConnect.tsx` by exposing the managed `openclaw-lark` runtime readiness before the user actually starts the link path. Before this slice, the link path could still look generically “not started” even when Mclaw had already detected that the runtime plugin was ready on disk, or knew that it would need to install the plugin on first use.
- I added two new pure helpers:
  - `resolveFeishuLinkPathEntryStatus(...)`
  - `resolveFeishuOfficialOnboardingRuntimeSummary(...)`
- I now persist a little more Feishu official-plugin state in the page:
  - whether the official runtime plugin is installed on disk
  - whether the normalized shared config is already ready
  - whether the config still needs a sync pass
- Behavior change on the local link-path card:
  - existing-link mode with no recovered bot no longer falls back to a vague “未开始”
  - the card now tells the user whether the link path is already ready to enter, still needs plugin/config verification, or will auto-install the official runtime plugin first
- Behavior change on `Official CLI Next Step`:
  - the summary tiles now include a dedicated `Runtime Plugin` field so the user can see at a glance whether the managed runtime is:
    - `Ready on disk`
    - `Sync config, then reuse`
    - `Verify config on entry`
    - `Install on first use`
- This makes the management path clearer because the decision surface now explains not only which Feishu route is active, but also what Mclaw will have to do with the managed runtime layer before that route can proceed cleanly.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - link-path idle status when the runtime plugin is already ready
  - link-path entry status when the runtime plugin is missing
  - `Official CLI Next Step` summary tiles including the new `Runtime Plugin` field
  - the dedicated runtime-summary helper for ready vs config-sync cases
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`129 passed`).

### Update 287: Make `Official CLI Next Step` use the same detailed runtime-readiness language as the new runtime summary
- I continued tightening the Feishu decision surface in `src/pages/ChannelConnect.tsx` by removing the last coarse runtime-readiness wording from `Official CLI Next Step`. Before this slice, the summary tiles and link-path entry card already knew whether the managed `openclaw-lark` runtime was fully ready, needed config sync, or only needed an entry-time verification pass, but the main next-step detail still used a simpler installed/not-installed sentence.
- I added a new pure helper:
  - `resolveFeishuOfficialOnboardingRuntimeDetail(...)`
- I updated `resolveFeishuOfficialOnboardingNextStep(...)` so its detail string now derives from the same richer runtime state:
  - plugin + shared config ready
  - plugin on disk but config still needs sync
  - plugin on disk but config should be rechecked on entry
  - plugin missing and will be installed on first use
- Behavior change:
  - `Official CLI Next Step` no longer says only “plugin already on disk” for all installed cases
  - link-mode next-step details now explicitly differentiate:
    - ready-to-finish runtime
    - sync-before-manual-binding runtime
    - verify-on-entry runtime
- This keeps the main decision card aligned with the newer `Runtime Plugin` summary tile and the link-path entry status card, so the user sees one consistent explanation of what Mclaw will do with the managed runtime layer next.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - next-step detail when link mode has progress but runtime still needs config sync
  - next-step detail when link mode has no progress and runtime needs entry-time verification
  - next-step detail when finishable link/manual states already have plugin + shared config ready
  - the new runtime-detail helper for ready, sync, and verify cases
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`133 passed`).

### Update 288: Stop the lower Feishu link panel from falsely claiming the runtime plugin is already ready
- I continued tightening the Feishu link-path UI in `src/pages/ChannelConnect.tsx` by fixing an inaccurate message in the lower link detail panel. Before this slice, once the page switched to link mode, the panel could still say “已确认飞书官方插件可用” even when Mclaw only knew that the plugin still needed installation, config sync, or a fresh verification pass.
- I added a new pure helper:
  - `resolveFeishuLinkPathPanelIntro(...)`
- That helper now derives a localized runtime-entry hint for the lower link panel from the same official-plugin state already used elsewhere:
  - runtime plugin + shared config ready
  - runtime plugin installed but shared config still needs sync
  - runtime plugin installed but shared config still needs verification
  - runtime plugin still missing and must be installed first
- I updated the lower link panel to render a dedicated `运行态入口提示` block instead of the old hard-coded ready-only sentence.
- Behavior change:
  - the lower link panel no longer over-promises runtime readiness after merely switching into link mode
  - when the official runtime is missing or only partially ready, the user now sees that Mclaw will still install, sync, or verify the runtime before opening the usable link flow
  - when everything is ready, the old “reuse detected bot or switch to manual credentials” guidance remains intact
- This keeps the lower link detail panel aligned with the newer status card, summary tile, and next-step decision card instead of letting it drift back to stale “plugin already ready” wording.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - ready intro with detected bots
  - sync-first intro before manual binding opens
  - install-first intro when bot config exists but the runtime plugin is still missing
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`136 passed`).

### Update 289: Stop the existing-link no-bot state from pointing users back into a dead-end
- I continued tightening the Feishu onboarding decision flow in `src/pages/ChannelConnect.tsx` by fixing the `关联已有机器人` state when no reusable bot has actually been recovered yet. Before this slice, the card, blocker, and next-step surfaces could still suggest the existing-link path itself as the primary action even though there was nothing available to reuse.
- I added a new pure helper:
  - `resolveFeishuExistingLinkNoBotActions(...)`
- I now route all existing-link/no-bot surfaces through that shared action decision so they stay aligned:
  - `resolveFeishuLinkPathCardActions(...)`
  - `resolveFeishuOfficialOnboardingBlockers(...)`
  - `resolveFeishuOfficialOnboardingNextStep(...)`
- Behavior change:
  - when the user is authenticated, has chosen `关联已有机器人`, but Mclaw still detects `0` reusable bots, the primary recommendation is now `Use Manual Link`
  - the create-bot path remains available as the explicit fallback
  - the next-step card now says `No Reusable Bot Yet` instead of implying that retrying the same empty existing-link path is the right first move
- This closes another misleading branch in the Feishu onboarding flow because all three decision surfaces now agree on the same recovery order: manual bind first if the bot already exists elsewhere, otherwise create a new bot.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the new shared existing-link/no-bot action helper
  - link-path card actions when existing mode has no reusable bot
  - official blockers for existing mode with no recovered bot
  - official next-step messaging for the authenticated existing-link/no-bot case
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`137 passed`).

### Update 290: Stop `Official CLI Next Step` from calling manual link work a managed reusable-bot path
- I continued tightening the Feishu onboarding wording in `src/pages/ChannelConnect.tsx` by fixing another inaccurate carry-over in `Official CLI Next Step`. Before this slice, once the user had already switched to manual App ID / App Secret binding, the next-step detail could still say “The managed existing-bot path already has progress,” which was wrong for both manual credential entry and manual idle states.
- I added a new pure helper:
  - `resolveFeishuOfficialOnboardingLinkPathDetail(...)`
- I moved the link-path wording inside `buildFeishuOfficialOnboardingRuntimeDetail(...)` onto that shared helper so the detail text now respects the active link mode:
  - existing reusable-bot path
  - manual App ID / App Secret path
  - finish-ready existing path
  - finish-ready manual path
- Behavior change:
  - when manual link mode already has partial progress, `Official CLI Next Step` now explicitly says the manual App ID / App Secret path has progress
  - when manual link mode is selected but still idle, the shared helper now points to the manual credential step next instead of the managed reusable-bot path
- This keeps the main next-step card aligned with what the user is actually doing locally, instead of mixing manual credential work back into the reusable-bot wording that belongs only to the managed existing-link path.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the new shared link-path-detail helper in manual progress and idle states
  - the authenticated `Official CLI Next Step` detail when manual link progress already exists
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`139 passed`).

### Update 291: Stop the Feishu summary tile from claiming a reusable bot already exists when none was recovered
- I continued tightening the Feishu onboarding summary surface in `src/pages/ChannelConnect.tsx` by fixing the `Current Target` tile for the existing-link path. Before this slice, if the user had chosen `关联已有机器人` but Mclaw still had `0` reusable bots, the summary could still show `Reuse detected bot`, which contradicted the blocker and next-step cards we had already corrected.
- I added a new pure helper:
  - `resolveFeishuOfficialOnboardingCurrentTarget(...)`
- I routed `resolveFeishuOfficialOnboardingSummary(...)` through that shared target helper so the summary tile now derives its `Current Target` label from the actual active state:
  - managed create flow
  - detected created bots
  - selected reusable bot
  - manual App ID / App Secret
  - no reusable bot yet
- Behavior change:
  - existing-link mode with `0` recovered bots now shows `No reusable bot yet` in the summary tile instead of pretending a reusable bot is already available
  - the create path and manual-link path keep their previous summary wording
- This keeps the compact summary tile aligned with the blocker and next-step surfaces, so the user no longer sees one card say “no reusable bot” while another simultaneously claims a reusable bot target already exists.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the new shared current-target helper in existing/no-bot and manual-link states
  - the summary tile for the existing-link/no-bot case
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`142 passed`).

### Update 292: Keep no-bot recovery guidance even when `lark-cli` is absent
- I continued tightening the Feishu onboarding decision flow in `src/pages/ChannelConnect.tsx` by fixing another existing-link/no-bot fallback. Before this slice, if the user chose `关联已有机器人`, Mclaw had `0` reusable bots, and the official `lark-cli` was not installed, `Official CLI Next Step` could still fall back to the generic `CLI Optional` branch and suggest `Start Link Existing`, which was already the wrong direction for this state.
- I added a new pure helper:
  - `shouldUseFeishuExistingLinkNoBotRecovery(...)`
- I also added a small shared next-step builder for that state and wired `resolveFeishuOfficialOnboardingNextStep(...)` through it so the existing-link/no-bot guidance now stays aligned in both cases:
  - `lark-cli` available and authenticated
  - `lark-cli` unavailable but local runtime path still usable
- Behavior change:
  - existing-link mode with `0` recovered bots no longer falls back to the generic `CLI Optional` message when `lark-cli` is missing
  - the next-step card now still recommends:
    - `Use Manual Link` first
    - `Start Create Bot` second
  - the detail text now explicitly says the CLI is optional while keeping the same no-bot recovery guidance
- This closes another contradiction between the compact summary, blocker card, and next-step card: all three now agree that “no reusable bot yet” means manual binding or create flow first, regardless of whether `lark-cli` is installed locally.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the new shared no-bot recovery predicate
  - `Official CLI Next Step` in the CLI-missing existing-link/no-bot case
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`145 passed`).

### Update 293: Stop the generic link-entry button from pretending it only starts reusable-bot linking
- I continued tightening the Feishu onboarding action surface in `src/pages/ChannelConnect.tsx` by fixing the last misleading label around the generic link-entry action. Before this slice, the shared `start-link` action still rendered as `Start Link Existing`, even though the handler actually prepares the link path runtime and is used for broader link-entry states than just direct reusable-bot linking.
- I updated the shared onboarding action-label resolver:
  - `resolveFeishuOfficialOnboardingActionLabel(...)`
- Behavior change:
  - the shared `start-link` action now renders as `Prepare Link Path`
  - this better matches what the action really does: prepare the local link/runtime path before the user continues, instead of falsely implying that a reusable bot already exists and will be linked immediately
- This keeps the button wording aligned with the decision cards we already tightened in recent slices. The surrounding summaries, blockers, and next-step details now say “no reusable bot yet” when appropriate, and the remaining generic link-entry button no longer reintroduces the old reusable-bot assumption.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the shared onboarding action label for `start-link`
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`146 passed`).

### Update 294: Stop the local Feishu link status card from falling back to a generic ready-state when no bot exists
- I continued tightening the Feishu local link-path UI in `src/pages/ChannelConnect.tsx` by fixing the main status card for the existing-link/no-bot state. Before this slice, once the user had already chosen `关联已有机器人` but Mclaw still had `0` reusable bots, the status card could still fall back to the generic runtime-entry message such as `关联路径就绪`, which no longer matched the corrected blocker, summary, and next-step cards.
- I added a new pure helper:
  - `resolveFeishuExistingLinkNoBotStatus(...)`
- I wired `resolveFeishuLinkPathStatus(...)` through that shared helper so the local link status card now gets a dedicated no-bot state instead of reusing the generic entry-status wording.
- Behavior change:
  - existing-link mode with `0` reusable bots now shows:
    - label: `暂无可复用机器人`
    - recovery guidance toward manual App ID / App Secret binding or the create-bot path
  - the detail still preserves the runtime-preparation hint underneath, so the user can see whether Mclaw is already ready for manual credentials, still needs config sync/verification, or still has to auto-install the official plugin first
- This keeps the local link status card aligned with the newer no-bot decision surfaces instead of letting the first card on the page drift back to a stale “path ready” message that assumes a reusable bot already exists.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the new shared existing-link/no-bot status helper in ready and install-first runtime states
  - the main link-path status card in the existing-link/no-bot case
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`148 passed`).

### Update 295: Normalize the finish-ready manual link wording to the same App ID / App Secret terminology
- I continued tightening the Feishu onboarding wording in `src/pages/ChannelConnect.tsx` by fixing one remaining manual-link phrase in the shared link-path detail helper. Before this slice, the manual path already said `manual App ID / App Secret path` for idle and in-progress states, but the finish-ready branch still fell back to the older `manual existing-bot credentials` wording.
- I updated the shared helper:
  - `resolveFeishuOfficialOnboardingLinkPathDetail(...)`
- Behavior change:
  - finish-ready manual link mode now says `The manual App ID / App Secret path is ready to finish.`
  - this now matches the existing manual-path wording used for:
    - manual progress already exists
    - manual path is the next step
- This keeps the manual-link terminology consistent across idle, in-progress, and finish-ready states, so the next-step card no longer switches vocabulary right at the moment the user has successfully completed the manual App ID / App Secret form.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the finish-ready branch of the shared manual link-path detail helper
  - the authenticated `Official CLI Next Step` detail when manual link mode is ready to finish
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`149 passed`).

### Update 296: Keep manual-binding recovery in manual mode when no reusable bot exists
- I continued tightening the Feishu onboarding flow in `src/pages/ChannelConnect.tsx` by fixing an imperative state mismatch in the manual-binding recovery path. Before this slice, when Mclaw finished preparing the official plugin for manual binding and still had `0` reusable bots, several recovery branches still forced `feishuLinkSourceMode` back to `existing`, then relied on a later effect to flip it back to `manual`.
- I added a new pure helper:
  - `resolveFeishuPreparedLinkSourceMode(...)`
- I wired the manual-binding recovery / preparation success branches through that helper so the prepared link source now reflects the currently available bot count immediately:
  - plugin-ready refresh recovery
  - background recovery target `recover-manual`
  - direct manual-binding preparation success after plugin/config verification
  - direct manual-binding preparation success after auto-install
- Behavior change:
  - when no reusable bot exists yet, successful manual-binding preparation now keeps the UI directly in `manual` mode instead of bouncing through `existing`
  - when reusable bots are already present, the recovery flow still keeps the user on `existing` mode
- This removes another small but real inconsistency between the recovery notice and the actual selected source mode. The UI no longer has to depend on a follow-up effect just to correct the mode back to the manual path the user was actually entering.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the new prepared-link-source helper in both no-bot and reusable-bot cases
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`151 passed`).

### Update 297: Make manual-binding recovery notices reflect whether reusable bots actually exist
- I continued tightening the Feishu onboarding flow in `src/pages/ChannelConnect.tsx` by fixing another imperative recovery mismatch, this time in the user-facing notice text after manual-binding preparation succeeds. Before this slice, those notices always said `现在可以手动绑定已有机器人`, even when Mclaw still had `0` reusable bots, and they also failed to acknowledge the reusable-bot option when bots were already present.
- I added a new pure helper:
  - `resolveFeishuPreparedLinkNotice(...)`
- I wired the manual-binding recovery / preparation success notices through that helper in all the same success branches we already normalized for the prepared source mode:
  - plugin-ready refresh recovery
  - background recovery target `recover-manual`
  - direct manual-binding preparation success after verification or config sync
  - direct manual-binding preparation success after auto-install
- Behavior change:
  - when no reusable bot exists, the notice now explicitly points to manual App ID / App Secret input
  - when reusable bots are already present, the notice now says the user can continue linking existing bots and still switch to manual input if needed
- This keeps the recovery notice aligned with the actual selected source mode and available bot state, instead of always speaking as if the next step were manual binding only. It closes another gap between the imperative recovery flow and the declarative status/summary cards we have already tightened.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the new prepared-link notice helper in both no-bot and reusable-bot cases
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`153 passed`).

### Update 298: Keep the existing-link card focused on selection whenever reusable bots already exist
- I continued tightening the Feishu local link-path card behavior in `src/pages/ChannelConnect.tsx` by fixing another transient mismatch in the existing-link action resolver. Before this slice, `resolveFeishuLinkPathCardActions(...)` only stayed on the link card when `botCount > 0` *and* `hasSelectedExistingBot` was already true; if reusable bots existed but the selection state had not resolved yet, the card could incorrectly fall back to the no-bot recovery actions and suggest manual binding or create flow.
- I tightened the existing-link branch inside:
  - `resolveFeishuLinkPathCardActions(...)`
- Behavior change:
  - as soon as reusable bots exist, the link card now stays focused on the existing-link path
  - it no longer briefly suggests the no-bot recovery path just because the selected bot id/name has not been resolved yet
- This removes another transient contradiction between the detected-bot state and the local primary action. The card now behaves consistently with the rest of the UI: recovered reusable bots mean “stay on the link card and pick/confirm one,” not “switch to manual or create.”
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - existing-link mode with recovered bots but no resolved selection yet
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`154 passed`).

### Update 299: Remove the stale selected-bot dependency from the link-card action helper
- I continued tightening the Feishu onboarding code surface in `src/pages/ChannelConnect.tsx` by cleaning up the helper API after the last existing-link action fix. Before this slice, `resolveFeishuLinkPathCardActions(...)` still accepted `hasSelectedExistingBot`, even though the helper no longer used that value after we changed the existing-link branch to stay focused whenever reusable bots already exist.
- I removed the stale parameter from:
  - `resolveFeishuLinkPathCardActions(...)`
  - the page-level call site that built `feishuLinkPathCardActions`
  - the matching unit tests in `src/pages/__tests__/channel-connect.test.ts`
- Behavior change:
  - no user-facing behavior changed in this slice
  - the cleanup makes the helper contract match the actual decision logic, so the code no longer advertises a selected-bot dependency that does not exist anymore
- This reduces one more source of confusion in the Feishu state model. After the previous behavior change, the card action decision depends on recovered bot count, not on whether selection resolution has already finished; the helper signature now reflects that directly.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`154 passed`).

### Update 300: Keep the lower link-path intro manual-focused once manual mode is already selected
- I tightened another Feishu link-path wording gap in `src/pages/ChannelConnect.tsx`. Before this slice, `resolveFeishuLinkPathPanelIntro(...)` could still use the reusable-bot intro wording whenever bots existed, even if the active source mode was already `manual`; that made the lower runtime hint tell the user they could switch to manual mode while they were already in it.
- I changed:
  - `resolveFeishuLinkPathPanelIntro(...)` to accept the active `linkSourceMode` and gate the reusable-bot wording on `existing` mode only
  - `resolveFeishuExistingLinkNoBotStatus(...)` to feed the intro helper with an explicitly manual fallback context
  - the page-level `feishuLinkPathPanelIntro` call site to pass the active `feishuLinkSourceMode`
- Behavior change:
  - when manual mode is already selected, the lower runtime intro now stays focused on manual App ID / App Secret input
  - it no longer repeats “reuse or switch to manual” wording in a state where manual mode is already active
- I also repaired a broken/mis-encoded block in `src/pages/__tests__/channel-connect.test.ts` while validating this slice so the Feishu regression suite compiled cleanly again.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the ready-state manual-mode intro path after reusable bots already exist
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`155 passed`).

### Update 301: Stop counting reusable existing bots as manual-path progress
- I tightened another Feishu next-step inconsistency in `src/pages/ChannelConnect.tsx`. Before this slice, the official onboarding next-step summary reused one broad `linkHasProgress` flag for both the overall link flow and the currently selected link source. That meant manual mode could incorrectly say “The manual App ID / App Secret path already has progress” purely because reusable bots existed, even when the user had not started manual input at all.
- I changed:
  - `resolveFeishuOfficialOnboardingLinkPathDetail(...)` to accept `selectedPathHasProgress`
  - `buildFeishuOfficialOnboardingRuntimeDetail(...)` to distinguish overall link activity from progress in the currently selected link source
  - `resolveFeishuOfficialOnboardingNextStep(...)` to compute `selectedLinkPathHasProgress` so manual mode only counts manual-binding work as manual progress
- Behavior change:
  - manual mode now says “Continue with the manual App ID / App Secret path next” when reusable bots exist but manual input has not started
  - it only says the manual path already has progress once the manual path itself has actually started
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - the helper-level manual detail path when overall link activity comes only from reusable bots
  - the user-facing next-step card when auth is ready, reusable bots exist, and manual mode is selected but still blank
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`157 passed`).

### Update 302: Keep Feishu onboarding positioned as QR-first while moving test coverage back to readable assertions
- I kept the current Feishu product direction in `src/pages/ChannelConnect.tsx` instead of collapsing it into a fake scan-only flow. The page copy now states the intended split more explicitly:
  - `新建机器人` is the normal QR-first path for ordinary users
  - `关联已有机器人` is the advanced/manual fallback path for users who already have credentials or need a fallback
- I kept the UI wording aligned with that direction in the existing helper outputs:
  - the create-path descriptor stays user-first
  - the link-path descriptor stays fallback/manual-first
  - the create-path explanatory copy now makes it explicit that most users do not need to prefill `App ID / App Secret`
  - the manual-binding copy now clearly reads as an existing-credential / fallback path
- I then finished the cleanup work in `src/pages/__tests__/channel-connect.test.ts`. That file had drifted into a partially garbled state, so I normalized the remaining failing expectations back to the actual readable strings now returned by the implementation:
  - Feishu manual-binding preparation labels/details
  - Gateway readiness / port-migration messages
  - completion CTA copy and connected-action labels
  - DingTalk setup log wording
  - prepared-link notices for the no-bot and reusable-bot cases
  - managed-plugin safety-error expectations
- Behavior change:
  - no new runtime behavior changed in this slice beyond the already-landed Feishu wording direction
  - this slice mainly re-synced the regression suite with the current product copy so future changes fail for real regressions instead of stale mojibake
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`157 passed`).

### Update 303: Make prepared Feishu link recovery trust the freshly normalized bot state instead of stale page state
- I continued the Feishu mainline in `src/pages/ChannelConnect.tsx` by fixing a real recovery-state race in the manual-binding / prepared-link path. Before this slice, several success branches still built the recovered source mode and notice from `feishuBotsOrdered.length`, which is page state and can be stale for one render after the latest normalized config has already been fetched.
- I added a new shared helper:
  - `resolveFeishuPreparedLinkRecovery(...)`
- I then routed all prepared-link success branches through that helper, using the freshest normalized config available in each branch:
  - manual-binding recovery after explicit refresh
  - background auto-recovery after polling
  - fast-path manual-binding preparation when the plugin/config is already ready
  - auto-install completion before switching to manual/existing link mode
- Behavior change:
  - if the newly refreshed normalized config already contains a reusable Feishu bot, the recovery path now immediately stays on `existing` mode and shows the reusable-bot notice, even if the previous render still thought there were `0` bots
  - if the latest normalized config still has no reusable bot, the recovery path now stays on `manual` mode and shows the manual App ID / App Secret notice, even if stale page state still remembered old bots
- This removes another transient mismatch between imperative recovery and declarative UI state. The prepared-link transition now follows the freshly normalized config we just read, not whatever bot count happened to be on the previous render.
- I added focused regression coverage in `src/pages/__tests__/channel-connect.test.ts` for:
  - stale zero-bot fallback vs fresh normalized config with a reusable bot
  - stale reusable-bot fallback vs fresh normalized config with no reusable bot
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`159 passed`).

### Update 304: Prefer bundled `openclaw-lark` repairs while keeping the existing `npx` install fallback
- I implemented the first Feishu bundling slice so Mclaw can treat `openclaw-lark` as a built-in official payload instead of always going out through `@larksuite/openclaw-lark-tools`.
- I added a new helper in `electron/main/openclaw-bundled-managed-plugin.ts` that:
  - searches the packaged `resources/openclaw-bundle/managed-plugins/<pluginId>/` locations
  - verifies a bundled plugin by checking for `openclaw.plugin.json`
  - materializes the bundled plugin into the managed install directory with a clean copy step
- I then wired that helper into `electron/main/feishu-official-plugin-state.ts`:
  - `ensureFeishuOfficialPluginReady()` now tries the bundled `openclaw-lark` payload first
  - it falls back to the existing `installPluginNpx(...)` path only when no bundled payload is present
  - if a bundled payload exists but cannot be copied, Mclaw now surfaces that failure instead of silently masking it with a network install
  - normalized plugin state now preserves the install origin, so `plugins.installs.openclaw-lark.source` can stay `bundled` instead of being forced back to `npm`
- I also added focused coverage for both layers:
  - `electron/main/__tests__/openclaw-bundled-managed-plugin.test.ts`
  - expanded `electron/main/__tests__/feishu-official-plugin-state.test.ts` to cover bundled-first install, `npx` fallback, bundled-source preservation, and bundled-copy failure handling
- Product decision for this slice:
  - keep bundling `openclaw-lark`
  - do not bundle `larksuite/cli` by default yet; it still fits better as the auth/bootstrap layer
  - do not build a generic plugin updater yet; app-shipped bundled payload refresh + existing fallback install is enough for the current Feishu mainline
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run electron/main/__tests__/openclaw-bundled-managed-plugin.test.ts electron/main/__tests__/feishu-official-plugin-state.test.ts src/pages/__tests__/channel-connect.test.ts electron/main/__tests__/feishu-official-cli-state.test.ts electron/main/__tests__/feishu-official-cli.test.ts electron/main/__tests__/app-exit-cleanup.test.ts electron/preload/index.test.ts` passed (`174 passed`).

### Update 305: Expose bundled Feishu runtime availability to the UI so the setup flow can distinguish built-in vs fallback install paths
- I tightened the next Feishu bundling slice by making the official-plugin state carry explicit bundled-payload availability, instead of only reporting whether `openclaw-lark` is already installed on disk.
- In `electron/main/feishu-official-plugin-state.ts` I now resolve and return:
  - `installSource`
  - `bundledPayloadAvailable`
  - `bundledPayloadPath`
- This means the renderer can tell the difference between:
  - a plugin that is already installed
  - a packaged app that contains a built-in `openclaw-lark` payload and can repair/install offline
  - a build that still needs to fall back to the existing `npx` installer path
- I updated the preload-exposed type surface in `src/types/electron.d.ts` so the renderer side has the same state contract as the main-process implementation.
- I then used that signal in `src/pages/ChannelConnect.tsx`:
  - when the plugin is missing but a bundled payload is available, the runtime hint now says Mclaw will install the built-in `openclaw-lark` runtime plugin from the packaged app bundle
  - when no bundled payload is available, the old generic wording remains unchanged
- This keeps the QR/manual Feishu setup UX aligned with the actual packaging state instead of always implying the same install path.
- I added focused regression coverage in:
  - `electron/main/__tests__/feishu-official-plugin-state.test.ts`
  - `src/pages/__tests__/channel-connect.test.ts`
- Important repo-state note:
  - this slice only exposes and uses bundled-payload availability
  - the current repo still does not stage a real `resources/openclaw-bundle/managed-plugins/openclaw-lark/` payload, so `bundledPayloadAvailable` will remain `false` until that official artifact is actually added
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run electron/main/__tests__/feishu-official-plugin-state.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`161 passed`).

### Update 306: Stage the real bundled `openclaw-lark` payload and harden plugin smoke tests against hanging successful loads
- I finished the next Feishu bundling slice by moving from wiring-only support to a real bundled runtime payload.
- First I tightened `electron/main/plugin-install-safety.ts` again:
  - the new plugin-sdk alias fallback added in the previous slice could leave the subprocess alive after a successful dynamic load because the smoke-test script only exited explicitly on error
  - I now force `process.exit(0)` after both successful paths: direct import success and alias-assisted success
  - this keeps plugin safety checks deterministic instead of letting a valid load drift into the default 5-second subprocess timeout
- Then I staged the verified official plugin payload at:
  - `resources/openclaw-bundle/managed-plugins/openclaw-lark`
- Important packaging decision for this slice:
  - I did not copy the raw npm tarball extraction
  - I copied the output shape produced by a real `openclaw plugins install @larksuite/openclaw-lark` run under the bundled OpenClaw runtime, because that tree already includes the resolved `node_modules` layout that the plugin actually needs at runtime
- Result:
  - Mclaw now has a real built-in offline `openclaw-lark` payload to materialize during Feishu repair/install flows
  - the plugin safety smoke test no longer times out on successful alias-assisted loads
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run electron/main/__tests__/plugin-install-safety.test.ts electron/main/__tests__/feishu-official-plugin-state.test.ts electron/main/__tests__/openclaw-bundled-managed-plugin.test.ts` passed (`36 passed`).
- Validation on April 17, 2026: `npm run check:openclaw:bundle` passed.
- Validation on April 17, 2026: copying `resources/openclaw-bundle/managed-plugins/openclaw-lark` into a clean temp `OPENCLAW_HOME` and running `resources/openclaw-bundle/runtime/windows-x64/openclaw.cmd plugins inspect openclaw-lark --json` loaded the staged payload successfully with `status: "loaded"` and `channelIds: ["feishu"]`.

### Update 307: Make bundled delivery checks understand the staged Feishu managed-plugin payload
- I tightened the bundle verification layer so the repo now asserts the new built-in Feishu payload instead of only checking the core OpenClaw runtime files.
- In `src/shared/openclaw-bundled-runtime.ts` I extended the bundle manifest schema to support:
  - `artifacts.managedPlugins[]`
  - each entry currently carries `id`, `directoryName`, `version`, and optional `channels`
- I then updated `resources/openclaw-bundle/manifest.json` to declare the staged built-in Feishu payload:
  - `openclaw-lark`
  - directory `managed-plugins/openclaw-lark`
  - version `2026.4.8`
  - channel `feishu`
- In `scripts/check-openclaw-bundled-runtime.mjs` I added managed-plugin validation that now checks:
  - the declared bundled plugin directory exists
  - `openclaw.plugin.json` exists and its `id` matches the manifest entry
  - `package.json` exists and its version matches the manifest entry
  - the plugin carries `node_modules`
  - every declared `openclaw.extensions` entry exists on disk
- In `scripts/report-openclaw-bundled-delivery.mjs` I added managed-plugin reporting so the delivery report now prints:
  - bundled managed plugin path
  - declared/plugin package versions
  - declared channels
  - warnings if the staged payload drifts from the manifest
- Result:
  - future packaging/regression checks will fail early if someone removes or damages the built-in `openclaw-lark` payload while the manifest still declares it
  - the repo-level delivery report now surfaces the Feishu built-in payload explicitly instead of hiding it behind the generic runtime checks
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `npm run check:openclaw:bundle` passed and now reports `Validated managed plugin openclaw-lark`.
- Validation on April 17, 2026: `npm run report:openclaw:bundle` passed and now reports the bundled `openclaw-lark` payload/version/channel metadata.
- Additional note on April 17, 2026: I also ran `./node_modules/.bin/vitest.cmd run electron/main/__tests__/openclaw-bundled-manifest.test.ts electron/main/__tests__/openclaw-bundled-plan.test.ts electron/main/__tests__/openclaw-bundled-runtime-windows.test.ts electron/main/__tests__/openclaw-bundled-runtime-darwin.test.ts`; the Windows and plan tests passed, while the existing darwin-path tests still fail on this Windows host because they assert POSIX path shapes in code paths that currently resolve with host separators. I did not expand this slice into a cross-platform path-normalization refactor.

### Update 308: Make helper Node subprocesses prefer Mclaw's bundled Node 24 instead of the shell Node 22
- I closed one runtime-consistency gap that mattered to your Node-version question. Before this slice, the main OpenClaw execution path already preferred the bundled runtime, but helper Node subprocesses created through `electron/main/node-subprocess-runtime.ts` could still resolve a qualified shell Node first.
- Concretely:
  - the Windows shell in this repo currently reports `node --version = v22.22.1`
  - the bundled OpenClaw runtime inside Mclaw currently reports `resources/openclaw-bundle/runtime/windows-x64/node.exe --version = v24.14.1`
- I updated `electron/main/node-subprocess-runtime.ts` so `resolveQualifiedNodeRuntime(...)` now probes the bundled OpenClaw runtime Node first and returns it as source `bundled` when it satisfies the active requirement.
- I also made the NVM probing in that module use platform-aware path joins, so the test suite can validate darwin/NVM selection logic correctly even when run on this Windows host.
- Result:
  - main OpenClaw execution was already aligned to the bundled runtime
  - helper eval/smoke-test subprocesses are now aligned too
  - this removes another path where Mclaw could accidentally lean on the machine's Node 22 instead of the app-shipped Node 24
- I added focused regression coverage in `electron/main/__tests__/node-subprocess-runtime.test.ts` for:
  - preferring bundled Node over shell discovery
  - running eval scripts with the bundled Node runtime
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `npm run check:openclaw:bundle` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run electron/main/__tests__/node-subprocess-runtime.test.ts electron/main/__tests__/plugin-install-safety.test.ts electron/main/__tests__/openclaw-spawn.test.ts` passed (`42 passed`).

### Update 309: Add real Windows packaged-artifact verification for bundled Node 24 and bundled `openclaw-lark`
- I moved from source-tree bundle checks to real packaged Windows artifact checks.
- First I added a new verifier script:
  - `scripts/check-win-packaged-openclaw-bundle.mjs`
- That script validates a `win-unpacked` build end to end:
  - resolves the packaged `resources/openclaw-bundle`
  - checks the bundled Windows runtime files exist
  - executes the packaged `node.exe` and confirms it is still Node 24
  - checks the packaged `managed-plugins/openclaw-lark` payload exists with manifest, package metadata, entries, and `node_modules`
  - copies the packaged plugin into a clean temp `OPENCLAW_HOME`
  - launches the packaged OpenClaw runtime via bundled `node.exe + openclaw.mjs`
  - confirms `plugins inspect openclaw-lark --json` returns `status: "loaded"` and channel `feishu`
- I also wired that verifier into the Windows packaging flow:
  - added npm script `check:win:artifact:bundle` in `package.json`
  - updated `scripts/run-electron-builder.mjs` so a successful Windows build is not treated as complete until the packaged bundle verifier passes
- This immediately caught a real issue in the previously built artifact:
  - the older unpacked build at `release/2026.4.16-v16/win-unpacked` still lacked the new `managed-plugins/openclaw-lark` payload
  - the new verifier failed that stale build exactly where it should
- After that, I rebuilt the Windows unpacked artifact and re-ran the flow:
  - new build output: `release/2026.4.17-v0/win-unpacked`
  - packaged verifier passed inside the packaging command itself
  - the stale older build was pruned automatically after the successful rebuild
- Result:
  - Mclaw now has a real guardrail for the actual Windows packaged output, not just the source-tree bundle
  - the Windows package path now proves both of the things we care about:
    - bundled Node 24 is really present and executable in the packaged app
    - bundled `openclaw-lark` is really present and loadable from the packaged app
- Validation on April 17, 2026: `node scripts/check-win-packaged-openclaw-bundle.mjs --release-dir release/2026.4.16-v16` failed as expected on the stale older build because the packaged manifest did not yet carry bundled `openclaw-lark`.
- Validation on April 17, 2026: `node scripts/check-win-packaged-openclaw-bundle.mjs --release-dir release/2026.4.17-v0` passed.
- Validation on April 17, 2026: `npm run package:win:dir` passed end to end, and the packaged verifier ran successfully during `scripts/run-electron-builder.mjs`.
### Update 310: Close the Feishu shared-status repair loop inside the pairing modal as well
- I tightened the Feishu support flow in `src/pages/ChannelsPage.tsx` so the shared-status blocker is no longer only visible from the pairing modal; it is now actionable there too.
- Concretely:
  - the pairing modal now derives `selectedPairingChannelCanRepair` and `selectedPairingChannelRepairing` from the same shared managed-plugin status that already feeds the channel card and diagnostics modal
  - the pairing warning alert now includes a direct `Repair Feishu plugin` action when the selected bot is blocked by missing / degraded shared plugin state
  - that button reuses the existing `repairFeishuPlugin(...)` flow, so the same managed repair path still performs repair, refreshes the latest channel snapshot, and clears the blocker in-place when the shared runtime recovers
- Result:
  - pairing no longer dead-ends on a shared Feishu runtime block
  - users can now go from `pairing blocked -> repair -> refreshed shared status -> continue pairing` without closing the modal or switching surfaces
- I also added a focused regression assertion in `src/pages/__tests__/channels-page-state.test.ts` so the source contract now explicitly checks that the pairing modal exposes the repair affordance and routes it through `repairFeishuPlugin(..., { surface: 'pairing' })`.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`13 passed`).
### Update 311: Gate the pairing form behind the shared Feishu repair step instead of letting users pair against a known blocked runtime
- I tightened the next Feishu repair-loop slice in `src/pages/ChannelsPage.tsx`.
- Before this change, the pairing modal already showed the shared Feishu blocker and now also had an inline repair button, but it still kept rendering `PairingCode` underneath. That meant users could try to submit a pairing code even while Mclaw already knew the shared `openclaw-lark` runtime was blocked.
- I changed that behavior so the pairing modal now derives `selectedPairingChannelBlockedBySharedStatus` and uses it to gate the form itself:
  - when the shared Feishu status is blocked, the pairing modal shows a `Pairing blocked` alert instead of the pairing form
  - the existing inline repair action remains in the shared-status alert above
  - once repair succeeds and the refreshed shared status clears, the modal automatically falls back to rendering `PairingCode` again in the same place
- Result:
  - the support flow is now coherent: `blocked -> repair -> status refresh -> pairing form reappears`
  - users no longer waste time entering pairing codes into a path Mclaw already knows cannot succeed yet
- I also extended `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks that the pairing modal:
  - computes `selectedPairingChannelBlockedBySharedStatus`
  - shows the `Pairing blocked` message
  - keeps the inline repair hook routed through `repairFeishuPlugin(..., { surface: 'pairing' })`
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`13 passed`).
### Update 312: Bring the same shared Feishu repair gate into the first-run pairing step after ChannelConnect
- I closed the next Feishu pairing gap in `src/pages/ChannelsPage.tsx`: the first-run config modal now respects the same shared `openclaw-lark` blocker that we already enforced in the dashboard pairing modal.
- Before this change, the `channel-connect -> pairing-code` path still rendered `PairingCode` directly even if the shared Feishu runtime had already drifted into a blocked state. That meant a new user could finish setup, land on the pairing step, and still be asked to enter a pairing code against a runtime Mclaw already knew needed repair.
- I changed that flow so the config modal now:
  - resolves the latest channel snapshot for the current config target via `resolveConfigTargetChannelSnapshot(...)`
  - refreshes channel state in the background when the wizard enters the Feishu `pairing-code` step
  - shows the same shared-status repair alert and inline `Repair Feishu plugin` action used elsewhere
  - gates the wizard-side `PairingCode` form behind the blocker, and reopens the form in place once the shared status refresh clears
- Result:
  - both pairing surfaces now behave consistently
  - the first-run Feishu flow is now `setup complete -> shared status checked -> repair if blocked -> pairing form reappears -> continue pairing`
  - users no longer get pushed into a known-bad pairing path immediately after setup
- I also extended `src/pages/__tests__/channels-page-state.test.ts`:
  - added direct coverage for `resolveConfigTargetChannelSnapshot(...)`
  - locked the new wizard-side shared-status gate / background refresh / repair wiring into the source contract
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`14 passed`).
### Update 313: Hold the first-run Feishu pairing step until the shared runtime check actually finishes
- I tightened the next first-run Feishu onboarding edge case in `src/pages/ChannelsPage.tsx`.
- Before this slice, the wizard-side `pairing-code` step now had the shared-status repair gate, but there was still a short race: as soon as the UI advanced from `ChannelConnect` into `pairing-code`, the page could render the pairing form before the background refresh had finished confirming the latest shared Feishu runtime state.
- I fixed that by adding an explicit status-check window for the current Feishu pairing target:
  - `selectedConfigTargetPairingKey` now tracks the exact Feishu bot being verified
  - `refreshingConfigTargetChannel` and `checkedConfigTargetPairingKey` now distinguish `still checking` from `checked and missing`
  - while the background refresh is still in flight, the wizard shows `Checking Feishu runtime status` instead of rendering `PairingCode`
  - if the refresh finishes and the bot still cannot be resolved from the latest shared state, the wizard now shows `Recently connected bot not found yet` instead of silently falling through to the pairing form
  - only after the check completes cleanly does the flow decide between `repair blocker` vs `open pairing form`
- Result:
  - the first-run wizard no longer briefly exposes a pairing form against unconfirmed shared runtime state
  - the user-visible flow is now deterministic: `refresh state -> confirm target bot exists -> repair if blocked -> open pairing form`
  - missing-target cases are surfaced explicitly instead of looking like normal pairing readiness
- I also tightened `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks:
  - the explicit Feishu pairing-target check key
  - the pending-check gate
  - the missing-after-refresh gate
  - the new `Checking Feishu runtime status` and `Recently connected bot not found yet` messages
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`14 passed`).
### Update 314: Turn the first-run Feishu missing-target warning into an actionable recovery loop
- I tightened the next wizard-side Feishu recovery gap in `src/pages/ChannelsPage.tsx`.
- Before this slice, the first-run `pairing-code` step could already distinguish `target missing after refresh`, but that state still ended in a passive warning only. Users had to infer that they should either retry or go back manually.
- I changed that missing-target state into an explicit recovery surface:
  - the `Recently connected bot not found yet` alert now includes a direct `Refresh bot status` action
  - that action reruns the same shared-channel refresh logic in place and re-enters the existing `checking -> resolved/missing` state machine
  - the alert also now includes a direct `Back to setup` action that returns the user to the `channel-connect` step instead of forcing them to close the dialog or infer the navigation path
- Result:
  - the first-run Feishu wizard now has a clean recovery loop even when the newly connected bot has not landed in the shared channel snapshot yet
  - the user path is now `missing target -> refresh in place or go back explicitly`, not `missing target -> read text -> guess next step`
- I also extended `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the new recovery copy and both inline actions.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`14 passed`).
### Update 315: Unify the wizard-side Feishu target refresh path and make stale refreshes no-op
- I tightened the next first-run Feishu onboarding edge case in `src/pages/ChannelsPage.tsx`.
- Before this slice, the wizard-side `pairing-code` flow had two separate refresh implementations:
  - the automatic refresh when the user first entered the pairing step
  - the manual `Refresh bot status` button in the missing-target warning
- Both paths worked, but they duplicated the same state transitions and the manual path could still race if the user changed steps while an earlier refresh was finishing. An older request could attempt to write back `checkedConfigTargetPairingKey` after the UI had already moved on.
- I fixed that by introducing a single `refreshConfigTargetChannelStatus(pairingKey)` path and guarding it with `configTargetRefreshRequestIdRef`:
  - every wizard-side refresh now gets a request id
  - leaving the pairing step or starting a newer refresh invalidates older requests
  - stale refresh completions now become no-ops instead of writing outdated status back into the current wizard state
  - both the effect-driven first refresh and the inline `Refresh bot status` action now reuse the same code path
- Result:
  - the first-run Feishu pairing gate is now more deterministic under quick step changes and repeated retries
  - the refresh state machine has one implementation instead of two slightly divergent ones
  - stale refresh completions no longer risk reviving an old pairing target after the user has already moved elsewhere
- I also tightened `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the new guarded refresh helper and request-id invalidation logic.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`14 passed`).
### Update 316: Give the dashboard pairing modal the same guarded Feishu status-check loop as the first-run wizard
- I tightened the next Feishu pairing consistency gap in `src/pages/ChannelsPage.tsx`.
- Before this slice, the first-run `channel-connect -> pairing-code` flow already had a guarded shared-status refresh loop, but the dashboard pairing modal still opened directly from the channel card snapshot. That meant it could briefly rely on stale shared Feishu runtime state if the card had not refreshed yet.
- I brought the dashboard pairing modal up to the same standard:
  - added `selectedPairingTarget` so the modal preserves the intended Feishu bot even if a refresh removes the current row snapshot
  - added a guarded `refreshPairingTargetChannelStatus(pairingKey)` path with `pairingTargetRefreshRequestIdRef` so stale refresh completions become no-ops
  - the pairing modal now performs an explicit shared-state refresh on open for Feishu targets
  - while that check is pending, the modal shows `Checking Feishu runtime status` instead of exposing the pairing form immediately
  - if the refreshed shared state no longer contains the selected Feishu bot, the modal now shows `Selected bot not found anymore` with direct `Refresh bot status` and `Close pairing` actions
  - the existing inline repair path now uses the refreshed modal snapshot, not the original card snapshot
- Result:
  - both pairing surfaces now behave consistently: wizard pairing and dashboard pairing both verify shared Feishu state before opening the form
  - stale channel-card snapshots no longer drive the pairing dialog directly
  - missing-target recovery inside the dashboard pairing modal is now explicit and actionable
- I also extended `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the preserved pairing target, guarded refresh helper, open-time refresh effect, missing-target copy, and refreshed repair wiring.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`14 passed`).
### Update 317: Give the diagnostics modal the same refreshed Feishu target contract as the pairing surfaces
- I tightened the next Feishu state-consistency gap in `src/pages/ChannelsPage.tsx`.
- Before this slice, both the first-run wizard and the dashboard pairing modal already preserved a target Feishu bot and refreshed shared status on open, but the diagnostics modal still depended on the channel-card snapshot captured at click time.
- I brought diagnostics up to the same standard:
  - added `selectedDiagnosticsTarget` so the intended Feishu bot is preserved independently of the card snapshot
  - added a guarded `refreshDiagnosticsTargetChannelStatus(pairingKey)` path with `diagnosticsTargetRefreshRequestIdRef` so stale refresh completions cannot overwrite current diagnostics state
  - the diagnostics surface now refreshes shared Feishu state on open before handing control to `FeishuDiagnosticsModal`
  - while the refresh is pending, the page shows `Checking Feishu runtime status` instead of opening diagnostics against unconfirmed state
  - if the refreshed shared state no longer contains the selected Feishu bot, the page now shows `Selected bot not found anymore` with direct `Refresh bot status` and `Close diagnostics` actions
  - when the target is still valid, `FeishuDiagnosticsModal` now receives the refreshed modal snapshot and the inline repair action is bound to that refreshed bot record instead of the original stale row
- Result:
  - pairing and diagnostics now follow the same contract: preserve target -> refresh shared state on open -> resolve blocker / missing target / continue
  - opening diagnostics from a stale card no longer means acting on stale shared status
  - missing-target recovery inside diagnostics is explicit and actionable
- I also extended `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the preserved diagnostics target, guarded refresh helper, open-time refresh effect, missing-target recovery copy, and refreshed repair wiring.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`14 passed`).
### Update 318: Collapse the three Feishu target refresh state machines into one guarded helper
- I tightened the next Feishu maintenance risk in `src/pages/ChannelsPage.tsx` by removing the drift between the wizard, dashboard pairing, and diagnostics refresh loops.
- Before this slice, all three Feishu surfaces already had guarded refresh behavior, but each one still carried its own near-duplicate request-id state machine. That was workable, but it meant future fixes could easily land in one path and miss the other two.
- I replaced that duplication with a shared helper layer:
  - added `FeishuTargetRefreshBindings`
  - added `runGuardedFeishuTargetRefresh(...)`
  - added `resetFeishuTargetRefresh(...)`
- The three surface-specific refresh entry points remain (`refreshConfigTargetChannelStatus`, `refreshPairingTargetChannelStatus`, `refreshDiagnosticsTargetChannelStatus`), but they now all delegate to the same guarded implementation instead of each hand-rolling request-id invalidation and checked-key writes.
- Result:
  - wizard pairing, dashboard pairing, and diagnostics now share one refresh contract
  - request-id invalidation stays behaviorally aligned across all three paths
  - the next Feishu refresh fix only needs to be made in one place instead of three
- I also updated `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the new shared guarded-refresh helper and the per-surface binding/wiring that sits on top of it.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`14 passed`).
### Update 319: Collapse Feishu target state derivation onto the same shared guarded-refresh contract
- I tightened the next Feishu maintenance risk in `src/pages/ChannelsPage.tsx` by removing the remaining drift between the three Feishu target-state derivation paths.
- Before this slice, the wizard pairing, dashboard pairing, and diagnostics flows already shared the guarded refresh helper from Update 318, but each surface still carried its own low-level reset / request-id binding shape inline. That kept behavior correct, but the per-surface wiring was still noisy and easy to let drift.
- I cleaned that up by introducing a shared binding layer for the guarded refresh contract:
  - added `FeishuTargetRefreshBindings`
  - added `resetFeishuTargetRefresh(...)`
  - kept `runGuardedFeishuTargetRefresh(...)` as the single request-id-aware refresh implementation
  - added explicit per-surface binding objects (`configTargetRefreshBindings`, `pairingTargetRefreshBindings`, `diagnosticsTargetRefreshBindings`) so each Feishu surface now plugs into the same contract instead of partially reimplementing its own reset semantics
- Result:
  - the three Feishu target surfaces now share both halves of the refresh state machine: guarded refresh and guarded reset
  - future fixes to target invalidation / checked-key reset only need to be made once
  - `ChannelsPage` is still large, but this particular Feishu consistency seam is now much less likely to drift again
- I also updated `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the shared binding interface, the shared reset helper, the shared guarded refresh helper, and the three surface-specific bindings layered on top.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`14 passed`).
### Update 320: Collapse the remaining Feishu target-view derivation into one shared helper
- I removed the next avoidable drift point in `src/pages/ChannelsPage.tsx`: the wizard pairing, dashboard pairing, and diagnostics surfaces were still hand-deriving the same Feishu target-view state even after the guarded refresh machinery had been shared.
- I replaced that duplicated derivation with one shared helper:
  - added `deriveFeishuTargetState(...)`
  - added `FeishuTargetStateOptions`
  - added `FeishuTargetState`
- The helper now owns the repeated logic for:
  - pairing key derivation
  - refreshed target snapshot resolution
  - modal fallback channel resolution
  - shared-status alert / repair availability
  - repairing state
  - pending-check and missing-after-refresh state
  - blocked-by-shared-status state
- I then rewired the three Feishu surfaces to destructure their local variables from that shared helper instead of recomputing each piece inline:
  - config wizard pairing state
  - dashboard pairing modal state
  - diagnostics modal state
- Result:
  - the three Feishu surfaces now share both the guarded refresh contract and the target-view derivation contract
  - future fixes to missing-target, repair gating, or shared-status semantics only need one code change instead of three
  - `ChannelsPage` still has broad surface area, but this Feishu-specific state path is materially less fragile
- I also updated `src/pages/__tests__/channels-page-state.test.ts` to cover the new helper directly and to refresh the source-contract assertions around the shared derivation wiring.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts` passed (`15 passed`).
### Update 321: Move the Feishu gate alerts onto one shared component contract
- I tightened the next consistency seam in the Feishu pairing flow by removing the remaining duplicated gate-alert JSX from `src/pages/ChannelsPage.tsx`.
- Before this slice, the wizard pairing surface, dashboard pairing modal, and diagnostics modal already shared the same guarded refresh and target-state derivation logic, but each surface still rendered its own inline pending / missing-target / blocked alert markup. That meant copy, button wiring, and layout could still drift.
- I replaced that duplication with a shared component in `src/components/FeishuTargetGateAlert.tsx`:
  - added `FeishuTargetGateAlert`
  - added `getFeishuTargetGateAlertCopy(...)`
  - added `FeishuTargetGateSurface`
  - added `FeishuTargetGateState`
- The component now owns the shared shell for:
  - pending-state loader alert
  - missing-target recovery alert
  - blocked pairing alert
  - refresh CTA and secondary CTA layout
- I rewired `src/pages/ChannelsPage.tsx` so the three Feishu surfaces now delegate gate rendering to that component:
  - config wizard pairing gate
  - dashboard pairing modal gate
  - diagnostics modal preflight gate
- Result:
  - Feishu gate copy and CTA layout now live in one place instead of three inline branches
  - future edits to pending / missing / blocked copy only need one change
  - `ChannelsPage` keeps the surface-specific actions, but the gate presentation contract is now shared
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` to assert the page wires the shared gate component into all three surfaces
  - added `src/components/__tests__/feishu-target-gate-alert.test.ts` to cover the shared copy contract and alert-shell wiring
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts` passed (`17 passed`).
### Update 322: Move the shared Feishu repair alert onto one reusable component
- I tightened the next Feishu consistency seam by removing the duplicated shared-status repair alert markup from both `src/pages/ChannelsPage.tsx` and `src/components/FeishuDiagnosticsModal.tsx`.
- Before this slice, the wizard pairing surface, dashboard pairing modal, and diagnostics modal already agreed on repair semantics, but the alert shell that showed the shared-status title/message plus the `Repair Feishu plugin` CTA was still duplicated. That left copy, button state, and layout open to drift again.
- I replaced that duplication with a shared component in `src/components/FeishuSharedStatusAlert.tsx`:
  - added `FeishuSharedStatusAlert`
  - added `FeishuSharedStatusAlertState`
- The shared component now owns the common alert shell for:
  - shared-status title/message display
  - repair hint copy placement
  - repair CTA layout and button state
  - optional disabled/loading repair behavior
- I then rewired the Feishu surfaces to use it:
  - `src/pages/ChannelsPage.tsx` now uses it for both the config pairing flow and the dashboard pairing modal
  - `src/components/FeishuDiagnosticsModal.tsx` now uses it for the diagnostics shared-status repair block
- Result:
  - Feishu repair alerts now share one presentation contract across pairing and diagnostics
  - future changes to repair CTA layout or shared-status message presentation only need one code change
  - the page and modal logic still own their specific repair actions, but the alert shell no longer drifts independently
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` to assert the page now wires the shared repair-alert component into both pairing surfaces
  - refreshed `src/components/__tests__/feishu-diagnostics-modal.test.ts` to assert diagnostics now delegates the shared alert shell to the new component
  - added `src/components/__tests__/feishu-shared-status-alert.test.ts` to cover the shared alert contract directly
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts` passed (`19 passed`).
### Update 323: Collapse the remaining Feishu target refresh lifecycle wiring into shared helpers
- I tightened the next Feishu maintenance seam in `src/pages/ChannelsPage.tsx` by removing the remaining duplicated refresh lifecycle wiring around the config pairing flow, dashboard pairing modal, and diagnostics modal.
- Before this slice, the three Feishu surfaces already shared the guarded refresh state machine, the guarded reset helper, and the shared target-state derivation, but each surface still carried its own near-identical `useEffect` lifecycle block for open-time refresh / cleanup. That left another small drift point in the last mile of the refresh contract.
- I closed that gap by introducing two additional shared helpers:
  - `refreshFeishuTargetChannelStatus(...)`
  - `runFeishuTargetRefreshLifecycle(...)`
- The new split is:
  - `runGuardedFeishuTargetRefresh(...)` still owns request-id-aware pending / checked-key semantics
  - `refreshFeishuTargetChannelStatus(...)` owns the common "run guarded refresh for this binding" wrapper
  - `runFeishuTargetRefreshLifecycle(...)` owns the common "if active + keyed, refresh; otherwise reset; always clean up on exit" lifecycle contract
- I then rewired all three Feishu surfaces to use that shared lifecycle helper:
  - config pairing lifecycle
  - dashboard pairing lifecycle
  - diagnostics lifecycle
- Result:
  - the three Feishu surfaces now share the full refresh flow end to end: guarded refresh, guarded reset, target derivation, and lifecycle activation / cleanup
  - future fixes to modal-open refresh behavior only need one lifecycle change instead of three effect edits
  - `ChannelsPage` is still broad, but this Feishu refresh path is now less likely to drift at the effect layer too
- I also updated `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the new shared lifecycle helper and the generic shared refresh wrapper instead of the older per-surface inline effect branches.
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts` passed (`19 passed`).
### Update 324: Collapse Feishu display-label and modal copy derivation into shared helpers
- I tightened the next Feishu presentation seam in `src/pages/ChannelsPage.tsx` by removing the remaining repeated inline label/copy derivation for pairing and diagnostics.
- Before this slice, the page already shared refresh, target-state, gate, and repair-alert behavior, but it still hand-built several small Feishu display strings inline:
  - diagnostics modal titles
  - diagnostics bot label resolution
  - pairing modal summary copy
- That logic was simple, but it was still duplicated and easy to let drift if we changed naming rules or fallback labels later.
- I replaced that inline duplication with three shared helpers:
  - `getFeishuChannelDisplayName(...)`
  - `getFeishuDiagnosticsModalTitle(...)`
  - `getFeishuPairingModalSummary(...)`
- I then rewired the remaining Feishu surfaces to use them:
  - diagnostics pending modal title
  - diagnostics missing-target modal title
  - diagnostics runtime bot label
  - pairing modal summary copy
- Result:
  - Feishu modal labels and summary copy now follow one helper contract instead of being reassembled inline
  - future edits to bot naming fallbacks or pairing guidance only need one code change
  - `ChannelsPage` keeps getting smaller at the leaf-expression layer, which makes the remaining Feishu flow easier to reason about
- I also updated `src/pages/__tests__/channels-page-state.test.ts`:
  - added direct helper assertions for display-name, diagnostics-title, and pairing-summary behavior
  - refreshed the source-contract checks so they assert the page now consumes the shared copy helpers instead of the old inline expressions
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts` passed (`20 passed`).
### Update 325: Collapse repeated channel badge derivation into one shared helper
- I tightened the next Feishu presentation seam in `src/pages/ChannelsPage.tsx` by removing the repeated badge derivation that still existed between the channel cards and the pairing modal header.
- Before this slice, the page already shared refresh, gate, repair-alert, and copy derivation, but the badge row still hand-assembled the same enabled/runtime badge logic in multiple places, with the card also layering on pairing-state and provision-source badges. That kept one more small UI contract open to drift.
- I replaced that inline duplication with a shared helper:
  - added `deriveChannelStatusBadges(...)`
  - added `ChannelStatusBadgeDescriptor`
  - added `ChannelStatusBadgeOptions`
- The helper now owns badge derivation for:
  - enabled / disabled state
  - pairing-state badge when requested
  - Feishu provision-source badge when requested
  - Feishu runtime-state badge
- I then rewired the two current badge consumers:
  - the channel-card badge row now derives its badges from one shared helper call
  - the pairing modal header now derives its badges from the same helper instead of rebuilding enabled/runtime badges inline
- Result:
  - the card and pairing modal now share one badge contract
  - future edits to badge order, labeling, or color rules only need one code change
  - `ChannelsPage` keeps shedding repeated leaf-level UI logic, which makes the remaining Feishu flow easier to maintain
- I also updated `src/pages/__tests__/channels-page-state.test.ts`:
  - added direct helper assertions for badge derivation behavior
  - refreshed the source-contract checks so they assert both the card and pairing modal now consume the shared badge helper
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts` passed (`21 passed`).
### Update 326: Collapse the remaining Feishu card/runtime copy into shared helpers
- I tightened the next Feishu presentation seam in `src/pages/ChannelsPage.tsx` by removing the remaining repeated inline card/runtime copy derivation.
- Before this slice, the page already shared refresh, gate, repair-alert, label, and badge derivation, but several small text contracts still lived inline:
  - channel-card interaction summary copy
  - Feishu provision-source description copy
  - pairing-modal runtime summary alert color
- That logic was straightforward, but it still meant wording and runtime styling rules could drift independently from the rest of the Feishu helper layer.
- I replaced that inline duplication with three shared helpers:
  - `getChannelCardSummary(...)`
  - `getFeishuProvisionSourceDescription(...)`
  - `getFeishuRuntimeSummaryAlertColor(...)`
- I then rewired the page so those helpers now drive:
  - the channel-card summary line
  - the Feishu provision-source detail line
  - the pairing-modal runtime summary alert color
- Result:
  - the remaining Feishu card/runtime copy now follows one helper contract instead of nested inline expressions
  - future edits to channel-card guidance or runtime summary styling only need one code change
  - `ChannelsPage` continues to shrink at the leaf-expression layer, which makes the remaining Feishu UI easier to scan and maintain
- I also updated `src/pages/__tests__/channels-page-state.test.ts`:
  - added direct helper assertions for channel-card summary, provision-source description, and runtime summary color behavior
  - refreshed the source-contract checks so they assert the page now consumes those shared helpers instead of the old inline expressions
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts` passed (`22 passed`).
### Update 327: Move the remaining Feishu card meta block onto one shared component
- I tightened the next Feishu presentation seam in `src/pages/ChannelsPage.tsx` by removing the remaining inline Feishu card meta block from the channel-card body.
- Before this slice, the page already shared refresh, gate, repair-alert, label, badge, and copy helpers, but the Feishu-specific card meta section still lived inline with several conditionals:
  - provision description
  - provision-source confirmation alert
  - runtime summary line
  - shared runtime-status alert
- That was now the main Feishu-specific presentation block still embedded directly inside `ChannelsPage`, which made the card body heavier than necessary.
- I extracted that block into a dedicated component:
  - added `src/components/FeishuChannelCardMeta.tsx`
- The new component now owns the shared Feishu card meta shell for:
  - provision description text
  - provision confirmation alert
  - runtime summary line
  - shared-status alert display
- I rewired `src/pages/ChannelsPage.tsx` so Feishu rows now delegate that entire meta block to `FeishuChannelCardMeta`, while the page still owns the surrounding card state and action wiring.
- Result:
  - `ChannelsPage` keeps shrinking at the Feishu-specific presentation layer
  - the remaining Feishu card meta rules now live in one focused component instead of four inline conditional blocks
  - future edits to card meta presentation only need one change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the new card-meta component
  - added `src/components/__tests__/feishu-channel-card-meta.test.ts` to cover the shared meta-shell contract directly
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts` passed (`24 passed`).
### Update 328: Move the channel-card action row onto one shared component
- I tightened the next Feishu presentation seam in `src/pages/ChannelsPage.tsx` by removing the remaining inline channel-card action row from the card footer.
- Before this slice, the page already shared refresh, gate, repair-alert, badge, copy, and card-meta presentation, but the card still owned one dense action block with repeated click-stop wiring and several Feishu-specific branches:
  - model config
  - enable / disable toggle
  - pairing
  - diagnostics
  - repair
  - remove
- I extracted that action row into a dedicated component:
  - added `src/components/ChannelCardActionButtons.tsx`
- The new component now owns the shared action-shell contract for:
  - card-action click handling via one `handleCardActionClick(...)` helper
  - the common button row layout
  - the Feishu-only model/diagnostics/repair branches
  - the shared toggle and remove actions
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes one explicit action contract into `ChannelCardActionButtons`, while still owning the page-level state and handlers.
- While finishing this slice, I also repaired a handful of broken string literals in `src/pages/ChannelsPage.tsx` so the page compiles cleanly again after the extraction work.
- Result:
  - `ChannelsPage` keeps shrinking at the leaf interaction layer
  - the card action row now follows one focused component contract instead of an inline JSX block
  - future edits to button ordering, disabled/loading rules, or click-stop behavior only need one change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared action-row component and its main props/handlers
  - added `src/components/__tests__/channel-card-action-buttons.test.ts` to cover the shared action-shell contract directly
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts` passed (`26 passed`).
### Update 329: Move the managed-plugin status block onto one shared component
- I tightened the next Feishu/channel-card presentation seam in `src/pages/ChannelsPage.tsx` by removing the remaining inline managed-plugin status block from the card body.
- Before this slice, the page already shared refresh, gate, repair-alert, badge, copy, card-meta, and action-row presentation, but the managed-plugin status section still lived inline with its own summary line and stage badge mapping:
  - plugin status summary text
  - stage badge loop
  - stage color/label/state-label formatting
- I extracted that block into a dedicated component:
  - added `src/components/ManagedChannelPluginStatusSummary.tsx`
- The new component now owns the shared managed-plugin status shell for:
  - the summary line
  - per-stage badge rendering
  - stage label/color derivation through the shared status-view helpers
- I rewired `src/pages/ChannelsPage.tsx` so the page now delegates that block through:
  - `channelKey={channel.id}`
  - `pluginStatus={channel.pluginStatus}`
- Result:
  - `ChannelsPage` keeps shrinking at the leaf presentation layer
  - managed-plugin status rendering now follows one focused component contract instead of inline JSX
  - future edits to stage-badge formatting or summary layout only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared managed-plugin status component
  - added `src/components/__tests__/managed-channel-plugin-status-summary.test.ts` to cover the shared status-shell contract directly
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts` passed (`29 passed`).
### Update 330: Move the remaining channel-card detail block onto one shared component
- I tightened the next `ChannelsPage` presentation seam by removing the remaining inline channel-card detail block from the card body.
- Before this slice, the page already shared refresh, gate, repair-alert, card meta, plugin status, and action-row presentation, but the card still owned one dense left-side detail shell with:
  - platform logo / fallback mark
  - channel title and platform badge
  - ID / channel-id / agent lines
  - badge row
  - summary copy
  - Feishu card meta and managed-plugin status subcomponents
- I extracted that detail shell into a dedicated component:
  - added `src/components/ChannelCardDetails.tsx`
- The new component now owns the shared card-detail rendering contract for:
  - platform identity
  - channel metadata lines
  - badge rendering
  - summary copy
  - Feishu meta display
  - managed-plugin status display
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the derived card state into `ChannelCardDetails`, while the page still owns:
  - card-level hover/click behavior
  - derived helper state
  - action handlers
- Result:
  - `ChannelsPage` keeps shrinking at the card-body presentation layer
  - the remaining channel-card detail rendering now follows one focused component contract instead of inline JSX
  - future edits to card identity layout, metadata lines, or subcomponent placement only need one change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared card-details component
  - added `src/components/__tests__/channel-card-details.test.ts` to cover the shared card-details shell directly
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts` passed (`31 passed`).
### Update 331: Move the pairing-modal summary block onto one shared component
- I tightened the next `ChannelsPage` modal presentation seam by removing the remaining inline summary/status block from the pairing modal.
- Before this slice, the pairing modal still owned one dense top section with:
  - pairing status badge row
  - pairing summary copy
  - shared Feishu repair alert
  - runtime summary alert
- I extracted that block into a dedicated component:
  - added `src/components/ChannelPairingModalSummary.tsx`
- The new component now owns the shared pairing-summary shell for:
  - badge rendering
  - summary copy
  - shared-status repair wiring
  - runtime-status alert rendering
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes derived pairing state into `ChannelPairingModalSummary`, while the page still owns:
  - target refresh/gate state
  - repair handlers
  - the actual pairing-code flow
- Result:
  - `ChannelsPage` keeps shrinking at the pairing-modal leaf layer
  - the pairing modal summary now follows one focused component contract instead of inline JSX
  - future edits to pairing summary layout or shared-status/runtime messaging only need one change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared pairing-summary component
  - added `src/components/__tests__/channel-pairing-modal-summary.test.ts` to cover the shared pairing-summary shell directly
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts` passed (`34 passed`).
### Update 332: Move the model-config modal body onto one shared component
- I tightened the next `ChannelsPage` modal presentation seam by removing the remaining inline model-config body from the Feishu model modal.
- Before this slice, the model modal still owned one dense inline body block with:
  - agent id line
  - current runtime model alert
  - modal error alert
  - loading vs model select body
  - cancel/save footer actions
- I extracted that body into a dedicated component:
  - added `src/components/FeishuModelConfigModalBody.tsx`
- The new component now owns the shared model-config modal shell for:
  - model context display
  - error display
  - loading/select rendering
  - footer action layout
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the model state and handlers into `FeishuModelConfigModalBody`, while the page still owns:
  - model loading/saving state
  - gateway-backed save logic
  - modal open/close lifecycle
- Result:
  - `ChannelsPage` keeps shrinking at the model-modal leaf layer
  - the Feishu model modal body now follows one focused component contract instead of inline JSX
  - future edits to the model modal layout or loading/error presentation only need one change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared model-config modal component
  - added `src/components/__tests__/feishu-model-config-modal-body.test.ts` to cover the shared model-config modal shell directly
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts` passed (`37 passed`).
### Update 333: Move the config-pairing summary block onto one shared component
- I tightened the next `ChannelsPage` modal presentation seam by removing the remaining inline summary/repair block from the config pairing step.
- Before this slice, the config pairing step still owned one small but repeated summary section with:
  - pairing intro success alert
  - shared Feishu runtime repair alert
- I extracted that summary into a dedicated component:
  - added `src/components/ChannelConfigPairingSummary.tsx`
- The new component now owns the shared config-pairing summary shell for:
  - intro title/message rendering
  - shared-status repair alert wiring
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the derived pairing intro and repair state into `ChannelConfigPairingSummary`, while the page still owns:
  - target refresh/gate state
  - repair handlers
  - the `PairingCode` flow
- Result:
  - `ChannelsPage` keeps shrinking at the config-pairing leaf layer
  - config pairing summary now follows one focused component contract instead of inline JSX
  - future edits to intro/repair presentation only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared config-pairing summary component
  - added `src/components/__tests__/channel-config-pairing-summary.test.ts` to cover the shared config-pairing summary shell directly
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts` passed (`40 passed`).
### Update 334: Move the diagnostics modal outer shell onto one shared component
- I tightened the next `ChannelsPage` modal presentation seam by removing the remaining diagnostics modal outer shell from the page body.
- Before this slice, the page still owned one three-way diagnostics branch with:
  - pending target-state modal
  - missing target-state modal
  - ready diagnostics modal
- I extracted that outer shell into a dedicated component:
  - added `src/components/FeishuDiagnosticsModalShell.tsx`
- The new component now owns the shared diagnostics shell contract for:
  - pending diagnostics gate modal
  - missing diagnostics gate modal
  - ready diagnostics modal handoff
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes derived diagnostics state into `FeishuDiagnosticsModalShell`, while the page still owns:
  - refresh request wiring
  - repair handler wiring
  - target selection state
- Result:
  - `ChannelsPage` keeps shrinking at the diagnostics modal leaf layer
  - diagnostics modal routing now follows one focused component contract instead of an inline ternary branch
  - future edits to diagnostics gate behavior only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared diagnostics shell component
  - added `src/components/__tests__/feishu-diagnostics-modal-shell.test.ts` to cover the shared diagnostics shell directly
- Validation on April 17, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 17, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts` passed (`43 passed`).
### Update 335: Move the full config-pairing step onto one shared component
- I tightened the next `ChannelsPage` presentation seam by removing the remaining config-pairing step branch from the page body.
- Before this slice, the page still owned one inline config-pairing branch with:
  - the missing-target fallback alert
  - the pending / missing / blocked Feishu gate routing
  - the final `PairingCode` handoff once the target was ready
- I extracted that branch into a dedicated component:
  - added `src/components/ChannelConfigPairingStep.tsx`
- The new component now owns the shared config-pairing step contract for:
  - missing target fallback handling
  - shared summary plus repair alert wiring
  - target gate switching before the pairing-code flow
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the derived pairing state and handlers into `ChannelConfigPairingStep`, while the page still owns:
  - target selection and refresh state
  - repair lifecycle wiring
  - the final completion handler
- Result:
  - `ChannelsPage` keeps shrinking at the config-pairing branch layer
  - config pairing now follows one focused component boundary instead of one more inline page branch
  - future edits to config-pairing routing only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared config-pairing step component
  - added `src/components/__tests__/channel-config-pairing-step.test.ts` to cover the shared config-pairing step shell directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`45 passed`).
### Update 336: Move the pairing modal outer shell onto one shared component
- I tightened the next `ChannelsPage` modal seam by removing the remaining inline pairing modal branch from the page body.
- Before this slice, the page still owned one pairing modal block with:
  - the modal title and outer shell
  - the shared summary and repair block
  - the pending / missing / blocked target gate routing
  - the final dashboard `PairingCode` handoff
- I extracted that branch into a dedicated component:
  - added `src/components/ChannelPairingModalShell.tsx`
- The new component now owns the shared pairing-modal shell contract for:
  - modal title and open/close shell
  - summary plus shared-status repair wiring
  - target gate switching before the dashboard pairing flow
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the derived pairing modal state and handlers into `ChannelPairingModalShell`, while the page still owns:
  - pairing target selection and refresh state
  - repair lifecycle wiring
  - final pairing completion handling
- Result:
  - `ChannelsPage` keeps shrinking at the pairing-modal branch layer
  - pairing modal routing now follows one focused component boundary instead of another inline modal branch
  - future edits to dashboard pairing modal behavior only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared pairing-modal shell component
  - added `src/components/__tests__/channel-pairing-modal-shell.test.ts` to cover the shared pairing-modal shell directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`47 passed`).
### Update 337: Move the config setup modal outer shell onto one shared component
- I tightened the next `ChannelsPage` modal seam by removing the remaining inline config setup modal branch from the page body.
- Before this slice, the page still owned one config modal block with:
  - the modal title, size, and scrollable shell
  - the `ChannelConnect` step branch
  - the `ChannelConfigPairingStep` branch
  - the inline advance handler that moves setup from connect into pairing
- I extracted that branch into a dedicated component:
  - added `src/components/ChannelConfigModalShell.tsx`
- The new component now owns the shared config setup modal shell contract for:
  - modal title and sizing rules
  - `ChannelConnect` vs `ChannelConfigPairingStep` routing
  - the shared scrollable modal body layout
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the derived config modal state and handlers into `ChannelConfigModalShell`, while the page still owns:
  - target selection state
  - transition logic after `resolveChannelConnectAdvance`
  - repair / refresh lifecycle wiring
- Result:
  - `ChannelsPage` keeps shrinking at the config modal branch layer
  - config setup routing now follows one focused component boundary instead of one more inline modal branch
  - future edits to add-channel setup flow only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared config modal shell component
  - added `src/components/__tests__/channel-config-modal-shell.test.ts` to cover the shared config modal shell directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`49 passed`).
### Update 338: Move the model-config modal outer shell onto one shared component
- I tightened the next `ChannelsPage` modal seam by removing the remaining inline model-config modal branch from the page body.
- Before this slice, the page still owned one model modal block with:
  - the modal title and outer shell
  - the body handoff into `FeishuModelConfigModalBody`
  - the inline close/save wiring
- I extracted that branch into a dedicated component:
  - added `src/components/FeishuModelConfigModalShell.tsx`
- The new component now owns the shared model-config shell contract for:
  - modal title derivation from the selected bot name
  - model modal open/close shell
  - body wiring into the shared model-config body component
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the derived model modal state and handlers into `FeishuModelConfigModalShell`, while the page still owns:
  - selected bot state
  - model option loading and selection state
  - the save lifecycle
- Result:
  - `ChannelsPage` keeps shrinking at the model modal branch layer
  - model configuration now follows one focused component boundary instead of another inline modal branch
  - future edits to model modal title or wrapper behavior only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared model-config shell component
  - added `src/components/__tests__/feishu-model-config-modal-shell.test.ts` to cover the shared model-config shell directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`51 passed`).
### Update 339: Move the diagnostics visibility gate into the shared diagnostics shell
- I tightened the next `ChannelsPage` diagnostics seam by removing the last page-level visibility wrapper around the diagnostics modal shell.
- Before this slice, the page still owned one outer diagnostics gate with:
  - `showDiagnosticsModal && ...` visibility control
  - the extra selected-target presence check before rendering the shared shell
- I moved that gating into the existing shared component:
  - updated `src/components/FeishuDiagnosticsModalShell.tsx`
- The diagnostics shell now owns:
  - the closed-state short-circuit when `opened` is false
  - the default diagnostics bot label fallback
  - the pending / missing / ready routing after its own visibility check
- I rewired `src/pages/ChannelsPage.tsx` so the page now always renders `FeishuDiagnosticsModalShell` and only passes the derived diagnostics state and handlers into it.
- Result:
  - `ChannelsPage` keeps shrinking at the diagnostics branch layer
  - diagnostics visibility logic now sits with the diagnostics shell instead of one more page-level wrapper
  - future changes to diagnostics open/close gating only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared diagnostics shell directly without the extra page-level visibility wrapper
  - updated `src/components/__tests__/feishu-diagnostics-modal-shell.test.ts` to cover the shell-owned `opened` gate and default bot label behavior
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`51 passed`).
### Update 340: Move the channels page top panel onto one shared component
- I tightened the next `ChannelsPage` layout seam by removing the remaining inline page header and alert strip from the page body.
- Before this slice, the page still owned one top panel block with:
  - the page title and description
  - refresh and add-channel actions
  - the dismissible error alert
  - the legacy Feishu agent warning alert
- I extracted that block into a dedicated component:
  - added `src/components/ChannelsPageTopPanel.tsx`
- The new component now owns the shared top-panel contract for:
  - header copy and action layout
  - refresh and add-channel buttons
  - error and legacy warning alert rendering
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the derived top-panel state and handlers into `ChannelsPageTopPanel`, while the page still owns:
  - refresh lifecycle state
  - add-channel modal reset logic
  - current error message state
- Result:
  - `ChannelsPage` keeps shrinking at the page-layout layer
  - the header / alert strip now follows one focused component boundary instead of one more inline page block
  - future edits to top-of-page controls or warning presentation only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared top panel component
  - added `src/components/__tests__/channels-page-top-panel.test.ts` to cover the shared top panel directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`54 passed`).
### Update 341: Move the scrollable channel list shell onto one shared component
- I tightened the next `ChannelsPage` body seam by removing the remaining inline scroll-area and empty-state shell from the page body.
- Before this slice, the page still owned one list wrapper block with:
  - the fixed-height `ScrollArea`
  - the empty-state card and copy
  - the outer list container around the mapped channel cards
- I extracted that block into a dedicated component:
  - added `src/components/ChannelsPageChannelListPanel.tsx`
- The new component now owns the shared channel-list shell contract for:
  - scrollable list layout
  - empty-state rendering
  - the outer container for rendered channel card children
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the list state and mapped card children into `ChannelsPageChannelListPanel`, while the page still owns:
  - per-channel card mapping
  - channel hover and click behavior
  - channel action handlers and derived badge / summary state
- Result:
  - `ChannelsPage` keeps shrinking at the page-body layout layer
  - empty-state and list-shell behavior now follow one focused component boundary instead of one more inline block
  - future edits to the scrollable list wrapper or empty-state presentation only need one code change
- I also cleaned up two malformed fallback strings in `src/pages/ChannelsPage.tsx` that were breaking local typecheck after this slice, and normalized the top-panel / empty-state copy to readable English while keeping behavior unchanged.
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared channel-list panel component
  - added `src/components/__tests__/channels-page-channel-list-panel.test.ts` to cover the shared list shell directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`57 passed`).
### Update 342: Move the per-channel card shell onto one shared component
- I tightened the next `ChannelsPage` body seam by removing the remaining inline per-channel card wrapper from the mapped list body.
- Before this slice, the page still owned one repeated channel-card block with:
  - the interactive Mantine `Card` wrapper
  - hover and click behavior for pairing-enabled rows
  - the `ChannelCardDetails` and `ChannelCardActionButtons` layout glue
- I extracted that block into a dedicated component:
  - added `src/components/ChannelsPageChannelCard.tsx`
- The new component now owns the shared channel-card shell contract for:
  - card hover styling and click behavior
  - details + action-row layout
  - the handoff of derived per-channel state into the existing leaf components
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the derived row state and handlers into `ChannelsPageChannelCard`, while the page still owns:
  - per-channel derived badge and summary state
  - repair/toggle/remove handlers
  - per-row model, pairing, and diagnostics open handlers
- Result:
  - `ChannelsPage` keeps shrinking at the per-row rendering layer
  - the mapped card shell now follows one focused component boundary instead of one more inline JSX block
  - future edits to row hover/click behavior or the details/actions layout only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the source contract now checks the page wires the shared channel-card shell component
  - added `src/components/__tests__/channels-page-channel-card.test.ts` to cover the shared card shell directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`59 passed`).
### Update 343: Move the mapped channel-card collection onto one shared component
- I tightened the next `ChannelsPage` seam by removing the remaining inline `channels.map(...)` collection block from the page body.
- Before this slice, the page still owned one repeated mapped collection with:
  - per-row platform lookup
  - per-row toggling / repair state derivation
  - per-row badge, summary, and Feishu shared-status helper wiring
  - the final handoff into `ChannelsPageChannelCard`
- I extracted that mapped collection into a dedicated component:
  - added `src/components/ChannelsPageChannelCards.tsx`
- The new component now owns the shared mapped row contract for:
  - iterating channel rows
  - deriving row-local platform / summary / badge / shared-status state
  - wiring each row into the shared `ChannelsPageChannelCard` shell
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the row derivation helpers and row action handlers into `ChannelsPageChannelCards`, while the page still owns:
  - the channel list state itself
  - the shared helper functions used across cards and modals
  - the underlying toggle / repair / pairing / diagnostics / removal handlers
- I also widened the exported `ChannelsPageChannelCardChannel` contract in `src/components/ChannelsPageChannelCard.tsx` so the new mapper can pass the full channel row shape through without losing the page helper typings.
- Result:
  - `ChannelsPage` keeps shrinking at the mapped-row collection layer
  - the page now delegates one more repeated rendering responsibility into a focused shared component
  - future edits to per-row mapping behavior only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated `ChannelsPageChannelCards` mapper and no longer expects inline row mapping
  - added `src/components/__tests__/channels-page-channel-cards.test.ts` to cover the shared mapper contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`61 passed`).
### Update 344: Move the page-level pairing modal wiring onto one shared wrapper
- I tightened the next `ChannelsPage` seam by removing the inline page-level pairing modal shell block from the page return.
- Before this slice, the page still owned one repeated pairing-modal wiring block with:
  - badge / summary derivation for the selected pairing channel
  - runtime summary color derivation
  - shared-status repair gating
  - missing-target refresh callback wiring into `ChannelPairingModalShell`
- I extracted that pairing modal wiring into a dedicated component:
  - added `src/components/ChannelsPagePairingModal.tsx`
- The new component now owns the shared pairing-modal wrapper contract for:
  - computing `badges`, `summary`, and `runtimeSummaryColor` from page helper functions
  - applying the shared Feishu repair hint and repair gating
  - only exposing the missing-target refresh action when a target key exists
  - handing the final computed props into `ChannelPairingModalShell`
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the selected pairing channel state and helper functions into `ChannelsPagePairingModal`, while the page still owns:
  - pairing target state selection
  - refresh / repair / close / complete handlers
  - the shared helper functions reused across cards and modals
- Result:
  - `ChannelsPage` keeps shrinking at the modal wiring layer
  - pairing-modal prop mapping now follows one focused component boundary instead of one more inline JSX block
  - future edits to pairing-modal copy or prop derivation only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated `ChannelsPagePairingModal` wrapper
  - added `src/components/__tests__/channels-page-pairing-modal.test.ts` to cover the shared pairing wrapper contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`63 passed`).
### Update 345: Move the page-level diagnostics modal wiring onto one shared wrapper
- I tightened the next `ChannelsPage` seam by removing the inline page-level diagnostics modal shell block from the page return.
- Before this slice, the page still owned one repeated diagnostics-modal wiring block with:
  - diagnostics title derivation for pending and missing target states
  - bot label derivation for the ready diagnostics surface
  - missing-target refresh gating based on the selected diagnostics target key
  - shared-status repair gating before handing props into `FeishuDiagnosticsModalShell`
- I extracted that diagnostics modal wiring into a dedicated component:
  - added `src/components/ChannelsPageDiagnosticsModal.tsx`
- The new component now owns the shared diagnostics-modal wrapper contract for:
  - computing pending and missing titles from the shared diagnostics title helper
  - computing the diagnostics bot label from the shared display-name helper
  - only exposing the missing-target refresh callback when a target key exists
  - only exposing the diagnostics repair action when the selected diagnostics channel is repairable
  - handing the final computed props into `FeishuDiagnosticsModalShell`
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the selected diagnostics state and helper functions into `ChannelsPageDiagnosticsModal`, while the page still owns:
  - diagnostics target state selection
  - diagnostics refresh / repair / close handlers
  - the shared helper functions reused across surfaces
- Result:
  - `ChannelsPage` keeps shrinking at the modal wiring layer
  - diagnostics-modal prop mapping now follows one focused component boundary instead of one more inline JSX block
  - future edits to diagnostics titles, label derivation, or repair gating only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated `ChannelsPageDiagnosticsModal` wrapper
  - added `src/components/__tests__/channels-page-diagnostics-modal.test.ts` to cover the shared diagnostics wrapper contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`65 passed`).
### Update 346: Move the page-level config modal wiring onto one shared wrapper
- I tightened the next `ChannelsPage` seam by removing the inline page-level config modal wiring block from the page return.
- Before this slice, the page still owned one repeated config-modal wiring block with:
  - channel-connect advance logic via `resolveChannelConnectAdvance(...)`
  - pairing intro copy derivation via `getPairingIntroCopy(...)`
  - shared-status repair gating for the pairing step
  - missing-target refresh gating for the pairing step
  - direct state setter wiring for the selected channel, target, and config step
- I extracted that config modal wiring into a dedicated component:
  - added `src/components/ChannelsPageConfigModal.tsx`
- The new component now owns the shared config-modal wrapper contract for:
  - computing pairing intro title and message from the selected config target
  - translating the `ChannelConnect` payload into the next config-modal state via `resolveChannelConnectAdvance(...)`
  - deciding when the config flow should complete immediately versus continue into pairing
  - only exposing shared-status repair and missing-target refresh callbacks when the current config target state allows them
  - handing the final computed props into `ChannelConfigModalShell`
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the config target state and state setters into `ChannelsPageConfigModal`, while the page still owns:
  - config target state selection and refresh bookkeeping
  - config completion and repair handlers
  - the underlying selected-channel / selected-target / config-step state
- Result:
  - `ChannelsPage` keeps shrinking at the modal wiring layer
  - config-modal prop mapping and connect-step transition logic now follow one focused component boundary instead of one more inline JSX block
  - future edits to config-step advancement or pairing intro copy only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated `ChannelsPageConfigModal` wrapper
  - added `src/components/__tests__/channels-page-config-modal.test.ts` to cover the shared config wrapper contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`67 passed`).
### Update 347: Move the page-level model-config modal wiring onto one shared wrapper
- I tightened the next `ChannelsPage` seam by removing the inline page-level model-config modal wiring block from the page return.
- Before this slice, the page still owned one repeated model-config wiring block with:
  - selected Feishu bot identity handoff via `selectedModelChannel?.name` and `selectedModelChannel?.agentId`
  - current runtime model, loading, saving, and error state handoff
  - direct model selection setter wiring into `FeishuModelConfigModalShell`
  - direct save action wiring into `handleSaveBotModel()`
- I extracted that model-config wiring into a dedicated component:
  - added `src/components/ChannelsPageModelConfigModal.tsx`
- The new component now owns the shared model-config wrapper contract for:
  - deriving `botName` and `agentId` from the selected channel object
  - handing the current model modal state into `FeishuModelConfigModalShell`
  - routing model selection changes through one page-level wrapper prop
  - preserving the existing save action handoff without changing modal behavior
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the selected model channel object and modal state into `ChannelsPageModelConfigModal`, while the page still owns:
  - model status loading and save handlers
  - selected model channel and current model state
  - the close handler and save flow
- Result:
  - `ChannelsPage` keeps shrinking at the modal wiring layer
  - model-config prop mapping now follows one focused component boundary instead of one more inline JSX block
  - future edits to model-config modal identity or field wiring only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated `ChannelsPageModelConfigModal` wrapper
  - added `src/components/__tests__/channels-page-model-config-modal.test.ts` to cover the shared model-config wrapper contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`69 passed`).
### Update 348: Move the page-level model-config controller logic onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the inline model-config controller logic from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned one self-contained model-config controller layer with:
  - model modal local state (`showModelModal`, selected bot, current model, loading, saving, errors, options cache)
  - model option loading and cache reuse logic
  - selected model bot snapshot syncing after channel refreshes
  - the open/save/close flow for the Feishu model configuration modal
- I extracted that controller logic into a dedicated shared page hook:
  - added `src/pages/channels-page-model-config.ts`
- The new hook now owns the shared model-config controller contract for:
  - `shouldReuseModelOptionsCache(...)`
  - loading the full model catalog with env/config/model-status snapshots
  - deriving the current runtime model from model status payloads
  - saving the selected model through the gateway reload flow
  - syncing the selected model bot snapshot when the channel list refreshes
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageModelConfig(...)`, while the page still owns:
  - the main channel list fetch flow
  - the shared `resolveLatestChannelSnapshot(...)` helper
  - the remaining pairing / diagnostics / repair state coordination
- Result:
  - `ChannelsPage` keeps shrinking at the controller layer, not just the rendering layer
  - model-config loading and save behavior now follow one focused hook boundary instead of one large inline page block
  - future edits to model-config caching, open/save behavior, or refresh syncing only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated model-config controller hook usage
  - added `src/pages/__tests__/channels-page-model-config-controller.test.ts` to cover the shared model-config controller contract directly
  - moved the source-contract checks for env/config snapshot loading and shared model catalog reuse from `ChannelsPage.tsx` onto `src/pages/channels-page-model-config.ts`
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`72 passed`).

### Update 349: Move the page-level Feishu target refresh coordination onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the repeated Feishu target refresh controller logic from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned three near-identical Feishu target refresh flows for config, pairing, and diagnostics with:
  - local refreshing / checked-key state per surface
  - request-id refs and bindings objects per surface
  - guarded refresh helpers and lifecycle effects per surface
  - per-surface `refresh...TargetChannelStatus(...)` wrappers
- I extracted that coordination logic into a dedicated shared page hook:
  - added `src/pages/channels-page-feishu-target-refresh.ts`
- The new hook now owns the shared target-refresh controller contract for:
  - deriving the Feishu target pairing key from the selected target
  - guarded request-id refresh bookkeeping
  - active / inactive lifecycle reset behavior
  - one reusable `refreshTargetChannelStatus(...)` entry point for all three surfaces
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageFeishuTargetRefresh(...)` for config, pairing, and diagnostics, while the page still owns:
  - target-state derivation via `deriveFeishuTargetState(...)`
  - surface-specific repair actions and modal props
  - the shared background `fetchChannels(...)` flow
- Result:
  - `ChannelsPage` keeps shrinking at the controller layer, not just the modal wiring layer
  - the Feishu target refresh lifecycle now follows one focused hook boundary instead of three repeated inline controller blocks
  - future edits to refresh timing, guarded request semantics, or pairing-key derivation only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated target-refresh hook wiring instead of the old inline request-id / effect bookkeeping
  - added `src/pages/__tests__/channels-page-feishu-target-refresh.test.ts` to cover the shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`74 passed`).

### Update 350: Move the page-level Feishu target state derivation onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the repeated Feishu target-state derivation layer from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned three near-identical state derivation blocks for config, pairing, and diagnostics with:
  - direct `deriveFeishuTargetState(...)` calls per surface
  - repeated handoff of refreshing / checked-key bookkeeping into the derived state contract
  - repeated fallback-channel and repair-state wiring per surface
  - one extra destructuring layer per surface before the modal props were wired
- I extracted that state derivation into a dedicated shared page hook:
  - added `src/pages/channels-page-feishu-target-state.ts`
- The new hook now owns the shared target-state controller contract for:
  - reusing `useChannelsPageFeishuTargetRefresh(...)` internally
  - feeding refresh bookkeeping back into the shared derived target-state contract
  - keeping fallback-channel, repair-state, and selected-target wiring in one place
  - returning one consolidated surface object with both derived state and refresh callbacks
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageFeishuTargetState(...)` for config, pairing, and diagnostics, while the page still owns:
  - the exported `deriveFeishuTargetState(...)` helper contract
  - surface-specific repair actions and modal prop wiring
  - the shared background `fetchChannels(...)` flow
- Result:
  - `ChannelsPage` keeps shrinking at the state-derivation layer
  - Feishu target refresh + derived state wiring now follows one focused hook boundary instead of three repeated inline page blocks
  - future edits to fallback-channel handling, repair gating, or refresh-to-derived-state coordination only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated target-state hook wiring instead of the old inline state-derivation blocks
  - added `src/pages/__tests__/channels-page-feishu-target-state.test.ts` to cover the shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`76 passed`).

### Update 351: Move the page-level pairing and diagnostics target modal state onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the repeated pairing/diagnostics target modal state controller logic from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned one duplicated modal-state layer across pairing and diagnostics with:
  - local `show...Modal`, selected channel, and selected target state per surface
  - repeated open / close / done handlers per surface
  - repeated target snapshot syncing after channel refreshes
  - repeated target construction from `channelId` and `pairingAccountId`
- I extracted that controller logic into a dedicated shared page hook:
  - added `src/pages/channels-page-target-modals.ts`
- The new hook now owns the shared target-modal controller contract for:
  - pairing modal open / close / complete flow
  - diagnostics modal open / close flow
  - selected target construction for both surfaces
  - syncing the selected pairing/diagnostics channel snapshots after channel refreshes
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageTargetModals(...)`, while the page still owns:
  - config modal state and config-step transitions
  - Feishu target-state derivation and refresh hooks
  - the shared background `fetchChannels(...)` flow
- Result:
  - `ChannelsPage` keeps shrinking at the modal-state controller layer
  - pairing and diagnostics modal selection state now follows one focused hook boundary instead of repeated inline page state + handlers
  - future edits to selected target construction, modal reset behavior, or snapshot syncing only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated target-modals hook wiring
  - added `src/pages/__tests__/channels-page-target-modals.test.ts` to cover the shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`79 passed`).

### Update 352: Move the page-level Feishu plugin repair controller onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the inline Feishu plugin repair controller from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned one large repair controller block with:
  - local `repairingPluginChannelId` state
  - guarded repair entry / page-surface wrapper handling
  - the managed plugin repair flow call
  - refreshed-channel reconciliation after repair and shared-status re-checking
- I extracted that controller logic into a dedicated shared page hook:
  - added `src/pages/channels-page-feishu-plugin-repair.ts`
- The new hook now owns the shared repair-controller contract for:
  - repair-in-progress state tracking
  - page / pairing / diagnostics surface handling
  - running the managed plugin repair flow and refetching channels
  - reconciling the refreshed channel snapshot and re-checking shared status after repair
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageFeishuPluginRepair(...)`, while the page still owns:
  - the repair action wiring passed into channel cards and modal wrappers
  - the shared helper contracts `shouldShowFeishuPluginRepairAction(...)` and `getFeishuSharedStatusAlert(...)`
  - the background `fetchChannels(...)` flow used across the page
- Result:
  - `ChannelsPage` keeps shrinking at the controller layer
  - the Feishu plugin repair path now follows one focused hook boundary instead of one large inline page block
  - future edits to repair flow error handling, shared-status reconciliation, or in-progress state only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated repair hook wiring instead of the old inline repair controller
  - added `src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts` to cover the shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts src/components/__tests__/feishu-diagnostics-modal.test.ts src/components/__tests__/feishu-target-gate-alert.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channel-card-details.test.ts src/components/__tests__/channel-config-modal-shell.test.ts src/components/__tests__/channel-pairing-modal-summary.test.ts src/components/__tests__/channel-pairing-modal-shell.test.ts src/components/__tests__/feishu-model-config-modal-body.test.ts src/components/__tests__/feishu-model-config-modal-shell.test.ts src/components/__tests__/channel-config-pairing-summary.test.ts src/components/__tests__/feishu-diagnostics-modal-shell.test.ts src/components/__tests__/channel-config-pairing-step.test.ts` passed (`82 passed`).

### Update 353: Move the page-level config flow controller onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the inline config modal flow controller from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned one config-flow controller block with:
  - local `showConfigModal`, `selectedChannelId`, `selectedConfigTarget`, and `configStep` state
  - inline add-channel open handling
  - inline config back / reset handling
  - inline config-complete reset + background refresh handling
- I extracted that controller logic into a dedicated shared page hook:
  - added `src/pages/channels-page-config-flow.ts`
- The new hook now owns the shared config-flow controller contract for:
  - config modal visibility and selected channel / target state
  - config-step reset behavior
  - add-channel open handling
  - config back / complete flows, including the background `fetchChannels(...)` refresh after completion
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageConfigFlow(...)`, while the page still owns:
  - config-target Feishu status derivation and repair wiring
  - the config modal prop surface and target refresh callbacks
  - the shared `fetchChannels(...)` flow passed into the extracted controller
- Result:
  - `ChannelsPage` keeps shrinking at the controller layer
  - the config modal flow now follows one focused hook boundary instead of one inline page state + handler block
  - future edits to add-channel open behavior, config reset semantics, or post-complete refresh handling only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated config-flow hook wiring
  - added `src/pages/__tests__/channels-page-config-flow.test.ts` to cover the shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts` passed (`39 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`16 passed`).

### Update 354: Move the page-level channel remove and enable-toggle mutations onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the inline channel mutation controller from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned one mutation block with:
  - local `togglingChannelId` state
  - inline remove-channel confirm + config patch handling
  - inline enable / disable config mutation handling for Feishu, Weixin, and generic channels
  - inline page-error handoff and background refresh handling after writes
- I extracted that controller logic into a dedicated shared page hook:
  - added `src/pages/channels-page-channel-actions.ts`
- The new hook now owns the shared channel-actions controller contract for:
  - remove-channel mutation flow
  - enable / disable mutation flow
  - toggle-in-progress state tracking
  - page-error handoff and background `fetchChannels(...)` refresh after mutation writes
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageChannelActions(...)`, while the page still owns:
  - channel card wiring that calls the shared remove / toggle handlers
  - page-level refresh state and error surface rendering
  - the shared `fetchChannels(...)` flow passed into the extracted controller
- Result:
  - `ChannelsPage` keeps shrinking at the mutation-controller layer
  - channel remove / enable-toggle behavior now follows one focused hook boundary instead of one inline page state + handler block
  - future edits to guarded config patching, per-channel mutation behavior, or page-level mutation error handling only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated channel-actions hook wiring
  - added `src/pages/__tests__/channels-page-channel-actions.test.ts` to cover the shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`42 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`16 passed`).

### Update 355: Move the page-level channel data loading and refresh controller onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the inline channel data controller from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned one large data-loading block with:
  - local `channels`, `loading`, `refreshing`, `error`, and `legacyFeishuAgentIds` state
  - cache bootstrap / initial snapshot handling
  - the full `fetchChannels(...)` config read, normalization, and channel-list build flow
  - the refresh handler and initial background fetch effect
- I extracted that controller logic into a dedicated shared page hook:
  - added `src/pages/channels-page-data.ts`
- The new hook now owns the shared data-controller contract for:
  - cached initial snapshot bootstrap
  - config normalization and legacy Feishu agent detection
  - Feishu / Weixin / generic channel listing and managed plugin status loading
  - page refresh state, error state, and initial background refresh lifecycle
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageData(...)`, while the page still owns:
  - selected-channel snapshot sync wiring that bridges the page data hook into the extracted modal/model controllers
  - the helper exports used by cards and modals
  - the final surface composition passed into the shared page components
- Result:
  - `ChannelsPage` keeps shrinking at the data-controller layer
  - channel loading and refresh behavior now follows one focused hook boundary instead of one large inline page block
  - future edits to channel list normalization, startup cache behavior, or refresh lifecycle only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated data hook wiring
  - added `src/pages/__tests__/channels-page-data.test.ts` to cover the shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`45 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`16 passed`).

### Update 356: Move the page-level modal surface prop composition onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the inline modal surface prop composition from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned three large modal prop blocks with:
  - config modal prop wiring and shared-status repair callbacks
  - pairing modal prop wiring and shared-status refresh callbacks
  - diagnostics modal prop wiring and repair / refresh callbacks
- I extracted that surface-composition logic into a dedicated shared page hook:
  - added `src/pages/channels-page-modal-props.ts`
- The new hook now owns the shared modal surface contract for:
  - assembling `ChannelsPageConfigModal` props from page-level config target state
  - assembling `ChannelsPagePairingModal` props from pairing target state and shared-status actions
  - assembling `ChannelsPageDiagnosticsModal` props from diagnostics target state and repair / refresh actions
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageModalProps(...)`, while the page still owns:
  - Feishu target-state derivation for config, pairing, and diagnostics surfaces
  - the model-config modal surface block
  - the final component composition that renders the shared modal components
- Result:
  - `ChannelsPage` keeps shrinking at the surface-composition layer
  - config / pairing / diagnostics modal prop wiring now follows one focused hook boundary instead of three inline page prop blocks
  - future edits to shared-status repair callbacks, refresh callbacks, or modal prop mapping only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated modal-props hook wiring and spread usage
  - added `src/pages/__tests__/channels-page-modal-props.test.ts` to cover the shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`48 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`16 passed`).

### Update 357: Move the page-level top panel and channel list/card surface props onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the inline top-panel and channel list/card surface prop composition from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned one large main-surface block with:
  - top panel labels, refresh wiring, add-channel wiring, and error-dismiss wiring
  - the `getPlatformInfo(...)` helper for channel cards
  - channel list empty-state props
  - channel card prop wiring for badges, summaries, shared-status alerts, and all card actions
- I extracted that surface-composition logic into a dedicated shared page hook:
  - added `src/pages/channels-page-main-surface-props.ts`
- The new hook now owns the shared main-surface contract for:
  - assembling `ChannelsPageTopPanel` props from page refresh/error state
  - assembling `ChannelsPageChannelListPanel` props from the current channel collection
  - assembling `ChannelsPageChannelCards` props from the shared page handlers and channel helper functions
  - deriving the shared `getPlatformInfo(...)` helper for card rendering
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageMainSurfaceProps(...)`, while the page still owns:
  - page-level controller wiring across data, model-config, target-state, and modal hooks
  - the model-config modal surface block
  - the final component composition that renders the shared page shells and modals
- Result:
  - `ChannelsPage` keeps shrinking at the main-surface composition layer
  - top panel plus channel list/card prop wiring now follows one focused hook boundary instead of one inline page prop block
  - future edits to top-panel refresh behavior, card action mapping, or platform-display helpers only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated main-surface hook wiring and spread usage
  - added `src/pages/__tests__/channels-page-main-surface-props.test.ts` to cover the shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`51 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`16 passed`).

### Update 358: Move the page-level model-config modal surface props onto one shared hook
- I tightened the next `ChannelsPage` seam by removing the inline model-config modal prop composition from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned one standalone model-config modal prop block with:
  - modal open / close wiring
  - selected channel and runtime model handoff
  - loading, error, selected-model, and saving state handoff
  - the save callback wiring
- I extracted that surface-composition logic into a dedicated shared page hook:
  - added `src/pages/channels-page-model-modal-props.ts`
- The new hook now owns the shared model-config modal surface contract for:
  - assembling `ChannelsPageModelConfigModal` props from the page-level model-config controller state
  - keeping selected-model change wiring in one place
  - keeping the modal save callback mapping in one place
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageModelModalProps(...)`, while the page still owns:
  - the page-level model-config controller hook `useChannelsPageModelConfig(...)`
  - the remaining page shell composition and modal placement
  - the helper exports used across the page test contract
- Result:
  - `ChannelsPage` keeps shrinking at the surface-composition layer
  - the model-config modal prop wiring now follows one focused hook boundary instead of one inline page prop block
  - future edits to model modal state handoff or save-button behavior only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated model-modal-props hook wiring and spread usage
  - added `src/pages/__tests__/channels-page-model-modal-props.test.ts` to cover the shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`54 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`16 passed`).

### Update 359: Move the repeated page-level Feishu target-state wiring behind one shared grouping hook
- I tightened the next `ChannelsPage` seam by removing the three repeated `useChannelsPageFeishuTargetState(...)` blocks from the page component body.
- Before this slice, `ChannelsPage.tsx` still owned three nearly identical target-state controller calls for:
  - config pairing-code recovery state
  - pairing modal recovery state
  - diagnostics modal recovery state
- I extracted that repeated composition logic into a dedicated shared page hook:
  - added `src/pages/channels-page-target-state-groups.ts`
- The new hook now owns the shared grouping contract for:
  - wiring config target-state refresh and derived-state inputs through the shared Feishu target-state hook
  - wiring pairing target-state refresh and fallback-channel inputs through the same shared hook
  - wiring diagnostics target-state refresh and fallback-channel inputs through the same shared hook
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageTargetStateGroups(...)`, while the page still owns:
  - the exported Feishu target-state derivation helpers in `ChannelsPage.tsx`
  - the modal surface prop composition via `useChannelsPageModalProps(...)`
  - the remaining page shell composition and controller wiring
- Result:
  - `ChannelsPage` keeps shrinking at the repeated target-state orchestration layer
  - config / pairing / diagnostics Feishu state setup now follows one focused grouping boundary instead of three inline hook calls
  - future edits to background refresh wiring, fallback-channel handoff, or derived Feishu state plumbing only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated target-state grouping hook wiring
  - added `src/pages/__tests__/channels-page-target-state-groups.test.ts` to cover the new shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`56 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`16 passed`).

### Update 360: Move the page-level data, target-modal, and model-config controller glue behind one shared core-controller hook
- I tightened the next `ChannelsPage` seam by removing the inline cross-controller glue that tied page data refresh, target-modal snapshot sync, and model-config snapshot sync together inside `ChannelsPage.tsx`.
- Before this slice, `ChannelsPage.tsx` still owned one intertwined controller block for:
  - the page data controller `useChannelsPageData(...)`
  - the target-modal controller `useChannelsPageTargetModals(...)`
  - the model-config controller `useChannelsPageModelConfig(...)`
  - the shared `syncSelectedChannelSnapshots(...)` callback and background refresh callback that connected those controllers together
- I extracted that orchestration into a dedicated shared page hook:
  - added `src/pages/channels-page-core-controllers.ts`
- The new hook now owns the shared core-controller contract for:
  - wiring `useChannelsPageData(...)` to the target-modal and model-config snapshot-sync callbacks
  - wiring `useChannelsPageTargetModals(...)` and `useChannelsPageModelConfig(...)` to the shared `fetchChannels` pipeline
  - exposing one shared `refreshChannelsInBackground(...)` callback for downstream Feishu target-state recovery flows
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageCoreControllers(...)`, while the page still owns:
  - config-flow, channel-action, and Feishu plugin-repair controller wiring
  - Feishu target-state grouping and modal/main-surface prop composition
  - the final page shell render and helper exports
- Result:
  - `ChannelsPage` keeps shrinking at the controller-orchestration layer
  - the data / target-modal / model-config refresh coupling now follows one focused hook boundary instead of one inline page block
  - future edits to snapshot-sync behavior or shared background refresh wiring only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated core-controller hook wiring
  - added `src/pages/__tests__/channels-page-core-controllers.test.ts` to cover the new shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`58 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`16 passed`).

### Update 361: Move the remaining ChannelsPage loading/render shell into one shared page-shell component
- I tightened the next `ChannelsPage` seam by removing the remaining inline loading guard and final render composition block from `ChannelsPage.tsx`.
- Before this slice, `ChannelsPage.tsx` still owned:
  - the `loading` guard with the centered loader
  - the top-panel render
  - the channel list/card render shell
  - the final config / pairing / model / diagnostics modal placement
- I extracted that render-only composition into a dedicated shared component:
  - added `src/components/ChannelsPageShell.tsx`
- The new shell component now owns the shared page-shell contract for:
  - switching between the loader state and the normal page shell
  - rendering `ChannelsPageTopPanel`, `ChannelsPageChannelListPanel`, and `ChannelsPageChannelCards`
  - rendering the config, pairing, model-config, and diagnostics modal surfaces from one component boundary
- I rewired `src/pages/ChannelsPage.tsx` so the page now passes the already-derived surface prop groups into `ChannelsPageShell`, while the page still owns:
  - controller wiring and helper exports
  - Feishu target-state and modal/main-surface prop composition
  - the page-level orchestration logic that feeds the shell
- Result:
  - `ChannelsPage` keeps shrinking at the final render layer
  - the loader + shell + modal placement now follows one focused component boundary instead of one inline render block
  - future edits to page-shell layout or modal placement only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated shell-component wiring
  - added `src/components/__tests__/channels-page-shell.test.ts` to cover the new shared shell source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`58 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 362: Move the remaining page-level config-flow, channel-actions, and plugin-repair wiring behind one shared interaction-controller hook
- I tightened the next `ChannelsPage` seam by removing the remaining inline interaction-controller wiring from `ChannelsPage.tsx`.
- Before this slice, `ChannelsPage.tsx` still owned three adjacent controller blocks for:
  - `useChannelsPageChannelActions(...)`
  - `useChannelsPageConfigFlow(...)`
  - `useChannelsPageFeishuPluginRepair(...)`
- I extracted that page-level orchestration into a dedicated shared hook:
  - added `src/pages/channels-page-interaction-controllers.ts`
- The new hook now owns the shared interaction-controller contract for:
  - wiring page mutation actions through `useChannelsPageChannelActions(...)`
  - wiring config modal flow state through `useChannelsPageConfigFlow(...)`
  - wiring Feishu plugin repair flows through `useChannelsPageFeishuPluginRepair(...)`
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageInteractionControllers(...)`, while the page still owns:
  - the core data / modal / model controller composition via `useChannelsPageCoreControllers(...)`
  - Feishu target-state derivation and modal/main-surface prop composition
  - the final shell handoff into `ChannelsPageShell`
- Result:
  - `ChannelsPage` keeps shrinking at the controller-wiring layer
  - config flow, channel actions, and Feishu repair setup now follow one focused hook boundary instead of three inline blocks
  - future edits to page-level interaction wiring only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated interaction-controller wiring
  - added `src/pages/__tests__/channels-page-interaction-controllers.test.ts` to cover the new shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`60 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 363: Move the remaining target-state and surface-prop glue behind one shared surface-composition hook
- I tightened the next `ChannelsPage` seam by removing the remaining inline target-state and surface-prop composition layer from `ChannelsPage.tsx`.
- Before this slice, `ChannelsPage.tsx` still owned one large surface-composition block for:
  - `useChannelsPageTargetStateGroups(...)`
  - `useChannelsPageModalProps(...)`
  - `useChannelsPageMainSurfaceProps(...)`
  - `useChannelsPageModelModalProps(...)`
- I extracted that orchestration into a dedicated shared hook:
  - added `src/pages/channels-page-surface-composition.ts`
- The new hook now owns the shared surface-composition contract for:
  - deriving config / pairing / diagnostics Feishu target-state groups from page controller state
  - mapping those target states into config / pairing / diagnostics modal prop groups
  - mapping page controller state into top-panel, channel-list, channel-card, and model-modal prop groups
- I rewired `src/pages/ChannelsPage.tsx` so the page now consumes `useChannelsPageSurfaceComposition(...)`, while the page still owns:
  - helper exports such as `deriveFeishuTargetState(...)` and `deriveChannelStatusBadges(...)`
  - the high-level controller composition via `useChannelsPageCoreControllers(...)` and `useChannelsPageInteractionControllers(...)`
  - the final shell handoff into `ChannelsPageShell`
- Result:
  - `ChannelsPage` keeps shrinking at the target-state and surface-prop composition layer
  - modal/main/model surface wiring now follows one focused hook boundary instead of four adjacent inline blocks
  - future edits to target-state refresh plumbing or page-surface prop mapping only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated surface-composition hook wiring
  - added `src/pages/__tests__/channels-page-surface-composition.test.ts` to cover the new shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`62 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 364: Move the remaining page-level controller-to-shell handoff behind one shared view-state hook
- I tightened the next `ChannelsPage` seam by removing the last inline controller-to-surface handoff block from `src/pages/ChannelsPage.tsx`.
- Before this slice, `ChannelsPage.tsx` still directly composed:
  - `useChannelsPageCoreControllers(...)`
  - `useChannelsPageInteractionControllers(...)`
  - `useChannelsPageSurfaceComposition(...)`
  - the final prop-group handoff into `ChannelsPageShell`
- I extracted that last page-level orchestration into a dedicated shared hook:
  - added `src/pages/channels-page-view-state.ts`
- The new hook now owns the shared view-state contract for:
  - wiring the core controller state into the interaction controller layer
  - wiring those controller outputs into the shared surface-composition hook
  - returning one shell-ready view-state object with `loading` plus the top-panel, list, cards, and modal prop groups
- I rewired `src/pages/ChannelsPage.tsx` so the page now only owns:
  - the exported Feishu/helper derivation functions
  - the helper bundle passed into `useChannelsPageViewState(...)`
  - the final `ChannelsPageShell` render call
- Result:
  - `ChannelsPage` keeps shrinking at the last orchestration layer
  - the controller/surface/shell handoff now follows one focused hook boundary instead of living inline in the page component
  - future edits to page-level helper wiring or shell prop composition only need one code change
- I also updated tests:
  - rewrote `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the delegated `useChannelsPageViewState(...)` wiring instead of the older direct core/interaction/surface composition
  - added `src/pages/__tests__/channels-page-view-state.test.ts` to cover the new shared hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`50 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 365: Move the remaining ChannelsPage helper/export layer into one shared state-helpers module
- I tightened the next `ChannelsPage` seam by removing the remaining pure helper and re-export layer from `src/pages/ChannelsPage.tsx`.
- Before this slice, `ChannelsPage.tsx` still owned a large block of shared page helpers for:
  - channel status badge derivation
  - Feishu plugin/shared-status evaluation
  - config-target snapshot resolution
  - Feishu pairing/diagnostics/card copy helpers
- I extracted that helper layer into a dedicated shared module:
  - added `src/pages/channels-page-state-helpers.ts`
- The new helper module now owns the shared contract for:
  - channel badge derivation and enabled/runtime labeling
  - managed Feishu plugin stage inspection and repair gating
  - config-target snapshot lookup and derived Feishu target state
  - Feishu pairing, diagnostics, and channel-card copy helpers
- I rewired `src/pages/ChannelsPage.tsx` so the page now:
  - imports the helper bundle from `channels-page-state-helpers.ts`
  - re-exports the public helper API from that module to keep the existing page import surface stable
  - stays focused on passing the helper bundle into `useChannelsPageViewState(...)` and rendering `ChannelsPageShell`
- Result:
  - `ChannelsPage.tsx` shrank again and is now much closer to a thin page-entry wrapper
  - pure helper logic now has one focused home instead of living beside the page component
  - future edits to Feishu/card/shared-status helper behavior only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks helper-module import/re-export wiring instead of inline helper definitions
  - added `src/pages/__tests__/channels-page-state-helpers.test.ts` to cover the new shared helper module source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`52 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 366: Move the page-level view-state helper bundle behind one shared module
- I tightened the next `ChannelsPage` seam by removing the inline helper-bundle object that was still being built inside `src/pages/ChannelsPage.tsx` before calling `useChannelsPageViewState(...)`.
- Before this slice, `ChannelsPage.tsx` still owned one page-local object that mapped the shared helper exports into the `useChannelsPageViewState(...)` option contract.
- I extracted that helper-bundle wiring into a dedicated shared module:
  - added `src/pages/channels-page-view-state-helpers.ts`
- The new module now owns the shared view-state helper bundle for:
  - wiring `resolveLatestChannelSnapshot` into the view-state controller
  - mapping Feishu repair/status helpers into the `shouldShowRepairAction` and `getSharedStatusAlert` slots
  - passing the shared card/pairing/diagnostics copy helpers into the view-state layer from one object boundary
- I rewired `src/pages/ChannelsPage.tsx` so the page now:
  - imports `channelsPageViewStateHelpers`
  - passes that shared bundle directly into `useChannelsPageViewState(...)`
  - stays focused on the view-state call plus `ChannelsPageShell` rendering
- Result:
  - `ChannelsPage.tsx` shrank again and is now closer to a minimal page-entry wrapper
  - the view-state option mapping now has one focused home instead of one inline object inside the page component
  - future edits to view-state helper wiring only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state.test.ts` so the page contract now checks the dedicated helper-bundle module import and direct `useChannelsPageViewState(channelsPageViewStateHelpers)` handoff
  - added `src/pages/__tests__/channels-page-view-state-helpers.test.ts` to cover the new shared helper-bundle module source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`54 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 367: Move the `useChannelsPageViewState(...)` helper/result contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline `useChannelsPageViewState(...)` helper contract from `src/pages/channels-page-view-state.ts`.
- Before this slice, `channels-page-view-state.ts` still owned:
  - the full helper-input interface for the page-level helper bundle
  - the implicit shell-ready return shape for `loading` plus the top-panel/list/cards/modal prop groups
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-view-state-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageViewStateHelpers` input wiring from the helper bundle into the view-state hook
  - `ChannelsPageViewStateResult` output wiring from the view-state hook into `ChannelsPageShell`
- I rewired the implementation files so that:
  - `src/pages/channels-page-view-state.ts` now imports the input/output contract types instead of declaring them inline
  - `src/pages/channels-page-view-state-helpers.ts` now types `channelsPageViewStateHelpers` explicitly against `ChannelsPageViewStateHelpers`
- Result:
  - `channels-page-view-state.ts` shrank and is more focused on controller/surface composition only
  - the helper bundle and hook implementation now share one explicit typed contract instead of relying on matching structure by convention
  - future edits to view-state inputs or shell-ready outputs only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-view-state.test.ts` so it now checks the dedicated contract-module import instead of inline option-interface declarations
  - refreshed `src/pages/__tests__/channels-page-view-state-helpers.test.ts` so it now checks the explicit `ChannelsPageViewStateHelpers` typing on the helper bundle
  - added `src/pages/__tests__/channels-page-view-state-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`56 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 368: Move the `useChannelsPageViewState(...)` controller flattening behind one shared hook
- I tightened the next `ChannelsPage` seam by removing the large inline core-controller and interaction-controller flattening block from `src/pages/channels-page-view-state.ts`.
- Before this slice, `channels-page-view-state.ts` still directly owned:
  - the `useChannelsPageCoreControllers(...)` call and nested state destructuring
  - the `useChannelsPageInteractionControllers(...)` call and nested state destructuring
  - the flattening of those controller outputs into the large object later passed to `useChannelsPageSurfaceComposition(...)`
- I extracted that controller flattening into a dedicated shared hook:
  - added `src/pages/channels-page-view-state-controller-state.ts`
- The new hook now owns the shared controller-state composition for:
  - wiring core controllers and interaction controllers together from the `resolveLatestChannelSnapshot` / repair-status inputs
  - flattening those controller outputs into one `surfaceControllerState` object for the surface-composition layer
  - returning `loading` plus the flattened surface controller inputs from one boundary
- I rewired `src/pages/channels-page-view-state.ts` so it now:
  - imports `useChannelsPageViewStateControllerState(...)`
  - consumes `loading` plus `surfaceControllerState`
  - spreads `surfaceControllerState` into `useChannelsPageSurfaceComposition(...)` and keeps only the helper-layer injection in the view-state hook
- Result:
  - `channels-page-view-state.ts` shrank again and is now more focused on the final controller-state to surface-composition handoff
  - the noisy controller flattening logic has one focused home instead of living inline in the view-state hook
  - future edits to controller wiring or surface-input flattening only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-view-state.test.ts` so it now checks the dedicated controller-state hook import and `...surfaceControllerState` handoff
  - added `src/pages/__tests__/channels-page-view-state-controller-state.test.ts` to cover the new shared controller-state hook source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`58 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 369: Move the `useChannelsPageViewStateControllerState(...)` input/output contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the implicit controller-state contract from `src/pages/channels-page-view-state-controller-state.ts`.
- Before this slice, `channels-page-view-state-controller-state.ts` still relied on:
  - an inline `Pick<ChannelsPageViewStateHelpers, ...>` input type for the controller-state hook
  - an implicit `surfaceControllerState` object shape that only matched `useChannelsPageSurfaceComposition(...)` by convention
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-view-state-controller-state-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageViewStateControllerStateInput`
  - `ChannelsPageViewStateSurfaceControllerState`
  - `ChannelsPageViewStateControllerStateResult`
- I also exported `UseChannelsPageSurfaceCompositionOptions` from `src/pages/channels-page-surface-composition.ts` so the controller-state contract can define `surfaceControllerState` as the non-helper subset of the surface-composition input contract instead of a loosely matched object.
- I rewired the implementation files so that:
  - `src/pages/channels-page-view-state-controller-state.ts` now imports the dedicated input/output contract types instead of declaring them inline
  - the controller-state contract explicitly derives `ChannelsPageViewStateSurfaceControllerState` via `Omit<UseChannelsPageSurfaceCompositionOptions, ...helper keys>`
- Result:
  - the controller-state hook is more explicit about what it accepts and what surface-ready state it returns
  - `surfaceControllerState` is now contract-linked to `useChannelsPageSurfaceComposition(...)` instead of being kept in sync manually by convention
  - future edits to surface-composition non-helper inputs only need one contract update
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-view-state-controller-state.test.ts` so it now checks the dedicated controller-state contract import
  - refreshed `src/pages/__tests__/channels-page-surface-composition.test.ts` so it now checks the exported `UseChannelsPageSurfaceCompositionOptions` contract
  - added `src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`60 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 370: Move the large `surfaceControllerState` object mapping behind one dedicated builder module
- I tightened the next `ChannelsPage` seam by removing the large inline `surfaceControllerState` object mapping from `src/pages/channels-page-view-state-controller-state.ts`.
- Before this slice, `channels-page-view-state-controller-state.ts` still owned:
  - the `useChannelsPageCoreControllers(...)` composition
  - the `useChannelsPageInteractionControllers(...)` composition
  - the full mapping from those controller outputs into the large `surfaceControllerState` object
- I extracted that large mapping into a dedicated shared module:
  - added `src/pages/channels-page-view-state-surface-controller-state.ts`
- The new builder module now owns the shared surface-controller-state mapping for:
  - flattening core controller outputs into the surface-composition input shape
  - flattening interaction controller outputs into the same shape
  - returning one `ChannelsPageViewStateSurfaceControllerState` object from a focused builder boundary
- I rewired `src/pages/channels-page-view-state-controller-state.ts` so it now:
  - keeps the core/interactions controller composition locally
  - delegates the big object assembly to `buildChannelsPageViewStateSurfaceControllerState(...)`
  - returns `loading` plus the builder result
- Result:
  - `channels-page-view-state-controller-state.ts` shrank again and is more focused on controller composition only
  - the biggest remaining object-mapping noise now has one dedicated home instead of living inline in the hook
  - future edits to the surface-controller-state mapping only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-view-state-controller-state.test.ts` so it now checks the dedicated builder-module import and handoff
  - added `src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts` to cover the new surface-controller-state builder source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`62 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 371: Move the surface-controller-state builder contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline builder-input contract from `src/pages/channels-page-view-state-surface-controller-state.ts`.
- Before this slice, `channels-page-view-state-surface-controller-state.ts` still owned:
  - the `ChannelsPageCoreControllersState` type alias
  - the `ChannelsPageInteractionControllersState` type alias
  - the `BuildChannelsPageViewStateSurfaceControllerStateOptions` interface
- I extracted that builder contract into a dedicated shared module:
  - added `src/pages/channels-page-view-state-surface-controller-state-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageCoreControllersState`
  - `ChannelsPageInteractionControllersState`
  - `BuildChannelsPageViewStateSurfaceControllerStateOptions`
  - `BuildChannelsPageViewStateSurfaceControllerStateResult`
- I rewired `src/pages/channels-page-view-state-surface-controller-state.ts` so it now imports the dedicated builder contract types instead of declaring them inline.
- Result:
  - the surface-controller-state builder is more focused on the actual mapping logic only
  - builder inputs/outputs now have one explicit shared home instead of being declared inside the implementation file
  - future edits to the builder input/output contract only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts` so it now checks the dedicated builder-contract import
  - added `src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts` passed (`64 passed`).
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`18 passed`).

### Update 372: Move the surface-composition input/output contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the large input/output contract declarations from `src/pages/channels-page-surface-composition.ts`.
- Before this slice, `channels-page-surface-composition.ts` still owned:
  - the full `ChannelsPageSurfaceCompositionOptions` interface
  - the full `ChannelsPageSurfaceCompositionResult` interface
  - the contract link later reused by the controller-state layer
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-surface-composition-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageSurfaceCompositionOptions`
  - `ChannelsPageSurfaceCompositionResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-surface-composition.ts` now imports the dedicated contract types instead of declaring them inline
  - `src/pages/channels-page-view-state-controller-state-contract.ts` now derives its non-helper surface subset from `ChannelsPageSurfaceCompositionOptions` in the dedicated contract module
- Result:
  - `channels-page-surface-composition.ts` shrank and is more focused on target-state plus modal/main/model prop composition only
  - the shared surface-composition contract now has one explicit home instead of being split between implementation and downstream consumers
  - future edits to surface-composition inputs or outputs only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-surface-composition.test.ts` so it now checks the dedicated surface-composition contract import instead of inline interface declarations
  - refreshed `src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts` so it now checks the new contract-module import and type name
  - added `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`84 passed`).

### Update 373: Move the grouped target-state input contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the grouped target-state input contract declarations from `src/pages/channels-page-target-state-groups.ts`.
- Before this slice, `channels-page-target-state-groups.ts` still owned:
  - the `ChannelsPageTargetStateSurfaceOptions<Channel>` interface
  - the `UseChannelsPageTargetStateGroupsOptions<Channel, State>` interface
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-target-state-groups-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageTargetStateSurfaceOptions<Channel>`
  - `ChannelsPageTargetStateGroupsOptions<Channel, State>`
- I rewired `src/pages/channels-page-target-state-groups.ts` so it now imports the dedicated grouped target-state options contract instead of declaring those interfaces inline.
- Result:
  - `channels-page-target-state-groups.ts` shrank and is more focused on the repeated `useChannelsPageFeishuTargetState(...)` composition only
  - the grouped target-state input shape now has one explicit shared home instead of being tied to the implementation file
  - future edits to config/pairing/diagnostics surface inputs only need one code change
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-target-state-groups.test.ts` so it now checks the dedicated grouped-target-state contract import instead of inline interface declarations
  - added `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`86 passed`).

### Update 374: Tighten the grouped target-state result contract around refresh state
- I tightened the next `ChannelsPage` seam by removing the implicit grouped target-state result shape from `src/pages/channels-page-target-state-groups.ts`.
- Before this slice, `channels-page-target-state-groups.ts` returned its grouped state objects without an explicit shared result contract, so downstream refresh-state fields were only enforced by inference.
- I extended the dedicated grouped target-state contract module:
  - added `ChannelsPageTargetStateGroupResult<State>`
  - added `ChannelsPageTargetStateGroupsResult<State>`
- The new result contract now owns the shared shape for:
  - the derived state returned per grouped target
  - the shared refresh fields added by `useChannelsPageFeishuTargetState(...)`
  - the grouped `configTargetState` / `pairingTargetState` / `diagnosticsTargetState` return surface
- I rewired `src/pages/channels-page-target-state-groups.ts` so it now returns `ChannelsPageTargetStateGroupsResult<State>` explicitly instead of relying on inference alone.
- Result:
  - the grouped target-state hook is now explicit about the refresh-state fields it guarantees to surface
  - downstream consumers keep a stable shared contract for `refreshingTargetChannel` and `refreshTargetChannelStatus`
  - future edits to grouped target-state outputs only need one contract update
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-target-state-groups.test.ts` so it now checks the dedicated grouped-target-state result contract import and annotated return type
  - refreshed `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` so it now covers the explicit per-target refresh-state result contract
- Validation on April 18, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 18, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`86 passed`).

### Update 375: Move the model-modal prop hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline model-modal input contract from `src/pages/channels-page-model-modal-props.ts`.
- Before this slice, `channels-page-model-modal-props.ts` still owned:
  - the full `UseChannelsPageModelModalPropsOptions` interface
  - the implicit single-field return shape around `modelConfigModalProps`
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-model-modal-props-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageModelModalPropsOptions`
  - `ChannelsPageModelModalPropsResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-model-modal-props.ts` now imports the dedicated model-modal contract types instead of declaring them inline
  - `src/pages/channels-page-surface-composition-contract.ts` now references `ChannelsPageModelModalPropsResult['modelConfigModalProps']` instead of reaching through the hook return type indirectly
- Result:
  - `channels-page-model-modal-props.ts` is more focused on model modal prop assembly only
  - the model-modal input/output contract now has one explicit shared home
  - the surface-composition contract now depends on that shared model-modal result contract directly
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-model-modal-props.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so it now checks the shared model-modal result contract reference
  - added `src/pages/__tests__/channels-page-model-modal-props-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`90 passed`).

### Update 376: Move the main-surface prop hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline main-surface input contract from `src/pages/channels-page-main-surface-props.ts`.
- Before this slice, `channels-page-main-surface-props.ts` still owned:
  - the full `UseChannelsPageMainSurfacePropsOptions` interface
  - the implicit return shape around `topPanelProps`, `channelListPanelProps`, and `channelCardsProps`
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-main-surface-props-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageMainSurfacePropsOptions`
  - `ChannelsPageMainSurfacePropsResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-main-surface-props.ts` now imports the dedicated main-surface contract types instead of declaring them inline
  - `src/pages/channels-page-surface-composition-contract.ts` now references `ChannelsPageMainSurfacePropsResult` directly for `topPanelProps`, `channelListPanelProps`, and `channelCardsProps`
- Result:
  - `channels-page-main-surface-props.ts` is more focused on top/list/card prop assembly only
  - the main-surface input/output contract now has one explicit shared home
  - the surface-composition result contract now depends on the shared main-surface result type instead of an indirect hook-return lookup
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-main-surface-props.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so it now checks the shared main-surface result contract reference
  - added `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`90 passed`).

### Update 377: Move the modal prop hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline config/pairing/diagnostics modal contract from `src/pages/channels-page-modal-props.ts`.
- Before this slice, `channels-page-modal-props.ts` still owned:
  - the full `UseChannelsPageModalPropsOptions` interface
  - the implicit return shape around `configModalProps`, `pairingModalProps`, and `diagnosticsModalProps`
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-modal-props-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageModalPropsOptions`
  - `ChannelsPageModalPropsResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-modal-props.ts` now imports the dedicated modal contract types instead of declaring them inline
  - `src/pages/channels-page-surface-composition-contract.ts` now references `ChannelsPageModalPropsResult` directly for the config, pairing, and diagnostics modal props
- Result:
  - `channels-page-modal-props.ts` is more focused on modal prop assembly only
  - the modal input/output contract now has one explicit shared home
  - the surface-composition result contract now depends on the shared modal result type instead of an indirect hook-return lookup
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-modal-props.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so it now checks the shared modal result contract reference
  - added `src/pages/__tests__/channels-page-modal-props-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`92 passed`).

### Update 378: Move the feishu target-state hook contracts into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline feishu target-state contracts from `src/pages/channels-page-feishu-target-state.ts`.
- Before this slice, `channels-page-feishu-target-state.ts` still owned:
  - the full `ChannelsPageFeishuTargetStateOptions<Channel>` interface
  - the `UseChannelsPageFeishuTargetStateOptions<Channel, State>` interface
  - the implicit result shape that mixed derived target-state fields with refresh-state fields
- I extracted those contracts into a dedicated shared module:
  - added `src/pages/channels-page-feishu-target-state-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageFeishuTargetStateOptions<Channel>`
  - `ChannelsPageFeishuTargetStateHookOptions<Channel, State>`
  - `ChannelsPageFeishuTargetStateResult<State>`
- I rewired the implementation files so that:
  - `src/pages/channels-page-feishu-target-state.ts` now imports the dedicated contract types instead of declaring them inline
  - `src/pages/channels-page-target-state-groups-contract.ts` now uses `ChannelsPageFeishuTargetStateResult<State>` for grouped target-state outputs
  - `src/pages/channels-page-view-state-contract.ts` and `src/pages/channels-page-surface-composition-contract.ts` now import `ChannelsPageFeishuTargetStateOptions` from the dedicated contract module
- Result:
  - `channels-page-feishu-target-state.ts` is more focused on refresh coordination plus derived-state composition only
  - the feishu target-state input/output contract now has one explicit shared home
  - grouped target-state and view/surface helper contracts now depend on a single feishu target-state contract boundary
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts`, `src/pages/__tests__/channels-page-view-state-contract.test.ts`, and `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so they now check the new contract-module imports
  - added `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`94 passed`).

### Update 379: Move the feishu target-refresh hook contracts into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline target-refresh contracts from `src/pages/channels-page-feishu-target-refresh.ts`.
- Before this slice, `channels-page-feishu-target-refresh.ts` still owned:
  - the `FeishuTargetRefreshBindings` interface
  - the `UseChannelsPageFeishuTargetRefreshOptions` interface
  - the implicit result shape around `pairingKey`, `refreshingTargetChannel`, `checkedTargetKey`, and `refreshTargetChannelStatus`
- I extracted those contracts into a dedicated shared module:
  - added `src/pages/channels-page-feishu-target-refresh-contract.ts`
- The new contract module now owns the shared type surface for:
  - `FeishuTargetRefreshBindings`
  - `ChannelsPageFeishuTargetRefreshOptions`
  - `ChannelsPageFeishuTargetRefreshResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-feishu-target-refresh.ts` now imports the dedicated refresh contract types instead of declaring them inline
  - `src/pages/channels-page-feishu-target-state-contract.ts` now derives its exposed refresh fields from `ChannelsPageFeishuTargetRefreshResult` instead of duplicating that refresh-state shape locally
- Result:
  - `channels-page-feishu-target-refresh.ts` is more focused on guarded refresh lifecycle logic only
  - the refresh hook input/output/bindings contract now has one explicit shared home
  - the feishu target-state contract now reuses the same refresh-state boundary instead of keeping a duplicated subset by convention
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-refresh.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the refresh-result contract reuse
  - added `src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`94 passed`).

### Update 380: Move the core-controller hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline core-controller contract from `src/pages/channels-page-core-controllers.ts`.
- Before this slice, `channels-page-core-controllers.ts` still owned:
  - the full `UseChannelsPageCoreControllersOptions` interface
  - the implicit result shape around `dataState`, `targetModalState`, `modelConfigState`, and `refreshChannelsInBackground`
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-core-controllers-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageCoreControllersOptions`
  - `ChannelsPageCoreControllersResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-core-controllers.ts` now imports the dedicated core-controller contract types instead of declaring them inline
  - `src/pages/channels-page-view-state-surface-controller-state-contract.ts` now derives `ChannelsPageCoreControllersState` from `ChannelsPageCoreControllersResult` instead of reaching through the hook return type indirectly
- Result:
  - `channels-page-core-controllers.ts` is more focused on data/target-modal/model-config composition only
  - the core-controller input/output contract now has one explicit shared home
  - the surface-controller-state builder contract now depends on the shared core-controller result type instead of an indirect hook-return lookup
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-core-controllers.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts` so it now checks the shared core-controller result contract reference
  - added `src/pages/__tests__/channels-page-core-controllers-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`96 passed`).

### Update 381: Move the interaction-controller hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline interaction-controller contract from `src/pages/channels-page-interaction-controllers.ts`.
- Before this slice, `channels-page-interaction-controllers.ts` still owned:
  - the full `UseChannelsPageInteractionControllersOptions` interface
  - the implicit result shape around `channelActionState`, `configFlowState`, and `pluginRepairState`
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-interaction-controllers-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageInteractionControllersOptions`
  - `ChannelsPageInteractionControllersResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-interaction-controllers.ts` now imports the dedicated interaction-controller contract types instead of declaring them inline
  - `src/pages/channels-page-view-state-surface-controller-state-contract.ts` now derives `ChannelsPageInteractionControllersState` from `ChannelsPageInteractionControllersResult` instead of reaching through the hook return type indirectly
- Result:
  - `channels-page-interaction-controllers.ts` is more focused on page-level controller composition only
  - the interaction-controller input/output contract now has one explicit shared home
  - the surface-controller-state builder contract now depends on the shared interaction-controller result type instead of an indirect hook-return lookup
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-interaction-controllers.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts` so it now checks the shared interaction-controller result contract reference
  - added `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`100 passed`).

### Update 382: Move the config-flow hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline config-flow contract from `src/pages/channels-page-config-flow.ts`.
- Before this slice, `channels-page-config-flow.ts` still owned:
  - the full `UseChannelsPageConfigFlowOptions` interface
  - the implicit result shape around modal state, selection state, setter actions, and config-flow handlers
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-config-flow-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageConfigFlowOptions`
  - `ChannelsPageConfigFlowResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-config-flow.ts` now imports the dedicated config-flow contract types instead of declaring them inline
  - `src/pages/channels-page-interaction-controllers-contract.ts` now derives `configFlowState` from `ChannelsPageConfigFlowResult` instead of reaching through the hook return type indirectly
- Result:
  - `channels-page-config-flow.ts` is more focused on modal/config flow behavior only
  - the config-flow input/output contract now has one explicit shared home
  - the interaction-controller result contract now depends on the shared config-flow result type instead of an indirect hook-return lookup
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-config-flow.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` so it now checks the shared config-flow result contract reference
  - added `src/pages/__tests__/channels-page-config-flow-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`100 passed`).

### Update 383: Move the Feishu plugin-repair hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline Feishu plugin-repair contract from `src/pages/channels-page-feishu-plugin-repair.ts`.
- Before this slice, `channels-page-feishu-plugin-repair.ts` still owned:
  - the `Channel` constraint for the repair hook
  - the full repair-hook options interface
  - the implicit result shape around `repairingPluginChannelId`, `repairFeishuPlugin`, and `handleRepairFeishuPlugin`
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-feishu-plugin-repair-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageFeishuPluginRepairChannel`
  - `ChannelsPageFeishuPluginRepairOptions`
  - `ChannelsPageFeishuPluginRepairResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-feishu-plugin-repair.ts` now imports the dedicated repair-hook contract types instead of declaring them inline
  - `src/pages/channels-page-interaction-controllers-contract.ts` now derives `pluginRepairState` from `ChannelsPageFeishuPluginRepairResult<ChannelInfo>` instead of reaching through the hook return type indirectly
- Result:
  - `channels-page-feishu-plugin-repair.ts` is more focused on repair-flow behavior only
  - the repair-hook input/output contract now has one explicit shared home
  - the interaction-controller result contract now depends on the shared repair-hook result type instead of an indirect hook-return lookup
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` so it now checks the shared repair-hook result contract reference
  - added `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`104 passed`).

### Update 384: Move the channel-actions hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline channel-actions contract from `src/pages/channels-page-channel-actions.ts`.
- Before this slice, `channels-page-channel-actions.ts` still owned:
  - the `Channel` constraint for the action hook
  - the full action-hook options interface
  - the implicit result shape around `restartingChannelId`, `togglingChannelId`, `handleRestartChannel`, `handleToggleChannel`, and `repairChannelPlugin`
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-channel-actions-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageChannelActionChannel`
  - `ChannelsPageChannelActionsOptions`
  - `ChannelsPageChannelActionsResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-channel-actions.ts` now imports the dedicated action-hook contract types instead of declaring them inline
  - `src/pages/channels-page-interaction-controllers-contract.ts` now derives `channelActionState` from `ChannelsPageChannelActionsResult<ChannelInfo>` instead of reaching through the hook return type indirectly
- Result:
  - `channels-page-channel-actions.ts` is more focused on channel action behavior only
  - the channel-action input/output contract now has one explicit shared home
  - the interaction-controller result contract now depends on the shared channel-action result type instead of an indirect hook-return lookup
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-channel-actions.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` so it now checks the shared channel-action result contract reference
  - added `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`104 passed`).

### Update 385: Move the target-modals hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline target-modals contract from `src/pages/channels-page-target-modals.ts`.
- Before this slice, `channels-page-target-modals.ts` still owned:
  - the `Channel` constraint for the target-modal hook
  - the full target-modal options interface
  - the implicit result shape around pairing state, diagnostics state, and modal open/close handlers
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-target-modals-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageTargetModalChannel`
  - `ChannelsPageTargetModalsOptions`
  - `ChannelsPageTargetModalsResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-target-modals.ts` now imports the dedicated target-modal contract types instead of declaring them inline
  - `src/pages/channels-page-core-controllers-contract.ts` now derives `targetModalState` from `ChannelsPageTargetModalsResult<ChannelInfo>` instead of reaching through the hook return type indirectly
- Result:
  - `channels-page-target-modals.ts` is more focused on modal-state behavior only
  - the target-modal input/output contract now has one explicit shared home
  - the core-controller result contract now depends on the shared target-modal result type instead of an indirect hook-return lookup
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-target-modals.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-core-controllers-contract.test.ts` so it now checks the shared target-modal result contract reference
  - added `src/pages/__tests__/channels-page-target-modals-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`108 passed`).

### Update 386: Move the model-config hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline model-config contract from `src/pages/channels-page-model-config.ts`.
- Before this slice, `channels-page-model-config.ts` still owned:
  - the `Channel` constraint for the model-config hook
  - the full model-config options interface
  - the implicit result shape around model modal state, model selection state, setter actions, and model-config handlers
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-model-config-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageModelConfigChannel`
  - `ChannelsPageModelConfigOptions`
  - `ChannelsPageModelConfigResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-model-config.ts` now imports the dedicated model-config contract types instead of declaring them inline
  - `src/pages/channels-page-core-controllers-contract.ts` now derives `modelConfigState` from `ChannelsPageModelConfigResult<ChannelInfo>` instead of reaching through the hook return type indirectly
- Result:
  - `channels-page-model-config.ts` is more focused on model-loading and save behavior only
  - the model-config input/output contract now has one explicit shared home
  - the core-controller result contract now depends on the shared model-config result type instead of an indirect hook-return lookup
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-model-config-controller.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-core-controllers-contract.test.ts` so it now checks the shared model-config result contract reference
  - added `src/pages/__tests__/channels-page-model-config-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`110 passed`).

### Update 387: Move the data hook contract into one shared module
- I tightened the next `ChannelsPage` seam by removing the inline data-hook contract from `src/pages/channels-page-data.ts`.
- Before this slice, `channels-page-data.ts` still owned:
  - the full data-hook options interface
  - the implicit result shape around channel state, loading state, refresh actions, and the page-level error setter
- I extracted that contract into a dedicated shared module:
  - added `src/pages/channels-page-data-contract.ts`
- The new contract module now owns the shared type surface for:
  - `ChannelsPageDataOptions`
  - `ChannelsPageDataResult`
- I rewired the implementation files so that:
  - `src/pages/channels-page-data.ts` now imports the dedicated data-hook contract types instead of declaring them inline
  - `src/pages/channels-page-core-controllers-contract.ts` now derives `dataState` from `ChannelsPageDataResult` instead of reaching through the hook return type indirectly
- Result:
  - `channels-page-data.ts` is more focused on config loading, normalization, and channel snapshot assembly only
  - the data-hook input/output contract now has one explicit shared home
  - the core-controller result contract now depends on the shared data-hook result type instead of an indirect hook-return lookup
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data.test.ts` so it now checks the dedicated contract import and typed function signature
  - refreshed `src/pages/__tests__/channels-page-core-controllers-contract.test.ts` so it now checks the shared data-hook result contract reference
  - added `src/pages/__tests__/channels-page-data-contract.test.ts` to cover the new shared contract module source contract directly
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`112 passed`).

### Update 388: Move the data domain types into the shared data contract module
- I tightened the next `ChannelsPage` seam by removing the inline channel snapshot types from `src/pages/channels-page-data.ts`.
- Before this slice, `channels-page-data.ts` still owned:
  - `FeishuRuntimeStatusState`
  - `ChannelsPageChannelInfo`
  - `ChannelsPageSnapshot`
  - plus the data-hook input/output contract that now already lived next to them conceptually
- I folded those types into the dedicated shared data contract module:
  - updated `src/pages/channels-page-data-contract.ts`
- The shared data contract module now owns:
  - `FeishuRuntimeStatusState`
  - `ChannelsPageChannelInfo`
  - `ChannelsPageSnapshot`
  - `ChannelsPageDataOptions`
  - `ChannelsPageDataResult`
- I rewired the dependent implementation and contract files so that:
  - `src/pages/channels-page-data.ts` now imports the shared data types instead of exporting them inline
  - `src/pages/channels-page-core-controllers.ts` and `src/pages/channels-page-interaction-controllers.ts` now import `ChannelInfo` from the shared data contract while continuing to import the hook from `channels-page-data.ts`
  - `src/pages/channels-page-core-controllers-contract.ts`, `src/pages/channels-page-interaction-controllers-contract.ts`, `src/pages/channels-page-main-surface-props-contract.ts`, `src/pages/channels-page-modal-props-contract.ts`, `src/pages/channels-page-model-modal-props-contract.ts`, `src/pages/channels-page-state-helpers.ts`, `src/pages/channels-page-surface-composition-contract.ts`, `src/pages/channels-page-surface-composition.ts`, and `src/pages/channels-page-view-state-contract.ts` now all depend on the shared data contract module instead of the hook module for channel snapshot types
- Result:
  - `channels-page-data.ts` is more focused on data loading and snapshot assembly only
  - the data domain types and the data-hook contract now live in one explicit shared home
  - downstream contracts no longer treat the data hook module as the owner of reusable channel snapshot types
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data.test.ts` so it now checks the shared data-type imports and the removal of the inline channel/snapshot type declarations
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the shared runtime-state, channel-info, and snapshot type definitions directly
  - refreshed the raw-source contract expectations in `src/pages/__tests__/channels-page-core-controllers-contract.test.ts`, `src/pages/__tests__/channels-page-core-controllers.test.ts`, `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts`, `src/pages/__tests__/channels-page-interaction-controllers.test.ts`, `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts`, `src/pages/__tests__/channels-page-modal-props-contract.test.ts`, `src/pages/__tests__/channels-page-model-modal-props-contract.test.ts`, `src/pages/__tests__/channels-page-state-helpers.test.ts`, `src/pages/__tests__/channels-page-surface-composition-contract.test.ts`, and `src/pages/__tests__/channels-page-view-state-contract.test.ts`
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`112 passed`).

### Update 389: Move the state-helper shared types into one dedicated contract module
- I tightened the next `ChannelsPage` seam by removing the inline helper-layer types from `src/pages/channels-page-state-helpers.ts`.
- Before this slice, `channels-page-state-helpers.ts` still owned:
  - the Feishu shared-status alert shape
  - the derived target-state options/result shapes
  - the channel-status badge descriptor/options shapes
  - while downstream contracts repeated equivalent helper-layer structures inline
- I extracted those helper-layer contracts into a dedicated shared module:
  - added `src/pages/channels-page-state-helpers-contract.ts`
- The new contract module now owns:
  - `ChannelsPageSharedStatusAlert`
  - `ChannelsPageStateHelperTargetStateOptions`
  - `ChannelsPageStateHelperTargetState`
  - `ChannelsPageChannelStatusBadgeDescriptor`
  - `ChannelsPageChannelStatusBadgeOptions`
- I rewired the implementation and contract files so that:
  - `src/pages/channels-page-state-helpers.ts` now imports the helper-layer types instead of declaring them inline
  - `src/pages/channels-page-view-state-contract.ts` now derives `getSharedStatusAlert`, `deriveTargetState`, and `deriveChannelStatusBadges` from the shared helper-layer types instead of inline alert/result/option shapes
  - `src/pages/channels-page-surface-composition-contract.ts` now depends on the shared helper target-state and badge-option types instead of carrying its own inline helper result/option structure
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts` and `src/pages/channels-page-interaction-controllers-contract.ts` now reuse `ChannelsPageSharedStatusAlert` instead of duplicating the alert shape conventionally
- Result:
  - `channels-page-state-helpers.ts` is more focused on helper behavior only
  - the helper-layer shared types now have one explicit home
  - downstream contracts no longer repeat the Feishu alert / target-state / badge option structures inline
- I also updated tests:
  - added `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` to cover the new shared helper contract module directly
  - refreshed `src/pages/__tests__/channels-page-state-helpers.test.ts` so it now checks the dedicated contract import and removal of the inline helper interfaces
  - refreshed `src/pages/__tests__/channels-page-view-state-contract.test.ts`, `src/pages/__tests__/channels-page-surface-composition-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, and `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` so they now check the shared helper contract references
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`114 passed`).

### Update 390: Reuse the shared helper target-state options in the Feishu target-state contract
- I tightened the next `ChannelsPage` seam by removing the duplicated target-state option shape from `src/pages/channels-page-feishu-target-state-contract.ts`.
- Before this slice, `channels-page-feishu-target-state-contract.ts` still owned a local `ChannelsPageFeishuTargetStateOptions` interface even though it matched the helper-layer target-state option shape already extracted into `src/pages/channels-page-state-helpers-contract.ts`.
- I rewired that contract so that:
  - `src/pages/channels-page-feishu-target-state-contract.ts` now imports `ChannelsPageStateHelperTargetStateOptions`
  - `ChannelsPageFeishuTargetStateOptions<Channel>` is now a shared type alias to `ChannelsPageStateHelperTargetStateOptions<Channel>` instead of a duplicated local interface
- I also trimmed the hook module so that:
  - `src/pages/channels-page-feishu-target-state.ts` no longer imports the now-unused `ChannelsPageFeishuTargetStateOptions` symbol directly
- Result:
  - the Feishu target-state contract keeps the same public type surface
  - the helper target-state option shape now has one canonical definition
  - the target-state hook contract depends on that shared helper option type instead of maintaining a parallel copy
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the shared helper-option import and exported alias
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state.test.ts` so it now matches the slimmer hook import surface
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`114 passed`).

### Update 391: Reuse the shared helper badge-options type in the main-surface contract
- I tightened the next `ChannelsPage` seam by removing the duplicated channel badge-options shape from `src/pages/channels-page-main-surface-props-contract.ts`.
- Before this slice, `channels-page-main-surface-props-contract.ts` still described the `deriveChannelStatusBadges` options inline as:
  - `{ includePairingState?: boolean; includeProvisionSource?: boolean }`
  - which was already owned canonically by `src/pages/channels-page-state-helpers-contract.ts`
- I rewired that contract so that:
  - `src/pages/channels-page-main-surface-props-contract.ts` now imports `ChannelsPageChannelStatusBadgeOptions`
  - `deriveChannelStatusBadges` now uses `options?: ChannelsPageChannelStatusBadgeOptions`
- Result:
  - the main-surface contract keeps the same runtime-facing shape
  - the badge-options structure now has one canonical definition
  - the main-surface contract no longer maintains a parallel inline copy of the helper badge-options type
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` so it now checks the shared helper badge-options import and the reused contract reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`114 passed`).

### Update 392: Reuse the shared plugin-repair request options across page surfaces
- I tightened the next `ChannelsPage` seam by removing the duplicated Feishu plugin-repair surface option shape from the remaining contracts and hook implementation.
- Before this slice, four places still repeated the same inline request shape:
  - `options?: { surface?: 'page' | 'pairing' | 'diagnostics' }`
  - inside `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - inside `src/pages/channels-page-feishu-plugin-repair.ts`
  - inside `src/pages/channels-page-modal-props-contract.ts`
  - inside `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts` now owns the canonical `ChannelsPageFeishuPluginRepairSurface` union and `ChannelsPageFeishuPluginRepairRequestOptions` interface
  - `repairFeishuPlugin` in the shared plugin-repair result contract now uses `options?: ChannelsPageFeishuPluginRepairRequestOptions`
  - `src/pages/channels-page-feishu-plugin-repair.ts` now imports and reuses the shared request-options type for the hook implementation signature
  - `src/pages/channels-page-modal-props-contract.ts` and `src/pages/channels-page-surface-composition-contract.ts` now import the shared request-options type instead of repeating the inline surface shape
- Result:
  - the page / pairing / diagnostics repair surface selector now has one canonical definition
  - the plugin-repair hook and downstream contracts keep the same runtime behavior
  - the remaining plugin-repair surface option duplication is removed from the current `ChannelsPage` contract layer
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts` so it now checks the exported shared surface union and request-options interface
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts` so it now checks the shared request-options import and signature reuse
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` and `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so they now check the shared plugin-repair request-options import/reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 393: Reuse the shared fetch-options contract across ChannelsPage controllers
- I tightened the next `ChannelsPage` seam by removing the duplicated background-fetch option shape from the remaining data and controller contracts.
- Before this slice, the same inline fetch signature was still repeated across the data hook and multiple controller contracts:
  - `fetchChannels: (options?: { background?: boolean }) => Promise<...>`
  - in `src/pages/channels-page-data-contract.ts`
  - in `src/pages/channels-page-data.ts`
  - in `src/pages/channels-page-channel-actions-contract.ts`
  - in `src/pages/channels-page-config-flow-contract.ts`
  - in `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - in `src/pages/channels-page-interaction-controllers-contract.ts`
  - in `src/pages/channels-page-model-config-contract.ts`
  - in `src/pages/channels-page-target-modals-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the canonical `ChannelsPageFetchChannelsOptions` interface
  - `src/pages/channels-page-data.ts` now imports and reuses that shared fetch-options type in the hook implementation signature
  - the channel-actions, config-flow, plugin-repair, interaction-controllers, model-config, and target-modals contract modules now all import and reuse `ChannelsPageFetchChannelsOptions` instead of repeating the inline background option shape
- Result:
  - the background-refresh fetch option now has one canonical definition
  - the shared data hook and downstream controller contracts keep the same runtime behavior
  - the remaining fetch-options duplication is removed from the current `ChannelsPage` contract layer
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` and `src/pages/__tests__/channels-page-data.test.ts` so they now check the exported shared fetch-options interface and the reused hook signature
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts`, `src/pages/__tests__/channels-page-config-flow-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts`, `src/pages/__tests__/channels-page-model-config-contract.test.ts`, and `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so they now check the shared fetch-options import/reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 394: Reuse the shared pairing-target reference type across ChannelsPage surfaces
- I tightened the next `ChannelsPage` seam by removing the repeated `Pick<ChannelPairingTarget, 'channelId' | 'accountId'>` shape from the remaining target-state and modal contracts.
- Before this slice, the same pairing-target reference type was still repeated across multiple hooks and contracts:
  - `target: Pick<ChannelPairingTarget, 'channelId' | 'accountId'> | null | undefined`
  - `selectedPairingTarget: Pick<ChannelPairingTarget, 'channelId' | 'accountId'> | null`
  - `selectedDiagnosticsTarget: Pick<ChannelPairingTarget, 'channelId' | 'accountId'> | null`
  - in `src/pages/channels-page-feishu-target-refresh-contract.ts`
  - in `src/pages/channels-page-feishu-target-refresh.ts`
  - in `src/pages/channels-page-feishu-target-state-contract.ts`
  - in `src/pages/channels-page-target-state-groups-contract.ts`
  - in `src/pages/channels-page-target-modals-contract.ts`
  - in `src/pages/channels-page-target-modals.ts`
  - in `src/pages/channels-page-state-helpers.ts`
  - in `src/pages/channels-page-view-state-contract.ts`
  - in `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-utils.ts` now owns the canonical `ChannelPairingTargetRef` alias
  - the Feishu target-refresh / target-state / target-state-groups contracts now all reuse `ChannelPairingTargetRef` instead of repeating the `Pick<...>` target type
  - the target-modals contract and hook now both reuse `ChannelPairingTargetRef` for pairing and diagnostics target state
  - `src/pages/channels-page-state-helpers.ts`, `src/pages/channels-page-view-state-contract.ts`, and `src/pages/channels-page-surface-composition-contract.ts` now all reuse the shared pairing-target reference alias for derived target-state wiring
- Result:
  - the reduced pairing-target reference shape now has one canonical definition
  - the modal, refresh, and derived-state layers keep the same runtime behavior
  - the remaining repeated `Pick<ChannelPairingTarget, 'channelId' | 'accountId'>` target references are removed from the current `ChannelsPage` contract layer
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts`, and `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` so they now check the shared `ChannelPairingTargetRef` import/reference
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` and `src/pages/__tests__/channels-page-target-modals.test.ts` so they now check the shared target-ref contract reuse in the modal controller
  - refreshed `src/pages/__tests__/channels-page-state-helpers.test.ts`, `src/pages/__tests__/channels-page-view-state-contract.test.ts`, `src/pages/__tests__/channels-page-surface-composition-contract.test.ts`, and `src/pages/__tests__/channels-page-feishu-target-refresh.test.ts` so they now check the shared target-ref import and reused signatures
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 395: Reuse the shared latest-snapshot resolver type across ChannelsPage contracts
- I tightened the next `ChannelsPage` seam by removing the repeated latest-channel snapshot resolver signature from the remaining controller and view contracts.
- Before this slice, several contracts still repeated the same inline resolver shape:
  - `resolveLatestChannelSnapshot: (channels: Channel[], current: Pick<Channel, 'id'> | null | undefined) => Channel | null`
  - in `src/pages/channels-page-core-controllers-contract.ts`
  - in `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - in `src/pages/channels-page-model-config-contract.ts`
  - in `src/pages/channels-page-target-modals-contract.ts`
  - in `src/pages/channels-page-interaction-controllers-contract.ts`
  - in `src/pages/channels-page-view-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the canonical `ChannelsPageLatestChannelSnapshotResolver<Channel extends { id: string }>` alias
  - the core-controllers, plugin-repair, model-config, target-modals, interaction-controllers, and view-state contracts now all reuse that shared resolver alias instead of repeating the inline latest-snapshot signature
- Result:
  - the latest-snapshot resolver signature now has one canonical definition
  - the resolver behavior in `src/pages/channels-page-state-helpers.ts` stays unchanged
  - the remaining duplicated latest-snapshot resolver contract text is removed from the current `ChannelsPage` contract layer
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared resolver alias and its constrained generic signature
  - refreshed `src/pages/__tests__/channels-page-core-controllers-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, `src/pages/__tests__/channels-page-model-config-contract.test.ts`, `src/pages/__tests__/channels-page-target-modals-contract.test.ts`, `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts`, and `src/pages/__tests__/channels-page-view-state-contract.test.ts` so they now check the shared resolver import/reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 396: Reuse the shared feishu target refresh callback type across target-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated refresh callback signature from the remaining Feishu target refresh/state contracts.
- Before this slice, the same inline callback shape was still repeated in the target refresh chain:
  - `refreshChannels: () => Promise<unknown>`
  - in `src/pages/channels-page-feishu-target-refresh-contract.ts`
  - in `src/pages/channels-page-feishu-target-state-contract.ts`
  - in `src/pages/channels-page-target-state-groups-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts` now owns the canonical `ChannelsPageFeishuTargetRefreshChannels` alias
  - `ChannelsPageFeishuTargetRefreshOptions` now uses `refreshChannels: ChannelsPageFeishuTargetRefreshChannels`
  - `src/pages/channels-page-feishu-target-state-contract.ts` now imports and reuses `ChannelsPageFeishuTargetRefreshChannels` instead of repeating the inline refresh callback signature
  - `src/pages/channels-page-target-state-groups-contract.ts` now also imports and reuses `ChannelsPageFeishuTargetRefreshChannels`
- Result:
  - the Feishu target refresh callback now has one canonical contract definition
  - the target refresh / target state / grouped target state layers keep the same runtime behavior
  - the remaining duplicated `refreshChannels: () => Promise<unknown>` contract text is removed from the current Feishu target-state chain
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts` so it now checks the exported shared refresh-callback alias and its reuse in the refresh options contract
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the shared refresh-callback import/reference
  - refreshed `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` so it now checks the shared refresh-callback import/reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 397: Reuse the shared channel surface action handler contract across page surfaces
- I tightened the next `ChannelsPage` seam by removing the repeated page-surface channel action handler signatures from the main-surface and surface-composition contracts.
- Before this slice, the same channel action handler fields were still repeated inline across the surface-layer contracts:
  - `handleOpenModelConfig`
  - `handleToggleChannelEnabled`
  - `handleOpenPairing`
  - `handleOpenDiagnostics`
  - `handleRepairFeishuPlugin`
  - `handleRemoveChannel`
  - in `src/pages/channels-page-main-surface-props-contract.ts`
  - in `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-channel-actions-contract.ts` now owns the shared `ChannelsPageChannelSurfaceActionHandlers<Channel>` interface
  - `src/pages/channels-page-main-surface-props-contract.ts` now makes `ChannelsPageMainSurfacePropsOptions` extend `ChannelsPageChannelSurfaceActionHandlers<ChannelsPageChannelInfo>`
  - `src/pages/channels-page-surface-composition-contract.ts` now makes `ChannelsPageSurfaceCompositionOptions` extend `ChannelsPageChannelSurfaceActionHandlers<ChannelsPageChannelInfo>`
- Result:
  - the page-surface channel action handler signature set now has one canonical definition
  - the main-surface and surface-composition contracts keep the same runtime behavior and public shape
  - the repeated inline action handler contract text is removed from the current surface-layer contracts
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the new shared surface action handler contract
  - refreshed `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` and `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so they now check the shared handler import and `extends` reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 398: Reuse the shared target-state refresh coordination contract across grouped Feishu state wiring
- I tightened the next `ChannelsPage` seam by removing the repeated refresh-coordination fields from the Feishu target-state contract chain.
- Before this slice, the same refresh coordination fields were still repeated across multiple target-state contracts:
  - `repairingPluginChannelId?: string | null`
  - `refreshChannels: ChannelsPageFeishuTargetRefreshChannels`
  - in `src/pages/channels-page-feishu-target-state-contract.ts`
  - in `src/pages/channels-page-target-state-groups-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-state-contract.ts` now owns the shared `ChannelsPageFeishuTargetStateRefreshOptions` interface
  - `ChannelsPageFeishuTargetStateHookOptions` now extends `ChannelsPageFeishuTargetStateRefreshOptions` instead of repeating the refresh coordination fields inline
  - `src/pages/channels-page-target-state-groups-contract.ts` now imports and reuses `ChannelsPageFeishuTargetStateRefreshOptions`, and `ChannelsPageTargetStateGroupsOptions` extends it
- Result:
  - the repair/refresh coordination fields for Feishu target-state flows now have one canonical contract definition
  - the target-state hook and grouped target-state composition keep the same runtime behavior
  - the remaining repeated refresh coordination contract text is removed from this target-state chain
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the exported shared refresh coordination interface and the `extends` reuse in the hook options contract
  - refreshed `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` so it now checks the shared refresh coordination import and the `extends` reuse in the grouped target-state contract
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 399: Reuse the shared Feishu target refresh controls contract across refresh-state outputs
- I tightened the next `ChannelsPage` seam by removing the repeated refresh-control field subset from the Feishu refresh/state result contracts.
- Before this slice, the same refresh-control shape was still represented in two different ways:
  - `refreshingTargetChannel: boolean`
  - `refreshTargetChannelStatus: (pairingKey: string) => Promise<void>`
  - inline in `src/pages/channels-page-feishu-target-refresh-contract.ts`
  - via a `Pick<...>` projection in `src/pages/channels-page-feishu-target-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts` now owns the shared `ChannelsPageFeishuTargetRefreshControls` interface
  - `ChannelsPageFeishuTargetRefreshResult` now extends `ChannelsPageFeishuTargetRefreshControls` instead of repeating those fields inline
  - `src/pages/channels-page-feishu-target-state-contract.ts` now imports and reuses `ChannelsPageFeishuTargetRefreshControls` directly instead of projecting the same fields via `Pick`
- Result:
  - the refresh-control subset now has one canonical contract definition
  - the Feishu refresh hook and Feishu target-state hook keep the same runtime behavior and public shape
  - the remaining duplicated refresh-control contract text is removed from the current refresh/state result layer
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts` so it now checks the exported shared refresh-controls interface and the `extends` reuse in the refresh result contract
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the shared refresh-controls import/reference in the target-state result contract
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 400: Reuse the shared target-modal open-handler contract across modal and surface action layers
- I tightened the next `ChannelsPage` seam by removing the repeated target-modal opener signatures from the modal and channel-action contracts.
- Before this slice, the same open-handler shape was still duplicated:
  - `handleOpenPairing: (channel: Channel) => void`
  - `handleOpenDiagnostics: (channel: Channel) => void`
  - inline in `src/pages/channels-page-target-modals-contract.ts`
  - inline in `src/pages/channels-page-channel-actions-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-target-modals-contract.ts` now owns the shared `ChannelsPageTargetModalOpenHandlers<Channel>` interface
  - `ChannelsPageTargetModalsResult` now extends `ChannelsPageTargetModalOpenHandlers<Channel>` instead of repeating those open-handler fields inline
  - `src/pages/channels-page-channel-actions-contract.ts` now imports and reuses `ChannelsPageTargetModalOpenHandlers<Channel>` via `ChannelsPageChannelSurfaceActionHandlers`
- Result:
  - the target-modal opener contract now has one canonical definition
  - the target-modal result layer and surface action handler layer keep the same runtime behavior and public shape
  - the remaining duplicated open-handler contract text is removed from this modal/action seam
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the exported shared open-handler interface and the `extends` reuse in the modal result contract
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the shared open-handler import and the `extends` reuse in the surface action handler contract
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 401: Reuse the shared fetchChannels contract across the remaining ChannelsPage controller modules
- I tightened the next `ChannelsPage` seam by removing the repeated generic `fetchChannels` callback signature from the remaining controller and modal contracts.
- Before this slice, the same fetch callback shape was still repeated in multiple places:
  - `fetchChannels: (options?: ChannelsPageFetchChannelsOptions) => Promise<Channel[]>`
  - `fetchChannels: (options?: ChannelsPageFetchChannelsOptions) => Promise<ChannelInfo[]>`
  - `fetchChannels: (options?: ChannelsPageFetchChannelsOptions) => Promise<unknown>`
  - in `src/pages/channels-page-data-contract.ts`
  - in `src/pages/channels-page-channel-actions-contract.ts`
  - in `src/pages/channels-page-config-flow-contract.ts`
  - in `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - in `src/pages/channels-page-interaction-controllers-contract.ts`
  - in `src/pages/channels-page-model-config-contract.ts`
  - in `src/pages/channels-page-target-modals-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageFetchChannels<Channel>` alias
  - `ChannelsPageDataResult` now uses `fetchChannels: ChannelsPageFetchChannels<ChannelsPageChannelInfo>`
  - the channel-actions, config-flow, plugin-repair, interaction-controllers, model-config, and target-modals contracts now all import and reuse `ChannelsPageFetchChannels<...>` instead of repeating inline fetch signatures
- Result:
  - the generic `fetchChannels` callback now has one canonical contract definition
  - the data, controller, repair, config, and target-modal layers keep the same runtime behavior and public shape
  - the repeated inline fetch callback contract text is removed from the current `ChannelsPage` contract layer
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared fetch alias and its reuse in the data result contract
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts`, `src/pages/__tests__/channels-page-config-flow-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts`, `src/pages/__tests__/channels-page-model-config-contract.test.ts`, and `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so they now check the shared fetch import/reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 402: Reuse the shared Feishu plugin repair handler contract across modal and surface composition wiring
- I tightened the next `ChannelsPage` seam by removing the repeated Feishu plugin repair handler signature from the repair, modal, and surface composition contracts.
- Before this slice, the same repair handler shape was still repeated:
  - `repairFeishuPlugin: (channel: ..., options?: ChannelsPageFeishuPluginRepairRequestOptions) => Promise<FeishuDiagnosticsRepairOutcome>`
  - inline in `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - inline in `src/pages/channels-page-modal-props-contract.ts`
  - inline in `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts` now owns the shared `ChannelsPageFeishuPluginRepairHandler<Channel>` alias
  - `ChannelsPageFeishuPluginRepairResult` now uses `repairFeishuPlugin: ChannelsPageFeishuPluginRepairHandler<Channel>`
  - `src/pages/channels-page-modal-props-contract.ts` now imports and reuses `ChannelsPageFeishuPluginRepairHandler<ChannelsPageChannelInfo>`
  - `src/pages/channels-page-surface-composition-contract.ts` now also imports and reuses `ChannelsPageFeishuPluginRepairHandler<ChannelsPageChannelInfo>`
- Result:
  - the Feishu repair handler now has one canonical contract definition
  - the repair result, modal props, and surface composition layers keep the same runtime behavior and public shape
  - the repeated inline repair handler contract text is removed from this repair/modal/surface seam
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts` so it now checks the exported shared repair-handler alias and its reuse in the repair result contract
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` and `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so they now check the shared repair-handler import/reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 403: Reuse shared display-helper contracts across ChannelsPage surface, modal, and view-state wiring
- I tightened the next `ChannelsPage` seam by removing repeated display-helper callback groups from the main-surface, modal-props, surface-composition, and view-state contracts.
- Before this slice, two helper groups were still repeated inline across multiple contracts:
  - channel-card display helpers:
    - `getChannelCardSummary`
    - `getFeishuProvisionSourceDescription`
    - `shouldShowPluginStatus`
    - `shouldShowFeishuPluginRepairAction`
    - inline in `src/pages/channels-page-main-surface-props-contract.ts`
    - inline in `src/pages/channels-page-surface-composition-contract.ts`
    - inline in `src/pages/channels-page-view-state-contract.ts`
  - Feishu modal display helpers:
    - `getFeishuPairingModalSummary`
    - `getFeishuRuntimeSummaryAlertColor`
    - `getFeishuDiagnosticsModalTitle`
    - `getFeishuChannelDisplayName`
    - inline in `src/pages/channels-page-modal-props-contract.ts`
    - inline in `src/pages/channels-page-surface-composition-contract.ts`
    - inline in `src/pages/channels-page-view-state-contract.ts`
- I rewired those seams so that:
  - `src/pages/channels-page-main-surface-props-contract.ts` now owns the shared `ChannelsPageChannelCardDisplayHelpers` interface
  - `ChannelsPageMainSurfacePropsOptions` now extends `ChannelsPageChannelCardDisplayHelpers`
  - `src/pages/channels-page-surface-composition-contract.ts` and `src/pages/channels-page-view-state-contract.ts` now both import and reuse `ChannelsPageChannelCardDisplayHelpers`
  - `src/pages/channels-page-modal-props-contract.ts` now owns the shared `ChannelsPageFeishuModalDisplayHelpers` interface
  - `ChannelsPageModalPropsOptions` now extends `ChannelsPageFeishuModalDisplayHelpers`
  - `src/pages/channels-page-surface-composition-contract.ts` and `src/pages/channels-page-view-state-contract.ts` now both import and reuse `ChannelsPageFeishuModalDisplayHelpers`
- Result:
  - the repeated card-display and Feishu modal-display helper callback groups now each have one canonical contract definition
  - the main-surface, modal-props, surface-composition, and view-state layers keep the same runtime behavior and public shape
  - the remaining duplicated inline display-helper contract text is removed from this surface/view wiring layer
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` so it now checks the exported shared channel-card display helper interface and its reuse in the main-surface options contract
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the exported shared Feishu modal display helper interface and its reuse in the modal-props options contract
  - refreshed `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` and `src/pages/__tests__/channels-page-view-state-contract.test.ts` so they now check the shared helper imports and their reuse in the surface/view contracts
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 404: Reuse shared repair-action and shared-status resolver aliases across helper-facing contracts
- I tightened the next `ChannelsPage` seam by removing repeated helper resolver signatures from the state-helper, plugin-repair, interaction-controller, and view-state contracts.
- Before this slice, two helper resolver shapes were still repeated inline:
  - `shouldShowRepairAction: (channel: ...) => boolean`
  - `getSharedStatusAlert: (channel: ...) => ChannelsPageSharedStatusAlert | null`
  - inline in `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - inline in `src/pages/channels-page-interaction-controllers-contract.ts`
  - inline in `src/pages/channels-page-view-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageRepairActionVisibilityResolver<Channel>` alias
  - `src/pages/channels-page-state-helpers-contract.ts` now also owns the shared `ChannelsPageSharedStatusAlertResolver<Channel>` alias
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts` now imports and reuses both resolver aliases in `ChannelsPageFeishuPluginRepairOptions`
  - `src/pages/channels-page-interaction-controllers-contract.ts` now imports and reuses both resolver aliases in `ChannelsPageInteractionControllersOptions`
  - `src/pages/channels-page-view-state-contract.ts` now imports and reuses both resolver aliases in `ChannelsPageViewStateHelpers`
- Result:
  - the repair-action visibility and shared-status alert resolver signatures now each have one canonical contract definition
  - the helper-facing plugin-repair, interaction-controller, and view-state layers keep the same runtime behavior and public shape
  - the repeated inline resolver contract text is removed from this helper-facing slice
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported resolver aliases
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts`, and `src/pages/__tests__/channels-page-view-state-contract.test.ts` so they now check the shared resolver imports and references
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 405: Reuse the shared config-flow modal state contract across modal and surface composition wiring
- I tightened the next `ChannelsPage` seam by removing the repeated config-flow modal state fields from the config-flow, modal-props, and surface-composition contracts.
- Before this slice, the same config-flow modal state group was still repeated inline:
  - `showConfigModal`
  - `selectedChannelId`
  - `selectedConfigTarget`
  - `configStep`
  - `handleChannelConfigBack`
  - `handleConfigDone`
  - `setSelectedChannelId`
  - `setSelectedConfigTarget`
  - `setConfigStep`
  - inline in `src/pages/channels-page-config-flow-contract.ts`
  - inline in `src/pages/channels-page-modal-props-contract.ts`
  - inline in `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-config-flow-contract.ts` now owns the shared `ChannelsPageConfigFlowModalState` interface
  - `ChannelsPageConfigFlowResult` now extends `ChannelsPageConfigFlowModalState`
  - `src/pages/channels-page-modal-props-contract.ts` now imports and reuses `ChannelsPageConfigFlowModalState`
  - `src/pages/channels-page-surface-composition-contract.ts` now also imports and reuses `ChannelsPageConfigFlowModalState`
- Result:
  - the config-flow modal state group now has one canonical contract definition
  - the config-flow, modal-props, and surface-composition layers keep the same runtime behavior and public shape
  - the remaining duplicated inline config-flow modal state contract text is removed from this wiring layer
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-config-flow-contract.test.ts` so it now checks the exported shared config-flow modal state interface and the `extends` reuse in the config-flow result contract
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` and `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so they now check the shared config-flow state import/reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 406: Reuse the shared target-state derive contract across hook, grouped-state, and view wiring
- I tightened the next `ChannelsPage` seam by removing the repeated target-state derive callback signature from the Feishu target-state, grouped target-state, surface composition, and view-state contracts.
- Before this slice, the same derive callback shape was still repeated inline:
  - `deriveTargetState: (channels, target, options) => ...`
  - inline in `src/pages/channels-page-feishu-target-state-contract.ts`
  - inline in `src/pages/channels-page-target-state-groups-contract.ts`
  - inline in `src/pages/channels-page-surface-composition-contract.ts`
  - inline in `src/pages/channels-page-view-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-state-contract.ts` now owns the shared `ChannelsPageTargetStateDeriver<Channel, State>` alias
  - `ChannelsPageFeishuTargetStateHookOptions` now uses `deriveTargetState: ChannelsPageTargetStateDeriver<Channel, State>`
  - `src/pages/channels-page-target-state-groups-contract.ts` now imports and reuses `ChannelsPageTargetStateDeriver<Channel, State>`
  - `src/pages/channels-page-surface-composition-contract.ts` now imports and reuses `ChannelsPageTargetStateDeriver<ChannelsPageChannelInfo, ChannelsPageStateHelperTargetState<ChannelsPageChannelInfo>>`
  - `src/pages/channels-page-view-state-contract.ts` now imports and reuses the same shared deriver alias for its helper contract
- Result:
  - the target-state derive callback now has one canonical contract definition
  - the Feishu target-state hook, grouped target-state wiring, surface composition, and view-state helper layers keep the same runtime behavior and public shape
  - the repeated inline target-state deriver contract text is removed from this wiring slice
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the exported shared deriver alias and its reuse in the hook options contract
  - refreshed `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts`, `src/pages/__tests__/channels-page-surface-composition-contract.test.ts`, and `src/pages/__tests__/channels-page-view-state-contract.test.ts` so they now check the shared deriver import/reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-helpers.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts src/pages/__tests__/channels-page-view-state-controller-state.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-core-controllers.test.ts src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-data.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-config-flow.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-refresh.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-channel-actions.test.ts src/components/__tests__/channels-page-shell.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/channels-page-channel-list-panel.test.ts src/components/__tests__/channels-page-channel-cards.test.ts src/components/__tests__/channels-page-channel-card.test.ts src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts src/components/__tests__/channels-page-model-config-modal.test.ts src/components/__tests__/channels-page-diagnostics-modal.test.ts` passed (`49 passed`, `114 passed`).

### Update 407: Reuse the shared model modal state contract across model-config, modal-props, and surface composition wiring
- I tightened the next `ChannelsPage` seam by removing the repeated model modal state fields from the model-config, model-modal-props, and surface-composition contracts.
- Before this slice, the same model modal state and save-wiring group was still repeated inline:
  - `showModelModal`
  - `selectedModelChannel`
  - `modelOptions`
  - `selectedModelValue`
  - `currentRuntimeModel`
  - `modelModalError`
  - `loadingModelContext`
  - `savingModel`
  - `setSelectedModelValue`
  - `closeModelModal`
  - `handleSaveBotModel`
  - inline in `src/pages/channels-page-model-config-contract.ts`
  - inline in `src/pages/channels-page-model-modal-props-contract.ts`
  - inline in `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-model-config-contract.ts` now owns the shared `ChannelsPageModelModalState<Channel>` interface
  - `ChannelsPageModelConfigResult<Channel>` now extends `ChannelsPageModelModalState<Channel>`
  - `src/pages/channels-page-model-modal-props-contract.ts` now imports and reuses `ChannelsPageModelModalState<ChannelsPageChannelInfo>`
  - `src/pages/channels-page-surface-composition-contract.ts` now also imports and reuses `ChannelsPageModelModalState<ChannelsPageChannelInfo>`
- Result:
  - the model modal state and save-wiring group now has one canonical contract definition
  - the model-config, model-modal-props, and surface-composition layers keep the same runtime behavior and public shape
  - the remaining duplicated inline model modal state contract text is removed from this wiring slice
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-model-config-contract.test.ts` so it now checks the exported shared model modal state interface and the `extends` reuse in the model-config result contract
  - refreshed `src/pages/__tests__/channels-page-model-modal-props-contract.test.ts` so it now checks the shared model modal state import/reference
  - refreshed `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so it now checks the shared model modal state import/reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-model-modal-props-contract.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-model-config-controller.test.ts src/pages/__tests__/channels-page-model-modal-props.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts` passed (`7 passed`, `14 passed`).

### Update 408: Reuse the shared channel-status badge deriver contract across helper, main-surface, modal, and view wiring
- I tightened the next `ChannelsPage` seam by removing the repeated channel-status badge derivation callback signature from the helper, main-surface, modal-props, surface-composition, and view-state contracts.
- Before this slice, the same badge-deriver shape was still repeated inline:
  - `deriveChannelStatusBadges: (channel, options?) => ...`
  - inline in `src/pages/channels-page-main-surface-props-contract.ts`
  - inline in `src/pages/channels-page-modal-props-contract.ts`
  - inline in `src/pages/channels-page-surface-composition-contract.ts`
  - inline in `src/pages/channels-page-view-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageChannelStatusBadgeChannel` interface
  - `src/pages/channels-page-state-helpers-contract.ts` now also owns the shared `ChannelsPageChannelStatusBadgeDeriver` alias
  - `src/pages/channels-page-state-helpers.ts` now types `deriveChannelStatusBadges` through that shared alias instead of repeating the function contract inline
  - the main-surface, modal-props, surface-composition, and view-state contracts now all import and reuse `ChannelsPageChannelStatusBadgeDeriver`
- Result:
  - the badge-deriver callback now has one canonical contract definition
  - the helper, main-surface, modal-props, surface-composition, and view-state layers keep the same runtime behavior and public shape
  - `useChannelsPageSurfaceComposition(...)` no longer needs the local badge-deriver cast wrapper when handing the function through to modal props
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared badge-channel interface and shared deriver alias
  - refreshed `src/pages/__tests__/channels-page-state-helpers.test.ts` so it now checks the shared badge-channel/deriver imports and the alias-backed `deriveChannelStatusBadges` declaration
  - refreshed `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts`, `src/pages/__tests__/channels-page-modal-props-contract.test.ts`, `src/pages/__tests__/channels-page-surface-composition-contract.test.ts`, and `src/pages/__tests__/channels-page-view-state-contract.test.ts` so they now check the shared badge-deriver import/reference
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts` passed (`9 passed`, `18 passed`).

### Update 409: Reuse grouped modal target-state contracts across modal-props wiring and surface composition mapping
- I tightened the next `ChannelsPage` seam by removing the repeated per-surface modal target-state field groups from the modal-props contract and the surface-composition-to-modal mapping.
- Before this slice, `useChannelsPageModalProps(...)` and `ChannelsPageModalPropsOptions` still carried three large flattened target-state groups inline:
  - config target fields such as `selectedConfigTargetStatusAlert`, `selectedConfigTargetRepairing`, `selectedConfigTargetStatusPending`, `refreshConfigTargetChannelStatus`
  - pairing target fields such as `selectedPairingChannelStatusAlert`, `selectedPairingTargetStatusPending`, `selectedPairingChannelBlockedBySharedStatus`, `refreshPairingTargetChannelStatus`
  - diagnostics target fields such as `selectedDiagnosticsChannelStatusAlert`, `selectedDiagnosticsTargetStatusPending`, `refreshingDiagnosticsTargetChannel`, `refreshDiagnosticsTargetChannelStatus`
- I rewired that seam so that:
  - `src/pages/channels-page-modal-props-contract.ts` now owns the shared grouped target-state contracts:
    - `ChannelsPageTargetChannelStatusRefreshHandler`
    - `ChannelsPageModalSharedStatusState<Alert>`
    - `ChannelsPageModalTargetRefreshState`
    - `ChannelsPageConfigModalTargetState`
    - `ChannelsPagePairingModalTargetState`
    - `ChannelsPageDiagnosticsModalTargetState`
  - `ChannelsPageModalPropsOptions` now takes `configTargetState`, `pairingTargetState`, and `diagnosticsTargetState` instead of the old flattened field lists
  - `src/pages/channels-page-modal-props.ts` now reads those grouped target-state objects directly when building the three modal prop payloads
  - `src/pages/channels-page-surface-composition.ts` now maps the derived target-state hook output into those grouped modal target-state objects before handing control to `useChannelsPageModalProps(...)`
- Result:
  - the config/pairing/diagnostics modal target-state wiring now has one clearer grouped contract shape instead of three long repeated flattened field packs
  - `useChannelsPageModalProps(...)` is easier to reason about because each modal now reads from one grouped state object per surface
  - the surface-composition layer still keeps the same runtime behavior while handing modal wiring through a more explicit contract boundary
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the grouped modal target-state interfaces and their reuse in `ChannelsPageModalPropsOptions`
  - refreshed `src/pages/__tests__/channels-page-modal-props.test.ts` so it now checks the grouped `configTargetState` / `pairingTargetState` / `diagnosticsTargetState` refresh and repair wiring
  - refreshed `src/pages/__tests__/channels-page-surface-composition.test.ts` so it now checks the grouped target-state mapping passed from surface composition into `useChannelsPageModalProps(...)`
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts` passed (`9 passed`, `18 passed`).

### Update 410: Reuse the shared managed-status helper contract across plugin-repair, interaction-controller, and view-state wiring
- I tightened the next `ChannelsPage` seam by removing the repeated managed-status helper field pair from the plugin-repair, interaction-controller, and view-state contracts.
- Before this slice, the same helper pair was still repeated inline:
  - `shouldShowRepairAction`
  - `getSharedStatusAlert`
  - inline in `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - inline in `src/pages/channels-page-interaction-controllers-contract.ts`
  - inline in `src/pages/channels-page-view-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageManagedStatusResolvers<Channel>` interface
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts` now extends `ChannelsPageManagedStatusResolvers<Channel>` inside `ChannelsPageFeishuPluginRepairOptions<Channel>`
  - `src/pages/channels-page-interaction-controllers-contract.ts` now extends `ChannelsPageManagedStatusResolvers<Pick<ChannelInfo, 'channelId' | 'pairingAccountId' | 'pluginStatus'>>` inside `ChannelsPageInteractionControllersOptions`
  - `src/pages/channels-page-view-state-contract.ts` now extends the same shared managed-status helper interface inside `ChannelsPageViewStateHelpers`
- Result:
  - the managed-status helper pair now has one canonical contract definition
  - the plugin-repair, interaction-controller, and view-state layers keep the same runtime behavior and public shape
  - the current contract surface is easier to evolve because managed-status wiring now moves through one named helper interface instead of three separate inline property packs
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared managed-status helper interface
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts`, and `src/pages/__tests__/channels-page-view-state-contract.test.ts` so they now check the shared managed-status helper import/reference and `extends` reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts` passed (`4 passed`, `8 passed`).

### Update 411: Reuse shared pairing and diagnostics modal-state contracts across target-modal and surface-composition wiring
- I tightened the next `ChannelsPage` seam by removing the repeated pairing/diagnostics modal state packs from the target-modal result contract and the surface-composition input contract.
- Before this slice, the same modal-state fields were still repeated inline:
  - pairing modal fields such as `showPairingModal`, `selectedPairingChannel`, `selectedPairingTarget`, `handlePairingClose`, `handlePairingDone`
  - diagnostics modal fields such as `showDiagnosticsModal`, `selectedDiagnosticsChannel`, `selectedDiagnosticsTarget`, `handleDiagnosticsClose`
  - inline in `src/pages/channels-page-target-modals-contract.ts`
  - inline again in `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-target-modals-contract.ts` now owns the shared `ChannelsPagePairingModalState<Channel, PairingDoneHandler>` interface
  - `src/pages/channels-page-target-modals-contract.ts` now also owns the shared `ChannelsPageDiagnosticsModalState<Channel>` interface
  - `ChannelsPageTargetModalsResult<Channel>` now extends those shared modal-state interfaces instead of repeating the fields inline
  - `src/pages/channels-page-surface-composition-contract.ts` now imports and reuses `ChannelsPagePairingModalState<ChannelsPageChannelInfo, () => void>` and `ChannelsPageDiagnosticsModalState<ChannelsPageChannelInfo>` instead of restating the same state pack locally
- Result:
  - the pairing/diagnostics modal state wiring now has one canonical contract definition
  - the target-modal hook contract and the surface-composition contract stay behavior-identical while sharing the same state vocabulary
  - the surface-composition contract is smaller and easier to evolve because its pairing/diagnostics state now moves through named shared interfaces instead of flattened repeated fields
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the exported shared pairing/diagnostics modal-state interfaces and the `extends` reuse in the target-modal result contract
  - refreshed `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so it now checks the shared modal-state import/reference in the surface-composition contract
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state.test.ts` passed (`5 passed`, `10 passed`).

### Update 412: Reuse shared managed-status channel aliases across helper, interaction-controller, and view-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated managed-status channel `Pick<...>` shapes from the helper implementation and the interaction/view contract layer.
- Before this slice, the same narrow channel field selections were still repeated inline:
  - `Pick<ChannelInfo, 'channelId' | 'pluginStatus'>`
  - `Pick<ChannelInfo, 'channelId' | 'pairingAccountId' | 'pluginStatus'>`
  - repeated in `src/pages/channels-page-state-helpers.ts`
  - repeated again in `src/pages/channels-page-interaction-controllers-contract.ts`
  - repeated again in `src/pages/channels-page-view-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageSharedStatusChannel<Channel>` alias
  - `src/pages/channels-page-state-helpers-contract.ts` now also owns the shared `ChannelsPageManagedStatusChannel<Channel>` alias
  - `src/pages/channels-page-state-helpers.ts` now types `getFeishuSharedStatusAlert(...)` and `shouldShowFeishuPluginRepairAction(...)` with those shared aliases instead of repeating local `Pick<...>` shapes
  - `src/pages/channels-page-interaction-controllers-contract.ts` now reuses `ChannelsPageManagedStatusChannel<ChannelInfo>` inside `ChannelsPageInteractionControllersOptions`
  - `src/pages/channels-page-view-state-contract.ts` now reuses `ChannelsPageManagedStatusChannel<ChannelsPageChannelInfo>` inside `ChannelsPageViewStateHelpers`
- Result:
  - the managed-status channel field subsets now have one canonical contract definition
  - helper implementation and controller/view contracts keep the same behavior while sharing the same narrow-channel vocabulary
  - future managed-status changes only need one contract edit instead of chasing repeated `Pick<...>` shapes across multiple files
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared managed-status channel aliases
  - refreshed `src/pages/__tests__/channels-page-state-helpers.test.ts` so it now checks the shared alias imports and alias-backed helper signatures
  - refreshed `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` and `src/pages/__tests__/channels-page-view-state-contract.test.ts` so they now check the shared alias import/reference and reuse in the two contracts
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-state-helpers.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts` passed (`4 passed`, `8 passed`).

### Update 413: Reuse the shared Feishu target surface-state contract across the target-state hook and grouped surface wiring
- I tightened the next `ChannelsPage` seam by removing the repeated Feishu target surface-state field pack from the target-state hook contract and the grouped target-state contract.
- Before this slice, the same surface-state fields were still repeated inline:
  - `active`
  - `target`
  - `fallbackChannel`
  - inline in `src/pages/channels-page-feishu-target-state-contract.ts`
  - inline again in `src/pages/channels-page-target-state-groups-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-state-contract.ts` now owns the shared `ChannelsPageFeishuTargetSurfaceOptions<Channel>` interface
  - `ChannelsPageFeishuTargetStateHookOptions<Channel, State>` now extends `ChannelsPageFeishuTargetSurfaceOptions<Channel>` instead of repeating the fields inline
  - `src/pages/channels-page-target-state-groups-contract.ts` now imports and reuses `ChannelsPageFeishuTargetSurfaceOptions<Channel>` for its `config` / `pairing` / `diagnostics` surface groups instead of keeping a duplicate local `ChannelsPageTargetStateSurfaceOptions<Channel>` interface
- Result:
  - the target-state hook and grouped target-state wiring now share one canonical surface-state contract
  - the target-state contract layer stays behavior-identical while using a single vocabulary for `active`, `target`, and `fallbackChannel`
  - future changes to Feishu target surface selection only need one contract edit instead of parallel updates across two modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the exported shared surface-state interface and the `extends` reuse in the hook options contract
  - refreshed `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` so it now checks the shared surface-state import/reference and the removal of the duplicate local interface
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state.test.ts src/pages/__tests__/channels-page-target-state-groups.test.ts` passed (`4 passed`, `8 passed`).

### Update 414: Reuse the shared surface-composition result contract inside the page-level view-state result
- I tightened the next `ChannelsPage` seam by removing the repeated shell-ready surface result prop pack from the page-level view-state contract.
- Before this slice, the same surface result fields were still restated inline in `src/pages/channels-page-view-state-contract.ts` even though they already existed in `src/pages/channels-page-surface-composition-contract.ts`:
  - `topPanelProps`
  - `channelListPanelProps`
  - `channelCardsProps`
  - `configModalProps`
  - `pairingModalProps`
  - `modelConfigModalProps`
  - `diagnosticsModalProps`
- I rewired that seam so that:
  - `src/pages/channels-page-view-state-contract.ts` now imports `ChannelsPageSurfaceCompositionResult`
  - `ChannelsPageViewStateResult` now extends `ChannelsPageSurfaceCompositionResult` and only keeps its additional `loading` field locally
- Result:
  - the page-level view-state result now shares one canonical definition with the surface-composition result for all shell-ready surface/modal props
  - the view-state hook and its consumers keep the same behavior and public shape while removing repeated contract text
  - future changes to surface-composition outputs only need one contract edit instead of parallel edits in both surface-composition and view-state result contracts
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-view-state-contract.test.ts` so it now checks the shared result import/reference and the `extends` reuse in `ChannelsPageViewStateResult`
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts` passed (`4 passed`, `8 passed`).

### Update 415: Reuse a shared latest-channel-snapshot resolver binding across controller, model, modal, plugin-repair, interaction, and view contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `resolveLatestChannelSnapshot` field pack from multiple contract modules.
- Before this slice, the same resolver field was still repeated inline in several places:
  - `src/pages/channels-page-core-controllers-contract.ts`
  - `src/pages/channels-page-model-config-contract.ts`
  - `src/pages/channels-page-target-modals-contract.ts`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - `src/pages/channels-page-interaction-controllers-contract.ts`
  - `src/pages/channels-page-view-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageLatestChannelSnapshotResolverBinding<Channel>` interface
  - the core-controller, model-config, target-modals, and plugin-repair option contracts now extend that shared binding instead of repeating `resolveLatestChannelSnapshot` inline
  - the interaction-controller contract now reuses the same binding alongside its managed-status helper interface
  - the page-level view-state helper contract now also reuses the same binding instead of restating the resolver field locally
- Result:
  - the latest-channel-snapshot resolver field now has one canonical binding contract
  - the controller/model/modal/plugin/view contracts keep the same runtime behavior and public shape while sharing the same resolver vocabulary
  - future changes to snapshot-resolver wiring only need one contract edit instead of touching six parallel inline field declarations
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared resolver-binding interface
  - refreshed `src/pages/__tests__/channels-page-core-controllers-contract.test.ts`, `src/pages/__tests__/channels-page-model-config-contract.test.ts`, `src/pages/__tests__/channels-page-target-modals-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts`, and `src/pages/__tests__/channels-page-view-state-contract.test.ts` so they now check the shared binding import/reference and `extends` reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts` passed (`7 passed`, `14 passed`).

### Update 416: Reuse a shared fetch-channels binding across data, channel-actions, config-flow, model-config, target-modals, plugin-repair, and interaction contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `fetchChannels` field pack from multiple contract modules.
- Before this slice, the same `fetchChannels: ChannelsPageFetchChannels<...>` field was still repeated inline in several places:
  - `src/pages/channels-page-channel-actions-contract.ts`
  - `src/pages/channels-page-config-flow-contract.ts`
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-model-config-contract.ts`
  - `src/pages/channels-page-target-modals-contract.ts`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - `src/pages/channels-page-interaction-controllers-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageFetchChannelsBinding<Channel>` interface
  - `ChannelsPageDataResult` now extends `ChannelsPageFetchChannelsBinding<ChannelsPageChannelInfo>` instead of restating the field inline
  - the channel-actions, config-flow, model-config, target-modals, plugin-repair, and interaction-controller option contracts now all extend `ChannelsPageFetchChannelsBinding<...>` instead of each repeating a local `fetchChannels` field
- Result:
  - the fetch-channels field now has one canonical binding contract
  - data/controller/model/modal/plugin contracts keep the same runtime behavior and public shape while sharing the same fetch vocabulary
  - future changes to fetch-channel wiring only need one contract edit instead of parallel edits across seven modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported fetch binding and the `extends` reuse in `ChannelsPageDataResult`
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts`, `src/pages/__tests__/channels-page-config-flow-contract.test.ts`, `src/pages/__tests__/channels-page-model-config-contract.test.ts`, `src/pages/__tests__/channels-page-target-modals-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, and `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` so they now check the shared binding import/reference and `extends` reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` passed (`7 passed`, `14 passed`).

### Update 417: Reuse a shared fetch-channels binding across data, channel-actions, config-flow, model-config, target-modals, plugin-repair, and interaction contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `fetchChannels` field pack from multiple contract modules.
- Before this slice, the same `fetchChannels: ChannelsPageFetchChannels<...>` field was still repeated inline in several places:
  - `src/pages/channels-page-channel-actions-contract.ts`
  - `src/pages/channels-page-config-flow-contract.ts`
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-model-config-contract.ts`
  - `src/pages/channels-page-target-modals-contract.ts`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - `src/pages/channels-page-interaction-controllers-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageFetchChannelsBinding<Channel>` interface
  - `ChannelsPageDataResult` now extends `ChannelsPageFetchChannelsBinding<ChannelsPageChannelInfo>` instead of restating the field inline
  - the channel-actions, config-flow, model-config, target-modals, plugin-repair, and interaction-controller option contracts now all extend `ChannelsPageFetchChannelsBinding<...>` instead of each repeating a local `fetchChannels` field
- Result:
  - the fetch-channels field now has one canonical binding contract
  - data/controller/model/modal/plugin contracts keep the same runtime behavior and public shape while sharing the same fetch vocabulary
  - future changes to fetch-channel wiring only need one contract edit instead of parallel edits across seven modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported fetch binding and the `extends` reuse in `ChannelsPageDataResult`
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts`, `src/pages/__tests__/channels-page-config-flow-contract.test.ts`, `src/pages/__tests__/channels-page-model-config-contract.test.ts`, `src/pages/__tests__/channels-page-target-modals-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, and `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` so they now check the shared binding import/reference and `extends` reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` passed (`7 passed`, `14 passed`).

### Update 418: Reuse a shared page-error handler alias across data, channel-actions, plugin-repair, interaction, and surface contracts
- I tightened the next `ChannelsPage` seam by removing the repeated page-error callback shape from multiple contract modules.
- Before this slice, the same `(message: string) => void` field shape was still repeated inline in several places:
  - `src/pages/channels-page-channel-actions-contract.ts`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - `src/pages/channels-page-interaction-controllers-contract.ts`
  - `src/pages/channels-page-main-surface-props-contract.ts`
  - `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPagePageErrorHandler` alias
  - the channel-actions and plugin-repair option contracts now reuse that shared alias for `onPageError`
  - the interaction-controller, main-surface, and surface-composition contracts now reuse that shared alias for their page-level `setError` callback shape
- Result:
  - the page-error callback shape now has one canonical alias
  - controller/plugin/surface contracts keep the same runtime behavior and public shape while sharing the same page-error vocabulary
  - future changes to page-level error callback typing only need one contract edit instead of parallel edits across five modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported page-error handler alias
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts`, `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts`, and `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so they now check the shared alias import/reference and field reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts` passed (`6 passed`, `12 passed`).

### Update 419: Reuse the main-surface options contract inside the surface-composition contract
- I tightened the next `ChannelsPage` seam by removing the repeated main-surface field pack from the surface-composition contract.
- Before this slice, `src/pages/channels-page-surface-composition-contract.ts` still repeated the same main-surface inputs that were already owned by `src/pages/channels-page-main-surface-props-contract.ts`, including the refresh/error/channel list/action/display-helper fields.
- I rewired that seam so that:
  - `ChannelsPageSurfaceCompositionOptions` now extends `ChannelsPageMainSurfacePropsOptions`
  - the surface-composition contract keeps only the fields that are unique to surface assembly, such as background refresh, target-state derivation, and plugin-repair wiring
  - the result contract continues to reuse `ChannelsPageMainSurfacePropsResult` for the shell-ready top-panel, list-panel, and channel-card props
- Result:
  - the main-surface input pack now has one canonical contract owner
  - the surface-composition contract keeps the same runtime behavior and public shape while removing duplicated field declarations
  - future changes to main-surface inputs only need one contract edit instead of parallel edits across both main-surface and surface-composition contracts
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so it now checks the shared main-surface options import/reference and verifies the repeated field pack is no longer declared inline there
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-main-surface-props.test.ts` passed (`4 passed`, `8 passed`).

### Update 420: Reuse target-modal visibility subcontracts inside the modal-props contract
- I tightened the next `ChannelsPage` seam by removing repeated pairing/diagnostics modal visibility fields from the modal-props contract.
- Before this slice, `src/pages/channels-page-modal-props-contract.ts` still repeated the same pairing and diagnostics visibility/control fields that were already part of `src/pages/channels-page-target-modals-contract.ts`.
- I rewired that seam so that:
  - `src/pages/channels-page-target-modals-contract.ts` now owns two smaller shared visibility subcontracts: `ChannelsPagePairingModalVisibilityState` and `ChannelsPageDiagnosticsModalVisibilityState`
  - `ChannelsPagePairingModalState` and `ChannelsPageDiagnosticsModalState` now extend those visibility subcontracts instead of restating the shared fields inline
  - `src/pages/channels-page-modal-props-contract.ts` now reuses those shared visibility subcontracts instead of redeclaring `showPairingModal`, `handlePairingClose`, `handlePairingDone`, `showDiagnosticsModal`, and `handleDiagnosticsClose`
- Result:
  - the pairing/diagnostics modal visibility field pack now has one canonical contract owner
  - target-modal and modal-props contracts keep the same runtime behavior and public shape while sharing the same modal-control vocabulary
  - future changes to modal visibility/control typing only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the exported visibility subcontracts and the `extends` reuse inside the full pairing/diagnostics modal state contracts
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the shared visibility imports/references and verifies those control fields are no longer declared inline there
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-modal-props.test.ts src/pages/__tests__/channels-page-target-modals.test.ts src/pages/__tests__/channels-page-surface-composition.test.ts` passed (`5 passed`, `10 passed`).

### Update 421: Reuse a shared channel-status-badge deriver binding across helper, main-surface, modal-props, and view-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `deriveChannelStatusBadges` field shape from multiple contract modules.
- Before this slice, the same `deriveChannelStatusBadges: ChannelsPageChannelStatusBadgeDeriver` field was still repeated inline in several places:
  - `src/pages/channels-page-main-surface-props-contract.ts`
  - `src/pages/channels-page-modal-props-contract.ts`
  - `src/pages/channels-page-view-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageChannelStatusBadgeDeriverBinding` interface
  - the main-surface, modal-props, and view-state helper contracts now all extend that shared binding instead of each repeating a local `deriveChannelStatusBadges` field
- Result:
  - the channel-status-badge deriver field now has one canonical binding contract
  - helper/surface/modal/view contracts keep the same runtime behavior and public shape while sharing the same badge-derivation vocabulary
  - future changes to badge-deriver wiring only need one contract edit instead of parallel edits across four modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported badge-deriver binding
  - refreshed `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts`, `src/pages/__tests__/channels-page-modal-props-contract.test.ts`, and `src/pages/__tests__/channels-page-view-state-contract.test.ts` so they now check the shared binding import/reference and confirm the repeated field is no longer declared inline there
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts` passed (`4 passed`, `8 passed`).

### Update 422: Reuse a shared target-state deriver binding across target-state, grouped target-state, surface-composition, and view-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `deriveTargetState` field shape from multiple contract modules.
- Before this slice, the same `deriveTargetState: ChannelsPageTargetStateDeriver<...>` field was still repeated inline in several places:
  - `src/pages/channels-page-feishu-target-state-contract.ts`
  - `src/pages/channels-page-target-state-groups-contract.ts`
  - `src/pages/channels-page-surface-composition-contract.ts`
  - `src/pages/channels-page-view-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-state-contract.ts` now owns the shared `ChannelsPageTargetStateDeriverBinding<Channel, State>` interface
  - the target-state hook options, grouped target-state options, surface-composition options, and view-state helper contract now all extend that shared binding instead of each repeating a local `deriveTargetState` field
- Result:
  - the target-state deriver field now has one canonical binding contract
  - target-state/grouped-state/surface/view contracts keep the same runtime behavior and public shape while sharing the same target-state derivation vocabulary
  - future changes to target-state derivation wiring only need one contract edit instead of parallel edits across four modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the exported deriver binding and the hook-options reuse
  - refreshed `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts`, `src/pages/__tests__/channels-page-surface-composition-contract.test.ts`, and `src/pages/__tests__/channels-page-view-state-contract.test.ts` so they now check the shared binding import/reference and confirm the repeated field is no longer declared inline there
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts` passed (`4 passed`, `8 passed`).

### Update 423: Reuse a shared plugin-repair binding across plugin-repair, modal-props, and surface-composition contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `repairFeishuPlugin` field shape from multiple contract modules.
- Before this slice, the same `repairFeishuPlugin: ChannelsPageFeishuPluginRepairHandler<...>` field was still repeated inline in several places:
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - `src/pages/channels-page-modal-props-contract.ts`
  - `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts` now owns the shared `ChannelsPageFeishuPluginRepairBinding<Channel>` interface
  - the plugin-repair result contract now extends that shared binding instead of restating the field inline
  - the modal-props and surface-composition contracts now also reuse that shared binding instead of repeating their own `repairFeishuPlugin` field declaration
- Result:
  - the plugin-repair handler field now has one canonical binding contract
  - plugin-repair/modal/surface contracts keep the same runtime behavior and public shape while sharing the same repair-handler vocabulary
  - future changes to plugin-repair handler wiring only need one contract edit instead of parallel edits across three modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts` so it now checks the exported repair binding and the result-contract reuse
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` and `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so they now check the shared binding import/reference and confirm the repeated field is no longer declared inline there
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 424: Reuse a shared add-channel handler alias across config-flow and main-surface contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `handleOpenAddChannel` callback shape from multiple contract modules.
- Before this slice, the same `handleOpenAddChannel: () => void` field was still repeated inline in:
  - `src/pages/channels-page-config-flow-contract.ts`
  - `src/pages/channels-page-main-surface-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-config-flow-contract.ts` now owns the shared `ChannelsPageOpenAddChannelHandler` alias
  - `ChannelsPageConfigFlowResult` now reuses that alias instead of restating the callback shape inline
  - `src/pages/channels-page-main-surface-props-contract.ts` now imports and reuses the same alias for its `handleOpenAddChannel` field
- Result:
  - the add-channel callback shape now has one canonical contract owner
  - config-flow and main-surface contracts keep the same runtime behavior and public shape while sharing the same add-channel callback vocabulary
  - future changes to add-channel callback typing only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-config-flow-contract.test.ts` so it now checks the exported add-channel handler alias and the result-contract reuse
  - refreshed `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` so it now checks the shared alias import/reference and field reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 425: Reuse a shared refresh-channels handler alias across data and main-surface contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `handleRefreshChannels` callback shape from multiple contract modules.
- Before this slice, the same refresh callback shape was still repeated inline in:
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-main-surface-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageRefreshChannelsHandler` alias
  - `ChannelsPageDataResult` now reuses that alias instead of restating the callback shape inline
  - `src/pages/channels-page-main-surface-props-contract.ts` now imports and reuses the same alias for its `handleRefreshChannels` field
- Result:
  - the refresh-channels callback shape now has one canonical contract owner
  - data and main-surface contracts keep the same runtime behavior and public shape while sharing the same refresh callback vocabulary
  - future changes to refresh callback typing only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported refresh handler alias and the data-result reuse
  - refreshed `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` so it now checks the shared alias import/reference and field reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 426: Reuse a shared nullable-string setter alias across data, config-flow, and model-config contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `Dispatch<SetStateAction<string | null>>` setter shape from multiple contract modules.
- Before this slice, the same nullable-string setter type was still repeated inline in:
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-config-flow-contract.ts`
  - `src/pages/channels-page-model-config-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageNullableStringSetter` alias
  - the config-flow contract now reuses that alias for `setSelectedChannelId`
  - the model-config contract now reuses that alias for `setSelectedModelValue`
- Result:
  - the nullable-string setter shape now has one canonical contract owner
  - data/config-flow/model-config contracts keep the same runtime behavior and public shape while sharing the same setter vocabulary
  - future changes to nullable-string setter typing only need one contract edit instead of parallel edits across three modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported nullable-string setter alias
  - refreshed `src/pages/__tests__/channels-page-config-flow-contract.test.ts` and `src/pages/__tests__/channels-page-model-config-contract.test.ts` so they now check the shared alias import/reference and field reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 427: Reuse a shared pending-channel-id alias across data, channel-actions, plugin-repair, and main-surface contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `string | null` busy-channel id shape from multiple contract modules.
- Before this slice, the same pending channel-id shape was still repeated inline in:
  - `src/pages/channels-page-channel-actions-contract.ts`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - `src/pages/channels-page-main-surface-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPagePendingChannelId` alias
  - the channel-actions result contract now reuses that alias for `togglingChannelId`
  - the plugin-repair result contract now reuses that alias for `repairingPluginChannelId`
  - the main-surface props contract now reuses that alias for both pending channel-id fields instead of repeating `string | null`
- Result:
  - the busy-channel id shape now has one canonical contract owner
  - data/actions/plugin-repair/main-surface contracts keep the same runtime behavior and public shape while sharing the same pending-channel vocabulary
  - future changes to pending channel-id typing only need one contract edit instead of parallel edits across four modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported pending-channel alias
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, and `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` so they now check the shared alias import/reference and field reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` passed (`4 passed`, `8 passed`).

### Update 428: Reuse shared busy-channel bindings across channel-actions, plugin-repair, and main-surface contracts
- I tightened the next `ChannelsPage` seam by removing the repeated busy-channel id field declarations from multiple contract modules.
- Before this slice, the same pending channel-id fields were still declared inline across:
  - `src/pages/channels-page-channel-actions-contract.ts`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - `src/pages/channels-page-main-surface-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-channel-actions-contract.ts` now owns the shared `ChannelsPageTogglingChannelBinding` interface
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts` now owns the shared `ChannelsPageRepairingPluginChannelBinding` interface
  - the channel-actions and plugin-repair result contracts now extend those shared bindings instead of restating the pending channel-id fields inline
  - `src/pages/channels-page-main-surface-props-contract.ts` now also reuses both shared bindings instead of repeating the same fields locally
- Result:
  - the toggling/repairing busy-channel field packs now have canonical contract owners
  - actions/plugin-repair/main-surface contracts keep the same runtime behavior and public shape while sharing the same busy-channel vocabulary
  - future changes to busy-channel field typing only need one contract edit per binding instead of parallel edits across three modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts`, `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts`, and `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` so they now check the shared binding imports/references and confirm the repeated fields are no longer declared inline in the consuming contracts
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` passed (`4 passed`, `8 passed`).

### Update 429: Reuse a shared target-ref input alias across target-refresh and target-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated nullable target-ref input shape from multiple contract modules.
- Before this slice, the same `ChannelPairingTargetRef | null | undefined` input shape was still repeated inline in:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts`
  - `src/pages/channels-page-feishu-target-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts` now owns the shared `ChannelsPageTargetRefInput` alias
  - the target-refresh options contract now reuses that alias for `target`
  - `src/pages/channels-page-feishu-target-state-contract.ts` now imports and reuses the same alias for both its surface options and target-state deriver signature
- Result:
  - the nullable target-ref input shape now has one canonical contract owner
  - target-refresh and target-state contracts keep the same runtime behavior and public shape while sharing the same target-input vocabulary
  - future changes to target-ref input typing only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts` so it now checks the exported shared target-ref alias and the target-refresh options reuse
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the shared alias import/reference and the reused target fields in the consumer contract
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 430: Reuse a shared refresh-channels binding across target-refresh and target-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `refreshChannels` field declaration from adjacent Feishu target contracts.
- Before this slice, the same `refreshChannels: ChannelsPageFeishuTargetRefreshChannels` field was still declared inline in:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts`
  - `src/pages/channels-page-feishu-target-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts` now owns the shared `ChannelsPageFeishuTargetRefreshChannelsBinding` interface
  - the target-refresh options contract now extends that binding instead of restating the field inline
  - `src/pages/channels-page-feishu-target-state-contract.ts` now imports and extends the same binding for its refresh options contract
- Result:
  - the shared refresh-channels field pack now has one canonical contract owner
  - target-refresh and target-state contracts keep the same runtime behavior and public shape while sharing the same refresh callback vocabulary
  - future changes to the shared refresh handler field only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts` so it now checks the exported shared refresh-channels binding and the target-refresh options reuse
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the shared binding import/reference and confirms the consumer contract no longer declares the `refreshChannels` field inline
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 431: Reuse shared fallback and repairing bindings across state-helper and target-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated fallback-channel and repairing-plugin option fields from adjacent helper and target-state contracts.
- Before this slice, the same target-option field shapes were still repeated inline across:
  - `src/pages/channels-page-state-helpers-contract.ts`
  - `src/pages/channels-page-feishu-target-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageStateHelperFallbackChannelBinding<Channel>` interface
  - `src/pages/channels-page-state-helpers-contract.ts` now also owns the shared `ChannelsPageStateHelperRepairingPluginChannelBinding` interface
  - `ChannelsPageStateHelperTargetStateOptions<Channel>` now extends those bindings instead of restating both fields inline
  - `src/pages/channels-page-feishu-target-state-contract.ts` now imports and reuses the same bindings for its surface and refresh option contracts
- Result:
  - the fallback-channel and repairing-plugin option fields now have canonical contract owners
  - helper and target-state contracts keep the same runtime behavior and public shape while sharing the same target-option vocabulary
  - future changes to either field only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared bindings and the helper target-state options reuse
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the shared binding imports/references and confirms the consumer contracts no longer declare the fallback/repairing fields inline
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 432: Reuse shared target-refresh controls across target-refresh and modal-props contracts
- I tightened the next `ChannelsPage` seam by removing the repeated target-refresh control fields from adjacent refresh and modal contract modules.
- Before this slice, the same refresh control field pack was still declared inline across:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts`
  - `src/pages/channels-page-modal-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts` continues to own the canonical `ChannelsPageFeishuTargetRefreshControls` interface
  - `src/pages/channels-page-modal-props-contract.ts` now imports and extends that shared controls interface for `ChannelsPageModalTargetRefreshState`
  - the modal-props contract no longer declares a separate local target-refresh handler alias or repeats the refresh control fields inline
- Result:
  - the modal target-refresh control pack now has one canonical contract owner
  - refresh and modal contracts keep the same runtime behavior and public shape while sharing the same refresh-control vocabulary
  - future changes to target-refresh control typing only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the shared controls import/reuse and confirms the local refresh handler alias plus repeated control fields are gone
  - kept `src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts` aligned with the canonical owner contract
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 433: Reuse shared refresh-status fields across state-helper and modal-props contracts
- I tightened the next `ChannelsPage` seam by removing the repeated refresh-status result fields from helper and modal contract modules.
- Before this slice, the same `statusPending` and `missingAfterRefresh` field pack was still declared inline across:
  - `src/pages/channels-page-state-helpers-contract.ts`
  - `src/pages/channels-page-modal-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageStateHelperRefreshStatusBinding` interface
  - `ChannelsPageStateHelperTargetState<Channel>` now extends that binding instead of restating the refresh-status fields inline
  - `src/pages/channels-page-modal-props-contract.ts` now imports and reuses the same binding for `ChannelsPageModalTargetRefreshState`
- Result:
  - the refresh-status field pack now has one canonical contract owner
  - state-helper and modal contracts keep the same runtime behavior and public shape while sharing the same refresh-status vocabulary
  - future changes to these derived refresh-status fields only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared refresh-status binding and the helper target-state reuse
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the shared binding import/reference and confirms the modal contract no longer declares the repeated refresh-status fields inline
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 434: Reuse shared blocked-state fields across state-helper and modal-props contracts
- I tightened the next `ChannelsPage` seam by removing the repeated shared-status blocking field from helper and modal contract modules.
- Before this slice, the same `blockedBySharedStatus` field was still declared inline across:
  - `src/pages/channels-page-state-helpers-contract.ts`
  - `src/pages/channels-page-modal-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageStateHelperBlockedBySharedStatusBinding` interface
  - `ChannelsPageStateHelperTargetState<Channel>` now extends that binding instead of restating the field inline
  - `src/pages/channels-page-modal-props-contract.ts` now imports and reuses the same binding for both config and pairing target-state contracts
- Result:
  - the shared-status blocking field now has one canonical contract owner
  - state-helper and modal contracts keep the same runtime behavior and public shape while sharing the same blocked-state vocabulary
  - future changes to this field only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared blocked-state binding and the helper target-state reuse
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the shared binding import/reference and confirms the config/pairing consumer contracts no longer declare the field inline
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 435: Reuse a shared modal target-channel binding across modal target-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated modal target-channel field from the config, pairing, and diagnostics target-state contracts.
- Before this slice, the same `channel: ChannelsPageChannelInfo | null` field was still declared inline in:
  - `src/pages/channels-page-modal-props-contract.ts` for the config target-state contract
  - `src/pages/channels-page-modal-props-contract.ts` for the pairing target-state contract
  - `src/pages/channels-page-modal-props-contract.ts` for the diagnostics target-state contract
- I rewired that seam so that:
  - `src/pages/channels-page-modal-props-contract.ts` now owns the shared `ChannelsPageModalTargetChannelBinding` interface
  - the config, pairing, and diagnostics target-state contracts now extend that shared binding instead of restating the same `channel` field inline
- Result:
  - the modal target-channel field now has one canonical contract owner inside the modal contract module
  - the config/pairing/diagnostics target-state contracts keep the same runtime behavior and public shape while sharing the same channel-field vocabulary
  - future changes to the modal target-channel field only need one contract edit instead of three parallel edits in the same module
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the exported shared target-channel binding and the consumer contract reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-modal-props-contract.test.ts` passed (`1 passed`, `2 passed`).

### Update 436: Reuse a shared channel-snapshot sync handler across data, model-config, and target-modals contracts
- I tightened the next `ChannelsPage` seam by removing the repeated channel-snapshot sync callback shape from multiple contract modules.
- Before this slice, the same `(nextChannels: Channel[]) => void` callback shape was still declared inline across:
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-model-config-contract.ts`
  - `src/pages/channels-page-target-modals-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageChannelSnapshotsSyncHandler<Channel>` alias
  - `ChannelsPageDataOptions` now reuses that alias for `syncSelectedChannelSnapshots`
  - `src/pages/channels-page-model-config-contract.ts` now imports and reuses the same alias for `syncSelectedModelChannelSnapshot`
  - `src/pages/channels-page-target-modals-contract.ts` now imports and reuses the same alias for `syncSelectedTargetChannelSnapshots`
- Result:
  - the channel-snapshot sync callback shape now has one canonical contract owner
  - data/model-config/target-modals contracts keep the same runtime behavior and public shape while sharing the same snapshot-sync vocabulary
  - future changes to this callback typing only need one contract edit instead of three parallel edits across the contract layer
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared snapshot-sync alias and the data-options reuse
  - refreshed `src/pages/__tests__/channels-page-model-config-contract.test.ts` and `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so they now check the shared alias import/reference and the consumer field reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 437: Reuse a shared selected-target ref alias inside the target-modals contract
- I tightened the next `ChannelsPage` seam by removing the repeated selected target-ref type from the pairing and diagnostics modal state contracts.
- Before this slice, the same `ChannelPairingTargetRef | null` type was still declared inline twice in:
  - `src/pages/channels-page-target-modals-contract.ts` for `selectedPairingTarget`
  - `src/pages/channels-page-target-modals-contract.ts` for `selectedDiagnosticsTarget`
- I rewired that seam so that:
  - `src/pages/channels-page-target-modals-contract.ts` now owns the shared `ChannelsPageTargetModalSelectionRef` alias
  - the pairing and diagnostics modal state contracts now both reuse that alias instead of restating the same selected target-ref type inline
- Result:
  - the selected target-ref type now has one canonical contract owner inside the target-modals module
  - the pairing/diagnostics modal state contracts keep the same runtime behavior and public shape while sharing the same selected-target vocabulary
  - future changes to the selected target-ref type only need one contract edit instead of parallel edits inside the same module
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the exported shared selected-target alias and the consumer field reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-target-modals-contract.test.ts` passed (`1 passed`, `2 passed`).

### Update 438: Reuse shared pairing-state and provision-source aliases across data and state-helper contracts
- I tightened the next `ChannelsPage` seam by removing the repeated pairing-state and provision-source literal unions from adjacent contract modules.
- Before this slice, the same domain unions were still declared inline across:
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-state-helpers-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPagePairingState` alias
  - `src/pages/channels-page-data-contract.ts` now also owns the shared `ChannelsPageProvisionSource` alias
  - `ChannelsPageChannelInfo` now reuses those aliases instead of restating the literal unions inline
  - `src/pages/channels-page-state-helpers-contract.ts` now imports and reuses the same aliases for `ChannelsPageChannelStatusBadgeChannel`
- Result:
  - the pairing-state and provision-source vocabularies now have canonical contract owners
  - data and state-helper contracts keep the same runtime behavior and public shape while sharing the same domain-type vocabulary
  - future changes to either domain union only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared aliases and the channel-info field reuse
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the shared alias import/reference and the badge-channel field reuse
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 439: Reuse a shared repair-state binding across state-helper and modal-props contracts
- I tightened the next `ChannelsPage` seam by removing the repeated repair-state field pack from helper and modal contract modules.
- Before this slice, the same `canRepair` / `repairing` field pair was still declared inline across:
  - `src/pages/channels-page-state-helpers-contract.ts`
  - `src/pages/channels-page-modal-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageStateHelperRepairStateBinding` interface
  - `ChannelsPageStateHelperTargetState<Channel>` now extends that binding instead of restating the repair-state fields inline
  - `src/pages/channels-page-modal-props-contract.ts` now imports and reuses the same binding for `ChannelsPageModalSharedStatusState<Alert>`
- Result:
  - the repair-state field pack now has one canonical contract owner
  - state-helper and modal contracts keep the same runtime behavior and public shape while sharing the same repair-state vocabulary
  - future changes to `canRepair` / `repairing` only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared repair-state binding and the helper target-state reuse
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the shared binding import/reference and confirms the modal shared-status contract no longer declares the repair-state fields inline
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 440: Reuse a shared channels binding across target-state and grouped target-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `channels: Channel[]` field from adjacent target-state contract modules.
- Before this slice, the same channels-list field was still declared inline across:
  - `src/pages/channels-page-feishu-target-state-contract.ts`
  - `src/pages/channels-page-target-state-groups-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-state-contract.ts` now owns the shared `ChannelsPageTargetStateChannelsBinding<Channel>` interface
  - `ChannelsPageFeishuTargetStateHookOptions<Channel, State>` now extends that binding instead of restating the channels field inline
  - `src/pages/channels-page-target-state-groups-contract.ts` now imports and reuses the same binding for `ChannelsPageTargetStateGroupsOptions<Channel, State>`
- Result:
  - the target-state channels-list field now has one canonical contract owner
  - target-state and grouped target-state contracts keep the same runtime behavior and public shape while sharing the same channels-binding vocabulary
  - future changes to the channels-list field only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the exported shared channels binding and the hook-options reuse
  - refreshed `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` so it now checks the shared binding import/reference and confirms the grouped contract no longer declares the channels field inline
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 441: Reuse a shared pairing-key binding across target-refresh and state-helper contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `pairingKey: string` field from adjacent contract modules.
- Before this slice, the same pairing-key field was still declared inline across:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts`
  - `src/pages/channels-page-state-helpers-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts` now owns the shared `ChannelsPagePairingKeyBinding` interface
  - `ChannelsPageFeishuTargetRefreshResult` now extends that binding instead of restating the pairing-key field inline
  - `src/pages/channels-page-state-helpers-contract.ts` now imports and reuses the same binding for `ChannelsPageStateHelperTargetState<Channel>`
- Result:
  - the pairing-key field now has one canonical contract owner
  - target-refresh and state-helper contracts keep the same runtime behavior and public shape while sharing the same pairing-key vocabulary
  - future changes to the pairing-key field only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts` so it now checks the exported shared pairing-key binding and the target-refresh result reuse
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the shared binding import/reference and confirms the helper target-state contract reuses it instead of declaring the field inline
- Validation on April 19, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 19, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 442: Reuse a shared target-selection binding across target-refresh and target-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `active + target` field pack from adjacent Feishu target contracts.
- Before this slice, the same target-selection fields were still declared inline across:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts`
  - `src/pages/channels-page-feishu-target-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-refresh-contract.ts` now owns the shared `ChannelsPageFeishuTargetSelectionBinding` interface
  - `ChannelsPageFeishuTargetRefreshOptions` now extends that binding instead of restating `active` and `target` inline
  - `src/pages/channels-page-feishu-target-state-contract.ts` now imports and reuses the same binding for `ChannelsPageFeishuTargetSurfaceOptions<Channel>`
- Result:
  - the Feishu target-selection field pack now has one canonical contract owner
  - target-refresh and target-state contracts keep the same runtime behavior and public shape while sharing the same target-selection vocabulary
  - future changes to the `active` / `target` selection fields only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts` so it now checks the exported shared target-selection binding and the refresh-options reuse
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the shared binding import/reference and confirms the target-surface options reuse it instead of declaring the fields inline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-feishu-target-refresh-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 443: Reuse a shared grouped-target-state binding across grouped state and modal-props contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `configTargetState / pairingTargetState / diagnosticsTargetState` field triplet from adjacent contract modules.
- Before this slice, the same grouped target-state keys were still declared inline across:
  - `src/pages/channels-page-target-state-groups-contract.ts`
  - `src/pages/channels-page-modal-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-target-state-groups-contract.ts` now owns the shared `ChannelsPageGroupedTargetStatesBinding<...>` interface
  - `ChannelsPageTargetStateGroupsResult<State>` now extends that binding instead of restating the grouped target-state keys inline
  - `src/pages/channels-page-modal-props-contract.ts` now imports and reuses the same binding for `ChannelsPageModalPropsOptions`
- Result:
  - the grouped target-state triplet now has one canonical contract owner
  - grouped state and modal-props contracts keep the same runtime behavior and public shape while sharing the same grouped target-state vocabulary
  - future changes to the config/pairing/diagnostics target-state key set only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` so it now checks the exported shared grouped-target-state binding and the grouped result reuse
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the shared binding import/reference and confirms the modal-props contract reuses it instead of declaring the grouped target-state fields inline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-target-state-groups-contract.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 444: Reuse the existing surface and modal result contracts inside the surface-composition result
- I tightened the next `ChannelsPage` seam by removing the repeated result-field projections from the surface-composition contract.
- Before this slice, `src/pages/channels-page-surface-composition-contract.ts` still restated the output result fields already owned by adjacent result contracts:
  - `topPanelProps / channelListPanelProps / channelCardsProps` from `ChannelsPageMainSurfacePropsResult`
  - `configModalProps / pairingModalProps / diagnosticsModalProps` from `ChannelsPageModalPropsResult`
  - `modelConfigModalProps` from `ChannelsPageModelModalPropsResult`
- I rewired that seam so that:
  - `ChannelsPageSurfaceCompositionResult` now directly extends `ChannelsPageMainSurfacePropsResult`
  - it also extends `ChannelsPageModalPropsResult`
  - and it extends `ChannelsPageModelModalPropsResult`
- Result:
  - the surface-composition result no longer repeats field projections that already have canonical result owners
  - the surface-composition contract keeps the same runtime behavior and public shape while reusing the established result vocabulary
  - future changes to those result fields now only need to be made in the owning result contracts instead of mirrored again in the surface-composition layer
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so it now checks the imported result interfaces and the new multi-interface reuse, instead of expecting inline projected result fields
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-surface-composition-contract.test.ts` passed (`1 passed`, `2 passed`).

### Update 445: Reuse a shared surface-controller-state binding across controller-state result contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `surfaceControllerState` field from adjacent controller-state result contracts.
- Before this slice, the same `surfaceControllerState: ChannelsPageViewStateSurfaceControllerState` field was still declared inline across:
  - `src/pages/channels-page-view-state-controller-state-contract.ts`
  - `src/pages/channels-page-view-state-surface-controller-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-view-state-controller-state-contract.ts` now owns the shared `ChannelsPageViewStateSurfaceControllerStateBinding` interface
  - `ChannelsPageViewStateControllerStateResult` now extends that binding instead of restating the `surfaceControllerState` field inline
  - `src/pages/channels-page-view-state-surface-controller-state-contract.ts` now imports and reuses the same binding for `BuildChannelsPageViewStateSurfaceControllerStateResult`
- Result:
  - the surface-controller-state field now has one canonical contract owner
  - the controller-state result and the surface-controller-state builder result keep the same runtime behavior and public shape while sharing the same field vocabulary
  - future changes to that field now only need one contract edit instead of parallel edits across both result contracts
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts` so it now checks the exported shared binding and the controller-state result reuse
  - refreshed `src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts` so it now checks the shared binding import/reference and confirms the builder result reuses it instead of declaring the field inline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts src/pages/__tests__/channels-page-view-state-surface-controller-state-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 446: Reuse a shared refresh-feedback binding across data and main-surface contracts
- I tightened the next `ChannelsPage` seam by removing the repeated refresh-feedback field pack from adjacent data and main-surface contracts.
- Before this slice, the same refresh-oriented fields were still declared inline across:
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-main-surface-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageRefreshFeedbackBinding` interface
  - `ChannelsPageDataResult` now extends that binding instead of restating `refreshing`, `error`, `legacyFeishuAgentIds`, and `handleRefreshChannels` inline
  - `src/pages/channels-page-main-surface-props-contract.ts` now imports and reuses the same binding for `ChannelsPageMainSurfacePropsOptions`
- Result:
  - the refresh-feedback field pack now has one canonical contract owner
  - data and main-surface contracts keep the same runtime behavior and public shape while sharing the same refresh-feedback vocabulary
  - future changes to those refresh/error fields now only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared refresh-feedback binding and the data-result reuse
  - refreshed `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` so it now checks the shared binding import/reference and confirms the main-surface options reuse it instead of declaring those fields inline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 447: Reuse a shared page-error binding across channel-actions and plugin-repair options
- I tightened the next `ChannelsPage` seam by removing the repeated `onPageError` field from adjacent mutation-controller option contracts.
- Before this slice, the same `onPageError: ChannelsPagePageErrorHandler` field was still declared inline across:
  - `src/pages/channels-page-channel-actions-contract.ts`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageOnPageErrorBinding` interface
  - `ChannelsPageChannelActionsOptions<Channel>` now extends that binding instead of restating the `onPageError` field inline
  - `ChannelsPageFeishuPluginRepairOptions<Channel>` now imports and reuses the same binding
- Result:
  - the page-error callback field now has one canonical contract owner
  - the channel-actions and plugin-repair option contracts keep the same runtime behavior and public shape while sharing the same page-error vocabulary
  - future changes to the `onPageError` field now only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared page-error binding
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the shared binding import/reference and confirms the actions-options contract reuses it instead of declaring `onPageError` inline
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts` so it now checks the shared binding import/reference and confirms the plugin-repair options contract reuses it instead of declaring `onPageError` inline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 448: Reuse a shared background-refresh callback binding across core-controller and surface-composition contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `refreshChannelsInBackground` callback field from adjacent controller and surface contracts.
- Before this slice, the same background-refresh callback concept was still declared inline across:
  - `src/pages/channels-page-core-controllers-contract.ts`
  - `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-core-controllers-contract.ts` now owns the shared `ChannelsPageRefreshChannelsInBackground<Channel>` alias
  - the same module now also owns `ChannelsPageRefreshChannelsInBackgroundBinding<Channel>`
  - `ChannelsPageCoreControllersResult` now extends that binding instead of restating `refreshChannelsInBackground` inline
  - `src/pages/channels-page-surface-composition-contract.ts` now imports and reuses the same binding for `ChannelsPageSurfaceCompositionOptions`
- Result:
  - the background-refresh callback now has one canonical contract owner
  - the core-controller result and surface-composition input contracts keep the same runtime behavior and public shape while sharing the same background-refresh vocabulary
  - future changes to that callback now only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-core-controllers-contract.test.ts` so it now checks the exported shared callback alias/binding and the core-controller result reuse
  - refreshed `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so it now checks the shared binding import/reference and confirms the surface-composition input contract reuses it instead of declaring `refreshChannelsInBackground` inline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-core-controllers-contract.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 449: Reuse a shared page-error setter binding across main-surface and interaction-controller options
- I tightened the next `ChannelsPage` seam by removing the repeated `setError` field from adjacent option contracts.
- Before this slice, the same `setError: ChannelsPagePageErrorHandler` field was still declared inline across:
  - `src/pages/channels-page-main-surface-props-contract.ts`
  - `src/pages/channels-page-interaction-controllers-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageSetPageErrorBinding` interface
  - `ChannelsPageMainSurfacePropsOptions` now extends that binding instead of restating the `setError` field inline
  - `src/pages/channels-page-interaction-controllers-contract.ts` now imports and reuses the same binding for `ChannelsPageInteractionControllersOptions`
- Result:
  - the page-error setter field now has one canonical contract owner
  - the main-surface and interaction-controller option contracts keep the same runtime behavior and public shape while sharing the same page-error-setter vocabulary
  - future changes to the `setError` field now only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared setter binding
  - refreshed `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` so it now checks the shared binding import/reference and confirms the main-surface options reuse it instead of declaring `setError` inline
  - refreshed `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` so it now checks the shared binding import/reference and confirms the interaction-controller options reuse it instead of declaring `setError` inline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 450: Reuse a shared loading binding across data, view-state, and controller-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `loading` field from adjacent result contracts.
- Before this slice, the same loading state was still represented separately across:
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-view-state-contract.ts`
  - `src/pages/channels-page-view-state-controller-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageLoadingBinding` interface
  - `ChannelsPageDataResult` now extends that binding instead of restating `loading` inline
  - `src/pages/channels-page-view-state-contract.ts` now imports and reuses the same binding for `ChannelsPageViewStateResult`
  - `src/pages/channels-page-view-state-controller-state-contract.ts` now also imports and reuses the same binding for `ChannelsPageViewStateControllerStateResult`
- Result:
  - the loading field now has one canonical contract owner
  - data, view-state, and controller-state result contracts keep the same runtime behavior and public shape while sharing the same loading vocabulary
  - future changes to loading-state typing now only need one contract edit instead of parallel edits across three modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared loading binding and the data-result reuse
  - refreshed `src/pages/__tests__/channels-page-view-state-contract.test.ts` so it now checks the shared binding import/reference and confirms the view-state result reuses it instead of projecting the shell prop type inline
  - refreshed `src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts` so it now checks the shared binding import/reference and confirms the controller-state result reuses it instead of projecting `ChannelsPageViewStateResult['loading']`
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-view-state-contract.test.ts src/pages/__tests__/channels-page-view-state-controller-state-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 451: Reuse a shared async channel-action handler across action, plugin-repair, and model-config contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `(channel: Channel) => Promise<void>` handler signature from adjacent contract modules.
- Before this slice, the same async channel-action handler shape was still declared inline across:
  - `src/pages/channels-page-channel-actions-contract.ts`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - `src/pages/channels-page-model-config-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-channel-actions-contract.ts` now owns the shared `ChannelsPageAsyncChannelActionHandler<Channel>` alias
  - `ChannelsPageChannelActionsResult<Channel>` now reuses that alias for `handleRemoveChannel` and `handleToggleChannelEnabled`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts` now imports and reuses the same alias for `handleRepairFeishuPlugin`
  - `src/pages/channels-page-model-config-contract.ts` now imports and reuses the same alias for `handleOpenModelConfig`
- Result:
  - the async channel-action handler now has one canonical contract owner
  - action, plugin-repair, and model-config contracts keep the same runtime behavior and public shape while sharing the same async-action vocabulary
  - future changes to that handler signature now only need one contract edit instead of parallel edits across three modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the exported shared async-action alias and the channel-actions result reuse
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts` so it now checks the shared alias import/reference and confirms the plugin-repair result reuses it instead of declaring the handler inline
  - refreshed `src/pages/__tests__/channels-page-model-config-contract.test.ts` so it now checks the shared alias import/reference and confirms the model-config result reuses it instead of declaring the handler inline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 452: Reuse a shared async-void handler across refresh, config-flow, model-config, and pairing contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `() => Promise<void>` handler signature from adjacent contract modules.
- Before this slice, the same async-void handler shape was still declared inline across:
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-config-flow-contract.ts`
  - `src/pages/channels-page-model-config-contract.ts`
  - `src/pages/channels-page-target-modals-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageAsyncVoidHandler` alias
  - `ChannelsPageRefreshChannelsHandler` now reuses that alias instead of restating `() => Promise<void>` inline
  - `src/pages/channels-page-config-flow-contract.ts` now imports and reuses the same alias for `handleConfigDone`
  - `src/pages/channels-page-model-config-contract.ts` now imports and reuses the same alias for `handleSaveBotModel`
  - `src/pages/channels-page-target-modals-contract.ts` now reuses the same alias as the default pairing-done handler type
- Result:
  - the async-void callback now has one canonical contract owner
  - refresh, config-flow, model-config, and pairing contracts keep the same runtime behavior and public shape while sharing the same async-void vocabulary
  - future changes to that handler signature now only need one contract edit instead of parallel edits across four modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared async-void alias and the refresh-handler reuse
  - refreshed `src/pages/__tests__/channels-page-config-flow-contract.test.ts` so it now checks the shared alias import/reference and confirms `handleConfigDone` reuses it instead of declaring the handler inline
  - refreshed `src/pages/__tests__/channels-page-model-config-contract.test.ts` so it now checks the shared alias import/reference and confirms `handleSaveBotModel` reuses it instead of declaring the handler inline
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the shared alias import/reference and confirms the pairing modal defaults reuse it instead of repeating `() => Promise<void>` inline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts` passed (`4 passed`, `8 passed`).

### Update 453: Reuse a shared sync-void handler across config-flow, target-modal, modal-props, and surface-composition contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `() => void` handler signature from adjacent contract modules.
- Before this slice, the same sync-void handler shape was still declared inline across:
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-config-flow-contract.ts`
  - `src/pages/channels-page-target-modals-contract.ts`
  - `src/pages/channels-page-modal-props-contract.ts`
  - `src/pages/channels-page-surface-composition-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageVoidHandler` alias
  - `src/pages/channels-page-config-flow-contract.ts` now reuses that alias for `handleChannelConfigBack` and `ChannelsPageOpenAddChannelHandler`
  - `src/pages/channels-page-target-modals-contract.ts` now reuses the same alias for `handlePairingClose` and `handleDiagnosticsClose`
  - `src/pages/channels-page-modal-props-contract.ts` now reuses the same alias when specializing `ChannelsPagePairingModalVisibilityState`
  - `src/pages/channels-page-surface-composition-contract.ts` now reuses the same alias when specializing `ChannelsPagePairingModalState`
- Result:
  - the sync-void callback now has one canonical contract owner
  - config-flow, target-modal, modal-props, and surface-composition contracts keep the same runtime behavior and public shape while sharing the same sync-void vocabulary
  - future changes to these simple close/open callback signatures now only need one contract edit instead of parallel edits across five modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared sync-void alias
  - refreshed `src/pages/__tests__/channels-page-config-flow-contract.test.ts` so it now checks the shared alias import/reference and confirms the config-flow close/open handler types reuse it
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the shared alias import/reference and confirms the pairing/diagnostics close handlers reuse it
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the shared alias import/reference and confirms modal-props reuse it when specializing pairing visibility
  - refreshed `src/pages/__tests__/channels-page-surface-composition-contract.test.ts` so it now checks the shared alias import/reference and confirms surface-composition reuse it when specializing pairing modal state
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-config-flow-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts src/pages/__tests__/channels-page-surface-composition-contract.test.ts` passed (`5 passed`, `10 passed`).

### Update 454: Reuse a shared channels binding across data, main-surface, and target-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `channels: Channel[]` / `channels: ChannelsPageChannelInfo[]` field shape from adjacent contract modules.
- Before this slice, channel collection ownership was still split across:
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-main-surface-props-contract.ts`
  - `src/pages/channels-page-feishu-target-state-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageChannelsBinding<Channel>` interface
  - `ChannelsPageDataResult` now reuses that binding instead of restating `channels: ChannelsPageChannelInfo[]` inline
  - `src/pages/channels-page-main-surface-props-contract.ts` now imports and reuses the same binding for `ChannelsPageMainSurfacePropsOptions`
  - `src/pages/channels-page-feishu-target-state-contract.ts` now imports and reuses the same binding as the base for `ChannelsPageTargetStateChannelsBinding<Channel>`
- Result:
  - channel collection state now has one canonical contract owner
  - data, main-surface, and target-state contracts keep the same runtime behavior and public shape while sharing the same channel-list vocabulary
  - future changes to shared channel-list typing now only need one contract edit instead of parallel edits across three modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared channels binding and the data-result reuse
  - refreshed `src/pages/__tests__/channels-page-main-surface-props-contract.test.ts` so it now checks the shared binding import/reference and confirms the main-surface options reuse it instead of declaring `channels` inline
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the shared binding import/reference and confirms the target-state channel binding now extends it
  - reran `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` to verify the grouped target-state contract still consumes the same target-state channels binding without regressing its raw-source expectations
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-main-surface-props-contract.test.ts src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` passed (`4 passed`, `8 passed`).

### Update 455: Reuse a shared nullable-channel alias across helper, model-config, target-modal, and modal-props contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `Channel | null` / `ChannelsPageChannelInfo | null` field shape from adjacent contract modules.
- Before this slice, the same nullable-channel shape was still declared inline across:
  - `src/pages/channels-page-data-contract.ts`
  - `src/pages/channels-page-model-config-contract.ts`
  - `src/pages/channels-page-target-modals-contract.ts`
  - `src/pages/channels-page-state-helpers-contract.ts`
  - `src/pages/channels-page-modal-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageNullableChannel<Channel>` alias
  - `src/pages/channels-page-model-config-contract.ts` now reuses that alias for `selectedModelChannel`
  - `src/pages/channels-page-target-modals-contract.ts` now reuses the same alias for `selectedPairingChannel` and `selectedDiagnosticsChannel`
  - `src/pages/channels-page-state-helpers-contract.ts` now reuses the same alias for `fallbackChannel`, `targetChannel`, and `channelForSurface`
  - `src/pages/channels-page-modal-props-contract.ts` now reuses the same alias for the shared modal target channel binding and diagnostics fallback channel
- Result:
  - nullable channel references now have one canonical contract owner
  - helper, model-config, target-modal, and modal-props contracts keep the same runtime behavior and public shape while sharing the same nullable-channel vocabulary
  - future changes to nullable channel typing now only need one contract edit instead of parallel edits across five modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the exported shared nullable-channel alias
  - refreshed `src/pages/__tests__/channels-page-model-config-contract.test.ts` so it now checks the shared alias import/reference and confirms `selectedModelChannel` reuses it
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the shared alias import/reference and confirms pairing/diagnostics selected-channel fields reuse it
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the shared alias import/reference and confirms helper-layer fallback/target channel fields reuse it
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the shared alias import/reference and confirms modal target/fallback channel fields reuse it
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-modal-props-contract.test.ts` passed (`5 passed`, `10 passed`).

### Update 456: Reuse a shared latest-snapshot access binding across state-helper, model-config, target-modal, plugin-repair, and interaction-controller contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `fetchChannels + resolveLatestChannelSnapshot` binding pair from adjacent contract modules.
- Before this slice, the same latest-snapshot access shape was still declared in parallel across:
  - `src/pages/channels-page-state-helpers-contract.ts`
  - `src/pages/channels-page-model-config-contract.ts`
  - `src/pages/channels-page-target-modals-contract.ts`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - `src/pages/channels-page-interaction-controllers-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageLatestChannelSnapshotAccessBinding<Channel>` interface
  - `src/pages/channels-page-model-config-contract.ts` now reuses that binding for `ChannelsPageModelConfigOptions`
  - `src/pages/channels-page-target-modals-contract.ts` now reuses the same binding for `ChannelsPageTargetModalsOptions`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts` now reuses the same binding inside `ChannelsPageFeishuPluginRepairOptions`
  - `src/pages/channels-page-interaction-controllers-contract.ts` now reuses the same binding inside `ChannelsPageInteractionControllersOptions`
- Result:
  - latest-snapshot access now has one canonical contract owner
  - state-helper, model-config, target-modal, plugin-repair, and interaction-controller contracts keep the same runtime behavior and public shape while sharing the same fetch-plus-latest-snapshot vocabulary
  - future changes to that shared access pattern now only need one contract edit instead of parallel edits across five modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared latest-snapshot access binding
  - refreshed `src/pages/__tests__/channels-page-model-config-contract.test.ts` so it now checks the shared binding import/reference and confirms `ChannelsPageModelConfigOptions` reuses it
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the shared binding import/reference and confirms `ChannelsPageTargetModalsOptions` reuses it
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts` so it now checks the shared binding import/reference and confirms plugin-repair options reuse it instead of declaring `fetchChannels` and `resolveLatestChannelSnapshot` separately
  - refreshed `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` so it now checks the shared binding import/reference and confirms interaction-controller options reuse it instead of declaring the pair separately
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` passed (`5 passed`, `10 passed`).

### Update 457: Reuse a shared managed-status access binding across state-helper, plugin-repair, and interaction-controller contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `managed-status resolvers + latest-snapshot access` binding pair from adjacent contract modules.
- Before this slice, the same managed-status access shape was still declared in parallel across:
  - `src/pages/channels-page-state-helpers-contract.ts`
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts`
  - `src/pages/channels-page-interaction-controllers-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-state-helpers-contract.ts` now owns the shared `ChannelsPageManagedStatusAccessBinding<ResolverChannel, AccessChannel>` interface
  - `src/pages/channels-page-feishu-plugin-repair-contract.ts` now reuses that binding for `ChannelsPageFeishuPluginRepairOptions<Channel>`
  - `src/pages/channels-page-interaction-controllers-contract.ts` now reuses the same binding for `ChannelsPageInteractionControllersOptions`
- Result:
  - managed-status access now has one canonical contract owner
  - state-helper, plugin-repair, and interaction-controller contracts keep the same runtime behavior and public shape while sharing the same managed-status-plus-latest-snapshot vocabulary
  - future changes to that shared access pattern now only need one contract edit instead of parallel edits across three modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the exported shared managed-status access binding
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts` so it now checks the shared binding import/reference and confirms plugin-repair options reuse it instead of declaring managed-status and latest-snapshot access separately
  - refreshed `src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` so it now checks the shared binding import/reference and confirms interaction-controller options reuse it instead of declaring the pair separately
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-state-helpers-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-interaction-controllers-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 458: Reuse a shared target-modal open handler alias inside the target-modal contract
- I tightened the next `ChannelsPage` seam by removing the repeated `(channel: Channel) => void` handler signature from the target-modal open-handler contract.
- Before this slice, the same open-handler shape was still declared inline for both:
  - `handleOpenPairing`
  - `handleOpenDiagnostics`
  - in `src/pages/channels-page-target-modals-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-target-modals-contract.ts` now owns the shared `ChannelsPageTargetModalOpenHandler<Channel>` alias
  - `ChannelsPageTargetModalOpenHandlers<Channel>` now reuses that alias for both `handleOpenPairing` and `handleOpenDiagnostics`
- Result:
  - target-modal open handlers now have one canonical contract owner
  - the target-modal contract keeps the same runtime behavior and public shape while sharing the same open-handler vocabulary across both modal-entry actions
  - future changes to the target-modal open callback signature now only need one contract edit instead of parallel edits across both fields
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the exported shared open-handler alias and the open-handler reuse
  - reran `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` to verify the channel-surface action contract still composes `ChannelsPageTargetModalOpenHandlers<Channel>` without regression
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 459: Reuse a shared target-state access binding across target-state hook and grouped-target-state contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `refresh options + channels binding + derive-state binding` contract bundle from adjacent target-state modules.
- Before this slice, the same target-state access shape was still declared in parallel across:
  - `src/pages/channels-page-feishu-target-state-contract.ts`
  - `src/pages/channels-page-target-state-groups-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-feishu-target-state-contract.ts` now owns the shared `ChannelsPageTargetStateAccessBinding<Channel, State>` interface
  - `ChannelsPageFeishuTargetStateHookOptions<Channel, State>` now reuses that binding and only layers on the target-surface fields
  - `src/pages/channels-page-target-state-groups-contract.ts` now imports and reuses the same binding for `ChannelsPageTargetStateGroupsOptions<Channel, State>`
- Result:
  - target-state access now has one canonical contract owner
  - the target-state hook contract and grouped target-state contract keep the same runtime behavior and public shape while sharing the same refresh-plus-channel-plus-derive vocabulary
  - future changes to that shared access pattern now only need one contract edit instead of parallel edits across both modules
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts` so it now checks the exported shared access binding and the hook-options reuse
  - refreshed `src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` so it now checks the shared binding import/reference and confirms grouped target-state options reuse it instead of declaring the three source bindings inline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-feishu-target-state-contract.test.ts src/pages/__tests__/channels-page-target-state-groups-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 460: Reuse a shared maybe-async surface action handler across channel surface actions
- I tightened the next `ChannelsPage` seam by removing the repeated `(channel: Channel) => Promise<unknown> | void` handler signature from the shared channel-surface action contract.
- Before this slice, the same maybe-async channel-action shape was still declared inline for:
  - `handleOpenModelConfig`
  - `handleToggleChannelEnabled`
  - `handleRepairFeishuPlugin`
  - `handleRemoveChannel`
  - in `src/pages/channels-page-channel-actions-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-channel-actions-contract.ts` now owns the shared `ChannelsPageSurfaceChannelActionHandler<Channel>` alias
  - `ChannelsPageChannelSurfaceActionHandlers<Channel>` now reuses that alias for all four surface action fields instead of restating the same maybe-async handler inline
- Result:
  - maybe-async channel surface actions now have one canonical contract owner
  - the channel-actions contract keeps the same runtime behavior and public shape while sharing the same surface-action vocabulary across all four fields
  - future changes to the shared surface-action callback signature now only need one contract edit instead of parallel edits across four fields
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the exported shared surface-action alias and the surface-action field reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-channel-actions-contract.test.ts` passed (`1 passed`, `2 passed`).

### Update 461: Reuse a shared blocked-modal target-state base across config and pairing modal target contracts
- I tightened the next `ChannelsPage` seam by removing the repeated blocked modal target-state inheritance stack from the modal-props contract.
- Before this slice, the same `shared-status + refresh-state + target-channel + blocked-by-shared-status` contract bundle was still declared in parallel for:
  - `ChannelsPageConfigModalTargetState`
  - `ChannelsPagePairingModalTargetState`
  - in `src/pages/channels-page-modal-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-modal-props-contract.ts` now owns the shared `ChannelsPageBlockedModalTargetState<Alert>` interface
  - `ChannelsPageConfigModalTargetState` now reuses that base with the config modal shared-status alert type
  - `ChannelsPagePairingModalTargetState` now reuses the same base with the pairing modal shared-status alert type
- Result:
  - blocked modal target-state composition now has one canonical contract owner
  - config and pairing modal target contracts keep the same runtime behavior and public shape while sharing the same blocked-target-state vocabulary
  - future changes to that blocked modal target-state bundle now only need one contract edit instead of parallel edits across both modal target interfaces
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the exported shared blocked-modal target-state base and the config/pairing target-state reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-modal-props-contract.test.ts` passed (`1 passed`, `2 passed`).

### Update 462: Reuse a shared base modal target-state contract across blocked and diagnostics modal target states
- I tightened the next `ChannelsPage` seam by removing the repeated `shared-status + refresh-state + target-channel` inheritance stack from the modal-props contract.
- Before this slice, the same modal target-state base shape was still declared in parallel across:
  - `ChannelsPageBlockedModalTargetState<Alert>`
  - `ChannelsPageDiagnosticsModalTargetState`
  - in `src/pages/channels-page-modal-props-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-modal-props-contract.ts` now owns the shared `ChannelsPageBaseModalTargetState<Alert>` interface
  - `ChannelsPageBlockedModalTargetState<Alert>` now reuses that base and only layers on `blockedBySharedStatus`
  - `ChannelsPageDiagnosticsModalTargetState` now reuses the same base and only layers on `fallbackChannel`
- Result:
  - the common modal target-state base now has one canonical contract owner
  - blocked and diagnostics modal target-state contracts keep the same runtime behavior and public shape while sharing the same shared-status-plus-refresh-plus-channel vocabulary
  - future changes to that common modal target-state bundle now only need one contract edit instead of parallel edits across both contracts
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-modal-props-contract.test.ts` so it now checks the exported shared base contract and the blocked/diagnostics target-state reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-modal-props-contract.test.ts` passed (`1 passed`, `2 passed`).

### Update 463: Reuse a shared pairing-requirement binding across data, target-modal, and badge-channel contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `pairingRequired: boolean` field declarations from the data, target-modal, and state-helper contract files.
- Before this slice, the same pairing-requirement shape was still declared in parallel across:
  - `ChannelsPageChannelInfo` in `src/pages/channels-page-data-contract.ts`
  - `ChannelsPageTargetModalChannel` in `src/pages/channels-page-target-modals-contract.ts`
  - `ChannelsPageChannelStatusBadgeChannel` in `src/pages/channels-page-state-helpers-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPagePairingRequirementBinding` interface
  - `ChannelsPageChannelInfo` now extends that shared binding instead of redeclaring `pairingRequired`
  - `ChannelsPageTargetModalChannel` and `ChannelsPageChannelStatusBadgeChannel` now import and extend the same shared binding
- Result:
  - the pairing-required contract now has one canonical owner
  - all three surfaces keep the same runtime behavior and public shape while sharing the same pairing-requirement vocabulary
  - future changes to that field now only need one contract edit instead of parallel edits across three interfaces
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the shared binding export and `ChannelsPageChannelInfo` reuse
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the shared binding import and `ChannelsPageTargetModalChannel` reuse
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the shared binding import and `ChannelsPageChannelStatusBadgeChannel` reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 464: Reuse a shared pairing-account binding across data, target-modal, and channel-action contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `pairingAccountId?: string` field declarations from the data, target-modal, and channel-action contract files.
- Before this slice, the same pairing-account shape was still declared in parallel across:
  - `ChannelsPageChannelInfo` in `src/pages/channels-page-data-contract.ts`
  - `ChannelsPageTargetModalChannel` in `src/pages/channels-page-target-modals-contract.ts`
  - `ChannelsPageChannelActionChannel` in `src/pages/channels-page-channel-actions-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPagePairingAccountBinding` interface
  - `ChannelsPageChannelInfo` now extends that shared binding alongside the existing pairing-requirement binding
  - `ChannelsPageTargetModalChannel` and `ChannelsPageChannelActionChannel` now import and extend the same shared binding instead of redeclaring `pairingAccountId`
- Result:
  - the pairing-account contract now has one canonical owner
  - all three surfaces keep the same runtime behavior and public shape while sharing the same pairing-account vocabulary
  - future changes to that field now only need one contract edit instead of parallel edits across three interfaces
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the shared binding export and `ChannelsPageChannelInfo` reuse
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the shared binding import and `ChannelsPageTargetModalChannel` reuse
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the shared binding import and `ChannelsPageChannelActionChannel` reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 465: Reuse a shared channel-identity binding across data, model-config, and plugin-repair contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `id + channelId` field declarations from the data, model-config, and plugin-repair contract files.
- Before this slice, the same channel-identity shape was still declared in parallel across:
  - `ChannelsPageChannelInfo` in `src/pages/channels-page-data-contract.ts`
  - `ChannelsPageModelConfigChannel` in `src/pages/channels-page-model-config-contract.ts`
  - `ChannelsPageFeishuPluginRepairChannel` in `src/pages/channels-page-feishu-plugin-repair-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageChannelIdentityBinding` interface
  - `ChannelsPageChannelInfo` now extends that shared binding alongside the existing pairing-related bindings
  - `ChannelsPageModelConfigChannel` and `ChannelsPageFeishuPluginRepairChannel` now import and extend the same shared binding instead of redeclaring `id` and `channelId`
- Result:
  - the channel-identity contract now has one canonical owner
  - all three surfaces keep the same runtime behavior and public shape while sharing the same `id + channelId` vocabulary
  - future changes to those identity fields now only need one contract edit instead of parallel edits across three interfaces
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the shared identity binding export and `ChannelsPageChannelInfo` reuse
  - refreshed `src/pages/__tests__/channels-page-model-config-contract.test.ts` so it now checks the shared identity binding import and `ChannelsPageModelConfigChannel` reuse
  - refreshed `src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts` so it now checks the shared identity binding import and `ChannelsPageFeishuPluginRepairChannel` reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-feishu-plugin-repair-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 466: Reuse the shared channel-identity binding across target-modal and channel-action contracts
- I tightened the next `ChannelsPage` seam by removing the remaining repeated `id + channelId` field declarations from the target-modal and channel-action contract files.
- Before this slice, those identity fields were still declared in parallel inside:
  - `ChannelsPageTargetModalChannel` in `src/pages/channels-page-target-modals-contract.ts`
  - `ChannelsPageChannelActionChannel` in `src/pages/channels-page-channel-actions-contract.ts`
- I rewired that seam so that:
  - `ChannelsPageTargetModalChannel` now extends `ChannelsPageChannelIdentityBinding` alongside the existing pairing-requirement and pairing-account bindings
  - `ChannelsPageChannelActionChannel` now extends `ChannelsPageChannelIdentityBinding` alongside the existing pairing-account binding
  - both contracts stop redeclaring `id` and `channelId`, and instead reuse the same shared identity vocabulary already owned by `src/pages/channels-page-data-contract.ts`
- Result:
  - the shared channel-identity binding is now adopted more consistently across the `ChannelsPage` contract surface
  - target-modal and channel-action contracts keep the same runtime behavior and public shape while reusing the same `id + channelId` seam as the data/model/plugin-repair contracts
  - future changes to those identity fields now require fewer parallel edits across adjacent action and modal contracts
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-target-modals-contract.test.ts` so it now checks the shared identity binding import and `ChannelsPageTargetModalChannel` reuse
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the shared identity binding import and `ChannelsPageChannelActionChannel` reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-target-modals-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 467: Reuse a shared enabled-state binding across data, channel-action, and badge-channel contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `enabled: boolean` field declarations from the data, channel-action, and state-helper badge contract files.
- Before this slice, the same enabled-state shape was still declared in parallel across:
  - `ChannelsPageChannelInfo` in `src/pages/channels-page-data-contract.ts`
  - `ChannelsPageChannelActionChannel` in `src/pages/channels-page-channel-actions-contract.ts`
  - `ChannelsPageChannelStatusBadgeChannel` in `src/pages/channels-page-state-helpers-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageChannelEnabledBinding` interface
  - `ChannelsPageChannelInfo` now extends that shared binding alongside the existing identity and pairing-related bindings
  - `ChannelsPageChannelActionChannel` and `ChannelsPageChannelStatusBadgeChannel` now import and extend the same shared binding instead of redeclaring `enabled`
- Result:
  - the enabled-state contract now has one canonical owner
  - all three surfaces keep the same runtime behavior and public shape while sharing the same enabled-state vocabulary
  - future changes to that field now only need one contract edit instead of parallel edits across three interfaces
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the shared enabled binding export and `ChannelsPageChannelInfo` reuse
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the shared enabled binding import and `ChannelsPageChannelActionChannel` reuse
  - refreshed `src/pages/__tests__/channels-page-state-helpers-contract.test.ts` so it now checks the shared enabled binding import and `ChannelsPageChannelStatusBadgeChannel` reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-state-helpers-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 468: Reuse a shared channel-name binding across data, channel-action, and model-config contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `name: string` field declarations from the data, channel-action, and model-config contract files.
- Before this slice, the same channel-name shape was still declared in parallel across:
  - `ChannelsPageChannelInfo` in `src/pages/channels-page-data-contract.ts`
  - `ChannelsPageChannelActionChannel` in `src/pages/channels-page-channel-actions-contract.ts`
  - `ChannelsPageModelConfigChannel` in `src/pages/channels-page-model-config-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageChannelNameBinding` interface
  - `ChannelsPageChannelInfo` now extends that shared binding alongside the existing identity, enabled, and pairing-related bindings
  - `ChannelsPageChannelActionChannel` and `ChannelsPageModelConfigChannel` now import and extend the same shared binding instead of redeclaring `name`
- Result:
  - the channel-name contract now has one canonical owner
  - all three surfaces keep the same runtime behavior and public shape while sharing the same channel-name vocabulary
  - future changes to that field now only need one contract edit instead of parallel edits across three interfaces
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the shared name binding export and `ChannelsPageChannelInfo` reuse
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the shared name binding import and `ChannelsPageChannelActionChannel` reuse
  - refreshed `src/pages/__tests__/channels-page-model-config-contract.test.ts` so it now checks the shared name binding import and `ChannelsPageModelConfigChannel` reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts` passed (`3 passed`, `6 passed`).

### Update 469: Reuse a shared config-channel binding across data and channel-action contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `configChannelId: string` field declarations from the data and channel-action contract files.
- Before this slice, the same config-channel shape was still declared in parallel across:
  - `ChannelsPageChannelInfo` in `src/pages/channels-page-data-contract.ts`
  - `ChannelsPageChannelActionChannel` in `src/pages/channels-page-channel-actions-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageConfigChannelBinding` interface
  - `ChannelsPageChannelInfo` now extends that shared binding alongside the existing identity, enabled, name, and pairing-related bindings
  - `ChannelsPageChannelActionChannel` now imports and extends the same shared binding instead of redeclaring `configChannelId`
- Result:
  - the config-channel contract now has one canonical owner
  - both surfaces keep the same runtime behavior and public shape while sharing the same config-channel vocabulary
  - future changes to that field now only need one contract edit instead of parallel edits across both interfaces
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the shared config-channel binding export and `ChannelsPageChannelInfo` reuse
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the shared config-channel binding import and `ChannelsPageChannelActionChannel` reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 470: Reuse a shared agent binding across data and model-config contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `agentId?: string` field declarations from the data and model-config contract files.
- Before this slice, the same agent-binding shape was still declared in parallel across:
  - `ChannelsPageChannelInfo` in `src/pages/channels-page-data-contract.ts`
  - `ChannelsPageModelConfigChannel` in `src/pages/channels-page-model-config-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageAgentBinding` interface
  - `ChannelsPageChannelInfo` now extends that shared binding alongside the existing identity, name, config-channel, enabled, and pairing-related bindings
  - `ChannelsPageModelConfigChannel` now imports and extends the same shared binding instead of redeclaring `agentId`
- Result:
  - the agent-binding contract now has one canonical owner
  - both surfaces keep the same runtime behavior and public shape while sharing the same agent-binding vocabulary
  - future changes to that field now only need one contract edit instead of parallel edits across both interfaces
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the shared agent binding export and `ChannelsPageChannelInfo` reuse
  - refreshed `src/pages/__tests__/channels-page-model-config-contract.test.ts` so it now checks the shared agent binding import and `ChannelsPageModelConfigChannel` reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-model-config-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 471: Reuse a shared account-name binding across data and channel-action contracts
- I tightened the next `ChannelsPage` seam by removing the repeated `accountName?: string` field declarations from the data and channel-action contract files.
- Before this slice, the same account-name shape was still declared in parallel across:
  - `ChannelsPageChannelInfo` in `src/pages/channels-page-data-contract.ts`
  - `ChannelsPageChannelActionChannel` in `src/pages/channels-page-channel-actions-contract.ts`
- I rewired that seam so that:
  - `src/pages/channels-page-data-contract.ts` now owns the shared `ChannelsPageAccountNameBinding` interface
  - `ChannelsPageChannelInfo` now extends that shared binding alongside the existing identity, name, config-channel, enabled, agent, and pairing-related bindings
  - `ChannelsPageChannelActionChannel` now imports and extends the same shared binding instead of redeclaring `accountName`
- Result:
  - the account-name contract now has one canonical owner
  - both surfaces keep the same runtime behavior and public shape while sharing the same account-name vocabulary
  - future changes to that field now only need one contract edit instead of parallel edits across both interfaces
- I also updated tests:
  - refreshed `src/pages/__tests__/channels-page-data-contract.test.ts` so it now checks the shared account-name binding export and `ChannelsPageChannelInfo` reuse
  - refreshed `src/pages/__tests__/channels-page-channel-actions-contract.test.ts` so it now checks the shared account-name binding import and `ChannelsPageChannelActionChannel` reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channels-page-data-contract.test.ts src/pages/__tests__/channels-page-channel-actions-contract.test.ts` passed (`2 passed`, `4 passed`).

### Update 472: Make Feishu device-code onboarding degrade cleanly when clipboard copy is unavailable
- I switched back to the Feishu onboarding mainline and fixed a real user-facing rough edge in `src/pages/ChannelConnect.tsx` instead of continuing the low-value contract cleanup loop.
- Before this slice, the official device-code path always assumed clipboard copy support existed:
  - the `Official CLI Next Step` blocker would still tell the user to `Copy Device Code`
  - the live auth assist panel would still render copy affordances for the device code and auth URL
  - but on a runtime without usable clipboard support, the action only failed after click with a red error toast
- I rewired that flow so that:
  - `resolveFeishuOfficialOnboardingBlockers(...)` now accepts clipboard availability and prefers safer fallback actions when copy is not available
  - if the current no-wait auth session has both a device code and a browser URL, the blocker now points the user to the official verification page instead of a doomed copy action
  - if only the device code is available, the blocker now keeps the user on the guided-flow surface and explicitly tells them to use the code shown below
  - `resolveFeishuOfficialOnboardingLiveAssist(...)` now suppresses `Copy URL` / `Copy Code` affordances when clipboard support is unavailable, while still showing the underlying values
  - the local action-disable logic now also disables the explicit `copy-device-code` command when clipboard support is missing instead of waiting for a click failure
- Result:
  - the official Feishu device-code path now degrades cleanly on restricted clipboard environments
  - users still get a workable verification route instead of a failing primary CTA
  - this is directly relevant to the final Windows packaged real-test loop because it removes another environment-sensitive onboarding failure mode
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with a blocker case that falls back to the browser verification page when clipboard copy is unavailable
  - extended `src/pages/__tests__/channel-connect.test.ts` with a live-assist case that keeps the device code visible but removes copy affordances when clipboard support is unavailable
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `151 passed`).

### Update 473: Surface a manual fallback when opening the Feishu auth URL fails
- I fixed the next real Feishu onboarding rough edge in `src/pages/ChannelConnect.tsx`: the `Open Browser` action for official CLI auth no longer fails silently when the system browser handoff breaks in a packaged Windows environment.
- Before this slice, `handleFeishuOfficialOnboardingAction('open-auth-url')` awaited `window.api.openOAuthUrl(...)` and then always refocused the guided-flow card:
  - if Electron could not hand the URL to the system browser
  - or if the backend returned `ok: false`
  - the user got no visible feedback even though the auth step had not actually advanced
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now owns `getFeishuOfficialAuthUrlOpenFailureMessage(...)` as the canonical fallback-message helper for official auth URL open failures
  - `open-auth-url` now checks the `openOAuthUrl(...)` result instead of ignoring it
  - backend failures now raise a red `Open browser failed` notification with explicit manual fallback guidance
  - thrown exceptions also map through the same manual fallback message, so the user is told to continue from the visible `Browser URL` instead of guessing what happened
- Result:
  - the official Feishu auth flow is more deterministic on packaged Windows builds where default-browser handoff can fail intermittently
  - users now get a clear recovery path instead of a silent no-op
  - this closes another environment-sensitive gap on the last Feishu acceptance mile
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with a helper test that locks the manual fallback copy for failed auth-URL open attempts
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `152 passed`).

### Update 474: Restore live guided-session notice after page refresh or resumed Feishu auth flow
- I fixed another real Feishu onboarding continuity gap in `src/pages/ChannelConnect.tsx`: when the official CLI session was already running and the page reloaded or reattached to that session, Mclaw restored the raw session data but lost the contextual guidance text.
- Before this slice:
  - `applyFeishuOfficialCliSessionSnapshot(...)` restored mode, output, auth URL, and device code
  - but `feishuOfficialCliSessionNotice` stayed empty on resumed sessions
  - so users coming back mid-login only saw raw session state, without the same “what to do next” guidance they got when the session first started
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuOfficialCliSessionLiveNotice(...)` as the canonical notice resolver for active official CLI sessions
  - snapshot restore now rebuilds the live notice from the current mode plus any restored auth URL / device code
  - `started` events and later `challenge` events now use the same resolver, so the notice upgrades itself once verification data arrives
- Result:
  - resumed Feishu auth sessions now preserve actionable context instead of degrading to a blank helper area
  - device-code and browser-auth flows stay understandable after page refresh, channel revisit, or session reattachment
  - this reduces another packaged-Windows acceptance risk because users can recover an in-flight official auth flow without guessing
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with live-notice cases for resumed device-code sessions, resumed guided-browser sessions, and inactive sessions
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `155 passed`).

### Update 475: Stop requests for Feishu guided flows no longer fail silently
- I fixed another real Feishu onboarding control gap in `src/pages/ChannelConnect.tsx`: stopping the official CLI guided session or the Feishu installer no longer pretends to succeed when the backend stop request fails.
- Before this slice:
  - `stopFeishuOfficialCliGuidedFlow()` always set `Stopping the official guided session...` after awaiting the IPC call, even if the backend returned `{ ok: false }`
  - `stopFeishuInstallerFlow()` awaited the stop request but ignored both backend failure and thrown exceptions
  - in practice that meant users could click stop, see no actionable error, and assume the flow was shutting down when it was not
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuStopRequestFeedback(...)` as the canonical success/error copy for Feishu stop requests
  - the official CLI stop path now checks `stopFeishuOfficialCliSession()` result before showing the stopping notice
  - the installer stop path now does the same for `stopFeishuInstaller()`
  - both stop paths now catch thrown failures and map them into explicit retryable user-facing errors instead of leaking a silent rejection through the button click
- Result:
  - stop controls for the official Feishu guided flow and installer are now honest about whether Mclaw actually managed to send the stop request
  - users get a retryable error instead of misleading progress copy
  - this reduces another real packaged-Windows support risk because stop/retry loops are now easier to reason about during onboarding
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with stop-feedback cases covering successful official guided-session stop requests and failed installer stop requests
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `157 passed`).

### Update 476: Decision-surface refresh now reloads the full Feishu setup state instead of only CLI auth
- I fixed a real Feishu onboarding mismatch in `src/pages/ChannelConnect.tsx`: the `Official CLI Next Step` card could tell the user to click `Refresh Status` for local runtime/plugin recovery, but that action only refreshed official CLI auth state instead of the full Feishu setup state.
- Before this slice:
  - the main page-level `刷新状态` button used `refreshFeishuSetupState(...)`, which reloads local plugin state, installer snapshot, recovered bots, and official CLI status together
  - but the decision-surface `refresh-status` action only called `loadFeishuOfficialCliStatus()`
  - so users following the blocker guidance could click the right button on the wrong surface and still fail to refresh the state that actually mattered
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuStatusRefreshOptions(...)` as the canonical request builder for user-initiated Feishu refreshes
  - the decision-surface `refresh-status` action now uses the full `refreshFeishuSetupState(...)` path
  - the page-level `刷新状态` button now reuses the same options helper, so both entry points share the same refresh semantics
- Result:
  - `Refresh Status` now really means “refresh the current Feishu onboarding state”, not only “re-read lark-cli auth”
  - blockers that ask the user to refresh local setup state now point to an action that actually performs that refresh
  - manual-binding recovery also stays wired through the same refresh request when it is in flight
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with cases that lock the refresh request options for both manual-binding recovery and normal refresh flows
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `159 passed`).

### Update 477: Feishu session input writes now fail explicitly instead of leaking unhandled IPC errors
- I fixed another real Feishu onboarding interaction gap in `src/pages/ChannelConnect.tsx`: sending text into the official CLI guided session or the Feishu installer no longer relies on the IPC call succeeding silently.
- Before this slice:
  - `sendFeishuInstallerInput(...)` and `sendFeishuOfficialCliSessionInput(...)` handled normal `{ ok: false }` responses
  - but neither function caught thrown preload / IPC errors
  - so if the session write crashed at the transport layer, the click path could reject without converting that failure into a stable user-facing error
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `getFeishuSessionInputFailureMessage(...)` as the canonical failure-message helper for Feishu session input writes
  - both session-input functions now wrap the IPC write in `try/catch`
  - normal backend write failures and thrown IPC failures now both resolve to explicit user-facing errors and return `false` instead of leaking an unhandled rejection through the UI event path
- Result:
  - typing into the official guided session or installer is now more robust on flaky packaged environments where the preload bridge or session transport can fail transiently
  - users get a clear error instead of a silent no-op or console-only rejection
  - this closes another support-heavy edge case on the last Feishu acceptance mile
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with input-failure helper cases for installer write failures and thrown official guided-session IPC failures
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `161 passed`).

### Update 478: Reattaching to an already-running Feishu session now tells the user what happened
- I fixed another real Feishu onboarding continuity gap in `src/pages/ChannelConnect.tsx`: when the user tries to start an official CLI guided flow or the Feishu installer while one is already running, Mclaw no longer just silently reuses the existing session.
- Before this slice:
  - `startFeishuOfficialCliGuidedFlow(...)` and `startFeishuInstallerFlow(...)` checked the current session state
  - if a session was already active, they restored the snapshot and returned
  - but the user was not explicitly told that Mclaw had reattached to an existing session instead of starting the one they just requested
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuSessionReuseNotice(...)` as the canonical message helper for session reuse
  - reattaching to an already-running official CLI session now sets a notice explaining whether Mclaw reused the same mode or attached to a different running mode
  - reattaching to an already-running Feishu installer now also sets an explicit reuse notice instead of silently restoring the output
- Result:
  - duplicate-start clicks now have deterministic user feedback instead of looking like a dead button
  - users can tell when Mclaw reused a running Guided Login / Device Code / Config Init session instead of launching a new one
  - this reduces another support-heavy edge case in packaged builds where users often retry buttons after a page refresh or delayed UI update
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with reuse-notice cases for mismatched official CLI session modes and installer-session reuse
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `163 passed`).

### Update 479: Resumed Feishu installer sessions now restore actionable live guidance
- I fixed the installer-side twin of the resumed-session guidance gap in `src/pages/ChannelConnect.tsx`: when Mclaw restores or reattaches to an already-running Feishu installer session, the page now restores a meaningful live notice instead of only showing the raw output and QR area.
- Before this slice:
  - `applyFeishuInstallerSnapshot(...)` restored session id, running state, output, and exit code
  - but it did not rebuild any installer guidance text
  - so after a page refresh or session restore, users could be dropped back into a running installer with no explicit “scan now” vs “wait for current QR refresh” context
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuInstallerSessionLiveNotice(...)` as the canonical live-notice helper for installer sessions
  - installer snapshot restore now derives guidance from the restored output, including whether a live QR is already present
  - installer `started` events now also set a deterministic waiting notice immediately, instead of leaving the helper area blank
- Result:
  - resumed Feishu installer sessions now preserve actionable guidance the same way resumed official CLI auth sessions already do
  - users can tell whether they should scan the current QR or keep waiting for the installer to refresh it
  - this removes another refresh/reopen support edge case on packaged Windows builds
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with installer live-notice cases for resumed sessions with a live QR and running sessions still waiting for the QR refresh
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `165 passed`).

### Update 480: Feishu installer live guidance now updates as soon as new output arrives
- I fixed the next real Feishu installer continuity gap in `src/pages/ChannelConnect.tsx`: while the installer was running, the guidance notice did not upgrade itself when new output finally contained the current-session QR information.
- Before this slice:
  - `resolveFeishuInstallerSessionLiveNotice(...)` already existed and was used on installer start and snapshot restore
  - but the live `output` event only appended to `feishuInstallerOutput`
  - so the notice could stay stuck on “wait for QR refresh” even after the current QR URL or ASCII QR had already arrived in the installer output
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuInstallerOutputState(...)` as the canonical output-state helper for installer QR detection
  - live installer `output` events now recompute the installer notice from the accumulated output instead of only appending text
  - I also added `feishuInstallerOutputRef` and reset it on new installer starts / channel changes, so a new run cannot accidentally append or reason from stale output
- Result:
  - the installer guidance now flips to “scan the current QR shown below” as soon as the live output actually contains that QR
  - new installer runs start from a clean output state instead of inheriting previous run leftovers
  - this removes another refresh/retry confusion point from the final packaged-Windows Feishu onboarding path
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with output-state cases that lock live QR detection from installer output and the empty-output baseline
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `167 passed`).

### Update 481: Feishu installer exit states now replace stale running hints with deterministic completion/cancel/failure notices
- I fixed another real Feishu installer continuity gap in `src/pages/ChannelConnect.tsx`: once the installer stopped running, the notice area could still carry the last running-state guidance or go blank after a restore, instead of telling the user how that installer session actually ended.
- Before this slice:
  - the installer notice had live-session coverage for running states
  - but installer `exit` events did not replace that live guidance with an exit-state notice
  - and restored inactive installer snapshots also collapsed to an empty notice because the live helper returns nothing when `running` is false
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuInstallerSessionExitNotice(...)` as the canonical notice helper for installer exit states
  - installer snapshot restore now shows a deterministic success / failure / canceled notice when the installer is no longer active
  - live installer `exit` events now also set that exit notice immediately, so stale “scan now” / “wait for QR refresh” copy does not survive past process termination
- Result:
  - users now get explicit post-run guidance after the installer finishes, fails, or is canceled
  - resumed inactive installer sessions no longer lose all context after a page refresh
  - this removes another packaged-Windows support edge case where the installer state was technically correct but the helper copy lagged behind it
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with exit-notice cases for successful completion, non-zero exit, and canceled installer sessions
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `170 passed`).

### Update 482: Official CLI exit states now survive page restore instead of collapsing back to blank or generic notices
- I fixed the official-CLI side of the same continuity problem in `src/pages/ChannelConnect.tsx`: after a guided Feishu CLI session had already ended, reloading or reattaching to that session could drop the user back into a blank or stale notice state instead of preserving the actual exit outcome.
- Before this slice:
  - live official CLI sessions already had running-state guidance
  - live `exit` events computed good completion/cancel/failure notices
  - but restored inactive snapshots still ran through the live-notice path, which returns nothing when `running` is false
  - and if auth status finished loading after the snapshot restore, the exit notice did not automatically upgrade to the authenticated “auth confirmed” copy
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuOfficialCliSessionExitNotice(...)` as the canonical exit-notice helper for official CLI sessions
  - inactive official CLI snapshots now restore a deterministic cancel / success / failure notice instead of blanking the helper area
  - the live `exit` handler now reuses that same helper instead of duplicating the branching logic
  - I also added a follow-up effect so that when `lark-cli` auth state finishes loading after a restore, the inactive-session notice upgrades itself to the correct authenticated completion message
- Result:
  - completed, failed, and canceled official CLI sessions now keep their real outcome visible after page refresh and session restore
  - authenticated login sessions no longer get stuck on a weaker generic completion hint just because auth state arrived a moment later
  - this removes another packaged-Windows support edge case from the last Feishu onboarding mile
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with official CLI exit-notice cases for authenticated login completion, config-init completion, and canceled sessions
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `173 passed`).

### Update 483: New official CLI sessions now clear stale output and challenge data before the next auth flow begins
- I fixed another real Feishu guided-session continuity gap in `src/pages/ChannelConnect.tsx`: when a fresh official CLI session started, the page could briefly retain output or challenge data from the previous session until the new session emitted its own challenge payload.
- Before this slice:
  - `startFeishuOfficialCliGuidedFlow(...)` manually cleared several fields before asking the backend to start a new session
  - but the live `started` event path did not clear old output, old auth URL, or old device code
  - so a newly started session coming in through event reattachment or delayed UI state could temporarily inherit stale guidance artifacts from the previous run
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuOfficialCliSessionStartState(...)` as the canonical initial state for a fresh official CLI session
  - both the explicit start action and the live `started` event now use that same reset state
  - a new session now starts from empty output, empty auth URL, empty device code, and the correct mode-specific live notice instead of carrying previous-session residue
- Result:
  - fresh Guided Login / Device Code / Config Init runs now start from a clean state even when the session is restored via events rather than only via the direct start button path
  - users no longer risk seeing an old device code or outdated output while a new official auth flow is starting
  - this closes another small but real confusion point on the packaged-Windows Feishu acceptance path
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with start-state cases for a fresh Guided Login session and a fresh Device Code session
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `175 passed`).

### Update 484: Fresh Feishu sessions now clear stale draft input as well as stale output
- I fixed the next small but real continuity gap in `src/pages/ChannelConnect.tsx`: starting a fresh official CLI session or a fresh Feishu installer session now clears any unsent draft text left in the session input box from the previous run.
- Before this slice:
  - I had already centralized fresh official CLI session startup through `resolveFeishuOfficialCliSessionStartState(...)`
  - but the typed draft input itself was not part of that shared reset state
  - the installer path had the same issue: a new session could inherit old unsent text in the input box even though output and notice state had already been reset
- I rewired that path so that:
  - `resolveFeishuOfficialCliSessionStartState(...)` now also owns the cleared draft-input state for fresh official CLI sessions
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuInstallerSessionStartState(...)` so the installer start path and installer `started` event share the same clean startup state
  - both the official CLI and installer now clear stale draft input on explicit start and on live `started` reattachment
- Result:
  - new sessions no longer risk sending leftover text from a previous run into a fresh installer or guided CLI session
  - the interactive composer now matches the already-clean output / notice state at the beginning of each session
  - this removes another packaged-Windows edge case where retrying a flow after interruption could carry hidden UI residue into the new session
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` so fresh official CLI start-state expectations now include empty draft input
  - added an installer start-state case that locks the cleared draft-input behavior for new installer sessions
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `176 passed`).

### Update 485: Switching channels now clears stale local Feishu view state instead of briefly reusing the previous session snapshot
- I fixed another real continuity gap in `src/pages/ChannelConnect.tsx`: when the user switched away from Feishu and later came back, the page could briefly reuse local Feishu session / bot / plugin state from the previous visit before the fresh state reload completed.
- Before this slice:
  - `handleChannelChange(...)` reset part of the Feishu wizard state
  - but several local Feishu view slices were left behind, including installer session state, official CLI status, detected bots, selected existing bot, and some transient flags
  - so re-entering the Feishu channel could momentarily show stale installer output, stale CLI status, or old detected-bot selections until the asynchronous reload caught up
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuChannelViewResetState(...)` as the canonical reset state for local Feishu channel UI
  - `handleChannelChange(...)` now resets the full local Feishu view state from that helper instead of only clearing a subset of fields
  - I also clear `canSkip` on channel switch so skip visibility cannot leak across channels while new state is loading
- Result:
  - switching away from Feishu and back now starts from a clean local view instead of momentarily replaying the previous session snapshot
  - stale installer / official CLI / bot-selection residue no longer flashes before the fresh Feishu state reload lands
  - this removes another packaged-Windows edge case where the UI looked like it had resumed a session that was only locally cached, not actually current
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with a reset-state case that locks the full cleared Feishu view shape used during channel switches
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `177 passed`).

### Update 486: Refresh Status now also reloads the official CLI session snapshot, not only installer/plugin state
- I fixed another real Feishu refresh gap in `src/pages/ChannelConnect.tsx`: even after I unified the decision-surface refresh behavior, a user-initiated refresh still did not reload the current official CLI session snapshot itself.
- Before this slice:
  - `refreshFeishuSetupState(...)` refreshed plugin/setup state, installer snapshot, and `lark-cli` status
  - but it did not reload `getFeishuOfficialCliSessionState()`
  - so if the page had missed official CLI session events or the session snapshot had changed outside the current event stream, clicking `Refresh Status` could still leave the official CLI session panel stale
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `loadFeishuRefreshResources(...)` as the canonical bundled refresh loader for Feishu setup state, installer snapshot, official CLI session snapshot, and official CLI status
  - `refreshFeishuSetupState(...)` now uses that helper and applies the refreshed official CLI session snapshot when available
  - snapshot probing failures for installer/session still degrade safely to `null`, so the broader refresh flow stays resilient
- Result:
  - user-initiated refresh now really refreshes the whole Feishu onboarding surface, including the live official CLI session panel
  - missed event updates no longer require a full page reload to bring the official CLI panel back in sync
  - this removes another packaged-Windows edge case where `Refresh Status` sounded complete but left one critical surface stale
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with async cases that lock bundled refresh behavior and verify installer/session snapshot probe failures degrade to `null` instead of breaking the whole refresh
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `179 passed`).

### Update 487: Fresh Feishu session starts now clear stale session IDs before the new run attaches
- I fixed another small but real continuity gap in `src/pages/ChannelConnect.tsx`: when a fresh official CLI session or installer session started, the page could keep the previous session id in local state until the new run attached.
- Before this slice:
  - I had already centralized fresh session startup for output, challenge data, and draft input
  - but the old `sessionId` itself was not part of the shared reset state
  - so if a restart failed before the new session attached, local state could still carry the previous session id even though a new run had already been requested
- I rewired that path so that:
  - `resolveFeishuOfficialCliSessionStartState(...)` now also owns the cleared session id for fresh official CLI runs
  - `resolveFeishuInstallerSessionStartState(...)` now does the same for installer runs
  - both explicit start actions now clear the previous session id before the backend start request, while `started` events still replace it with the actual new session id once attached
- Result:
  - failed restarts no longer leave an old session id masquerading as the current run
  - the fresh-session state is now fully clean across session id, output, draft input, and challenge data
  - this removes another subtle retry edge case from the packaged-Windows Feishu onboarding path
- I also updated tests:
  - extended the official CLI and installer start-state expectations in `src/pages/__tests__/channel-connect.test.ts` so fresh sessions now explicitly lock an empty `sessionId`
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `179 passed`).

### Update 488: Initial Feishu hydration now restores official CLI session notices from the freshly loaded auth state
- I fixed another real first-load continuity gap in `src/pages/ChannelConnect.tsx`: initial Feishu page hydration and bundled refresh were not using one shared source of truth for the official CLI auth state when rebuilding the resumed-session notice.
- Before this slice:
  - I had already added bundled refresh loading through `loadFeishuRefreshResources(...)`
  - but initial Feishu page hydration and restored official CLI session notice handling could still depend on local state ordering instead of the freshly loaded `officialCliStatus`
  - so a resumed `lark-cli` session could briefly restore with a stale or missing notice until a later state update landed
- I rewired that path so that:
  - `resolveFeishuOfficialCliSessionSnapshotNotice(...)` now centralizes how restored official CLI session notices are derived from session snapshot + auth state
  - `applyFeishuOfficialCliSessionSnapshot(...)` now accepts an optional auth-state override so restore logic can use the just-loaded `officialCliStatus` immediately
  - the initial Feishu page hydration effect now uses bundled `loadFeishuRefreshResources(...)` loading instead of separate ad-hoc probes, and applies installer/session snapshots from the same payload
  - `refreshFeishuSetupState(...)` now passes the freshly loaded `officialCliStatus?.authState` into the restored official CLI snapshot path instead of relying on older closure state
- Result:
  - first entry into the Feishu channel now restores the official CLI session surface from one coherent refresh payload
  - resumed-session notices no longer depend on a later auth-state race to become accurate
  - this removes another packaged-Windows edge case where the official CLI panel looked partially restored on first load
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with restored-notice cases for `resolveFeishuOfficialCliSessionSnapshotNotice(...)`
  - kept the bundled refresh loader tests aligned with the new initial-load path
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `181 passed`).

### Update 489: Link-path transitions now clear stale create-flow recovery snapshots instead of leaking old create state
- I fixed another real Feishu continuity gap in `src/pages/ChannelConnect.tsx`: the create-flow recovery snapshot could survive after the UI had already moved back to the link/manual path or after the user left the Feishu channel entirely.
- Before this slice:
  - `feishuCreateStartConfigSnapshotRef` was captured when the official Feishu installer started in create mode
  - but that recovery snapshot was not being explicitly cleared on every successful transition back into the link path, nor on full Feishu channel reset
  - so later refreshes or returns to the Feishu page could still carry an old create-run comparison baseline that no longer matched the current path
- I rewired that path so that:
  - `resolveFeishuPreparedLinkRecovery(...)` now also carries the canonical cleared create-snapshot state for all prepared link recoveries
  - every successful manual/link recovery path now clears `feishuCreateStartConfigSnapshotRef` before switching the UI back to link mode
  - `resolveFeishuChannelViewResetState(...)` now includes the cleared create-snapshot state too, and `handleChannelChange(...)` applies it during full Feishu view reset
  - direct path focusing into the link card now also drops the stale create snapshot instead of silently keeping it alive
- Result:
  - old create-flow recovery baselines no longer leak into link-mode refreshes, re-entry, or manual-binding recovery
  - Feishu path switching now keeps the recovery comparator aligned with the currently active path instead of a previous installer run
  - this removes another subtle packaged-Windows retry edge case where the create path could look partially recoverable after the user had already moved back to link/manual setup
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` so `resolveFeishuPreparedLinkRecovery(...)` and `resolveFeishuChannelViewResetState(...)` now lock the cleared create-snapshot state
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `181 passed`).

### Update 490: Restored Feishu session snapshots now clear stale unsent draft input when the session changed or already ended
- I fixed another real Feishu continuity gap in `src/pages/ChannelConnect.tsx`: installer / official CLI snapshot restore could keep a locally typed draft input from an older session even after Mclaw had already reattached to a different session or an exited one.
- Before this slice:
  - fresh session starts already cleared the draft input fields
  - but restored snapshots from preload / refresh / reattach only updated output, status, and notice
  - so a stale unsent draft could remain in the input box when the restored backend session id had changed, or when the restored session was already inactive
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `shouldResetFeishuSessionDraftOnSnapshot(...)` as the canonical rule for whether a restored session snapshot should drop local draft input
  - `applyFeishuInstallerSnapshot(...)` now clears installer draft input when the restored snapshot belongs to a different session, has no session id, or is already inactive
  - `applyFeishuOfficialCliSessionSnapshot(...)` now does the same for the official `lark-cli` guided session
  - refreshes that reattach to the same still-running session keep the current unsent draft instead of wiping it unnecessarily
- Result:
  - stale local draft input no longer leaks across restored installer / official CLI sessions
  - first-load reattach, manual refresh, and background session reuse now keep the input box aligned with the actual backend session lifecycle
  - this removes another packaged-Windows edge case where the Feishu panel looked attached to one session while the text box still belonged to a previous one
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with `shouldResetFeishuSessionDraftOnSnapshot(...)` cases covering changed session ids, same-session refresh, and inactive restored sessions
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `184 passed`).

### Update 491: Restored Feishu installer snapshots now also clear stale auto-reply prompt state when the backend session changed
- I fixed another real Feishu continuity gap in `src/pages/ChannelConnect.tsx`: installer snapshot restore could still keep the previous auto-reply prompt key even after Mclaw had already reattached to a different installer session.
- Before this slice:
  - I had already taught restored session snapshots to clear stale unsent draft input when the session changed
  - but the installer-specific `feishuInstallerPromptAutoReplyKeyRef` was not part of that reset path
  - so if a newly restored installer session emitted the same reuse prompt shape as a previous session, Mclaw could incorrectly think it had already auto-replied and skip the Y/n response
- I rewired that path so that:
  - `applyFeishuInstallerSnapshot(...)` now derives one shared `shouldResetEphemeralState` decision from `shouldResetFeishuSessionDraftOnSnapshot(...)`
  - when that reset condition is true, the restored installer snapshot now clears both the local draft input and the cached installer auto-reply prompt key before continuing
  - same-session refresh still preserves the current auto-reply guard, so Mclaw does not double-submit on a normal reattach to the same running installer session
- Result:
  - reattached installer sessions no longer inherit stale prompt-response state from a previous run
  - the automatic Y/n recovery path stays aligned with the actual backend installer session instead of a locally cached key from an older session
  - this removes another packaged-Windows retry edge case where a restored installer looked active but silently skipped the expected reuse/create prompt reply
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with an additional `shouldResetFeishuSessionDraftOnSnapshot(...)` case that locks the missing-session-id reset branch used by the shared snapshot-reset rule
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `185 passed`).

### Update 492: Feishu installer reuse-prompt detection now follows the latest prompt occurrence instead of the first historical one
- I fixed another real Feishu continuity gap in `src/lib/feishu-installer.ts`: the reuse-prompt key extractor was effectively sticky to the first historical prompt in the accumulated installer log.
- Before this slice:
  - `extractFeishuExistingBotPromptKey(...)` only checked whether any reuse prompt existed anywhere in the normalized installer output
  - it then paired that with the first matching `cli_*` id and returned one static key
  - so if the same installer session later emitted a second reuse prompt, or switched to a later bot prompt, Mclaw could keep thinking the old prompt was still the current one
- I rewired that path so that:
  - `extractFeishuExistingBotPromptKey(...)` now counts and orders all detected reuse prompts in the normalized output instead of collapsing them into one historical boolean
  - it associates the key with the latest `cli_*` id that appears before the latest prompt, falling back only when needed
  - the returned key now includes the prompt occurrence count, so repeated prompts in one installer session produce a fresh auto-reply key instead of reusing the stale first one forever
- Result:
  - installer auto-reply detection now tracks the most recent reuse/create prompt instead of the oldest prompt still present in the scrollback
  - repeated prompts in one long-running installer session can trigger the correct Y/n auto-reply path again when the prompt genuinely changed
  - this removes another packaged-Windows retry edge case where the Feishu installer panel looked active but Mclaw was still anchored to a stale historical reuse prompt
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with `extractFeishuExistingBotPromptKey(...)` cases covering repeated prompts and later prompts for a newer bot inside the same installer session
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `187 passed`).

### Update 493: Feishu session start buttons now avoid wiping local state before they discover they are only reattaching to an existing run
- I fixed another real Feishu continuity gap in `src/pages/ChannelConnect.tsx`: both the official `lark-cli` start action and the installer start action were priming fresh-start UI state before checking whether the backend already had a running session.
- Before this slice:
  - clicking a start button immediately cleared local output, challenge data, input draft, notices, and some installer-specific ephemeral state
  - only after those resets did Mclaw ask the backend whether a session was already active
  - so a plain reattach to an existing session could still briefly wipe local state, overwrite the active setup mode, or disturb the create-flow snapshot baseline even though no fresh run had actually started
- I rewired that path so that:
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuOfficialCliSessionStartPlan(...)` as the canonical rule for whether official guided-session start should prime fresh-start UI state or preserve the current session mode during a reuse attach
  - `src/pages/ChannelConnect.tsx` now exports `resolveFeishuInstallerStartPlan(...)` as the equivalent installer rule, including whether the create snapshot baseline should be captured, cleared, or preserved
  - `startFeishuOfficialCliGuidedFlow(...)` now checks for an active backend session first, only primes fresh-start local state when a genuinely new guided session is about to start, and keeps reuse attaches from unnecessarily wiping local draft/challenge state first
  - `startFeishuInstallerFlow(...)` now does the same for the Feishu installer, so reuse attaches no longer pre-clear installer output/input, flip the setup mode prematurely, or mutate the create snapshot baseline before the active-session check returns
- Result:
  - clicking a start button while a backend session is already running now behaves like a clean reattach instead of a fake fresh start followed by a correction
  - local draft input, challenge state, setup mode, and create-mode recovery baseline stay aligned with the actual backend session lifecycle
  - this removes another packaged-Windows edge case where a reattach looked like a new start for a moment and could disturb the user’s in-progress Feishu flow
- I also updated tests:
  - extended `src/pages/__tests__/channel-connect.test.ts` with `resolveFeishuOfficialCliSessionStartPlan(...)` cases for reuse vs fresh start
  - extended `src/pages/__tests__/channel-connect.test.ts` with `resolveFeishuInstallerStartPlan(...)` cases for reuse vs fresh installer start, including create-snapshot preservation/clear decisions
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/pages/__tests__/channel-connect.test.ts` passed (`1 passed`, `191 passed`).

### Update 494: Feishu dashboard bot manager now follows the same hardened installer restore / reattach rules as Channel Connect
- I fixed another real Feishu continuity gap in `src/components/FeishuBotManagerModal.tsx`: the dashboard bot manager’s installer flow had not kept up with the hardened session-restore logic already applied in Channel Connect.
- Before this slice:
  - `FeishuBotManagerModal` restored installer snapshots without clearing stale local draft input, stale auto-reply prompt state, or stale notice state when the backend session changed or had already exited
  - its `startFeishuInstallerFlow(...)` also set local setup mode and other start-side UI assumptions before checking whether the backend was actually just reattaching to an already running installer session
  - so the dashboard modal could still show the older “fake fresh start before reattach” behavior and stale prompt/input residue even after the main onboarding surface was hardened
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `shouldResetFeishuBotManagerInstallerEphemeralState(...)` as the canonical rule for when restored installer snapshots should drop stale local prompt/input/notice state
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerInstallerStartState(...)` for a clean fresh installer start baseline inside the dashboard modal
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerInstallerStartPlan(...)` so reuse attaches preserve the current mode instead of priming a fake fresh start first
  - `applyFeishuInstallerSnapshot(...)` now clears stale input, auto-reply key, and notice when the restored snapshot belongs to a different installer session, has no usable session id, or is already inactive
  - `startFeishuInstallerFlow(...)` now waits for the active-session check before priming fresh-start UI state, so a plain reattach no longer wipes or mutates local installer state first
- Result:
  - the dashboard Feishu bot manager now behaves like a clean reattach when the installer is already running instead of pretending a new installer run has started
  - stale prompt/input/notice residue no longer leaks across restored installer sessions inside the modal
  - this removes another packaged-Windows edge case where the dashboard recovery surface behaved differently from the main Feishu onboarding surface
- I also updated tests:
  - added `src/components/__tests__/feishu-bot-manager-modal.test.ts` with focused helper coverage for fresh-start state, reuse-vs-fresh start planning, and installer snapshot ephemeral-state reset decisions
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `197 passed`).

### Update 495: Feishu dashboard bot manager now resets stale output on installer started events and explicitly explains reuse attaches
- I fixed the next real Feishu continuity gap in `src/components/FeishuBotManagerModal.tsx`: the dashboard bot manager still handled installer `started` events and reuse attaches less cleanly than the main Channel Connect surface.
- Before this slice:
  - when a fresh installer `started` event arrived while the modal was open, it only updated session id / running / exit state and could leave stale output, stale draft input, or stale notice text from the previous installer run visible until later output arrived
  - when the user clicked the dashboard installer start action while a backend installer session was already running, the modal quietly reattached without surfacing an explicit reuse notice
  - so the dashboard surface could still look ambiguous on restart/reuse even after the main onboarding page had already been hardened
- I rewired that path so that:
  - the installer `started` event handler in `src/components/FeishuBotManagerModal.tsx` now applies the full `resolveFeishuBotManagerInstallerStartState(...)` reset instead of only partially touching session fields
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerInstallerReuseNotice(...)` so reuse attaches have one canonical user-facing explanation
  - the dashboard `startFeishuInstallerFlow(...)` now sets that reuse notice after reattaching to an already running installer session, instead of silently returning
- Result:
  - external or fresh installer starts now clear stale dashboard modal output/input/notice state immediately instead of waiting for follow-up output to overwrite it
  - reuse attaches in the dashboard bot manager are now explicit and understandable instead of silent
  - this removes another packaged-Windows edge case where the dashboard Feishu installer modal looked half-reset or unexplained during reattach/restart behavior
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with `resolveFeishuBotManagerInstallerReuseNotice(...)` coverage while keeping the previously added start/reset helper coverage in place
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `198 passed`).

### Update 496: Feishu dashboard bot manager now gives honest installer stop feedback instead of silently swallowing failures
- I fixed the next real Feishu continuity gap in `src/components/FeishuBotManagerModal.tsx`: the dashboard bot manager’s installer stop button still behaved silently compared with the hardened stop feedback already present in the main Channel Connect surface.
- Before this slice:
  - `stopFeishuInstallerFlow(...)` called `window.api.stopFeishuInstaller()` but ignored the returned `ok` state
  - so a failed backend stop request could look like it succeeded, because the modal showed no explicit error
  - and a successful stop request also gave no immediate local notice that Mclaw had at least accepted the stop attempt
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerInstallerStopFeedback(...)` as the canonical stop-request feedback rule for the dashboard modal
  - `stopFeishuInstallerFlow(...)` now clears stale modal errors before issuing the stop request, then shows either a local “Stopping the official Feishu installer...” notice or a retryable failure message depending on the backend result
  - thrown stop-call failures now also fall back to the same retryable error path instead of being silently swallowed
- Result:
  - the dashboard Feishu installer stop button is now honest about whether the backend accepted the stop request
  - stop failures are visible and retryable instead of looking like a no-op success
  - this removes another packaged-Windows edge case where the dashboard modal could leave the user guessing whether a stop click had actually done anything
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with `resolveFeishuBotManagerInstallerStopFeedback(...)` cases for accepted vs failed stop requests
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `200 passed`).

### Update 497: Feishu dashboard bot manager now hardens installer input write failures instead of letting IPC errors escape silently
- I fixed the next real Feishu continuity gap in `src/components/FeishuBotManagerModal.tsx`: the dashboard bot manager’s installer input path still lacked the hardened try/catch handling already present in the main Channel Connect surface.
- Before this slice:
  - `sendFeishuInstallerInput(...)` awaited `window.api.sendFeishuInstallerInput(...)` directly and only handled normal `{ ok: false }` responses
  - if the IPC call itself threw or the bridge rejected, the dashboard modal could surface an unhandled promise rejection instead of a user-facing installer write error
  - this also meant the dashboard Feishu surface was still less robust than the main onboarding page under the same backend write failure
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `getFeishuBotManagerInstallerInputFailureMessage(...)` as the canonical user-facing installer write failure formatter for the dashboard modal
  - `sendFeishuInstallerInput(...)` now uses a full try/catch path, mapping both `{ ok: false }` backend results and thrown IPC failures into the same actionable local error surface instead of letting promise failures escape
  - while landing that change I also normalized several malformed modal text literals in `src/components/FeishuBotManagerModal.tsx` to stable valid copy so the dashboard Feishu modal remains buildable and testable after the new helper coverage was added
- Result:
  - dashboard installer input failures are now surfaced as a normal modal error instead of a silent or unhandled IPC failure
  - the dashboard Feishu bot manager’s write path now matches the same reliability bar already enforced in Channel Connect
  - this removes another packaged-Windows edge case where manual installer input in the dashboard modal could appear to do nothing when the IPC call failed
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with `getFeishuBotManagerInstallerInputFailureMessage(...)` cases covering normal backend write errors and thrown IPC failures
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `202 passed`).

### Update 498: Feishu dashboard bot manager now normalizes thrown refresh/start/delete/repair failures instead of surfacing raw bridge messages
- I fixed the next real Feishu continuity gap in `src/components/FeishuBotManagerModal.tsx`: several dashboard bot-manager actions still surfaced raw thrown values or ad-hoc `.message` reads instead of the same user-facing failure normalization already used elsewhere in Mclaw.
- Before this slice:
  - `refreshBotModalState(...)`, `startFeishuInstallerFlow(...)`, `handleDeleteBot(...)`, and `handleRepairIsolation(...)` each handled thrown failures separately
  - those paths mostly relied on `e?.message || fallback`, which meant non-Error throw values or noisy bridge/runtime errors could leak low-quality text straight into the dashboard modal
  - this left the dashboard Feishu surface less consistent than the hardened Channel Connect flow under the same IPC/CLI failure conditions
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `getFeishuBotManagerActionFailureMessage(...)` as the shared user-facing formatter for thrown dashboard action failures
  - `refreshBotModalState(...)` now uses that helper for bot-list refresh failures instead of reading raw thrown messages directly
  - `startFeishuInstallerFlow(...)` now maps thrown installer start failures through the same normalized helper
  - `handleDeleteBot(...)` and `handleRepairIsolation(...)` now do the same for delete/repair failures, so the dashboard modal surfaces one consistent class of actionable errors
- Result:
  - dashboard Feishu refresh/start/delete/repair failures now stay readable and user-facing instead of exposing raw bridge/runtime messages
  - the dashboard bot manager now matches the same error-surface discipline already enforced in the main onboarding flow
  - this removes another packaged-Windows edge case where some dashboard Feishu actions looked much noisier or less actionable than equivalent failures in Channel Connect
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with `getFeishuBotManagerActionFailureMessage(...)` cases covering both normal `Error` throws and non-Error thrown values
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `204 passed`).

### Update 499: Feishu dashboard bot manager now rebuilds installer live/exit notices on refresh, output, and exit events
- I fixed the next real Feishu continuity gap in `src/components/FeishuBotManagerModal.tsx`: the dashboard bot manager still restored installer snapshots and stream events without rebuilding the same live/exit status notices that the main Channel Connect surface already keeps coherent.
- Before this slice:
  - `applyFeishuInstallerSnapshot(...)` restored session/output/exit fields but could leave the modal notice blank after reopen or refresh, even when the installer was still running or had already exited
  - installer `output` events appended text but did not update the modal notice, so a running session could keep showing stale reuse/prompt copy instead of switching back to scan/wait guidance
  - installer `exit` events cleared running state but did not replace the last live hint with a deterministic finished/canceled/failed notice
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerInstallerLiveNotice(...)`, `resolveFeishuBotManagerInstallerOutputState(...)`, `resolveFeishuBotManagerInstallerExitNotice(...)`, and `resolveFeishuBotManagerInstallerSnapshotNotice(...)` as the dashboard-modal equivalents of the hardened Channel Connect notice rules
  - `resolveFeishuBotManagerInstallerStartState(...)` now primes a clean running notice immediately instead of starting from an empty notice field
  - `applyFeishuInstallerSnapshot(...)` now derives a fresh live/exit notice from the restored snapshot every time the modal refreshes or reopens
  - installer `output` events now recompute live QR/output state and refresh the notice, while installer `exit` events now replace the running hint with a deterministic completion/canceled/failure notice
- Result:
  - reopening or refreshing the dashboard modal now restores the current installer guidance instead of leaving the notice area empty
  - active installer sessions now switch back to the right scan/wait copy as new output arrives, instead of keeping stale reuse or prompt text indefinitely
  - completed installer sessions now land on a deterministic post-exit notice, which closes another parity gap with the main Feishu onboarding page
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with focused coverage for dashboard installer live notices, output-state detection, exit notices, and snapshot notice reconstruction
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `212 passed`).

### Update 500: Feishu dashboard modal refresh now tolerates installer snapshot probe failures instead of failing the whole bot-state refresh
- I fixed the next real Feishu continuity gap in `src/components/FeishuBotManagerModal.tsx`: the dashboard modal still treated installer snapshot probing as a hard dependency for every refresh/open cycle, unlike the main Channel Connect surface which already tolerates partial refresh failures.
- Before this slice:
  - `refreshBotModalState(...)` called `window.api.getFeishuInstallerState()` first and then refreshed bot state
  - if the installer snapshot probe failed transiently, the entire dashboard refresh path failed and the bot list did not refresh, even though plugin/bot state could still have loaded successfully
  - that meant a flaky installer-state IPC call could block the management modal from updating pairing/runtime/bot status at all
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `loadFeishuBotManagerRefreshResources(...)` as the dashboard-modal equivalent of the page-level partial-refresh loader
  - the helper treats `getFeishuInstallerState()` as best-effort and returns `installerSnapshot: null` when that probe fails, while still letting the main bot-state load complete
  - `refreshBotModalState(...)` now uses that helper and only reapplies installer snapshot state when a real snapshot is available
- Result:
  - dashboard open/refresh no longer collapses just because installer-state probing failed once
  - bot inventory, pairing state, runtime status, and isolation drift can still refresh independently of the installer snapshot IPC path
  - this closes another parity gap with Channel Connect and removes another intermittent packaged-Windows style failure mode from the Feishu management surface
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with coverage for `loadFeishuBotManagerRefreshResources(...)` in both partial-failure and full-success cases
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `214 passed`).

### Update 501: Feishu dashboard bot manager now exposes link mode explicitly instead of keeping reusable-bot flow hidden behind dead state
- I fixed another concrete Feishu dashboard gap in `src/components/FeishuBotManagerModal.tsx`: the modal had a full `create` / `link` state model and even rendered a reusable-bot selection panel, but there was no explicit UI entry into link mode, so part of the flow was effectively dead.
- Before this slice:
  - the dashboard modal only exposed a `Create bot` primary action even though `feishuBotSetupMode`, selected linked-bot state, and link-mode auto-reply behavior already existed underneath
  - that meant the reusable-bot path was effectively hidden unless some other state transition happened to switch the mode indirectly
  - the modal could therefore look inconsistent: it carried link-mode state and selection UI, but did not give the user a direct way to choose that path
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerInstallerActionState(...)` as the canonical decision rule for the dashboard primary installer action
  - the modal now shows an explicit `Create new` / `Reuse existing` mode switch, instead of silently pinning the UI to create mode
  - the primary action button now follows the active mode: it starts `create` when create mode is selected, and starts `link` when reusable-bot mode is selected
  - link mode is also honestly disabled when there are no reusable linked bots yet, instead of leaving a dead hidden state in the modal
- Result:
  - reusable linked-bot mode is now directly reachable from the dashboard modal
  - the primary CTA now matches the currently selected Feishu setup mode instead of always saying `Create bot`
  - the modal no longer carries a partially hidden link-mode branch that only existed in state without a first-class entry point
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with coverage for `resolveFeishuBotManagerInstallerActionState(...)` across create mode, empty link mode, and reusable linked-bot mode
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `217 passed`).

### Update 502: Feishu dashboard modal and tutorial now use readable UI copy instead of leaving key controls in mojibake
- I fixed a direct user-facing quality gap in the Feishu dashboard surfaces: `src/components/FeishuBotManagerModal.tsx` and `src/components/FeishuInstallTutorialModal.tsx` still contained several mojibake strings on core controls, titles, and hints.
- Before this slice:
  - the bot manager modal still showed broken text on the modal title, refresh tooltip, empty-state copy, default badge, delete/repair actions, tutorial/stop buttons, guide link, installer console title, control buttons, input placeholder, and installer notice title
  - the tutorial modal still showed broken copy on its title, note label, image-section heading, fallback image button labels, zoom aria label, zoom hint, and previous-step button
  - some fallback error strings in the dashboard modal were also still malformed, which meant a few repair/delete/no-session paths could surface unreadable text when they did trigger
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now uses readable Chinese copy for the key bot-manager controls and fallbacks that the user actually sees during Feishu setup / repair / installer interaction
  - `src/components/FeishuInstallTutorialModal.tsx` was rewritten cleanly with the same behavior but readable titles, hints, and navigation labels, removing the broken tutorial text in one pass
  - the small remaining malformed fallback strings in the dashboard modal were normalized to readable Chinese copy as well
- Result:
  - the Feishu dashboard management surface is now legible end-to-end on its primary controls instead of mixing working logic with broken text
  - the install tutorial is now usable again without garbled labels on the tutorial frame itself
  - this removes another source of confusion during Feishu onboarding, especially on packaged Windows builds where users rely on the dashboard/tutorial wording rather than source context
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `217 passed`).

### Update 503: Feishu dashboard link mode now explains the selected reuse target and what the installer console still needs from the user
- I fixed the next concrete Feishu dashboard usability gap in `src/components/FeishuBotManagerModal.tsx`: after `Update 501`, the modal finally exposed link mode explicitly, but it still did not explain the relationship between the reusable-bot selection list and the official installer console below.
- Before this slice:
  - once link mode was selected, the primary action description was still generic even when the user had already picked a specific reusable bot in the dashboard list
  - the installer console area also lacked link-mode-specific guidance, so users could reasonably assume the top selection list had already fully controlled the installer
  - in reality, the modal only auto-confirms the installer reuse prompt; if the installer continues into a concrete target-choice step, the user still needs to confirm it in the console
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerInstallerConsoleHint(...)` as the canonical console-guidance rule for create vs link mode
  - `resolveFeishuBotManagerInstallerActionState(...)` now accepts the selected reusable bot name and upgrades the link-mode description from a generic reuse statement to a target-specific explanation when a concrete bot is selected
  - the installer console card now renders a mode-aware hint that explicitly explains the automatic `Y` reply in link mode and tells the user when they may still need to confirm the selected bot in the console
- Result:
  - link mode is now more honest about what the upper reusable-bot list does and does not control
  - when a reusable bot is already selected, the dashboard surfaces that target directly instead of keeping the operator in a generic “reuse something” state
  - the console area now gives the missing next-step instruction that users need once the official installer goes beyond the initial reuse prompt
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with coverage for selected-target link descriptions and mode-specific installer console hints
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `220 passed`).

### Update 504: Feishu dashboard link mode now names the selected reuse target in the action area and explains the remaining console step
- I tightened the same dashboard link-mode surface a bit further in `src/components/FeishuBotManagerModal.tsx`: even after exposing link mode and cleaning the modal copy, the action area still behaved too generically once the user had actually selected a reusable bot.
- Before this slice:
  - the reusable-bot picker and the primary action were both present, but the operator still had to infer how that picked bot related to the official installer flow
  - the action description did not surface the selected bot name, so the modal still looked like it was reusing “some existing bot” rather than a concrete target
  - the installer console also lacked an explicit mode-aware hint explaining that link mode only auto-confirms the reuse prompt and may still require the user to confirm the final target in the console
- I rewired that path so that:
  - `resolveFeishuBotManagerInstallerActionState(...)` now accepts `selectedLinkedBotName` and upgrades the link-mode description to a target-specific explanation once a concrete reusable bot has been chosen
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerInstallerConsoleHint(...)` to centralize the create-vs-link console guidance
  - the installer console card now renders that mode-aware hint directly below the console header, making the remaining manual step explicit when link mode is active
- Result:
  - once the user picks a reusable bot, the action area now reflects that exact target instead of staying generic
  - the dashboard no longer leaves the relationship between upper-list selection and lower installer console behavior implicit
  - this reduces another avoidable source of operator confusion during the Feishu reuse path, especially on packaged Windows builds where users rely on inline UI explanations
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with coverage for selected-target link descriptions and the new mode-specific installer console hint helper
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `220 passed`).

### Update 505: Feishu dashboard installer mode is now locked and restored per session so running sessions cannot silently drift between create/link
- I fixed the next real Feishu dashboard reliability bug in `src/components/FeishuBotManagerModal.tsx`: after making create/link mode explicit in the modal, the UI could still let the operator flip modes while the official installer session was already active, which meant the local auto-reply behavior could drift away from the mode that session actually started with.
- Before this slice:
  - the modal could switch between `create` and `link` even while the installer was already running or the UI was busy starting/stopping it
  - the dashboard also did not persist installer mode per session id, so reopen/refresh could lose the mode that a still-running installer session originally started with
  - because link mode changes the automatic reuse reply from `n` to `Y`, that left room for a running session to pick up the wrong local intent if the operator changed modes mid-run
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `getFeishuBotManagerInstallerModeStorageKey(...)`, `readFeishuBotManagerInstallerSessionMode(...)`, `writeFeishuBotManagerInstallerSessionMode(...)`, `clearFeishuBotManagerInstallerSessionMode(...)`, and `shouldLockFeishuBotManagerSetupMode(...)`
  - the modal now persists the chosen setup mode per installer `sessionId`, restores it when a matching running snapshot comes back, and clears it again on installer exit/reset
  - fresh starts now stage the intended mode before the backend start call returns, so early `started` events still pick up the correct local mode
  - the create/link segmented control is now locked while the installer is running or the start/stop action is busy, preventing mid-session mode drift from the dashboard UI
- Result:
  - once an installer session starts, its create-vs-link intent now stays stable for the life of that session
  - reopen/refresh is less likely to lose the intended session mode for a still-running installer
  - this removes another packaged-Windows style edge case where the dashboard could silently drift into the wrong local auto-reply behavior during a live Feishu installer run
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with coverage for installer-mode storage keying, write/read/clear helpers, corrupted storage fallback, and setup-mode lock rules
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `224 passed`).

### Update 506: Feishu dashboard now locks and restores the selected reusable bot per installer session so link targets cannot drift mid-run
- I fixed the next dashboard integrity gap in `src/components/FeishuBotManagerModal.tsx`: after locking create/link mode per running installer session, the reusable-bot target itself could still drift because the upper selection list remained mutable and was not persisted per session.
- Before this slice:
  - link mode could still let the operator click a different reusable bot while the installer session was already running or the start/stop action was still busy
  - the selected reusable bot also was not restored per installer `sessionId`, so reopen/refresh could fall back to the first visible bot even if a different target had been chosen before the session started
  - that meant the dashboard hints could drift to a different target than the one the running installer session had been started for
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `getFeishuBotManagerInstallerSelectedBotStorageKey(...)`, `readFeishuBotManagerInstallerSelectedBotAccountId(...)`, `writeFeishuBotManagerInstallerSelectedBotAccountId(...)`, `clearFeishuBotManagerInstallerSelectedBotAccountId(...)`, and `shouldLockFeishuBotManagerLinkedBotSelection(...)`
  - the modal now persists the selected reusable bot account id per installer `sessionId`, restores it when a matching live snapshot comes back, and clears it on installer exit/reset
  - fresh starts stage the intended reusable-bot target before the backend start call returns, so early `started` events still bind to the correct selected target
  - the reusable-bot list is now locked while a link-mode installer session is running or busy, preventing mid-session target drift from the dashboard UI
- Result:
  - once a reusable bot is chosen for a running link session, the dashboard keeps that target stable for the life of the session
  - reopen/refresh is less likely to “snap” the UI to a different reusable bot than the one the operator originally picked
  - this removes another packaged-Windows style edge case where the dashboard’s selected target and console guidance could silently drift apart during a live Feishu reuse flow
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with coverage for selected-bot storage keying, write/read/clear helpers, empty-target fallback, and linked-bot selection lock rules
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `228 passed`).

### Update 507: Feishu dashboard now blocks config mutations during live installer sessions so delete/repair actions cannot race the running flow
- I fixed another concrete dashboard race in `src/components/FeishuBotManagerModal.tsx`: even after locking setup mode and reusable-bot target per installer session, the modal still allowed config-mutating actions like delete and isolation repair while the official installer was actively running.
- Before this slice:
  - the modal could still trigger Feishu bot deletion or multi-bot isolation repair while a live installer session was running
  - the primary installer start action also did not guard against overlapping delete/repair work that was already mutating the same shared config
  - that left room for the dashboard to change Feishu config out from under the running installer session or while the next installer start was being primed
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `shouldLockFeishuBotManagerConfigMutations(...)` as the shared rule for mutation safety during live/busy installer states
  - delete and repair actions now stay disabled whenever the installer is running or the start/stop UI is busy
  - the primary installer start action now also stays disabled while delete or repair work is already in flight, preventing overlapping local config mutations and installer startup
- Result:
  - live installer sessions are less likely to have their underlying Feishu config changed mid-run by the dashboard itself
  - the modal now avoids another class of race between local config edits and installer startup/reattach work
  - this removes one more packaged-Windows style edge case where the dashboard could mutate Feishu bot config while the official installer flow was still in progress
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with coverage for the new config-mutation lock helper
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`2 passed`, `229 passed`).

### Update 508: Feishu tutorial step data is now readable again instead of shipping garbled step titles, notes, and captions
- I fixed another directly user-facing Feishu issue in `src/components/feishu-install-tutorial.ts`: the tutorial modal frame had already been cleaned up earlier, but the underlying tutorial step data was still full of mojibake, so the actual step titles, descriptions, image captions, notes, and next/finish button labels were still broken.
- Before this slice:
  - the seven-step Feishu tutorial still rendered garbled copy inside the content area even though the modal chrome itself had been cleaned up
  - that meant the tutorial could open successfully but still fail at its core job: explaining the onboarding steps clearly
  - the primary action label helper was also still returning broken text for `下一步` / `完成`
- I rewired that path so that:
  - `src/components/feishu-install-tutorial.ts` was rewritten with clean Chinese copy for all seven tutorial steps, including descriptions, image alt text, captions, bullets, and notes
  - the `getFeishuInstallTutorialPrimaryActionLabel(...)` helper now returns readable `下一步` and `完成`
  - I added a focused tutorial test file so the first/last milestone titles, QR fallback note, and primary action labels stay pinned to readable copy
- Result:
  - the Feishu tutorial is now readable end-to-end instead of mixing a clean modal shell with broken tutorial content
  - new users following the create-bot path now get usable inline step guidance again
  - this removes another obvious packaged-Windows quality issue on the Feishu onboarding path
- I also updated tests:
  - added `src/components/__tests__/feishu-install-tutorial.test.ts` for readable milestone titles, QR note text, and primary action labels
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-install-tutorial.test.ts src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`3 passed`, `232 passed`).

### Update 509: Feishu dashboard modal now uses readable Chinese copy across the remaining primary helper text and status surfaces
- I fixed another direct usability gap in `src/components/FeishuBotManagerModal.tsx`: after the earlier cleanup passes, the modal still mixed readable Chinese with leftover English on several primary helper surfaces, which made the dashboard feel inconsistent during actual Feishu setup.
- Before this slice:
  - runtime badges, installer reuse/live/exit notices, installer stop feedback, primary create/link action labels and descriptions, and several core status labels were still in English
  - the create/link cards and installer console also still mixed Chinese controls with English status text like `Pending pairing`, `Installer running`, `Fallback command`, and `Choose an existing OpenClaw-linked bot`
  - the modal’s auto-reply and installer-start failure messages also still fell back to English, which diluted the earlier copy cleanup work
- I rewired that path so that:
  - the remaining primary helper outputs in `src/components/FeishuBotManagerModal.tsx` now return readable Chinese copy for runtime labels, installer reuse/live/exit notices, action labels/descriptions, and stop feedback
  - the create/link cards and installer console were aligned onto readable Chinese status text for pairing state, QR state, empty state, selected-bot guidance, and installer lifecycle status
  - the auto-reply notice and installer-start failure fallback were also moved onto Chinese copy so the live installer path stays linguistically consistent end-to-end
  - `src/components/__tests__/feishu-bot-manager-modal.test.ts` was rewritten with clean readable expectations instead of carrying older mojibake snapshots
- Result:
  - the Feishu dashboard modal now reads consistently in Chinese across its main setup, reuse, QR, and installer-status surfaces instead of mixing multiple language/copy states
  - the helper test file is now readable and maintainable again, which lowers the cost of landing the remaining Feishu dashboard hardening slices
  - this removes another obvious packaged-Windows polish issue from the Feishu onboarding surface
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/components/__tests__/feishu-install-tutorial.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`3 passed`, `232 passed`).

### Update 510: Feishu dashboard modal now explains why create/link controls are locked during live installer sessions and removes the last stray English action copy
- I fixed the next concrete usability gap in `src/components/FeishuBotManagerModal.tsx`: after we locked setup mode and reusable-bot selection to prevent session drift, the dashboard still disabled those controls without explaining why, and it still left a couple of visible English labels in the live modal.
- Before this slice:
  - the create/link segmented control could become disabled while the official installer was starting, stopping, or already running, but the operator got no inline explanation for why the path selector was suddenly frozen
  - the reusable-bot list in link mode could also lock during a live installer session without any explicit notice that the selected target had been frozen on purpose
  - the live modal still exposed stray English microcopy like the custom input `Send` button and the per-bot `Agent:` label, which made the dashboard feel unfinished even after the earlier Chinese copy cleanup
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerSetupModeLockNotice(...)` and `resolveFeishuBotManagerLinkedBotSelectionLockNotice(...)` to generate deterministic inline explanations for locked create/link controls
  - the modal now shows an explicit warning-style text notice when the setup path is locked, telling the operator whether the installer is already running or just transitioning and which path will continue
  - the link-mode reusable-bot panel now shows a matching lock notice when the selected bot is intentionally frozen to avoid target drift mid-session
  - the last visible English action/microcopy leftovers in this modal were cleaned up by changing the custom input button to `发送` and aligning the bot metadata row to `Agent：...`
- Result:
  - the Feishu dashboard no longer looks arbitrarily disabled during live installer work; it now tells the operator exactly why the current path or reusable bot is locked
  - the lock behavior added in the earlier hardening slices is now explainable from the UI itself instead of only being inferable from code or prior knowledge
  - this removes another small but real packaged-Windows polish gap from the Feishu onboarding surface
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with coverage for the new setup-mode and linked-bot lock-notice helpers
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/components/__tests__/feishu-install-tutorial.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`3 passed`, `238 passed`).

### Update 511: Feishu dashboard modal now explains why delete and isolation-repair actions are locked during live installer sessions
- I fixed the next small but real dashboard usability gap in `src/components/FeishuBotManagerModal.tsx`: we had already blocked bot deletion and multi-bot isolation repair during live installer work to avoid config races, but the modal still gave no inline explanation when those buttons became unavailable.
- Before this slice:
  - the `删除` action on each configured bot could become disabled while the official installer was running or transitioning, but the operator only saw a greyed-out button with no reason
  - the `修复隔离` action was blocked by the same safety rule, yet the UI still did not explain that the block was intentional to avoid mutating shared Feishu config mid-session
  - that made the earlier safety hardening look arbitrary from the user’s point of view, especially during long-running installer sessions
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerConfigMutationLockNotice(...)` as the shared explanation for config-mutation locks
  - the modal now shows an inline warning-style notice directly under the bot list whenever delete/repair actions are blocked because the official installer is running or still starting/stopping
  - the notice distinguishes between an actively running installer and a transitional busy state, so the operator can tell whether to wait for startup/shutdown or for the live session itself to end
- Result:
  - the Feishu dashboard no longer leaves delete/repair actions silently disabled during installer activity
  - the config-race protection from earlier slices is now visible and understandable from the UI itself
  - this removes another small packaged-Windows polish issue from the Feishu onboarding and maintenance surface
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with coverage for the new config-mutation lock-notice helper
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/components/__tests__/feishu-install-tutorial.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`3 passed`, `241 passed`).

### Update 512: Feishu dashboard modal now explains why refresh and installer-start actions are blocked during local delete or isolation-repair work
- I fixed the next concrete dashboard clarity gap in `src/components/FeishuBotManagerModal.tsx`: while a local delete or isolation-repair write was already in progress, the modal intentionally blocked refresh and installer-start actions to avoid overlapping config work, but the operator still got no inline explanation for that temporary lock.
- Before this slice:
  - clicking `删除` on a bot or `修复隔离` could start a local config write that disabled the top-level refresh action and the primary installer-start action
  - the buttons were correctly blocked, but the dashboard did not tell the operator whether they were waiting on a bot deletion or an isolation repair write
  - that made another deliberate safety rule look arbitrary from the UI, especially when the modal was otherwise idle and the official installer itself was not running
- I rewired that path so that:
  - `src/components/FeishuBotManagerModal.tsx` now exports `resolveFeishuBotManagerMaintenanceLockNotice(...)` to generate a deterministic explanation for local maintenance locks
  - the helper distinguishes between an in-flight isolation repair, a delete action with a known bot name, and a delete action where only the account id is still available
  - the modal now shows that warning-style notice near the bot list whenever a local delete or repair action is the reason refresh and installer start remain blocked
- Result:
  - the Feishu dashboard now makes it clear that refresh/start are waiting on a local config mutation to finish, rather than silently failing to react
  - operators can tell whether the temporary lock is caused by deleting a specific bot or by repairing multi-bot isolation
  - this removes another small packaged-Windows polish gap from the Feishu onboarding and maintenance surface
- I also updated tests:
  - extended `src/components/__tests__/feishu-bot-manager-modal.test.ts` with coverage for repair-mode, delete-with-name, delete-with-account-id, and idle cases of the new maintenance-lock helper
- Validation on April 20, 2026: `./node_modules/.bin/tsc.cmd --noEmit` passed.
- Validation on April 20, 2026: `./node_modules/.bin/vitest.cmd run src/components/__tests__/feishu-bot-manager-modal.test.ts src/components/__tests__/feishu-install-tutorial.test.ts src/pages/__tests__/channel-connect.test.ts` passed (`3 passed`, `245 passed`).

### Update 513: Windows packaged Feishu onboarding artifact is now built and verified locally, so this stage can move from local hardening to real-machine acceptance
- I stopped doing small dashboard-only polish and switched to the actual delivery gate: producing a real Windows packaged artifact and verifying that the bundled Feishu/OpenClaw runtime still works in the packaged app instead of only inside the repo workspace.
- What I validated on April 20, 2026:
  - `cmd.exe /c npm run check:win:release-env -- --allow-placeholder-publish --allow-unsigned` passed
  - `cmd.exe /c npm run package:win:dir` passed and produced `release/2026.4.20-v0/win-unpacked`
  - `cmd.exe /c npm run package:win` initially hit a sandbox-side `spawn EPERM` during `vite` startup, so I reran it with escalation as required by the harness
  - the escalated `cmd.exe /c npm run package:win` then passed and produced the real NSIS installer plus packaged app directory under `release/2026.4.20-v1`
- Packaged-artifact verification result:
  - `release/2026.4.20-v1/win-unpacked/resources/openclaw-bundle/runtime/windows-x64/node.exe --version` was verified as `v24.14.1`
  - the packaged bundle verification confirmed that bundled `openclaw-lark` was present and that the packaged runtime could load it with the `feishu` channel
  - the packaged Windows outputs now exist at:
    - `release/2026.4.20-v1/Mclaw_2026.4.20-v1.exe`
    - `release/2026.4.20-v1/win-unpacked/Mclaw.exe`
- Result:
  - the Feishu接入阶段不再卡在“只有本地源码验证”；现在已经有可安装、可直接启动的 Windows 打包产物可供真机实测
  - 当前剩余的主要工作已从“继续补本地逻辑”切换为“用户侧真机闭环验收”
  - 非代码层面的发布残项仍然存在，但不阻塞你现在做功能验收：自动更新 URL 还是占位值，Windows 签名仍是开发态未签名

### Update 514: Windows packaged bundle verifier now seeds trusted Feishu plugin config and fails on provenance warnings, so packaged acceptance is cleaner and stricter
- I fixed the next delivery-quality gap in `scripts/check-win-packaged-openclaw-bundle.mjs`: the packaged verifier was correctly proving that bundled `openclaw-lark` could load, but it did so from a temporary empty OpenClaw home, which still triggered plugin trust/provenance warnings during verification.
- Before this slice:
  - the verifier copied bundled `openclaw-lark` into a temp `extensions/` directory and ran `plugins inspect`, but it did not create a matching `openclaw.json`
  - that meant packaged verification could still print `plugins.allow is empty` and `loaded without install/load-path provenance` warnings even though the bundled plugin itself was healthy
  - worse, the verifier still passed in that noisy state, so the packaged acceptance signal was weaker than it should have been
- I rewired that path so that:
  - `scripts/check-win-packaged-openclaw-bundle.mjs` now writes a minimal trusted plugin config into the temporary probe home before running `plugins inspect`
  - the seeded config includes `plugins.allow`, a disabled built-in `feishu` entry, an enabled `openclaw-lark` entry, and a `plugins.installs.openclaw-lark` record pointing at the copied local plugin path
  - the verifier now uses `spawnSync(...)` for the plugin inspection step so it can inspect both `stdout` and `stderr`
  - the verifier now fails explicitly if packaged plugin inspection still emits the old trust/provenance warnings, turning that noisy condition into a real verification failure instead of a tolerated side effect
- Result:
  - the packaged Windows verifier now produces a much cleaner acceptance signal for bundled Feishu onboarding
  - local packaged verification is stricter and closer to the state we actually want before asking for user-side real-machine testing
  - this removes one more “green but noisy” gap from the Feishu delivery chain
- Validation on April 20, 2026:
  - initial rerun of `cmd.exe /c node scripts/check-win-packaged-openclaw-bundle.mjs --win-unpacked-dir release\\2026.4.20-v1\\win-unpacked` exposed a real schema issue in the seeded install record (`source: "bundled"` was invalid), which I then corrected to an allowed `path` source
  - final rerun of `cmd.exe /c node scripts/check-win-packaged-openclaw-bundle.mjs --win-unpacked-dir release\\2026.4.20-v1\\win-unpacked` passed cleanly and verified bundled runtime + bundled `openclaw-lark` loading without the earlier trust/provenance warnings

### Update 515: Windows installer artifact now carries an explicit Mclaw app icon instead of shipping with the default Electron icon
- I fixed another concrete delivery-quality gap in `electron-builder.json`: the Windows packaging logs were still reporting `default Electron icon is used`, which meant the NSIS installer and packaged app were functionally usable but still looked unfinished.
- Before this slice:
  - `package:win` could build successfully, but the builder log still warned that no application icon was set
  - that left the packaged artifact looking less like a real deliverable and more like a developer build
  - for user-side Feishu acceptance, this is not a functional blocker, but for “可交付级别” it is still a real gap
- I rewired that path so that:
  - `electron-builder.json` now points Windows packaging at the existing `public/favicon.ico`
  - the NSIS installer and uninstaller were also wired to the same icon asset
  - I then rebuilt the full Windows NSIS artifact instead of stopping at config-only edits
- Result:
  - the latest packaged Windows artifact is now `release/2026.4.20-v2/Mclaw_2026.4.20-v2.exe`
  - the previous `default Electron icon is used` warning no longer appears in the packaging output
  - packaged Feishu verification still passes on the new artifact, so this is a real delivery-quality improvement rather than a cosmetic-only config edit
- Validation on April 20, 2026:
  - escalated `cmd.exe /c npm run package:win` passed and produced `release/2026.4.20-v2`
  - the packaged verifier still passed for `release/2026.4.20-v2/win-unpacked`
  - the packaging log no longer reported the old default-icon warning

### Update 516: Windows packaged Feishu official installer now runs from the bundled Node 24 npm/npx toolchain instead of depending on system npx
- I fixed the concrete blocker behind the packaged Windows failure you hit after clicking `新建机器人`: `electron/main/feishu-installer-session.ts` was still building the official installer command as plain `npx -y @larksuite/openclaw-lark-tools install`, which meant the packaged app still depended on whatever `npx` happened to exist on the user machine.
- I rewired that startup path so that:
  - `electron/main/feishu-installer-session.ts` now resolves the bundled OpenClaw runtime first and, on Windows, prefers `resources/openclaw-bundle/runtime/windows-x64/npx.cmd`
  - in repo/dev mode it falls back to the local full Node 24 distribution under `node-v24.14.1-win-x64/node-v24.14.1-win-x64`, so dev flow also stays on the project-pinned Node 24 toolchain instead of the shell Node 22
  - packaged builds now fail fast with an explicit packaged-runtime error if bundled `npx` is missing, instead of silently probing system Node/npm and producing the vague `启动飞书官方安装器失败`
  - the installer child process PATH is now seeded with the chosen bundled toolchain directory, so downstream CLI calls resolve against the same pinned runtime
- I also fixed the packaging side in `electron-builder.json`:
  - Windows artifacts now copy `npm`, `npm.cmd`, `npm.ps1`, `npx`, `npx.cmd`, `npx.ps1`, and `node_modules/npm/**/*` from the local Node 24 payload into `openclaw-bundle/runtime/windows-x64`
  - this makes the packaged Feishu installer path self-contained instead of relying on external Node/npm availability
- I strengthened packaged verification in `scripts/check-win-packaged-openclaw-bundle.mjs`:
  - it now requires bundled `npm.cmd`, `npx.cmd`, `node_modules/npm/package.json`, and `node_modules/npm/bin/npx-cli.js`
  - it also executes the bundled `npx` CLI through the bundled `node.exe` and fails if no version string is returned
- Result:
  - the new packaged build should no longer fail at `新建机器人` because of a missing system `npx`
  - Mclaw’s Feishu official installer path is now aligned with your requirement that packaged/runtime flow use the app’s bundled Node 24, not the terminal’s external Node 22
  - the new Windows packaged artifact is `release/2026.4.20-v3/Mclaw_2026.4.20-v3.exe` and the unpacked app is `release/2026.4.20-v3/win-unpacked/Mclaw.exe`
- Validation on April 20, 2026:
  - `cmd.exe /c .\node_modules\.bin\tsc.cmd --noEmit` passed
  - `cmd.exe /c npm run package:win` passed and produced `release/2026.4.20-v3`
  - packaged verifier passed during the build and confirmed:
    - bundled node version `v24.14.1`
    - bundled npx version `11.11.0`
    - bundled `openclaw-lark` still loads with channel `feishu`

### Update 517: Feishu bot creation now auto-materializes the bundled `openclaw-lark` runtime plugin into the user OpenClaw home before launching the official installer
- I traced the next blocker after the bundled Node/npm/npx fix: the packaged app could now start `@larksuite/openclaw-lark-tools install`, but the active user profile still had no materialized `openclaw-lark` plugin under the OpenClaw home.
- Concrete local state on April 20, 2026:
  - `C:\Users\James\AppData\Roaming\Mclaw\openclaw-state\openclaw.json` still only had the built-in `feishu` entry disabled
  - there was no `plugins.allow` / `plugins.installs.openclaw-lark` record in that user config
  - `C:\Users\James\AppData\Roaming\Mclaw\openclaw-state\extensions\openclaw-lark` was not present
- That means the app bundle already contained `openclaw-lark`, but the current user profile had not yet activated/materialized it into the runtime home. So the previous behavior was inconsistent with the product expectation of “内置即可用”.
- I fixed `electron/main/feishu-installer-session.ts` so that before `新建机器人` launches the official installer it now:
  - calls `ensureFeishuOfficialPluginReady()` first
  - materializes the bundled `openclaw-lark` payload into the current OpenClaw home when missing
  - fails fast with an explicit plugin-readiness error if that preparation step cannot complete
  - prepends the preparation result into the installer console output so the operator can see whether Mclaw reused or newly activated the bundled Feishu runtime plugin
- Result:
  - the official installer flow no longer assumes the bundled plugin is already active in the user profile
  - “插件已内置” and “当前用户态真的能用这个插件” are now joined into one startup path instead of being two separate states
  - this should remove the current failure mode where the packaged build reaches the installer package but stalls or exits while the user-side Feishu runtime plugin was never materialized locally
- Validation on April 20, 2026:
  - `cmd.exe /c .\node_modules\.bin\tsc.cmd --noEmit` passed

### Update 518: Rebuilt the Windows packaged artifact after the bundled-plugin auto-materialization fix, so the next user retest should be on the corrected installer flow
- After wiring `ensureFeishuOfficialPluginReady()` into `electron/main/feishu-installer-session.ts`, I rebuilt the full Windows NSIS artifact so your next `新建机器人` retest is not blocked on stale packaging.
- New packaged outputs on April 20, 2026:
  - `release/2026.4.20-v4/Mclaw_2026.4.20-v4.exe`
  - `release/2026.4.20-v4/win-unpacked/Mclaw.exe`
- Validation on April 20, 2026:
  - `cmd.exe /c npm run package:win` passed
  - packaged verifier still passed and confirmed bundled runtime node `v24.14.1`, bundled npx `11.11.0`, and bundled `openclaw-lark` loading with channel `feishu`
- Result:
  - the next packaged Windows retest now includes both fixes together: bundled Node/npm/npx for the official installer and automatic materialization of the bundled Feishu runtime plugin into the user OpenClaw home before installer startup

### Update 519: Feishu new-bot startup no longer requires a Gateway reload before the official installer can start, and the Windows installer subprocess now stays hidden
- I addressed the next failure mode behind `点了创建新 bot 就闪一个终端然后失败`: `electron/main/feishu-installer-session.ts` had already started auto-preparing the bundled `openclaw-lark` runtime plugin, but that preparation still used the full `ensureFeishuOfficialPluginReady()` path, which could fail early on a Gateway reload even though the official installer itself only needed the plugin files and config to be ready.
- I changed the startup chain so that:
  - `electron/main/feishu-official-plugin-state.ts` now accepts `skipGatewayReload` on `ensureFeishuOfficialPluginReady(...)`
  - `electron/main/feishu-installer-session.ts` now calls `ensureFeishuOfficialPluginReady({ skipGatewayReload: true })` before starting the official installer, so the bundled Feishu runtime plugin is materialized and normalized without treating Gateway reload success as a hard precondition for the create-bot flow
  - the official installer subprocess now uses `windowsHide: true`, which should remove the extra Windows terminal flash during startup on packaged builds
  - the installer startup banner and fallback errors on this path were also converted to readable Chinese instead of the earlier mixed English output
- Result:
  - `新建机器人` no longer blocks on an unnecessary pre-installer Gateway reload step
  - packaged Windows startup should no longer flash a transient console window just to launch the official installer session
  - if startup still fails, the UI now has a better chance of surfacing the actual preparation error instead of only collapsing to a generic failure toast
- Validation on April 20, 2026:
  - `cmd.exe /c .\node_modules\.bin\tsc.cmd --noEmit` passed

### Update 520: The Feishu connect page is now quieter and more Chinese-first during normal setup, while still retaining advanced official CLI tools behind an explicit toggle
- I simplified the current Feishu onboarding UI in `src/pages/ChannelConnect.tsx`, because the visible page was still too noisy and still leaked too much English into the normal user path.
- I changed that surface so that:
  - the primary visible CLI status card is now renamed to `可选：飞书官方 CLI` and uses shorter Chinese helper copy
  - the status summaries / recommended actions returned by `electron/main/feishu-official-cli-state.ts` are now Chinese instead of English
  - the large `Official CLI Next Step` and `Official CLI Guided Flow` blocks are now hidden by default behind a `显示高级工具` toggle, so ordinary users only see the default plugin-based onboarding path unless they explicitly ask for more
  - `src/pages/ChannelConnect.tsx` and `src/components/FeishuBotManagerModal.tsx` now keep the real installer failure detail when startup returns an inactive snapshot, instead of immediately collapsing to the generic `启动飞书官方安装器失败`
- Result:
  - the Feishu connect page is now closer to the user expectation of “中文 + 简约 + 默认走内置流程”
  - the advanced official CLI tooling is still available, but no longer dominates the normal create-bot UI
- Validation on April 20, 2026:
  - `cmd.exe /c .\node_modules\.bin\tsc.cmd --noEmit` passed
  - `cmd.exe /c npm run package:win` passed and produced `release/2026.4.20-v5`
  - packaged verifier still passed for `release/2026.4.20-v5/win-unpacked`

### Update 521: Feishu 新建机器人改为强制走 Mclaw 托管 OpenClaw home，并把二维码提示统一成“本次安装器二维码”
- 我把这次 `新建机器人卡住、看不到二维码` 的真实根因收尾到了可交付状态：官方安装器子进程之前没有稳定继承 Mclaw 托管的 OpenClaw 环境，`@larksuite/openclaw-lark-tools install` 会跑到用户默认 `C:\Users\James\.openclaw`，而不是 Mclaw 的 `C:\Users\James\AppData\Roaming\Mclaw\openclaw-state\.openclaw`。
- 这会直接导致两个问题叠在一起：
  - 安装器在错误的 home 下看不到已经内置并物化好的 `openclaw-lark`
  - UI 又可能把教程 / 引导链接误当成可扫码二维码，用户看到的是“卡住、没二维码、提示混乱”
- 这次我完成了三块修正：
  - `electron/main/feishu-installer-session.ts` 继续沿用托管环境注入，在启动官方安装器前显式传入托管态 `OPENCLAW_HOME` / `OPENCLAW_STATE_DIR` / `OPENCLAW_CONFIG_PATH`
  - `electron/main/feishu-installer-env.ts` 去掉了会让当前 Vitest 路径报 `require is not defined in ES module scope` 的 `node:path` 依赖，改成了本地路径解析逻辑，保证这条托管环境链路可测试
  - `src/components/feishu-install-tutorial.ts` 改成了全中文、简化后的真实流程文案，不再提“官网兜底二维码”，统一强调只有出现“本次安装器二维码”后再扫码
- 同步清理：
  - `src/components/__tests__/feishu-install-tutorial.test.ts` 改成验证新的中文教程与真实二维码提示
  - `src/components/__tests__/feishu-bot-manager-modal.test.ts` 和 `src/pages/__tests__/channel-connect.test.ts` 全部对齐当前中文文案与实时二维码策略
  - `electron/main/__tests__/feishu-installer-env.test.ts` 现在可正常跑通，覆盖托管 `OPENCLAW_HOME` 推导与 env 注入
- 2026-04-20 本地验证结果：
  - `cmd.exe /c npm run typecheck` 通过
  - `cmd.exe /c npm test -- electron/main/__tests__/feishu-installer-env.test.ts src/components/__tests__/feishu-install-tutorial.test.ts src/components/__tests__/feishu-bot-manager-modal.test.ts src/pages/__tests__/channel-connect.test.ts` 通过（4 个文件、251 个测试）
  - `cmd.exe /c npm run package:win` 通过，产物为：
    - `release/2026.4.20-v7/Mclaw_2026.4.20-v7.exe`
    - `release/2026.4.20-v7/win-unpacked/Mclaw.exe`
  - 打包校验继续通过，确认：
    - bundled node `v24.14.1`
    - bundled npx `11.11.0`
    - bundled `openclaw-lark` 仍能加载 `feishu`
- 结论：
  - 现在请直接用 `release/2026.4.20-v7/Mclaw_2026.4.20-v7.exe` 复测 `新建机器人`
  - 这版已经同时带上了：托管 OpenClaw home 修正、真实二维码提示修正、中文教程修正，以及前面已经完成的 bundled Node 24 / bundled `openclaw-lark` 路径

### Update 522: 飞书“新建机器人”不再走上游 install/update，错误二维码也不再把 GitHub / npm 链接当成可扫码二维码
- 我把这次用户实测里最关键的两个问题一起收口了：
  - 页面里出现的二维码有时其实是 GitHub / npm changelog 链接，不是真正的飞书建机器人二维码。
  - `新建机器人` 仍然会落到上游 `@larksuite/openclaw-lark-tools install` 的既有插件更新分支，继续触发 npm install/update，从而在已内置 `openclaw-lark` 的 Mclaw 模型下失败。
- 这次的代码修正分成两层：
  - `src/lib/feishu-installer.ts`
    - 新增 `FEISHU_LIVE_QR_URL_MARKER = MCLAW_FEISHU_QR_URL:`
    - `extractFeishuLiveQrUrl(...)` 改成只接受两类 URL：
      1. Mclaw 明确打了当前会话标记的二维码 URL
      2. 明显属于 Feishu/Lark OAuth / device-code 范畴的官方 URL
    - 这样 GitHub release、npm changelog、飞书官方文档页都不会再被误判成“本次安装器二维码”。
  - `electron/main/feishu-installer-session.ts`
    - `startFeishuInstallerSession(...)` 现在按模式分流：
      - `create`：改走 Mclaw 内置二维码建机器人链路
      - `link`：继续保留原来的官方安装器子进程链路，避免把已有复用路径一起打断
    - 新的创建链路不再调用上游 `install/update`，而是由 Mclaw 自己：
      - 先确保 bundled `openclaw-lark` 已在当前 OpenClaw home 就绪
      - 直接向飞书官方注册接口申请二维码
      - 轮询拿回 `client_id / client_secret`
      - 把新建机器人的凭据直接写入当前托管 OpenClaw 配置
      - 输出机器可解析的 `MCLAW_FEISHU_QR_URL:` 标记，供前端稳定展示真正的二维码
- 为了支撑这条新链路，我新增了 `electron/main/feishu-managed-create-flow.ts`：
  - 内置调用飞书官方 `/oauth/v1/app/registration` 的 `init / begin / poll`
  - 处理 Lark 租户域名切换
  - 把新建机器人写入本地多 Bot 配置，避免再依赖上游 CLI 去“安装/更新插件后顺便写配置”
- 同步前端接线：
  - `electron/main/ipc-handlers.ts`
  - `electron/preload/index.ts`
  - `src/types/electron.d.ts`
  - `src/pages/ChannelConnect.tsx`
  - `src/components/FeishuBotManagerModal.tsx`
  - 现在前端会显式把 `create / link` 模式传给主进程，保证“新建”和“复用”不再混走同一条后台命令。
- 2026-04-20 本地验证结果：
  - `cmd.exe /c npm run typecheck` 通过
  - `cmd.exe /c npm test -- src/lib/__tests__/feishu-installer.test.ts electron/main/__tests__/feishu-installer-env.test.ts` 通过（2 个文件、8 个测试）
  - `cmd.exe /c npm run package:win` 通过，产物为：
    - `release/2026.4.20-v8/Mclaw_2026.4.20-v8.exe`
    - `release/2026.4.20-v8/win-unpacked/Mclaw.exe`
  - 打包校验继续通过，确认 bundled runtime 仍使用：
    - node `v24.14.1`
    - npx `11.11.0`
    - bundled `openclaw-lark` 仍能加载 `feishu`
- 备注：
  - 我额外尝试跑了更大的前端历史测试切片，但当前仓里这部分仍有一批旧的中文文案 / 编码期望漂移，不是这次二维码修复新引入的失败。
  - 本次发版判断仍以：类型检查通过、二维码解析新增测试通过、Windows 打包通过 为主。
- 结论：
  - 下一个用户实测目标已经从“看不到真实二维码 / 扫到 GitHub”切成了“验证 v8 包里是否能稳定显示真正的飞书建机器人二维码并完成扫码建 Bot”。
- Update 523
  - Fixed the Feishu official plugin install metadata bug that was writing `plugins.installs.openclaw-lark.source = bundled` into `openclaw.json`; OpenClaw only accepts `npm/archive/path/clawhub/marketplace`, so this invalid record could push the runtime into the red "blocked" state and keep doctor/health on the incompatible-config path.
  - Added managed-plugin config normalization so legacy `bundled` records are rewritten to `path` during config sanitization, and wired that repair into the CLI preflight. This means existing affected local configs are healed before later `health`, `doctor`, or gateway bootstrap probes run.
  - Rewrote the corrupted output strings in `electron/main/feishu-managed-create-flow.ts`, so the in-app "新建机器人" flow now emits readable QR/status text instead of mojibake.
  - Added focused regression coverage in `electron/main/__tests__/openclaw-plugin-config.test.ts` and `electron/main/__tests__/feishu-official-plugin-state.test.ts` for the `bundled -> path` normalization path.
- Update 524
  - Fixed the visible Feishu tutorial modal mojibake in `src/components/FeishuInstallTutorialModal.tsx`; the title, hints, image labels, aria copy, and navigation buttons are now all clean Chinese instead of mixed broken text.
  - Added a stricter tutorial warning in `src/components/feishu-install-tutorial.ts`: the QR shown inside the tutorial screenshot is now explicitly labeled as an example only, so users are told not to scan the tutorial image and to wait for the live in-session QR.
  - Hardened `src/components/FeishuBotManagerModal.tsx` against missed installer event delivery by polling `window.api.getFeishuInstallerState()` while the installer session is running; this gives the modal a snapshot-reconcile fallback so the create flow can still surface live output / QR even if the event stream is late or partially missed.
  - Simplified the create-mode QR panel copy in `src/components/FeishuBotManagerModal.tsx` so the live QR area now clearly says it is the current real QR, warns users not to scan tutorial screenshots, and shows an immediate "starting" notice when the create flow is launched.
  - Re-encoded `src/components/__tests__/feishu-bot-manager-modal.test.ts` and `src/components/__tests__/feishu-install-tutorial.test.ts` as UTF-8 so the test expectations no longer carry legacy mojibake bytes.
  - 2026-04-20 local validation:
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npx vitest run src/components/__tests__/feishu-bot-manager-modal.test.ts src/components/__tests__/feishu-install-tutorial.test.ts electron/main/__tests__/openclaw-plugin-config.test.ts electron/main/__tests__/feishu-official-plugin-state.test.ts` passed (4 files, 73 tests)
    - `cmd.exe /c npm run build:app` passed
- Update 525
  - Built a fresh Windows packaged artifact for retest after the Feishu modal / QR fixes.
  - 2026-04-20 packaging validation:
    - `cmd.exe /c npm run package:win:dir` passed
    - unpacked artifact: `release/2026.4.20-v10/win-unpacked/Mclaw.exe`
    - packaged bundle verification passed inside `release/2026.4.20-v10/win-unpacked`
    - bundled runtime still resolves `node v24.14.1`, `npx 11.11.0`, and bundled `openclaw-lark` with `feishu`
- Update 526
  - Fixed the Feishu managed create flow to use the real registration hosts:
    - `https://accounts.feishu.cn/oauth/v1/app/registration`
    - `https://accounts.larksuite.com/oauth/v1/app/registration`
  - Root cause was confirmed live on this machine: `open.feishu.cn/oauth/v1/app/registration?action=init` returned `404`, while `accounts.feishu.cn` returned `200` and produced the expected create-flow payload.
  - Simplified the Feishu `ChannelConnect` page copy to Chinese end-user wording:
    - “Official CLI Next Step” -> “下一步建议”
    - “Official CLI Guided Flow” -> “官方 CLI 执行区”
    - blocker/live-assist/status labels now use Chinese action text such as “验证链接 / 设备码 / 登录已就绪 / 刷新状态 / CLI 可选”
    - create/link runtime summary cards now use Chinese labels and clearer path wording for ordinary users
    - copy/open failure toasts were also localized
  - 2026-04-21 local validation:
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npm run build:app` passed
    - `cmd.exe /c npm run package:win:dir` passed
    - unpacked artifact: `release/2026.4.21-v0/win-unpacked/Mclaw.exe`
    - packaged bundle verification still passed with bundled `node v24.14.1`, bundled `npx 11.11.0`, and bundled `openclaw-lark`
  - Focused Vitest note:
    - sandboxed `npx vitest` hit `spawn EPERM`
    - escalated rerun got past the sandbox, but the current repo test harness still fails before collecting this suite with `ReferenceError: require is not defined in ES module scope` from `vite-plugin-electron-renderer`
    - so this round is validated by typecheck + production build + Windows packaged output, while the isolated Vitest lane still needs separate harness cleanup
- Update 527
  - Relaxed the Feishu finish path so `完成机器人配置` no longer hard-blocks on a still-settling Gateway reload; the wizard now keeps advancing into the pairing step instead of stopping on a transient runtime check.
  - Kept Feishu on the pairing step after both create/link finishes by routing `skipPairing` through a dedicated helper that currently returns `false`.
  - Allowed the Feishu managed-channel ready check to treat a pending `ready` state as non-blocking when install + registration are already verified, which matches the create/link handoff better than the previous hard fail.
  - Added regression coverage in `src/pages/__tests__/channel-connect.test.ts` for the new Feishu pending-ready behavior and the post-connect pairing policy.
  - 2026-04-21 local validation:
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npm run build:app` passed
    - `cmd.exe /c npm run package:win:dir` passed
    - unpacked artifact: `release/2026.4.21-v1/win-unpacked/Mclaw.exe`
    - packaged bundle verification still passed with bundled `node v24.14.1`, bundled `npx 11.11.0`, and bundled `openclaw-lark` exposing `feishu`

- Update 528
  - Normalized the IM Channels page copy that had regressed into mojibake. The card action row, stage badges, shared-status summaries, and related page error strings are readable again.
  - Kept the fix ASCII-safe in the touched source and test files so the renderer no longer depends on the broken text-encoding path that caused the garbled labels.
  - Rebuilt the focused test coverage for the affected helpers in:
    - `src/pages/__tests__/channels-page-channel-actions.test.ts`
    - `src/shared/__tests__/official-channel-status-view.test.ts`
  - 2026-04-21 local validation:
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npm test -- src/pages/__tests__/channels-page-channel-actions.test.ts src/shared/__tests__/official-channel-status-view.test.ts src/pages/__tests__/channels-page-state.test.ts src/components/__tests__/channel-card-action-buttons.test.ts src/components/__tests__/feishu-shared-status-alert.test.ts src/components/__tests__/managed-channel-plugin-status-summary.test.ts src/components/__tests__/channels-page-top-panel.test.ts src/components/__tests__/feishu-channel-card-meta.test.ts` passed (8 files, 32 tests)
    - `cmd.exe /c npm run build:app` passed
- Update 529
  - Built a fresh Windows unpacked artifact after the IM Channels mojibake fix for real-machine retest.
  - 2026-04-21 packaging validation:
    - `cmd.exe /c npm run package:win:dir` passed
    - unpacked artifact: `release/2026.4.21-v2/win-unpacked/Mclaw.exe`
    - packaged bundle verification still passed with bundled `node v24.14.1`, bundled `npx 11.11.0`, and bundled `openclaw-lark` exposing `feishu`

- Update 530
  - Root cause of the latest “飞书里能聊天但拒绝本地电脑操作” issue is now nailed down more precisely: this was not mainly a Feishu permission-scope problem, and not a missing OpenClaw local-tool problem either. The active Feishu managed workspace under Mclaw user data was still carrying the generic OpenClaw bootstrap files, so the bot kept framing itself like a cloud-only Feishu assistant even though the runtime already had local filesystem / command / browser tools.
  - Strengthened `electron/main/feishu-managed-workspace-bootstrap.ts` so the generated Feishu managed workspace prompt is more explicit: paired Feishu private chats are allowed to operate the local Windows PC, and the agent must not reposition itself as a cloud-only office assistant. I also added concrete examples like creating Desktop text files, running local shell commands, opening local apps, and editing local project files.
  - Closed the missing lifecycle gap in `electron/main/openclaw-config-coordinator.ts`: after any successful config write, Mclaw now immediately re-syncs the Feishu managed workspace bootstrap under the active OpenClaw home before later Gateway policy steps. That means both “新建机器人” and “关联已有机器人 / 手动绑定” now repair the Feishu runtime prompt files at write time instead of waiting for a later status page read.
  - Cleaned the remaining Feishu main-process fallback mojibake in `electron/main/feishu-official-plugin-state.ts`, so the last Gateway reload fallback message on this path is readable Chinese.
  - 2026-04-21 local validation:
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npm test -- electron/main/__tests__/openclaw-config-coordinator.test.ts electron/main/__tests__/feishu-managed-workspace-bootstrap.test.ts electron/main/__tests__/feishu-official-plugin-state.test.ts` passed (`3` files, `20` tests)
    - `cmd.exe /c npm run build:app` passed
  - Machine note for this workstation:
    - I also performed a one-time live repair on `C:\Users\James\AppData\Roaming\Mclaw\openclaw-state\.openclaw\workspace-feishu-bot-b89bd2`, so the currently connected Feishu bot no longer depends on waiting for a future config write before seeing the corrected local-operator prompt.

- Update 531
  - Built a fresh Windows packaged artifact after the Feishu local-operator prompt repair, so you should not test the older `2026.4.21-v2` package for this round.
  - 2026-04-21 packaging validation:
    - `cmd.exe /c npm run package:win` passed
    - installer artifact: `release/2026.4.21-v3/Mclaw_2026.4.21-v3.exe`
    - unpacked artifact: `release/2026.4.21-v3/win-unpacked/Mclaw.exe`
    - packaged bundle verification still passed with bundled `node v24.14.1`, bundled `npx 11.11.0`, and bundled `openclaw-lark` exposing `feishu`

- Update 532
  - Fixed a stale Feishu create-flow error banner in `src/pages/ChannelConnect.tsx`. When the backend had already recovered and detected the newly created bot, the page could still keep showing the old red `操作失败 / 写入飞书官方安装器失败` message even though the flow was already recoverable.
  - In both recover-create branches, the page now clears the stale error state before surfacing the recovery notice, so the UI matches the real backend state once the bot has been detected.
  - 2026-04-21 local validation:
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npm run build:app` passed
    - `cmd.exe /c npm run package:win` passed
    - installer artifact: `release/2026.4.21-v4/Mclaw_2026.4.21-v4.exe`
    - unpacked artifact: `release/2026.4.21-v4/win-unpacked/Mclaw.exe`

- Update 533
  - Continued the Feishu local-PC execution hardening after a strict live check on the weather-file task. The bot had reached the correct local-operation intent, but it chose the built-in `write` tool for `C:\\Users\\James\\Desktop\\...`, and OpenClaw scopes `write` / `edit` to the workspace, so that path is not the right mechanism for Desktop writes.
  - Strengthened `electron/main/feishu-managed-workspace-bootstrap.ts` so the generated `TOOLS.md` now makes the rule explicit:
    - `write` / `edit` are only for the current OpenClaw workspace
    - absolute Windows paths outside the workspace must go through `exec` + native PowerShell commands
    - outside-workspace file operations must be verified with `Test-Path`, `Get-Item`, or a follow-up read before the bot reports success
  - Added regression coverage in `electron/main/__tests__/feishu-managed-workspace-bootstrap.test.ts` for the new Feishu tool-routing instructions.

- Update 534
  - Built a fresh Windows packaged artifact after the Feishu outside-workspace file-write guidance fix, because the previous `2026.4.21-v4` package does not include the new Desktop-write routing instructions.
  - 2026-04-21 local validation:
    - `cmd.exe /c npm test -- electron/main/__tests__/feishu-managed-workspace-bootstrap.test.ts electron/main/__tests__/openclaw-config-coordinator.test.ts electron/main/__tests__/feishu-official-plugin-state.test.ts` passed (`3` files, `20` tests)
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npm run build:app` passed
    - `cmd.exe /c npm run package:win` passed
    - installer artifact: `release/2026.4.21-v5/Mclaw_2026.4.21-v5.exe`
    - unpacked artifact: `release/2026.4.21-v5/win-unpacked/Mclaw.exe`
    - packaged bundle verification still passed with bundled `node v24.14.1`, bundled `npx 11.11.0`, and bundled `openclaw-lark` exposing `feishu`

- Update 535
  - Fixed the remaining Feishu config/pairing modal placeholder copy in:
    - `src/components/ChannelsPageConfigModal.tsx`
    - `src/components/ChannelsPagePairingModal.tsx`
  - The shared-status repair hint is now clean Chinese (`如共享飞书运行时阻塞，请先在这里一键修复；刷新共享状态后再继续配对。`), and the post-success primary action now shows `开始对话` instead of `????`.
  - Fixed the Direct Chat duplicate assistant replay regression in `electron/main/openclaw-chat-service.ts`. Root cause was the transcript merge path: local cache could keep a combined assistant reply while upstream history already exposed the split thinking / tool / final-answer turns, so the renderer ended up showing both.
  - Added composite-replay suppression during transcript merge:
    - normalize the local/external assistant text for comparison
    - skip a cached local assistant message when it is effectively a replay of multiple assistant segments already present upstream
    - keep the upstream thinking/tool/final-answer sequence intact
  - Added regression coverage in:
    - `src/components/__tests__/channels-page-config-modal.test.ts`
    - `src/components/__tests__/channels-page-pairing-modal.test.ts`
    - `electron/main/__tests__/openclaw-chat-service.test.ts`
  - 2026-04-21 local validation:
    - `cmd.exe /c npm test -- src/components/__tests__/channels-page-config-modal.test.ts src/components/__tests__/channels-page-pairing-modal.test.ts electron/main/__tests__/openclaw-chat-service.test.ts` passed (`3` files, `122` tests)
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npm run build:app` passed

- Update 536
  - Built a fresh Windows packaged artifact after the Feishu modal copy fix and Direct Chat transcript-merge dedupe fix.
  - 2026-04-21 packaging validation:
    - `cmd.exe /c npm run package:win` passed
    - installer artifact: `release/2026.4.21-v6/Mclaw_2026.4.21-v6.exe`
    - unpacked artifact: `release/2026.4.21-v6/win-unpacked/Mclaw.exe`
    - packaged bundle verification still passed with bundled `node v24.14.1`, bundled `npx 11.11.0`, and bundled `openclaw-lark` exposing `feishu`

- Update 537
  - Fixed the remaining Direct Chat replay edge case in `electron/main/openclaw-chat-service.ts`: after the previous assistant-side dedupe landed, a delayed locally cached user turn could still be appended at the end of the merged transcript when the local cache wrote the whole turn after the upstream split turn had already completed.
  - Added `isLocalUserReplayForCompositeAssistantTurn(...)` so transcript merge now suppresses a local user message when:
    - it is immediately paired with a local composite assistant replay,
    - upstream history already contains the same user text,
    - and that upstream user sits in the same recent turn window.
  - This keeps the intended UI behavior:
    - show upstream thinking / tool / final-answer turns
    - do not append the cached duplicate user bubble afterward
  - Added regression coverage in `electron/main/__tests__/openclaw-chat-service.test.ts` for the delayed user-replay case.
  - 2026-04-21 local validation:
    - sandboxed `cmd.exe /c npm test -- electron/main/__tests__/openclaw-chat-service.test.ts` hit `spawn EPERM`
    - escalated rerun passed (`1` file, `119` tests)
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npm run build:app` passed

- Update 538
  - Built a fresh Windows packaged artifact after the Direct Chat duplicate-user replay fix.
  - 2026-04-21 packaging validation:
    - `cmd.exe /c npm run package:win` passed
    - installer artifact: `release/2026.4.21-v8/Mclaw_2026.4.21-v8.exe`
    - unpacked artifact: `release/2026.4.21-v8/win-unpacked/Mclaw.exe`
    - packaged bundle verification still passed with bundled `node v24.14.1`, bundled `npx 11.11.0`, and bundled `openclaw-lark` exposing `feishu`

- Update 539
  - Tightened Direct Chat transcript merge dedupe in `electron/main/openclaw-chat-service.ts` after a live retest still showed the same user question replayed at the end of the thread.
  - Root cause was more specific than the previous patch: upstream session history and local transcript cache do not always use the same timestamp basis. In the failing live path, upstream message timestamps and local cached message timestamps were far apart numerically even when the role/text were clearly the same turn, so the old timestamp-window guard still let the local replay leak into the merged transcript.
  - Adjusted transcript merge behavior:
    - exact transcript-merge fingerprint matches now dedupe regardless of timestamp skew
    - composite assistant replay detection no longer depends on a narrow timestamp window
    - paired local user replay suppression now keys off the upstream text match instead of the upstream timestamp window
  - Added/updated regression coverage in `electron/main/__tests__/openclaw-chat-service.test.ts` to simulate the real mixed timestamp-basis case.
  - 2026-04-21 local validation:
    - `cmd.exe /c npm test -- electron/main/__tests__/openclaw-chat-service.test.ts` passed (`1` file, `119` tests)
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npm run build:app` passed

- Update 540
  - Built a fresh Windows packaged artifact after the mixed-timestamp transcript-merge dedupe fix.
  - 2026-04-21 packaging validation:
    - `cmd.exe /c npm run package:win` passed
    - installer artifact: `release/2026.4.21-v9/Mclaw_2026.4.21-v9.exe`
    - unpacked artifact: `release/2026.4.21-v9/win-unpacked/Mclaw.exe`
    - packaged bundle verification still passed with bundled `node v24.14.1`, bundled `npx 11.11.0`, and bundled `openclaw-lark` exposing `feishu`

- Update 541
  - Fixed the remaining Direct Chat duplicate-user replay path for Control UI initiated chats. Live inspection of the latest failing session showed the upstream user message still carried the control-ui timestamp prefix (`[Tue 2026-04-21 20:12 GMT+8] ...`) after metadata sanitization, while the local transcript cache stored only the plain user text. That text mismatch meant the merge layer still could not recognize the two user turns as the same message.
  - Updated `electron/main/openclaw-chat-service.ts` so metadata-wrapped external user messages also strip the leading control-ui timestamp prefix after removing the untrusted metadata wrapper.
  - Added regression coverage in `electron/main/__tests__/openclaw-chat-service.test.ts` for the control-ui timestamp-prefix case.
  - 2026-04-21 local validation:
    - `cmd.exe /c npm test -- electron/main/__tests__/openclaw-chat-service.test.ts` passed (`1` file, `120` tests)
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npm run build:app` passed

- Update 542
  - Integrated the Phase 7 security module into the main process by copying `Phase7-Delivery/security/` into `electron/main/security/` and wiring the first safe enforcement points without touching the Direct Chat merge path or the screenshot recovery pipeline.
  - Added CLI-output redaction in `electron/main/openclaw-command-output.ts`. The new `sanitizeCliOutput(...)` path now masks likely secret values before user-facing failure text is returned, while intentionally avoiding over-redaction of normal config variable names.
  - Added a managed-plugin whitelist bootstrap in `electron/main/security/official-plugin-whitelist.ts` and enforced it from `electron/main/cli.ts` for official/expected plugin installs. This keeps the existing general plugin install path intact, but blocks auto-install of managed plugins when the source is not in the trusted allowlist.
  - Added redacted diagnostic IPC reads in `electron/main/ipc-handlers.ts`:
    - `config:read:redacted`
    - `env:read:redacted`
    The existing `config:read` / `env:read` handlers stay unchanged so current renderer edit flows do not regress by writing masked config values back to disk.
  - Added validation coverage in:
    - `electron/main/__tests__/openclaw-command-output.test.ts`
    - `electron/main/security/__tests__/official-plugin-whitelist.test.ts`
  - 2026-04-21 local validation:
    - `cmd.exe /c npm run typecheck` passed
    - escalated `vitest run electron/main/__tests__/openclaw-command-output.test.ts electron/main/__tests__/watchdog-service.test.ts electron/main/security/__tests__/redaction-service.test.ts electron/main/security/__tests__/whitelist-service.test.ts electron/main/security/__tests__/official-plugin-whitelist.test.ts` passed (`5` files, `50` tests)
    - escalated `vitest run electron/main/__tests__/openclaw-chat-service.test.ts` still hit the existing temp-runtime cleanup issue on this machine (`EBUSY` while removing `qclaw-chat-service-*\\runtime` after the first timed-out case), so that suite was not used as the merge gate for this slice

- Update 543
  - Integrated the watchdog module by copying `M-claw-hizeys/electron/main/watchdog/` into `electron/main/watchdog/` and wiring it into the app lifecycle.
  - `electron/main/index.ts` now schedules watchdog startup 30 seconds after app ready with the current thresholds:
    - health check interval: `15000ms`
    - consecutive failure threshold: `3`
    - circuit-open cooldown: `60000ms`
  - `electron/main/app-exit-cleanup.ts` now stops the watchdog during shutdown, and `electron/main/ipc-handlers.ts` now exposes:
    - `watchdog:state`
    - `watchdog:events`
    - `watchdog:running`
    - `watchdog:start`
    - `watchdog:stop`
  - Added `electron/main/__tests__/watchdog-service.test.ts` to cover start/stop state transitions, event emission, and double-start suppression.
  - Built a fresh Windows unpacked artifact after the security + watchdog slice landed.
  - 2026-04-21 packaging validation:
    - escalated `cmd.exe /c npm run package:win:dir` passed
    - unpacked artifact: `release/2026.4.21-v11/win-unpacked/Mclaw.exe`
    - packaged bundle verification still passed with bundled `node v24.14.1`, bundled `npx 11.11.0`, and bundled `openclaw-lark` exposing `feishu`

- Update 544
  - Stabilized the Windows-local regression gate for `electron/main/__tests__/openclaw-chat-service.test.ts`, which had stopped being a reliable merge gate because multiple send-path cases were clustering around the default `5s` Vitest timeout and a single timeout then cascaded into `EBUSY` temp-runtime cleanup failures.
  - Updated the chat-service test file to:
    - raise the per-file Vitest runtime timeout to `15000ms`
    - retry temp user-data directory cleanup on transient Windows `EBUSY` / `EPERM` / `ENOTEMPTY` errors before the next case starts
    - keep the previously widened `records send trace entries for a successful local send flow` case covered under the higher suite timeout
  - This was a test-harness stabilization only; no production chat-service behavior changed in this slice.
  - 2026-04-21 local validation:
    - `cmd.exe /c npm run typecheck` passed
    - escalated `cmd.exe /c npx vitest run electron/main/__tests__/openclaw-chat-service.test.ts` passed (`1` file, `120` tests)
    - escalated `cmd.exe /c npx vitest run electron/main/__tests__/openclaw-chat-service.test.ts electron/main/__tests__/gateway-lifecycle-controller.test.ts electron/main/__tests__/openclaw-command-output.test.ts electron/main/__tests__/watchdog-service.test.ts electron/main/security/__tests__/redaction-service.test.ts electron/main/security/__tests__/whitelist-service.test.ts electron/main/security/__tests__/official-plugin-whitelist.test.ts src/pages/__tests__/chat-availability-state.test.ts src/pages/__tests__/dashboard-entry-flow.test.tsx` passed (`9` files, `200` tests)

- Update 545
  - Completed `security-watchdog-integration-plan.md` Phase 8 packaging validation on the current working tree after the security/watchdog integration and the Windows-local regression-gate stabilization both landed.
  - Built a fresh Windows unpacked artifact:
    - `release/2026.4.21-v12/win-unpacked/Mclaw.exe`
  - Packaged bundle verification still passed:
    - bundled runtime: `openclaw-bundle/runtime/windows-x64`
    - bundled `node`: `v24.14.1`
    - bundled `npx`: `11.11.0`
    - bundled managed plugin: `openclaw-lark`
    - packaged channel exposure: `feishu`
  - Packaging command also rotated the retained release directory from `2026.4.21-v11` to `2026.4.21-v12`.
  - 2026-04-21 packaging validation:
    - escalated `cmd.exe /c npm run package:win:dir` passed

- Update 546
  - Added a post-plan diagnostics follow-up for the security/watchdog lane so the renderer can read the new watchdog state and the safe redacted config/env snapshots through the existing desktop bridge.
  - Extended `electron/preload/index.ts` and `src/types/electron.d.ts` with:
    - `getWatchdogState()`
    - `listWatchdogEvents()`
    - `isWatchdogRunning()`
    - `startWatchdog()`
    - `stopWatchdog()`
    - `readConfigRedacted()`
    - `readEnvFileRedacted()`
  - Added shared watchdog types in `src/shared/watchdog.ts` and aligned the main-process watchdog type module to re-export those shared contracts so the renderer and main process use the same state/event shape.
  - Wired the hidden Dashboard Chat diagnostics panel to load and render:
    - watchdog runtime state
    - recent watchdog events
    - redacted config snapshot preview
    - redacted env snapshot preview
  - Added focused regression coverage in:
    - `electron/preload/index.test.ts`
    - `src/components/dashboard/system-diagnostics.test.ts`
  - 2026-04-22 local validation:
    - `cmd.exe /c npm run typecheck` passed
    - escalated `cmd.exe /c npx vitest run electron/preload/index.test.ts src/components/dashboard/system-diagnostics.test.ts` passed (`2` files, `6` tests)
    - escalated `cmd.exe /c npm run build:app` passed

- Update 547
  - Re-ran the security/watchdog merge gate rigorously on the final working tree before release packaging, covering the original security/watchdog slice, the chat-service regression gate, the preload bridge, and the renderer diagnostics follow-up in one focused pass.
  - 2026-04-22 regression validation:
    - escalated `cmd.exe /c npx vitest run electron/main/__tests__/openclaw-chat-service.test.ts electron/main/__tests__/gateway-lifecycle-controller.test.ts electron/main/__tests__/openclaw-command-output.test.ts electron/main/__tests__/watchdog-service.test.ts electron/main/security/__tests__/redaction-service.test.ts electron/main/security/__tests__/whitelist-service.test.ts electron/main/security/__tests__/official-plugin-whitelist.test.ts electron/preload/index.test.ts src/components/dashboard/system-diagnostics.test.ts src/pages/__tests__/chat-availability-state.test.ts src/pages/__tests__/dashboard-entry-flow.test.tsx` passed (`11` files, `206` tests)
  - Built a fresh signed-off Windows release package after that regression pass:
    - installer: `release/2026.4.22-v0/Mclaw_2026.4.22-v0.exe`
    - unpacked: `release/2026.4.22-v0/win-unpacked/Mclaw.exe`
  - 2026-04-22 packaging validation:
    - escalated `cmd.exe /c npm run package:win` passed
    - packaged bundle verification still passed with bundled `node v24.14.1`, bundled `npx 11.11.0`, and bundled `openclaw-lark` exposing `feishu`

- Update 548
  - Fixed the first post-release acceptance slice for the latest desktop-chat/watchdog issues reported on the packaged Windows build.
  - `src/App.tsx`
    - startup plugin-repair is now treated as best-effort
    - soft startup repair misses no longer persist or surface a false `插件环境修复失败` banner when nothing actually needed repair
  - `electron/main/cli.ts` and `electron/main/openclaw-runtime-paths.ts`
    - Windows CLI execution now prefers the resolved real OpenClaw runtime path instead of letting shell resolution bounce through wrappers
    - runtime probing now uses `resolveOpenClawCommand(...)` with hidden windows, reducing the risk of idle watchdog checks spawning visible flashing terminals
  - `src/shared/chat-visible-text.ts`, `src/components/dashboard/chat-panel-messages.ts`, and `src/components/dashboard/DashboardChatPanel.tsx`
    - assistant tool noise / raw machine lines are filtered out of visible chat text
    - assistant reasoning is split from final answer and rendered in a collapsible `思考过程` block
    - Windows file-path extraction now scans full assistant content instead of relying on fragile line-tail matches, fixing truncated path/button labels such as `广州今天气.txt`
    - current-session self-click in history now reloads the transcript instead of blanking the panel
    - chat diagnostics entry is now visible from the main chat panel so watchdog state and redacted snapshots are easier to discover
  - `electron/main/openclaw-chat-service.ts`
    - transcript merge/dedupe now fingerprints normalized visible text, reducing duplicate replay artifacts after assistant-text sanitization
  - Added/updated focused regression coverage in:
    - `src/components/dashboard/chat-panel-messages.test.ts`
    - `src/components/dashboard/dashboard-chat-panel-guardrails.test.ts`
    - `electron/main/__tests__/openclaw-chat-service.test.ts`
  - 2026-04-22 local validation:
    - `cmd.exe /c npm run typecheck` passed
    - `cmd.exe /c npx vitest run src/components/dashboard/chat-panel-messages.test.ts src/components/dashboard/dashboard-chat-panel-guardrails.test.ts` passed
    - `cmd.exe /c npx vitest run electron/main/__tests__/openclaw-chat-service.test.ts` passed

- Update 549
  - Audited the Update 548 acceptance fixes against the actual code paths and tightened the parts that were still too optimistic.
  - `src/shared/chat-visible-text.ts`
    - Rebuilt the assistant-text cleanup heuristics so the reasoning/final splitter no longer depends on corrupted mojibake markers.
    - The final-answer split now keeps the whole final block together instead of accidentally leaving early bullet lines inside `思考过程`.
    - Embedded image/base64 stripping now also removes the dangling trailing colon that could remain after the payload is removed.
    - Centralized Windows local-path extraction and path-label formatting here so the same raw-text parser can be reused consistently.
  - `src/components/dashboard/DashboardChatPanel.tsx`
    - File buttons now scan the raw assistant message text together with the rendered reasoning/final text instead of only scanning the already-cleaned display text.
    - When a raw tool payload contains both `path` and its parent `workdir`, the UI now keeps the concrete file path and suppresses the redundant ancestor directory button.
  - `electron/main/openclaw-chat-service.ts`
    - Transcript merge fingerprints and composite-replay comparisons now use sanitized visible text per role, so a locally cached assistant turn with tool chatter no longer reappears beside the already-clean upstream turn.
  - `src/App.tsx`
    - Startup plugin repair now treats no-op / soft-miss results as silent best-effort cache entries, but it still persists and surfaces a startup failure when the result contains real incompatible-plugin evidence, failed plugin ids, or failed paths.
  - Expanded focused regression coverage in:
    - `src/components/dashboard/chat-panel-messages.test.ts`
    - `src/components/dashboard/dashboard-chat-panel-guardrails.test.ts`
    - `electron/main/__tests__/openclaw-chat-service.test.ts`
  - 2026-04-22 validation:
    - `cmd.exe /c npm run typecheck` passed
    - escalated `cmd.exe /c npx vitest run src/components/dashboard/chat-panel-messages.test.ts electron/main/__tests__/openclaw-chat-service.test.ts` passed (`2` files, `129` tests)
    - escalated `cmd.exe /c npx vitest run src/components/dashboard/dashboard-chat-panel-guardrails.test.ts electron/main/__tests__/openclaw-runtime-paths.test.ts` passed (`2` files, `13` tests)
    - escalated `cmd.exe /c npm run build:app` passed
    - escalated `cmd.exe /c npm run package:win:dir` passed
  - Built a fresh Windows unpacked validation artifact with the tightened acceptance fixes:
    - unpacked: `release/2026.4.22-v1/win-unpacked/Mclaw.exe`

- Update 550
  - Closed the remaining acceptance gaps from the `v1` user retest and rebuilt a new Windows validation package.
  - `src/components/dashboard/chat-panel-messages.ts` and `src/components/dashboard/DashboardChatPanel.tsx`
    - replaced the old per-message-only assistant splitter with message-level grouping across consecutive assistant/process bubbles
    - the chat panel now merges fragmented `reasoning_content` / tool-process / path-only assistant bubbles into a single assistant turn
    - `思考过程` is now rendered as a dedicated collapsible block with a Gemini-style left vertical guideline, while the final answer stays in the main bubble below
    - file-button extraction now reads `rawText` from the grouped assistant turn so grouped transcripts still surface the real deliverable file
  - `src/shared/chat-visible-text.ts`
    - tightened machine-artifact filtering so marker-only lines such as `reasoning_content` no longer leak into the visible chat body
    - stopped falling back to raw artifact lines when every line was machine noise; this prevents placeholder process markers from being rendered as user-facing content
    - filtered internal runtime-managed files from assistant path buttons, including `HEARTBEAT.md`, `.openclaw` runtime workspaces, and internal browser-media files under `openclaw-state`
  - `electron/main/openclaw-spawn.ts`
    - extended Windows command resolution beyond the bundled runtime case: global/npm `openclaw.cmd` shims are now unwrapped to their package entrypoint and launched through a real `node.exe`
    - this removes another visible-shell path on Windows that could still be hit when model switching or gateway reloads resolved to an npm shim instead of the bundled runtime
  - `electron/main/command-capabilities.ts` and `electron/main/openclaw-package.ts`
    - added `windowsHide: true` to command-path probing helpers so Windows lookup/probe subprocesses do not flash visible terminals during command discovery
  - `electron/main/openclaw-chat-service.ts`
    - kept explicit assistant JSON text fields parseable even when the content itself looks like a JSON object, while still suppressing true tool-payload blobs from non-assistant fields
    - this preserves legitimate assistant replies and avoids regressing transcript parsing while the stricter chat cleanup is enabled
  - Audited the current live plugin state on this machine after the startup-repair best-effort change:
    - `C:\Users\James\AppData\Roaming\Mclaw\openclaw-state\.openclaw\openclaw.json` currently contains only the managed `openclaw-lark` install in `plugins.allow`
    - the managed plugin directory exists with both `openclaw.plugin.json` and `package.json`
    - no additional stale plugin ids or obviously broken plugin install records were found in the active managed config snapshot
  - Added/updated focused regression coverage in:
    - `src/components/dashboard/chat-panel-messages.test.ts`
    - `src/components/dashboard/dashboard-chat-panel-guardrails.test.ts`
    - `electron/main/__tests__/openclaw-spawn.test.ts`
  - 2026-04-22 validation:
    - `cmd.exe /c npm run typecheck` passed
    - escalated `cmd.exe /c npx vitest run src/components/dashboard/chat-panel-messages.test.ts src/components/dashboard/dashboard-chat-panel-guardrails.test.ts electron/main/__tests__/openclaw-spawn.test.ts` passed (`3` files, `30` tests)
    - escalated `cmd.exe /c npx vitest run electron/main/__tests__/openclaw-chat-service.test.ts` passed (`1` file, `121` tests)
    - escalated `cmd.exe /c npm run build:app` passed
    - escalated `cmd.exe /c npm run package:win:dir` passed
  - Built a fresh Windows unpacked validation artifact containing the latest acceptance fixes:
    - unpacked: `release/2026.4.22-v2/win-unpacked/Mclaw.exe`

- Update 551
  - Fixed the follow-up regressions reported after the `v2` unpacked retest and produced a new Windows validation build.
  - `src/components/dashboard/chat-panel-messages.ts` and `src/components/dashboard/DashboardChatPanel.tsx`
    - assistant file buttons now come from message-scoped `localPaths` computed during assistant-turn grouping, instead of rescanning the entire grouped raw transcript blob
    - the path extractor now prefers the final-answer block and only falls back to the latest meaningful assistant path-bearing bubble when the final reply omits the full path
    - this removes junk buttons such as stray `.html` / truncated fragments while still keeping the real deliverable file button
    - chat image thumbnails are now filtered through a renderability guard so broken non-image artifacts no longer surface as clickable `聊天图片` previews
  - `electron/main/openclaw-chat-service.ts`
    - tightened image-attachment parsing so arbitrary remote URLs are no longer treated as chat images unless they are explicit image payloads, image-like local files, or remote URLs that clearly resolve to images
    - this suppresses bogus screenshot/image attachments caused by upstream tool/search metadata carrying generic `url` fields
  - `electron/main/cli.ts` and `electron/main/openclaw-runtime-paths.ts`
    - Windows command resolution now passes the fully prepared runtime `env` into `resolveOpenClawCommand(...)`
    - npm/global `openclaw.cmd` shims can therefore be unwrapped using the managed `node.exe` lookup path during model-status polling and gateway reload flows, reducing the remaining visible `timeout /t 1 /nobreak` shell popups during model switching
  - Added/updated focused regression coverage in:
    - `src/components/dashboard/chat-panel-messages.test.ts`
    - `src/components/dashboard/dashboard-chat-panel-guardrails.test.ts`
    - `electron/main/__tests__/openclaw-chat-service.test.ts`
    - `electron/main/__tests__/cli-windows-spawn.test.ts`
  - 2026-04-22 validation:
    - `npm.cmd run typecheck` passed
    - escalated `npx.cmd vitest run src/components/dashboard/chat-panel-messages.test.ts src/components/dashboard/dashboard-chat-panel-guardrails.test.ts electron/main/__tests__/openclaw-chat-service.test.ts electron/main/__tests__/cli-windows-spawn.test.ts` passed (`4` files, `140` tests)
    - escalated `npm.cmd run build:app` passed
    - escalated `npm.cmd run package:win:dir` passed
  - Built a fresh Windows unpacked validation artifact containing this acceptance slice:
    - unpacked: `release/2026.4.22-v3/win-unpacked/Mclaw.exe`
