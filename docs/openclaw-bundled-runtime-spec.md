# OpenClaw 内置本体载荷规范

## 1. 文档目的

本文件用于把“内置 OpenClaw 本体”从口头目标收敛为可执行规范。

适用范围：

1. `Phase 2` 双平台 OpenClaw 真内置本体底座。
2. Windows 与 macOS 安装包中的 runtime 载荷准备、校验、接入与验收。

本文件不讨论：

1. Docker 交付方案。
2. 在线安装作为默认主路径。
3. 仅内置 `tgz` 的旧式首启安装方案。

## 2. 当前生效原则

1. v1 默认交付形态是：`桌面壳 + 平台专属内置 OpenClaw 本地服务本体`。
2. `bundled-runtime` 是主路径。
3. `bundled-fallback` 仅指内置 `tgz` 的受控降级路径。
4. `online-fallback` 仅作为最后兜底，不再作为默认实现。
5. Windows 与 macOS 必须对等设计，不能长期只做单平台真内置、另一平台继续在线安装。
6. Windows `bundled-runtime` 的完整形态必须包含：`openclaw.cmd/openclaw.ps1`、`node_modules/openclaw`，以及与其同目录共置的 `node.exe`。
7. 在 Windows 真内置闭环完成前，系统 Node 只能作为临时兼容兜底，不得继续被视为正式主路径。
8. 当前主线阶段已经完成：
   - `win32-x64`
   - `darwin-arm64`
   - `darwin-x64`
   三平台 bundled-runtime 收口。
9. 当前文档示例与 manifest 基线继续锁定 `2026.3.24`；外部 `2026.4.x` 候选线在未完成兼容审计前，不得直接写回 spec 示例或主 manifest。
10. Windows bundled Node 当前统一锁定为 `Node 24.14.1 x64`，用于提前对齐 OpenClaw 的推荐运行时主线，而不是继续围绕 `Node 22` 做长期封装。

## 3. 当前仓库实际状态

截至 `2026-04-09`，仓库现状如下：

1. 已存在：
   - `resources/openclaw-bundle/manifest.json`
   - `resources/openclaw-bundle/openclaw-2026.3.24.tgz`
   - `resources/openclaw-bundle/runtime/windows-x64/...`
   - `resources/openclaw-bundle/runtime/darwin-arm64/...`
2. 当前三条正式主线路径均已存在：
   - `resources/openclaw-bundle/runtime/windows-x64/...`
   - `resources/openclaw-bundle/runtime/darwin-arm64/...`
   - `resources/openclaw-bundle/runtime/darwin-x64/...`
3. 代码层已具备：
   - delivery status 解析
   - runtime binary 发现
   - install plan 优先级分发
   - Windows runtime 接管复制与版本探测
   - macOS runtime 接管复制骨架与版本探测
4. 近期一次失败验证已确认：仅从 pinned `tgz` 手动解包出的 npm 包体并不等于“可运行 bundled runtime”，因为缺少完整依赖闭包。
5. 因此当前瓶颈不是“缺设计”，而是“缺真正可运行的 runtime 本体 + 缺端到端验证”。
6. 对 Windows 而言，这个“真正可运行”的定义已进一步明确为：**不能只带 OpenClaw 包体，还必须能在没有系统 Node 的前提下独立启动**。

补充说明：

1. 当前 `npm run report:openclaw:bundle` 与 `npm run check:openclaw:phase2-exit` 已能直接输出：
   - `mainlineStatus=cross-platform-mainline-ready`
   - `readyRequiredTargets=win32-x64,darwin-arm64,darwin-x64`
2. 这表示当前主线 bundled runtime 已满足：
   - `win32-x64`
   - `darwin-arm64`
   - `darwin-x64`
   的三平台主路径要求。

## 4. 目录规范

根目录固定为：

`resources/openclaw-bundle/`

其中目录结构约定如下：

```text
resources/openclaw-bundle/
├─ manifest.json
├─ README.md
├─ openclaw-2026.3.24.tgz                # 可选，bundled-fallback
└─ runtime/
   ├─ windows-x64/
   ├─ darwin-arm64/
   └─ darwin-x64/
```

约束如下：

1. `runtime/` 目录可按平台/架构分发多个本体。
2. 每个 `directoryName` 必须与 `manifest.json` 中 `artifacts.runtime[]` 的声明一致。
3. 不允许把平台 runtime 直接散落在 `openclaw-bundle/` 根目录。

## 5. manifest 规范

`resources/openclaw-bundle/manifest.json` 必须满足：

1. `defaultDeliveryMode` 描述当前仓库实际默认交付模式。
2. `targetDeliveryMode` 描述最终目标模式。
3. 当仓库尚未放入真实 runtime 时：
   - `defaultDeliveryMode` 可为 `bundled-fallback`
   - `targetDeliveryMode` 必须保持 `bundled-runtime`
4. 当仓库已放入并验证真实 runtime 后：
   - `defaultDeliveryMode` 应切换为 `bundled-runtime`
5. 若当前只有 Windows runtime 已完成，仓库可继续保留 `targetDeliveryMode = bundled-runtime`，但 macOS 不应被误判为“已正式内置本体完成”。
5. `artifacts.runtime[]` 中每一项必须至少声明：
   - `platform`
   - `arch`
   - `directoryName`
   - `version`

建议示例：

```json
{
  "schemaVersion": 1,
  "product": "Mclaw",
  "openclawVersion": "2026.3.24",
  "defaultDeliveryMode": "bundled-runtime",
  "targetDeliveryMode": "bundled-runtime",
  "artifacts": {
    "tgz": {
      "fileName": "openclaw-2026.3.24.tgz",
      "version": "2026.3.24"
    },
    "runtime": [
      {
        "platform": "win32",
        "arch": "x64",
        "directoryName": "windows-x64",
        "version": "2026.3.24"
      },
      {
        "platform": "darwin",
        "arch": "arm64",
        "directoryName": "darwin-arm64",
        "version": "2026.3.24"
      },
      {
        "platform": "darwin",
        "arch": "x64",
        "directoryName": "darwin-x64",
        "version": "2026.3.24"
      }
    ]
  }
}
```

## 6. Windows 载荷要求

`resources/openclaw-bundle/runtime/windows-x64/` 至少必须包含：

1. `openclaw.cmd`
2. 可选 `openclaw.ps1`
3. `node_modules/openclaw/package.json`

建议结构：

```text
runtime/windows-x64/
├─ openclaw.cmd
├─ openclaw.ps1
└─ node_modules/
   └─ openclaw/
      ├─ package.json
      ├─ dist/
      └─ ...
```

说明：

1. 当前代码会优先探测根目录下的 `openclaw.cmd`。
2. `node_modules/openclaw/package.json` 是判断包体是否完整的最小锚点。
3. 如果只放 shim，不放 `node_modules/openclaw`，当前实现会判定为无效 runtime。

## 7. macOS 载荷要求

`resources/openclaw-bundle/runtime/darwin-arm64/` 与 `runtime/darwin-x64/` 至少必须包含：

1. `openclaw` 或 `bin/openclaw`
2. `node_modules/openclaw/package.json`

建议结构：

```text
runtime/darwin-arm64/
├─ bin/
│  └─ openclaw
└─ node_modules/
   └─ openclaw/
      ├─ package.json
      ├─ dist/
      └─ ...
```

或：

```text
runtime/darwin-x64/
├─ openclaw
└─ node_modules/
   └─ openclaw/
      ├─ package.json
      ├─ dist/
      └─ ...
```

说明：

1. 当前代码支持根目录 `openclaw` 和 `bin/openclaw` 两种布局。
2. 同样要求存在 `node_modules/openclaw/package.json` 作为最小包体验证锚点。

## 8. 接入步骤

当准备真实 runtime 载荷时，统一按以下顺序操作：

1. 先按 [openclaw-bundled-runtime-acquisition-sop.md](./openclaw-bundled-runtime-acquisition-sop.md) 获取并验证真实 runtime 本体。
2. 将对应平台本体放入 `resources/openclaw-bundle/runtime/<directoryName>/`。
2. 更新 `resources/openclaw-bundle/manifest.json`：
   - 补齐 `artifacts.runtime[]`
   - 在真实主路径切换后，将 `defaultDeliveryMode` 改为 `bundled-runtime`
3. 先执行直探测验证：
   - Windows：`openclaw.cmd --version`
   - macOS：`openclaw --version` 或 `bin/openclaw --version`
   - 或统一执行：`npm run probe:openclaw:runtime -- --runtime-dir <path> --platform <platform> --arch <arch>`
4. 运行构建验证：
   - `npm run build:app`
5. 分平台实机验证：
   - Windows 首启断网验证
   - macOS 首启断网验证
6. 验证成功后，再更新路线图与阶段状态。
7. 在载荷落仓后，先执行仓库校验命令：
   - 过渡检查：`npm run check:openclaw:bundle`
   - 严格检查：`npm run check:openclaw:bundle:strict`
8. 如需快速判断当前仓库对 Windows/macOS 的实际分发选择，执行：
   - `npm run report:openclaw:bundle`
9. 当前不应把“从 pinned tgz 直接解包 npm 包体”视为有效 runtime 生成方案，除非后续补齐依赖闭包并完成 `--version` 探测验证。

补充执行入口：

1. 若接入的是 `darwin-x64 / Intel Mac`，统一优先打开：
   - [darwin-x64-runtime-request-message-template.md](./darwin-x64-runtime-request-message-template.md)
   - [darwin-x64-runtime-handoff.md](./darwin-x64-runtime-handoff.md)
   - [darwin-x64-runtime-receipt-checklist.md](./darwin-x64-runtime-receipt-checklist.md)
   - [darwin-x64-runtime-intake-command-sheet.md](./darwin-x64-runtime-intake-command-sheet.md)
2. 若真实版本属于 `2026.4.x`，则先按候选线处理，并同步参考：
   - [openclaw-version-strategy.md](./openclaw-version-strategy.md)
   - [openclaw-upgrade-migration-smoke-runbook.md](./openclaw-upgrade-migration-smoke-runbook.md)

## 8.1 关键准入规则

真实 runtime 载荷入仓前，必须同时满足：

1. 来源明确。
2. 版本明确。
3. 依赖闭包明确。
4. 目标平台明确。
5. `--version` 直探测通过。

任何未满足以上条件的目录，都只能视为“候选载荷”，不能写入 `manifest.json` 的 `artifacts.runtime[]`。

## 9. 验收标准

只有同时满足以下条件，才能认为 `Phase 2` 的“真内置本体”关闭：

1. Windows 安装包内含真实 runtime 本体。
2. macOS 安装包内含真实 runtime 本体。
3. 首次启动断网时，默认走 `bundled-runtime`，而不是在线安装。
4. 失败提示指向本地载荷损坏、权限问题或可执行入口缺失，而不是只提示 npm 网络问题。
5. 安装完成后可成功执行本地 runtime 的 `--version` 探测。
6. Windows 与 macOS 都完成至少一次带真实载荷的端到端实机验证。

当前主线口径补充：

1. 当前主线退出前置已经由 `win32-x64 + darwin-arm64 + darwin-x64` 共同满足。
2. 后续若替换任一平台 runtime，仍应按同等级 intake / 验证链维护。
3. 如果后续拿到的 `darwin-x64` 新包版本属于 `2026.4.x`，则该轮只记 candidate 验证，不直接宣称主线发生切换。

## 10. 当前下一步

当前最应该继续推进的不是再改安装分发逻辑，而是：

1. 继续维持 Windows runtime-first 主线可用。
2. 继续维持 `darwin-arm64` bundled-runtime 主线路径稳定。
3. 后续重点转为三平台 bundle / phase2-exit / 实机验证的一致性维持。
4. 若拿到新的 `darwin-x64` 包，根据真实版本决定是替换主线 manifest，还是仅走 candidate 验证链。
5. 继续补 Intel Mac 断网首启与后续迁移 smoke 记录。
6. Intel Mac 真机验证入口统一参考：
   - [darwin-x64-offline-first-launch-runbook.md](./darwin-x64-offline-first-launch-runbook.md)
