# OpenClaw Runtime 接入 Runbook

## 1. 适用场景

本 runbook 用于以下场景：

1. 已从外部拿到真实 `OpenClaw` runtime。
2. 准备把该 runtime 接入 Mclaw 仓库。
3. 目标是最短路径完成：
   - 候选检查
   - manifest 预览
   - 直探测
   - 仓库校验
   - `Phase 2` 退出判断

本 runbook 不替代详细规范，只负责把执行顺序压缩成一条可直接照跑的命令链。

## 2. 前置条件

开始前先确认：

1. 当前仓库所在盘剩余空间仍大于 `5 GB`。
2. 候选目录来源已经满足 [openclaw-bundled-runtime-acquisition-sop.md](./openclaw-bundled-runtime-acquisition-sop.md) 的来源要求。
3. 来源机与候选目录都已完成一次 `--version` 验证。
4. 已先按 [openclaw-version-strategy.md](./openclaw-version-strategy.md) 判断该包属于：
   - 当前主线 `2026.3.24`
   - 或 `2026.4.x` 候选线

## 3. 平台目录约定

- `win32-x64` -> `resources/openclaw-bundle/runtime/windows-x64`
- `darwin-arm64` -> `resources/openclaw-bundle/runtime/darwin-arm64`
- `darwin-x64` -> `resources/openclaw-bundle/runtime/darwin-x64`

补充入口：

1. `darwin-arm64` 收包时，优先参考：
   - [darwin-arm64-runtime-intake-command-sheet.md](./darwin-arm64-runtime-intake-command-sheet.md)
2. `darwin-x64` 收包时，优先参考：
   - [darwin-x64-runtime-intake-command-sheet.md](./darwin-x64-runtime-intake-command-sheet.md)

## 4. 标准执行顺序

### A. 放入候选目录

1. 将真实 runtime 放到目标目录：
   - 例如 `resources/openclaw-bundle/runtime/darwin-arm64`
2. 不要先改 `manifest.json`。

### B. 候选报告

执行：

```bash
npm run report:openclaw:runtime-candidate -- --runtime-dir resources/openclaw-bundle/runtime/darwin-arm64 --platform darwin --arch arm64 --version <真实版本>
```

要求：

1. 命中正确的 binary 路径。
2. 命中 `node_modules/openclaw/package.json`。
3. 包体体积在预期范围内。
4. 建议的 `directoryName` 与实际目录一致。

### C. manifest 预览

如果当前只接入 `darwin-arm64`，先执行：

```bash
npm run preview:openclaw:manifest-runtime -- --runtime darwin:arm64:darwin-arm64:<真实版本>
```

如果 `darwin-arm64` 与 `darwin-x64` 都已齐备，并准备切默认模式，再执行：

```bash
npm run preview:openclaw:manifest-runtime -- --runtime darwin:arm64:darwin-arm64:<真实版本> --runtime darwin:x64:darwin-x64:<真实版本> --enable-bundled-runtime
```

要求：

1. 预览输出中的 `artifacts.runtime[]` 与实际接入目标一致。
2. 若当前仓库默认模式尚未切换，且只补单平台，则不切 `defaultDeliveryMode`。
3. 若双平台都已完成并准备切主路径，再预览 `defaultDeliveryMode = bundled-runtime`。
4. 如需把 preview 也纳入统一 intake 判定链，可追加：

```bash
npm run preview:openclaw:manifest-runtime -- --runtime darwin:arm64:darwin-arm64:<真实版本> --runtime-check darwin:arm64:<候选目录>:<真实版本>
```

并关注：

- `runtimeCheck.intakeDecision=mainline-ready`
- 或 `runtimeCheck.intakeDecision=candidate-only`
- 或 `runtimeCheck.intakeDecision=reject`

### D. runtime 直探测

执行：

```bash
npm run probe:openclaw:runtime -- --runtime-dir resources/openclaw-bundle/runtime/darwin-arm64 --platform darwin --arch arm64 --version <真实版本>
```

要求：

1. 结构检查通过。
2. 若当前主机不是目标平台，则至少使用结构模式完成校验。
3. 只有 probe 通过，才允许继续回填 manifest。
4. 如果传入了 `--version <真实版本>`，probe 输出中的 `intakeDecision` 也应与 candidate report 一致：
   - `mainline-ready`
   - `candidate-only`
   - `reject`

### E. 正式回填 manifest

按前一步 manifest 预览结果，手动更新：

- `resources/openclaw-bundle/manifest.json`

规则：

1. 只补已经通过候选报告和 probe 的 runtime artifact。
2. 若真实版本不是当前主线 `2026.3.24`，则本轮不回填主线 manifest。
3. 若当前仓库默认模式尚未切换，且只新增单个平台 runtime，则不切 `defaultDeliveryMode`。
4. 若双平台真实 payload 都已到位且验证通过，再切到 `bundled-runtime`；若仓库已提前切换，则继续以严格校验和 `Phase 2` 退出检查为准。

### F. 仓库校验

依次执行：

```bash
npm run check:openclaw:bundle
npm run check:openclaw:bundle:strict
npm run report:openclaw:bundle
npm run check:openclaw:phase2-exit
```

要求：

1. `check:openclaw:bundle:strict` 必须通过。
2. `report:openclaw:bundle` 必须显示目标平台已命中 `bundled-runtime`。
3. `report:openclaw:bundle` 现在还会额外输出：
   - `targetMainlineState=...`
   - `mainlineStatus=...`
   - `readyRequiredTargets=...`
   可用于快速确认当前 bundled runtime 是否仍与 pinned baseline 一致。
4. 只有真实版本属于当前主线 `2026.3.24`，且 `check:openclaw:phase2-exit` 通过，才说明 `Phase 2` 可以考虑退出。
5. 如果真实版本属于 `2026.4.x`，则本轮校验结论只记为：
   - candidate runtime 已完成报告 / probe / 对比
   - 不改变 pinned baseline
   - 不宣称 `Phase 2` 已退出
6. `check:openclaw:phase2-exit` 现在还会额外输出：
   - `mainlineStatus=...`
   - `readyRequiredTargets=...`
   用于快速判断当前是：
   - Windows-only 主线就绪
   - 还是 `win32-x64 + darwin-arm64 + darwin-x64` 主线路径已就绪

### G. 构建与实机验证

继续执行：

```bash
npm run build:app
```

然后进入：

1. Windows 断网首启验证。
2. macOS 断网首启验证。

## 5. 最小记录模板

建议在 [dev_log.md](./dev_log.md) 回填以下信息：

1. 本次接入平台：
2. 真实版本：
3. 版本线：
4. 候选报告结果：
5. probe 结果：
6. manifest 是否更新：
7. `check:openclaw:bundle:strict` 结果：
8. `report:openclaw:bundle` 结果：
9. `check:openclaw:phase2-exit` 结果：
10. 是否允许退出 `Phase 2`：

## 6. 常见禁止动作

1. 候选报告没跑就改 `manifest.json`。
2. probe 没过就宣称 runtime 可用。
3. 明明实际版本属于 `2026.4.x`，却直接按 `2026.3.24` 主线 runtime 入仓。
4. 在未完成严格校验和 `Phase 2` 退出检查前，仅凭单个平台 runtime 就宣称 bundled-runtime 已完全闭环。
5. 不看磁盘空间就直接复制大体积 runtime。
