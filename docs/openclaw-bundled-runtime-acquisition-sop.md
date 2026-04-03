# OpenClaw 内置本体获取与入库 SOP

## 1. 文档目的

本文件用于解决 `Phase 2` 当前唯一核心阻塞项：

1. 如何获取一份真正可运行的 OpenClaw 本体。
2. 如何把它整理成可入库的 `bundled-runtime` 载荷。
3. 如何在入库前证明它不是“只解包了 npm tgz 的假 runtime”。

本 SOP 适用于：

1. `windows-x64`
2. `darwin-arm64`
3. `darwin-x64`

## 2. 当前结论

截至 `2026-04-02`，以下事实已经被验证：

1. `resources/openclaw-bundle/openclaw-2026.3.24.tgz` 只能作为 `bundled-fallback` 载荷。
2. 直接从该 `tgz` 手动解包得到的目录，不等于可运行 runtime。
3. 原因已经被实测确认：
   - 目录内虽然可看到 `node_modules/openclaw/package.json`
   - 但直接执行 `openclaw.cmd --version` 时缺少运行时依赖闭包
   - 已出现 `ERR_MODULE_NOT_FOUND`，缺失包示例为 `tslog`
4. 因此后续一律禁止把“解包 tgz 后的目录”直接宣称为 `bundled-runtime`。

## 3. 允许的运行时来源

当前只接受以下来源：

1. 在目标平台机器上，已经成功完成安装的 OpenClaw 运行前缀目录。
2. 来自项目方或上游提供的、已经验证可运行的离线 runtime 目录。
3. 由可信构建机生成、并已完成 `--version` 验证的完整安装目录。

当前不接受以下来源：

1. 单纯 `tar`/解压 `openclaw-*.tgz` 后得到的目录。
2. 只有 shim、没有完整 `node_modules` 依赖闭包的目录。
3. 未经过本地 `--version` 直探测的目录。

## 4. 获取原则

获取真实 runtime 时，必须同时满足：

1. 来源机器与目标平台一致。
2. 来源目录已经能直接执行 OpenClaw。
3. 采集前先在来源机器完成一次 `--version` 验证。
4. 采集后在候选目录内再次完成一次 `--version` 验证。
5. 入库前再在 Mclaw 仓库目标目录内完成一次 `--version` 验证。
6. 复制大体积 runtime 前，确认当前 C 盘剩余空间仍能保持至少 `5 GB` 安全余量。

简化为一句话：

`三次验证通过，才允许入库。`

## 5. 推荐来源方案

### A. Windows x64

推荐从一台可正常联网安装 OpenClaw 的 Windows x64 机器获取。

推荐流程：

1. 在来源机上完成 OpenClaw 安装。
2. 确认 OpenClaw 可直接执行：
   - `openclaw.cmd --version`
3. 找到实际运行前缀目录。
4. 复制完整前缀到临时采集目录。
5. 在临时采集目录再次执行：
   - `openclaw.cmd --version`
6. 通过后，将该目录整理为：
   - `resources/openclaw-bundle/runtime/windows-x64`

### B. macOS arm64 / x64

推荐分别在 Apple Silicon 与 Intel Mac 来源机上独立获取。

推荐流程：

1. 在来源机上完成 OpenClaw 安装。
2. 确认 OpenClaw 可直接执行：
   - `./openclaw --version`
   - 或 `./bin/openclaw --version`
3. 找到实际运行前缀目录。
4. 复制完整前缀到临时采集目录。
5. 在临时采集目录再次执行相同的 `--version` 验证。
6. 通过后分别整理为：
   - `resources/openclaw-bundle/runtime/darwin-arm64`
   - `resources/openclaw-bundle/runtime/darwin-x64`

## 6. 最小目录要求

### Windows

`runtime/windows-x64/` 至少应满足：

1. `openclaw.cmd`
2. 可选 `openclaw.ps1`
3. `node_modules/openclaw/package.json`
4. OpenClaw 所需的完整运行时依赖闭包

### macOS

`runtime/darwin-arm64/`、`runtime/darwin-x64/` 至少应满足：

1. `openclaw` 或 `bin/openclaw`
2. `node_modules/openclaw/package.json`
3. OpenClaw 所需的完整运行时依赖闭包

说明：

1. “完整运行时依赖闭包”不是指目录看起来像 npm 包。
2. 而是指本地实际执行 `--version` 时不会再触发缺包错误。

## 7. 入库前必做验证

### A. 来源机验证

在来源机原始安装目录执行：

1. Windows：
   - `openclaw.cmd --version`
2. macOS：
   - `./openclaw --version`
   - 或 `./bin/openclaw --version`

要求：

1. 命令成功退出。
2. 输出可识别版本号。
3. 不出现缺失模块、缺失动态库或权限拒绝。

### B. 候选目录复验

复制到临时采集目录后，必须在该目录再次执行相同验证。

目标是排除：

1. 复制时漏文件。
2. 只复制了 shim，没复制依赖闭包。
3. 目录相对路径变化后无法运行。

### C. 仓库内最终复验

复制到 Mclaw 仓库目标目录后，再执行：

1. 先做候选载荷报告：
   - `npm run report:openclaw:runtime-candidate -- --runtime-dir <path> --platform <platform> --arch <arch> --version <version>`
   - 该步骤用于确认建议的 `directoryName`、binary 命中路径、`package.json` 锚点与总体积
2. 再执行直探测：
1. Windows：
   - `resources\\openclaw-bundle\\runtime\\windows-x64\\openclaw.cmd --version`
   - 或 `npm run probe:openclaw:runtime -- --runtime-dir resources/openclaw-bundle/runtime/windows-x64 --platform win32 --arch x64`
2. macOS：
   - `resources/openclaw-bundle/runtime/darwin-arm64/openclaw --version`
   - 或 `resources/openclaw-bundle/runtime/darwin-arm64/bin/openclaw --version`
   - 或 `npm run probe:openclaw:runtime -- --runtime-dir resources/openclaw-bundle/runtime/darwin-arm64 --platform darwin --arch arm64`

只有候选载荷报告与这一步都通过，`manifest.json` 才允许填写 `artifacts.runtime[]`。

## 8. manifest 回填规则

当且仅当某个平台 runtime 通过入库前最终复验时，才允许在 `resources/openclaw-bundle/manifest.json` 中新增对应条目。

示例：

```json
{
  "platform": "win32",
  "arch": "x64",
  "directoryName": "windows-x64",
  "version": "2026.3.24"
}
```

切换规则：

1. 若只拿到单平台真实 runtime，不切换 `defaultDeliveryMode`。
2. 若双平台真实 runtime 都已入库并完成实机验证，才把：
   - `defaultDeliveryMode` 从 `bundled-fallback`
   - 切换为 `bundled-runtime`

## 9. 入库后的仓库验证顺序

每次新增或替换 runtime 本体，都必须按以下顺序执行：

1. 候选载荷报告：
   - `npm run report:openclaw:runtime-candidate -- --runtime-dir <path> --platform <platform> --arch <arch> --version <version>`
2. 直探测验证：
   - 目标 binary `--version`
   - 或 `npm run probe:openclaw:runtime -- --runtime-dir <path> --platform <platform> --arch <arch>`
3. 仓库结构检查：
   - `npm run check:openclaw:bundle`
4. 严格运行时检查：
   - `npm run check:openclaw:bundle:strict`
5. 分发决策报告：
   - `npm run report:openclaw:bundle`
6. 构建验证：
   - `npm run build:app`
7. 平台打包验证：
   - Windows：`npm run package:win` 或 `npm run package:win:dir`
   - macOS：对应打包命令
8. 断网首启实机验证：
   - Windows
   - macOS

## 10. 禁止事项

以下行为一律视为不合格交付：

1. 未做 `--version` 验证就把目录提交到仓库。
2. 仅因目录存在 `package.json` 就宣称 runtime 可运行。
3. 仅跑过 `npm run build:app` 就宣称 `bundled-runtime` 已完成。
4. 只验证 Windows，不验证 macOS，就把默认分发切到 `bundled-runtime`。
5. 把来源不明、版本不明的运行目录直接纳入安装包。

## 11. 建议的人工交接清单

当需要你手动下载或从另一台机器拷贝 OpenClaw 本体时，统一按此清单交接：

1. 记录来源机器平台与架构。
2. 记录 OpenClaw 版本。
3. 记录来源机 `--version` 成功截图或文本。
4. 记录候选目录复验结果。
5. 记录最终放入仓库后的 `--version` 结果。
6. 记录是否已更新 `manifest.json`。
7. 记录是否已执行 `check/report/build/package`。

## 12. 当前下一步

当前项目的下一步不是继续改 fallback 逻辑，而是：

1. 获取 Windows x64 真实 runtime。
2. 获取 macOS arm64 真实 runtime。
3. 如目标包含 Intel Mac，再获取 macOS x64 真实 runtime。
4. 逐个平台完成本 SOP 的三次验证。
5. 通过后再进入下一轮端到端打包与断网验证。
