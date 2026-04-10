# OpenClaw 内置本体验证清单

## 1. 文档目的

本清单用于 `Phase 2` 的真实 runtime 载荷接入验证。

与 [mclaw-windows-smoke-checklist.md](./mclaw-windows-smoke-checklist.md) 的区别是：

1. 该清单专门验证 `bundled-runtime` 是否真正生效。
2. 该清单同时覆盖 Windows 与 macOS。
3. 该清单的通过结果直接影响 `Phase 2` 是否可以退出。

## 2. 使用前提

执行本清单前，必须满足：

1. `resources/openclaw-bundle/runtime/` 下已放入真实 runtime 载荷。
2. 在回填 `manifest.json` 之前，建议先执行：
   - `npm run report:openclaw:runtime-candidate -- --runtime-dir <path> --platform <platform> --arch <arch> --version <version>`
   用于确认目录结构、二进制入口、包体体积与建议的 `artifacts.runtime[]` 片段。
3. `resources/openclaw-bundle/manifest.json` 已回填 `artifacts.runtime[]`。
3. 当前仓库已通过：
   - `npm run build:app`
4. 建议先执行：
   - `npm run check:openclaw:bundle`
   - 或在真实本体进仓后执行 `npm run check:openclaw:bundle:strict`
5. 建议同时执行：
   - `npm run report:openclaw:bundle`
   以确认：
   - `win32-x64`
   - `darwin-arm64`
   - `darwin-x64`
   当前是否都命中 `bundled-runtime`
6. 载荷获取过程已满足 [openclaw-bundled-runtime-acquisition-sop.md](./openclaw-bundled-runtime-acquisition-sop.md) 的三次验证规则。
7. 若本轮接入的是 `darwin-x64 / Intel Mac`，建议同时打开以下文档，避免只按 arm64 经验操作：
   - [darwin-x64-runtime-receipt-checklist.md](./darwin-x64-runtime-receipt-checklist.md)
   - [darwin-x64-runtime-intake-command-sheet.md](./darwin-x64-runtime-intake-command-sheet.md)
   - [darwin-x64-offline-first-launch-runbook.md](./darwin-x64-offline-first-launch-runbook.md)
   - [openclaw-version-strategy.md](./openclaw-version-strategy.md)
   - [openclaw-upgrade-migration-smoke-runbook.md](./openclaw-upgrade-migration-smoke-runbook.md)

## 3. 载荷预检查

### A. manifest

- [ ] `defaultDeliveryMode` 与当前仓库真实状态一致
- [ ] `targetDeliveryMode` 为 `bundled-runtime`
- [ ] `artifacts.runtime[]` 已声明所有实际放入仓库的平台载荷
- [ ] `directoryName` 与实际目录完全一致
- [ ] `version` 与实际 OpenClaw 版本一致

### B. 目录存在性

- [ ] 存在 `resources/openclaw-bundle/runtime/windows-x64`
- [ ] 存在 `resources/openclaw-bundle/runtime/darwin-arm64`
- [ ] 如需兼容 Intel Mac，存在 `resources/openclaw-bundle/runtime/darwin-x64`

### B1. 直探测准入

- [ ] 已执行 `report:openclaw:runtime-candidate` 记录候选目录体积与建议 manifest 片段
- [ ] Windows 来源目录 `openclaw.cmd --version` 通过
- [ ] Windows 仓库目标目录 `openclaw.cmd --version` 通过
- [ ] macOS 来源目录 `openclaw --version` 或 `bin/openclaw --version` 通过
- [ ] macOS 仓库目标目录 `openclaw --version` 或 `bin/openclaw --version` 通过
- [ ] 如需统一入口，已执行 `npm run probe:openclaw:runtime -- --runtime-dir <path> --platform <platform> --arch <arch>`

### C. 最小结构

- [ ] Windows runtime 含 `openclaw.cmd`
- [ ] Windows runtime 含 `node_modules/openclaw/package.json`
- [ ] macOS runtime 含 `openclaw` 或 `bin/openclaw`
- [ ] macOS runtime 含 `node_modules/openclaw/package.json`

## 4. Windows 验证

### A. 打包前

- [ ] `resolveBundledOpenClawInstallPlan(...)` 对 `win32-x64` 返回 `preferredSource = bundled-runtime`
- [ ] 不再优先落到 `bundled-fallback`
- [ ] 无“runtime directory exists but no runtime binary was found”类 warning

### B. 首次启动

- [ ] 在断网环境下启动安装后的 Windows 包
- [ ] 环境检查阶段可完成 OpenClaw 准备
- [ ] 不出现“必须联网下载 OpenClaw”类主提示
- [ ] 日志中可确认来源为 `bundled-runtime`

### C. 接管结果

- [ ] 目标前缀存在
- [ ] 目标 binary 已落位
- [ ] 目标 `node_modules/openclaw/package.json` 已落位
- [ ] `target binary --version` 成功

## 5. macOS 验证

### A. 打包前

- [ ] `resolveBundledOpenClawInstallPlan(...)` 对 `darwin-arm64` 或 `darwin-x64` 返回 `preferredSource = bundled-runtime`
- [ ] 不再优先落到 `bundled-fallback`
- [ ] 无“runtime directory exists but no runtime binary was found”类 warning

### B. 首次启动

- [ ] 在断网环境下启动安装后的 macOS 包
- [ ] 环境检查阶段可完成 OpenClaw 准备
- [ ] 不出现“必须联网下载 OpenClaw”类主提示
- [ ] 日志中可确认来源为 `bundled-runtime`

### C. 接管结果

- [ ] 目标前缀存在
- [ ] 目标 binary 已落位
- [ ] 目标 `node_modules/openclaw/package.json` 已落位
- [ ] `target binary --version` 成功

## 6. fallback 边界

- [ ] 当 runtime 缺失时，仍可回退到 `bundled-fallback`
- [ ] 当 `tgz` 也缺失时，才回退到 `online-fallback`
- [ ] fallback 原因在日志中可区分

## 7. 通过标准

只有以下条件全部满足，才视为 `Phase 2` 可申请退出：

1. Windows 断网首启通过。
2. macOS Apple Silicon 断网首启通过。
3. macOS Intel 断网首启通过，或已有明确 runbook / 待执行记录且当前仓库侧验收完备。
4. `win32-x64`、`darwin-arm64`、`darwin-x64` 都实际命中 `bundled-runtime`。
5. 三平台 runtime 都完成来源与仓库侧的 `--version` / probe 验证。
6. fallback 仍可用，但不再是默认主路径。

## 8. 当前阶段结论模板

验证完成后，建议在 `docs/dev_log.md` 使用以下格式回填：

1. 本次实机验证平台：
   - Windows:
   - macOS:
2. 候选载荷报告：
   - Windows:
   - macOS:
3. manifest 状态：
   - defaultDeliveryMode:
   - targetDeliveryMode:
4. 实际命中来源：
   - Windows:
   - macOS:
5. 版本探测结果：
   - Windows:
   - macOS:
6. 是否允许退出 `Phase 2`：
   - 是 / 否

补充建议：

1. 若版本属于 `2026.4.x`，本段结论应明确写成“candidate 验证通过/未通过”，不要写成主线已切换。
2. 若平台是 `darwin-x64`，建议同时回填：
   - 是否已按 receipt checklist 验收
   - 是否已追加 migration smoke 记录
   - 是否已按 offline first-launch runbook 执行或排期
