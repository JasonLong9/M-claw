# darwin-x64 Runtime 接包命令单

## 1. 目的

这份命令单用于在收到 `darwin-x64` runtime 压缩包后，按最短路径完成：

1. 收包验收
2. 候选检查
3. runtime probe
4. 候选线 / 主线分流
5. 入仓后校验

适用对象：

1. 当前仓库维护人
2. 负责接 `Intel Mac` runtime 的执行人

## 2. 收包后先不要做的事

收到压缩包后，先不要：

1. 直接创建或覆盖 `resources/openclaw-bundle/runtime/darwin-x64`
2. 直接改 `resources/openclaw-bundle/manifest.json`
3. 直接宣称 `Intel Mac` 已进入 `bundled-runtime`

先按下面的命令顺序走完。

## 3. 推荐临时目录

建议先把收到的文件放到：

```text
D:\workspace\mclaw-runtime-intake\
```

推荐布局：

```text
D:\workspace\mclaw-runtime-intake\
├─ darwin-x64-openclaw-<version>.tar.gz
├─ darwin-x64-runtime-notes.txt
└─ darwin-x64\
```

## 4. 执行顺序

### A. 人工核对交付物

先人工检查：

- [ ] 收到 `darwin-x64-openclaw-<version>.tar.gz`
- [ ] 收到 `darwin-x64-runtime-notes.txt`
- [ ] notes 中有两次 `--version`
- [ ] notes 中 `machine_arch=x64` / `x86_64`
- [ ] 先从 `notes` 判断真实版本：
  - 当前主线 `2026.3.24`
  - 或 `2026.4.x` 候选线

补充要求：

1. 若来源是 `Intel Mac` 实机，优先保留来源机说明。
2. 若来源是构建机导出的离线 runtime，也必须保留来源机的 `--version` 输出。

## 5. 关键命令

下面命令默认在仓库根目录执行：

```bash
cd D:\workspace\Mclaw
```

### 5.1 候选报告

```bash
npm run report:openclaw:runtime-candidate -- --runtime-dir D:\workspace\mclaw-runtime-intake\darwin-x64 --platform darwin --arch x64 --version <notes里确认的真实版本>
```

通过标准：

1. 命中 `openclaw` 或 `bin/openclaw`
2. 命中 `node_modules/openclaw/package.json`
3. `directoryName` 建议值应为 `darwin-x64`
4. 关注输出中的：
   - `intakeDecision=mainline-ready`
   - 或 `intakeDecision=candidate-only`
   - 或 `intakeDecision=reject`

### 5.2 runtime probe

```bash
npm run probe:openclaw:runtime -- --runtime-dir D:\workspace\mclaw-runtime-intake\darwin-x64 --platform darwin --arch x64 --version <notes里确认的真实版本>
```

通过标准：

1. 结构检查通过
2. probe 输出的 `intakeDecision` 与候选报告一致

### 5.3 manifest 预览

```bash
npm run preview:openclaw:manifest-runtime -- --runtime darwin:x64:darwin-x64:<notes里确认的真实版本> --runtime-check darwin:x64:D:\workspace\mclaw-runtime-intake\darwin-x64:<notes里确认的真实版本>
```

此时应关注：

1. `runtimeCheck.intakeDecision=mainline-ready`
2. 或 `runtimeCheck.intakeDecision=candidate-only`
3. 或 `runtimeCheck.intakeDecision=reject`

## 6. 候选通过后的分流规则

### A. 若真实版本是 `2026.3.24`

可以继续准备接入：

1. 复制到：
   - `resources/openclaw-bundle/runtime/darwin-x64`
2. 再手动补：
   - `resources/openclaw-bundle/manifest.json`
3. 最后执行 bundle / phase2-exit 校验

### B. 若真实版本是 `2026.4.x`

本轮只做候选验证，不直接写入主线：

1. 不改 `manifest.json`
2. 不宣称 `Intel Mac` 已进入主线 bundled-runtime
3. 只保留：
   - notes
   - report / probe / preview 结果
   - migration smoke 记录

建议顺手再跑一次：

```bash
npm run report:openclaw:migration-smoke -- --from 2026.3.24 --to <notes里确认的真实版本> --runtime-dir D:\workspace\mclaw-runtime-intake\darwin-x64 --runtime-version <notes里确认的真实版本>
```

## 7. 入仓后校验

如果最终确认要接入主线，再执行：

```bash
npm run check:openclaw:bundle
npm run check:openclaw:bundle:strict
npm run report:openclaw:bundle
npm run check:openclaw:phase2-exit
```

关注点：

1. `report:openclaw:bundle` 中 `darwin-x64` 应为 `mainline-ready`
2. `readyRequiredTargets` 应包含：
   - `win32-x64,darwin-arm64,darwin-x64`
3. `mainlineStatus` 仍保持 `cross-platform-mainline-ready`
4. 若后续开始做 Intel Mac 真机断网首启，再继续执行：
   - [darwin-x64-offline-first-launch-runbook.md](./darwin-x64-offline-first-launch-runbook.md)

## 8. 结果记录模板

执行完成后，按这个模板回填到 `dev_log.md`：

```text
本次接入平台：darwin-x64
真实版本：<notes 里的 version>
版本线：2026.3.24 主线 / 2026.4.x candidate
来源：Intel Mac / 构建机 / 其他
候选报告：通过 / 失败
runtime probe：通过 / 失败
manifest 预览：通过 / 失败
migration smoke：<填结果>
manifest：已更新 / 未更新
bundle strict：通过 / 失败
bundle report：<填结果>
phase2-exit：通过 / 失败
下一步：<填下一步>
```

## 9. 相关文档

- [darwin-x64-runtime-receipt-checklist.md](./darwin-x64-runtime-receipt-checklist.md)
- [darwin-x64-runtime-handoff.md](./darwin-x64-runtime-handoff.md)
- [openclaw-runtime-pending-items.md](./openclaw-runtime-pending-items.md)
- [openclaw-runtime-intake-runbook.md](./openclaw-runtime-intake-runbook.md)
- [openclaw-upgrade-migration-smoke-runbook.md](./openclaw-upgrade-migration-smoke-runbook.md)
- [openclaw-version-strategy.md](./openclaw-version-strategy.md)
