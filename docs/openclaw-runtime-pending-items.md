# OpenClaw Runtime 待补事项

## 1. 当前状态

截至 `2026-04-09`，当前主线策略已调整为：

1. `win32-x64`、`darwin-arm64` 与 `darwin-x64` 已共同构成当前主线 bundled-runtime 三平台路径。
2. `Intel Mac` 不再默认依赖：
   - `bundled-fallback`
   - `online-fallback`
3. `resources/openclaw-bundle/manifest.json` 仍保持：
   - `defaultDeliveryMode = bundled-runtime`
   - `targetDeliveryMode = bundled-runtime`
4. 当前仓库已经可以直接用以下两类输出判断主线状态：
   - `npm run check:openclaw:phase2-exit`
   - `npm run report:openclaw:bundle`
5. 当前 OpenClaw 主线版本继续锁定 `2026.3.24`；外部提到的 `2026.4.6/2026.4.7` 统一先按 `2026.4.x` 候选线处理。

## 2. 当前挂起事项

当前挂起事项为：

1. 当前不再存在主线 bundled-runtime 挂起项；`darwin-x64` 已完成真实 runtime 的获取、复验与接入前验收。

影响如下：

1. `Intel Mac` 已具备命中 `bundled-runtime` 的主线路径。
2. `report:openclaw:bundle` 中 `darwin-x64` 已切换为 `mainline-ready`。
3. 当前主线已经可以宣称：
   - `win32-x64`
   - `darwin-arm64`
   - `darwin-x64`
   三条路径均已进入主线 bundled-runtime
4. 当前可以直接通过 `npm run check:openclaw:phase2-exit` 与 `npm run report:openclaw:bundle` 共同确认：
   - 当前主线是否仍保持 `cross-platform-mainline-ready`
   - 三平台 runtime 是否仍与 pinned baseline `2026.3.24` 一致

## 3. 为什么当前先挂起

当前该事项已关闭，后续关注点改为：

1. 保持 `darwin-x64` 与 `win32-x64`、`darwin-arm64` 同步处于 `2026.3.24` pinned baseline。
2. 后续若替换 `darwin-x64` runtime，仍需重复执行 receipt / report / probe / preview / migration smoke 链路。
3. `Claude Code` 与 `MemOS / memos` 仍继续放在 `2026.4.x` 候选评估线，不因本次 Intel Mac 接入而直接改主线基线。

## 4. 恢复推进条件

满足以下任一条件后，重新打开该事项：

1. 需要替换当前 `darwin-x64` 主线 runtime。
2. 收到新的 `2026.4.x` Intel Mac 候选 runtime，需要做候选验证。
3. 当前 `darwin-x64` runtime 在后续 bundle / probe / 实机验证中出现回归。

建议附带交接信息：

1. 来源机器平台与架构。
2. OpenClaw 版本。
3. 来源机 `--version` 结果。
4. 候选目录 `--version` 结果。
5. 若口头版本与实际版本不一致，以 `--version` 结果为准。

## 5. 恢复后执行入口

恢复推进后，统一按以下顺序执行：

1. 先确认候选目录的精确版本；若实际版本属于 `2026.4.x`，则本轮只做候选验证，不直接改 pinned baseline。
2. 候选报告（若实际版本不是 `2026.3.24`，将命令中的 `--version` 参数替换为候选真实版本）：
   - `npm run report:openclaw:runtime-candidate -- --runtime-dir resources/openclaw-bundle/runtime/darwin-x64 --platform darwin --arch x64 --version 2026.3.24`
3. manifest 预览（若实际版本不是 `2026.3.24`，将命令中的版本段替换为候选真实版本）：
   - `npm run preview:openclaw:manifest-runtime -- --runtime darwin:x64:darwin-x64:2026.3.24`
4. runtime probe：
   - `npm run probe:openclaw:runtime -- --runtime-dir resources/openclaw-bundle/runtime/darwin-x64 --platform darwin --arch x64`
5. 若决定切主线，再手动回填：
   - `resources/openclaw-bundle/manifest.json`
6. 仓库校验：
   - `npm run check:openclaw:bundle`
   - `npm run check:openclaw:bundle:strict`
   - `npm run report:openclaw:bundle`
   - `npm run check:openclaw:phase2-exit`

补充约束：

1. 如果拿到的 `darwin-arm64` 包真实版本属于 `2026.4.x`，本轮默认只做候选验证，不直接入主线 manifest。
2. 收包时优先按以下文档组合执行：
   - 若接 `darwin-arm64`：
     - [darwin-arm64-runtime-receipt-checklist.md](./darwin-arm64-runtime-receipt-checklist.md)
     - [darwin-arm64-runtime-intake-command-sheet.md](./darwin-arm64-runtime-intake-command-sheet.md)
   - 若接 `darwin-x64`：
     - [darwin-x64-runtime-receipt-checklist.md](./darwin-x64-runtime-receipt-checklist.md)
     - [darwin-x64-runtime-intake-command-sheet.md](./darwin-x64-runtime-intake-command-sheet.md)
   - [openclaw-version-strategy.md](./openclaw-version-strategy.md)
   - [openclaw-upgrade-migration-smoke-runbook.md](./openclaw-upgrade-migration-smoke-runbook.md)

## 6. 相关文档

详细规则与执行入口如下：

1. 获取与入库 SOP：
   - [openclaw-bundled-runtime-acquisition-sop.md](./openclaw-bundled-runtime-acquisition-sop.md)
2. 验证清单：
   - [openclaw-bundled-runtime-validation-checklist.md](./openclaw-bundled-runtime-validation-checklist.md)
3. 短执行 runbook：
   - [openclaw-runtime-intake-runbook.md](./openclaw-runtime-intake-runbook.md)
4. 版本策略：
   - [openclaw-version-strategy.md](./openclaw-version-strategy.md)
5. `Intel Mac` 专用接包命令单：
   - [darwin-x64-runtime-intake-command-sheet.md](./darwin-x64-runtime-intake-command-sheet.md)
6. `Intel Mac` 断网首启验证：
   - [darwin-x64-offline-first-launch-runbook.md](./darwin-x64-offline-first-launch-runbook.md)
7. `Intel Mac` 对外交付说明：
   - [darwin-x64-runtime-handoff.md](./darwin-x64-runtime-handoff.md)
8. `Intel Mac` 对外消息模板：
   - [darwin-x64-runtime-request-message-template.md](./darwin-x64-runtime-request-message-template.md)

## 7. 当前结论

当前结论只保留一句：

1. `win32-x64`、`darwin-arm64`、`darwin-x64` 均已进入主线 bundled-runtime；`2026.4.x` 继续只作为候选线验证。
