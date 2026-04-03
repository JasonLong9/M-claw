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

1. 当前 C 盘剩余空间仍大于 `5 GB`。
2. 候选目录来源已经满足 [docs/openclaw-bundled-runtime-acquisition-sop.md](C:\Users\James\Desktop\Mclaw\docs\openclaw-bundled-runtime-acquisition-sop.md) 的来源要求。
3. 来源机与候选目录都已完成一次 `--version` 验证。

## 3. 平台目录约定

- `win32-x64` -> `resources/openclaw-bundle/runtime/windows-x64`
- `darwin-arm64` -> `resources/openclaw-bundle/runtime/darwin-arm64`
- `darwin-x64` -> `resources/openclaw-bundle/runtime/darwin-x64`

## 4. 标准执行顺序

### A. 放入候选目录

1. 将真实 runtime 放到目标目录：
   - 例如 `resources/openclaw-bundle/runtime/darwin-arm64`
2. 不要先改 `manifest.json`。

### B. 候选报告

执行：

```bash
npm run report:openclaw:runtime-candidate -- --runtime-dir resources/openclaw-bundle/runtime/darwin-arm64 --platform darwin --arch arm64 --version 2026.3.24
```

要求：

1. 命中正确的 binary 路径。
2. 命中 `node_modules/openclaw/package.json`。
3. 包体体积在预期范围内。
4. 建议的 `directoryName` 与实际目录一致。

### C. manifest 预览

如果当前只接入 `darwin-arm64`，先执行：

```bash
npm run preview:openclaw:manifest-runtime -- --runtime darwin:arm64:darwin-arm64:2026.3.24
```

如果 `darwin-arm64` 与 `darwin-x64` 都已齐备，并准备切默认模式，再执行：

```bash
npm run preview:openclaw:manifest-runtime -- --runtime darwin:arm64:darwin-arm64:2026.3.24 --runtime darwin:x64:darwin-x64:2026.3.24 --enable-bundled-runtime
```

要求：

1. 预览输出中的 `artifacts.runtime[]` 与实际接入目标一致。
2. 若只补单平台，不切 `defaultDeliveryMode`。
3. 若双平台都已完成并准备切主路径，再预览 `defaultDeliveryMode = bundled-runtime`。

### D. runtime 直探测

执行：

```bash
npm run probe:openclaw:runtime -- --runtime-dir resources/openclaw-bundle/runtime/darwin-arm64 --platform darwin --arch arm64
```

要求：

1. 结构检查通过。
2. 若当前主机不是目标平台，则至少使用结构模式完成校验。
3. 只有 probe 通过，才允许继续回填 manifest。

### E. 正式回填 manifest

按前一步 manifest 预览结果，手动更新：

- `resources/openclaw-bundle/manifest.json`

规则：

1. 只补已经通过候选报告和 probe 的 runtime artifact。
2. 若只新增单个平台 runtime，不切 `defaultDeliveryMode`。
3. 若双平台真实 payload 都已到位且验证通过，再切到 `bundled-runtime`。

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
3. 只有 `check:openclaw:phase2-exit` 通过，才说明 `Phase 2` 可以考虑退出。

### G. 构建与实机验证

继续执行：

```bash
npm run build:app
```

然后进入：

1. Windows 断网首启验证。
2. macOS 断网首启验证。

## 5. 最小记录模板

建议在 [docs/dev_log.md](C:\Users\James\Desktop\Mclaw\docs\dev_log.md) 回填以下信息：

1. 本次接入平台：
2. 候选报告结果：
3. probe 结果：
4. manifest 是否更新：
5. `check:openclaw:bundle:strict` 结果：
6. `report:openclaw:bundle` 结果：
7. `check:openclaw:phase2-exit` 结果：
8. 是否允许退出 `Phase 2`：

## 6. 常见禁止动作

1. 候选报告没跑就改 `manifest.json`。
2. probe 没过就宣称 runtime 可用。
3. 只补 `darwin-arm64` 就把 `defaultDeliveryMode` 切到 `bundled-runtime`。
4. 不看磁盘空间就直接复制大体积 runtime。
