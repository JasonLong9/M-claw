# darwin-arm64 Runtime 接包命令单

## 1. 目的

这份命令单用于在收到 `darwin-arm64` runtime 压缩包后，按最短路径完成：

1. 收包验收
2. 候选检查
3. runtime probe
4. 入仓
5. `Phase 2` 退出检查

适用对象：

1. 当前仓库维护人
2. 包体到位后需要立刻执行接入的人

本文件是操作单，不替代详细规范。

## 2. 收包后先不要做的事

收到压缩包后，先不要：

1. 直接覆盖 `resources/openclaw-bundle/runtime/darwin-arm64`
2. 直接改 `manifest.json`
3. 直接宣称 `Phase 2` 已完成

先按下面的命令顺序走完。

## 3. 推荐临时目录

建议先把收到的文件放到：

```text
D:\workspace\mclaw-runtime-intake\
```

推荐布局：

```text
D:\workspace\mclaw-runtime-intake\
├─ darwin-arm64-openclaw-<version>.tar.gz
├─ darwin-arm64-runtime-notes.txt
└─ darwin-arm64\
```

## 4. 执行顺序

### A. 人工核对交付物

先人工检查：

- [ ] 收到 `darwin-arm64-openclaw-<version>.tar.gz`
- [ ] 收到 `darwin-arm64-runtime-notes.txt`
- [ ] notes 中有两次 `--version`
- [ ] notes 中 `machine_arch=arm64`
- [ ] 先从 `notes` 判断真实版本：
  - 当前主线 `2026.3.24`
  - 或 `2026.4.x` 候选线

对照文档：

- [darwin-arm64-runtime-receipt-checklist.md](./darwin-arm64-runtime-receipt-checklist.md)

### B. 解压到临时目录

如果压缩包已经解开，就跳过这步。

目标目录应为：

```text
D:\workspace\mclaw-runtime-intake\darwin-arm64
```

## 5. 关键命令

下面命令默认在仓库根目录执行：

```bash
cd D:\workspace\Mclaw
```

### 5.1 候选报告

```bash
npm run report:openclaw:runtime-candidate -- --runtime-dir D:\workspace\mclaw-runtime-intake\darwin-arm64 --platform darwin --arch arm64 --version <notes里确认的真实版本>
```

通过标准：

1. 命中 `openclaw` 或 `bin/openclaw`
2. 命中 `node_modules/openclaw/package.json`
3. `directoryName` 建议值应为 `darwin-arm64`
4. 关注输出中的：
   - `intakeDecision=mainline-ready`
   - 或 `intakeDecision=candidate-only`
   - 或 `intakeDecision=reject`

### 5.2 runtime probe

```bash
npm run probe:openclaw:runtime -- --runtime-dir D:\workspace\mclaw-runtime-intake\darwin-arm64 --platform darwin --arch arm64
```

通过标准：

1. 结构检查通过
2. 没有缺失最小入口或包根锚点

### 5.3 manifest 预览

```bash
npm run preview:openclaw:manifest-runtime -- --runtime darwin:arm64:darwin-arm64:<notes里确认的真实版本>
```

用途：

1. 先看最终 manifest 片段长什么样
2. 当前仓库已经是 `defaultDeliveryMode = bundled-runtime`，这里只用于预览 artifact 补齐结果，不在这一步直接落盘
3. 如果真实版本是 `2026.4.x`，这一步只用于候选线预览，不代表允许直接回填主线 manifest

如果希望在 preview 里顺便看到与 report/probe 一致的接包结论，可追加：

```bash
npm run preview:openclaw:manifest-runtime -- --runtime darwin:arm64:darwin-arm64:<notes里确认的真实版本> --runtime-check darwin:arm64:D:\workspace\mclaw-runtime-intake\darwin-arm64:<notes里确认的真实版本>
```

此时应关注：

- `runtimeCheck.intakeDecision=mainline-ready`
- 或 `runtimeCheck.intakeDecision=candidate-only`
- 或 `runtimeCheck.intakeDecision=reject`

## 6. 候选通过后再入仓

只有 `5.1` 和 `5.2` 都通过，才执行复制入仓。

目标目录：

```text
resources/openclaw-bundle/runtime/darwin-arm64
```

复制前再次确认：

- [ ] 当前仓库内还没有 `darwin-arm64`
- [ ] 候选报告通过
- [ ] probe 通过
- [ ] 真实版本已经确认是 `2026.3.24`

如果真实版本是 `2026.4.x`：

1. 本轮先不要复制入主线 runtime 目录
2. 只保留：
   - 报告结果
   - probe 结果
   - notes
   - 候选线记录

## 7. 入仓后执行顺序

### 7.1 更新 manifest

手动更新：

```text
resources/openclaw-bundle/manifest.json
```

补入：

```json
{
  "platform": "darwin",
  "arch": "arm64",
  "directoryName": "darwin-arm64",
  "version": "<真实版本>"
}
```

注意：

1. 只有真实版本是当前主线 `2026.3.24` 时，才执行这一步。
2. 如果真实版本是 `2026.4.x`，本轮不要把 candidate runtime 直接写进主线 manifest。

### 7.2 仓库校验

```bash
npm run check:openclaw:bundle
npm run check:openclaw:bundle:strict
npm run report:openclaw:bundle
npm run check:openclaw:phase2-exit
```

关注点：

1. `check:openclaw:bundle:strict` 必须通过
2. `report:openclaw:bundle` 里 `darwin-arm64` 应命中 `bundled-runtime`
3. `check:openclaw:phase2-exit` 若仍失败，直接看是否还有其他 artifact / 目录缺口

## 8. 结果记录模板

执行完成后，按这个模板回填到 `dev_log.md`：

```text
本次接入平台：darwin-arm64
真实版本：<notes 里的 version>
版本线：2026.3.24 主线 / 2026.4.x candidate
收包文件：已收到 / 未收到 notes
候选报告：通过 / 失败
runtime probe：通过 / 失败
manifest：已更新 / 未更新
bundle strict：通过 / 失败
bundle report：<填结果>
phase2-exit：通过 / 失败
下一步：<填下一步>
```

## 9. 当前最短执行路径

如果包体完整、notes 完整、probe 不报错，那么最短路径就是：

1. 先从 `notes` 确认真实版本
2. 候选报告
3. runtime probe
4. 如果是真实 `2026.3.24`：
   - 复制入仓
   - 回填 manifest
   - `check:openclaw:bundle`
   - `check:openclaw:bundle:strict`
   - `check:openclaw:phase2-exit`
5. 如果是 `2026.4.x`：
   - 不入主线
   - 只记录 candidate 验证结果

## 10. 相关文档

- [openclaw-runtime-intake-runbook.md](./openclaw-runtime-intake-runbook.md)
- [darwin-arm64-runtime-receipt-checklist.md](./darwin-arm64-runtime-receipt-checklist.md)
- [openclaw-runtime-pending-items.md](./openclaw-runtime-pending-items.md)
- [openclaw-version-strategy.md](./openclaw-version-strategy.md)
