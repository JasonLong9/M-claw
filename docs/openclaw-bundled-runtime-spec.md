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
5. Windows 与 macOS 必须对等设计，不能只做单平台真内置、另一平台继续在线安装。

## 3. 当前仓库实际状态

截至 `2026-04-02`，仓库现状如下：

1. 已存在：
   - `resources/openclaw-bundle/manifest.json`
   - `resources/openclaw-bundle/openclaw-2026.3.24.tgz`
2. 尚不存在：
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

1. 先按 [docs/openclaw-bundled-runtime-acquisition-sop.md](C:\Users\James\Desktop\Mclaw\docs\openclaw-bundled-runtime-acquisition-sop.md) 获取并验证真实 runtime 本体。
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

## 10. 当前下一步

当前最应该继续推进的不是再改安装分发逻辑，而是：

1. 获取真正可运行的 Windows runtime 本体。
2. 获取真正可运行的 macOS runtime 本体。
3. 回填 `manifest.json` 的 `artifacts.runtime[]`。
4. 做双平台离线首启验证。
5. 验证通过后，再把 `defaultDeliveryMode` 正式切换到 `bundled-runtime`。
