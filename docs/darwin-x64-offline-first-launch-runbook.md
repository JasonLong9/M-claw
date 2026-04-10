# darwin-x64 断网首启验证 Runbook

## 1. 目的

这份 runbook 用于在后续拿到真实 `Intel Mac` 机器时，直接验证：

1. `darwin-x64` 是否真的命中 `bundled-runtime`
2. 断网环境下首次启动是否仍可完成 OpenClaw 准备
3. 日志、状态页与版本探测口径是否与当前主线一致

它不替代收包验收文档，而是接在：

1. `darwin-x64` 已完成 receipt / report / probe / preview / manifest 回填之后
2. 准备做一次真实 `Intel Mac` 实机首启验证之前

## 2. 适用前提

执行前必须满足：

1. 当前仓库已包含：
   - `resources/openclaw-bundle/runtime/darwin-x64`
2. `resources/openclaw-bundle/manifest.json` 已声明：
   - `platform=darwin`
   - `arch=x64`
   - `directoryName=darwin-x64`
   - `version=2026.3.24`
3. 当前仓库已通过：
   - `npm run check:openclaw:bundle`
   - `npm run check:openclaw:bundle:strict`
   - `npm run report:openclaw:bundle`
   - `npm run check:openclaw:phase2-exit`
4. 当前 delivery report 已显示：
   - `darwin-x64 -> preferredSource=bundled-runtime`
   - `darwin-x64 -> targetMainlineState=mainline-ready`
5. 当前包体版本仍与 pinned baseline 一致：
   - `2026.3.24`

## 3. 验证机器要求

验证机器必须满足：

1. 是真实 `Intel Mac`
2. `uname -m = x86_64`
3. 尽量使用全新环境，或至少是：
   - 没有现成可复用的 Mclaw runtime 前缀
   - 没有会误导首启来源判断的旧 OpenClaw 安装残留

建议额外记录：

1. macOS 版本
2. 机器型号
3. 当前是否全新用户环境
4. 是否已清理旧的 Mclaw / Qclaw 相关目录

## 4. 断网前准备

在断网前先做这些确认：

1. 安装包产物确实来自当前仓库
2. 安装包中携带的 `darwin-x64` runtime 与仓库内容一致
3. 当前机器时间正常
4. 已准备好记录：
   - 首启页面截图
   - 日志导出
   - 关键状态文案

建议先在联网状态下只做机器信息记录，不执行正式首启主流程。

## 5. 断网执行步骤

### A. 切断网络

执行要求：

1. 关闭 Wi-Fi / 有线网络
2. 确认机器无法访问外网
3. 避免通过代理、手机热点等方式意外恢复联网

### B. 执行首次启动

1. 安装并启动 Mclaw
2. 进入 `EnvCheck` / 首启主流程
3. 观察 OpenClaw 准备阶段是否直接命中内置 runtime

期望结果：

1. 不出现“必须联网安装 OpenClaw”类主提示
2. 不出现把 `npm install` 作为默认主路径的行为
3. 不出现把 `darwin-x64` 误判为缺失 runtime 的提示

### C. 记录首启结果

至少记录：

1. 首启页面是否进入成功
2. OpenClaw 准备是否成功
3. 当前实际命中来源是否为：
   - `bundled-runtime`
4. 是否出现 fallback
   - `bundled-fallback`
   - `online-fallback`
5. 若失败，失败主提示文案是什么

## 6. 验证点清单

### A. 来源判断

- [ ] `darwin-x64` 实际命中 `bundled-runtime`
- [ ] 日志中不存在“因缺少 runtime 而回退到 tgz”的主记录
- [ ] 日志中不存在“因联网安装失败而阻塞”的主记录

### B. 首启体验

- [ ] 断网下可进入主流程
- [ ] 不要求用户手动打开终端
- [ ] 不要求用户手动执行 `npm install`
- [ ] 不出现明显错误平台文案（例如把 Intel Mac 当成 arm64）

### C. 接管结果

- [ ] 目标前缀创建成功
- [ ] `bin/openclaw` 已正确落位
- [ ] `node_modules/openclaw/package.json` 已正确落位
- [ ] 若机器上允许直接验证，`target binary --version` 与 `2026.3.24` 一致

### D. 状态与日志

- [ ] 状态页 / EnvCheck 未把 `darwin-x64` 标成 fallback-only
- [ ] 诊断日志里能看到 `bundled-runtime` 语义
- [ ] 未出现与当前主线策略冲突的过期提示

## 7. 失败时如何分类

若失败，优先按以下方向分类：

1. `runtime 未命中`
   - 例如路径解析错误、manifest 与目录不一致
2. `runtime 命中但接管失败`
   - 例如权限问题、前缀复制失败
3. `runtime 已接管但首启主流程异常`
   - 例如 EnvCheck / gateway / 状态机文案问题
4. `版本或诊断口径不一致`
   - 例如日志仍把 `darwin-x64` 当成 optional / fallback

失败时建议同时回填：

1. 截图
2. 关键日志片段
3. 是否能人工确认 runtime 目录实际存在
4. 是否能手动执行目标 `openclaw --version`

## 8. 建议回填模板

建议在 `docs/dev_log.md` 或单独验收记录中回填：

```text
验证平台：darwin-x64 / Intel Mac
机器架构：x86_64
macOS 版本：<填写>
网络状态：断网
安装包版本：<填写>
manifest 版本：2026.3.24
实际命中来源：bundled-runtime / bundled-fallback / online-fallback
OpenClaw 准备：成功 / 失败
首启主流程：成功 / 失败
target binary --version：<填写>
关键日志：<填写>
结论：通过 / 不通过
下一步：<填写>
```

## 9. 相关文档

1. [darwin-x64-runtime-receipt-checklist.md](./darwin-x64-runtime-receipt-checklist.md)
2. [darwin-x64-runtime-intake-command-sheet.md](./darwin-x64-runtime-intake-command-sheet.md)
3. [openclaw-bundled-runtime-validation-checklist.md](./openclaw-bundled-runtime-validation-checklist.md)
4. [openclaw-runtime-intake-runbook.md](./openclaw-runtime-intake-runbook.md)
5. [openclaw-version-strategy.md](./openclaw-version-strategy.md)
