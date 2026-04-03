# Mclaw Windows 阻塞项清单

## 1. 文档目的

本文件是 `Phase 1` 的直接产物。  
目标是把“Windows 还没收口”拆成可以执行、可以验收、可以排优先级的阻塞项列表。

判定标准：

1. 会阻止 Windows 开发构建。
2. 会阻止 Windows 安装或首次启动。
3. 会导致 Windows 与 macOS 行为严重不一致。
4. 会导致 v1 交付文档与实际行为不一致。

## 2. 总体结论

当前 Windows 阻塞项可以分为三类：

1. `P0` 必须先解决，否则无法稳定进入 Windows 最小闭环。
2. `P1` 不解决会导致体验或交付不完整，但不一定阻塞本地开发。
3. `P2` 不阻塞闭环，但会影响 v1 质量与后续维护。

## 3. P0 阻塞项

### P0-01 缺少 Windows 对等发布脚本

现状：

1. `electron-builder.json` 已配置 `win.nsis`。
2. `package.json` 已补齐 `package:win`、`package:win:dir`、`release:win` 与 `check:win:release-env`。
3. Windows 已具备标准化开发打包入口。

风险：

1. Windows 无法形成统一构建入口。
2. CI/CD 与本地验证都没有标准命令。
3. Windows 发布流程只能靠手工拼参数，容易出错。

处理建议：

1. 新增 Windows 对等脚本。
2. 区分开发构建与正式发布构建。
3. 明确是否支持在 Windows 主机和非 Windows 主机上构建。

当前状态：

1. 该项已从“脚本缺失”收敛为“脚本已补齐，等待持续验证”。
2. 当前不再阻塞开发命令入口。

### P0-02 `forceCodeSigning: true` 阻塞 Windows 开发构建

现状：

1. `electron-builder.json` 顶层设置 `forceCodeSigning: true`。
2. 现有文档已确认 Windows 证书方案尚未决策。
3. `package:win` / `package:win:dir` 已通过 `-c.forceCodeSigning=false` 提供开发阶段临时覆盖。

风险：

1. 在没有 Windows 代码签名证书前，Windows 打包可能直接失败。
2. 会卡住 Phase 2 的最小闭环验证。

处理建议：

1. 先做证书策略决策。
2. 明确开发阶段是否允许临时关闭强制签名。
3. 若保持 `true`，需立即补证书准备与使用流程文档。

当前状态：

1. 开发构建阻塞已临时绕开。
2. 正式发布阻塞仍存在，仍维持 `P0`。

### P0-03 发布配置仍为 Qclaw 且更新源为占位值

现状：

1. `package.json` 已切换为 `name: mclaw`、`productName: Mclaw`。
2. `electron-builder.json` 的 `appId`、`artifactName` 已切换为 Mclaw。
3. `publish.url` 仍为 `https://example.invalid/...` 占位值。
4. `EnvCheck` 中已开始出现 `Mclaw` 文案，但全仓品牌迁移尚未完成。

风险：

1. 更新配置仍未闭合，无法进行真实发布验证。
2. 仓库内仍可能存在未迁移的 Qclaw 文案与逻辑。
3. 后续品牌切换仍可能影响已有打包/升级逻辑。

处理建议：

1. 继续在 Phase 3 统一清扫剩余品牌残留。
2. 在 Phase 8 配置真实发布源。
3. 发布前复核升级链路与历史数据迁移中的旧品牌标识。

### P0-04 `EnvCheck` 存在大量 mac-only 逻辑和文案

现状：

1. `src/pages/EnvCheck.tsx` 明确引用 `classifyMacGitToolsIssue`、`classifyMacNodeInstallerFailure`。
2. 文件内存在 `xcode-clt-pending`、`macOS 安装前校验`、`prepareMacGitTools()` 等流程。
3. 文件体量极大，平台分支与文案耦合严重。
4. 已完成第一批收口：Xcode inline 提示仅在 `darwin` 下展示，`StartupIssueDialog` 已带平台参数，首屏部分 `Qclaw` 文案已切到 `Mclaw`。

风险：

1. Windows 首次启动流程容易展示错误的 macOS 文案。
2. Windows 错误分类与修复路径不完整。
3. 该文件过大，后续任何平台改动都高风险。

处理建议：

1. 先做 Windows 路径和文案专项审计。
2. 把平台错误分类抽离。
3. 在 Phase 4 重构首次启动状态机时优先拆分该文件。

当前状态：

1. 该项仍是 `P0`。
2. 当前已消除一批明显的 Windows 误入 macOS 交互问题，但尚未完成彻底收口。

### P0-05 品牌切换尚未落地到主进程与 UI

现状：

1. `electron/main/index.ts` 的窗口标题、托盘提示、通知标题已切换为 `Mclaw`。
2. Windows 开发目录产物已从 `Qclaw.exe` 切换为 `Mclaw.exe`。
3. `src/pages/EnvCheck.tsx` 已完成首批 `Mclaw` 收口，但 `src/components/*`、`src/pages/*` 等范围仍可能存在 `Qclaw` 残留。

风险：

1. 部分界面和非主流程文案仍可能出现 `Qclaw`。
2. 未完成全量扫描前，仍不能视为品牌迁移彻底关闭。

处理建议：

1. 继续在 Phase 3 统一做品牌替换清单。
2. 补做全仓 UI/文档扫描，确认剩余残留点。

### P0-06 OpenClaw 尚未实现“内置本体直用”，仍停留在安装流程思路

现状：

1. 当前 `EnvCheck` 仍通过 `installEnv({ needOpenClaw: true })` 触发 OpenClaw 安装。
2. 主进程安装路径当前依赖 `npm install -g openclaw@<pinned-version>` 与镜像回退。
3. 当前保留的 `v11` 方案虽然内置了 `openclaw-2026.3.24.tgz`，但本质仍是“首启再安装 OpenClaw”。
4. 因此当前问题不只是“在线安装优先”，而是“默认仍是安装流程，而不是直接内置 OpenClaw 本体”。

风险：

1. 在断网、受限网络或证书代理环境下，首次启动仍可能失败。
2. 与产品定位“下载安装即用”“尽量跳过依赖安装”存在直接冲突。
3. Windows/macOS 首次启动体验一致性会持续受网络环境影响。
4. 即便 `tgz` 路径可用，它也仍不满足“内置 OpenClaw 本体”的最终定义。

处理建议：

1. 将 OpenClaw 改为安装包内置可运行本体（平台化产物），首启默认只做校验、注册、修复。
2. `tgz` 与在线安装仅保留为 fallback，不再作为默认路径。
3. 在 smoke checklist 中新增“断网首启仍可直接启用内置本体”作为发布前必测项。

当前状态：

1. 该项为新增 `P0` 阻塞，未关闭前不应宣布 Windows 最小闭环完成。

## 4. P1 阻塞项

### P1-01 Windows 预检脚本缺失

现状：

1. 已新增 `scripts/check-win-release-env.mjs`。
2. `package.json` 已接入 `check:win:release-env`。
3. 预检已覆盖 `win.target`、发布钩子、占位更新源、签名配置等关键项。

影响：

1. Windows 发布前无法统一检查签名、更新源、产物配置。
2. 容易把不完整配置打进发布流程。

处理建议：

1. 补 `check-win-release-env`。
2. 至少覆盖签名策略、更新源、artifact 配置、平台目标。

当前状态：

1. 该项已完成，不再作为新增阻塞。

### P1-05 Windows 打包依赖下载链路未闭合

现状：

1. 已在真实环境执行 `npm run package:win:dir`。
2. `check:win:release-env` 与 `build:app` 均已通过。
3. 通过本地 `electron-dist` 成功绕过了 `electron-v33.4.11-win32-x64.zip` 的联网下载。
4. 随后又发现 `electron-builder` 默认会额外下载 `winCodeSign-2.6.0.7z`。
5. 开发打包脚本已进一步加入 `-c.win.signAndEditExecutable=false`，从而绕过该下载并成功产出 `win-unpacked`。
6. 之后又通过本地 NSIS 目录绕过了 `nsis-3.0.4.1.7z` 下载。
7. 在当前代理异常环境下，`app-builder.exe` 对 `localhost/127.0.0.1` 也会错误走代理，因此单纯本地 HTTP mirror 不能关闭 `nsis-resources` 下载阻塞。
8. 已改为“本地解压 `nsis-resources` 目录 + 打包前补丁 `app-builder-lib`”方案，并成功产出正式 NSIS 安装包：
   - `release/2026.4.2-v2/Mclaw_2026.4.2-v2.exe`

影响：

1. 当前“开发目录打包”和“开发阶段正式安装包打包”都已成功，不再阻塞 Windows 构建闭环。
2. 但该链路目前仍依赖本地离线资源与启动前补丁，不应直接等同于最终正式发布方案。
3. 正式发布链路仍然依赖真实更新源和标准签名方案。

处理建议：

1. 明确 Windows 打包机代理配置要求。
2. 将 Electron、NSIS、NSIS resources 的离线预置方式写入 Windows 发布环境文档。
3. 将“本地 `nsis-resources` 目录 + 启动前补丁”定义为开发阶段兜底策略，而不是最终正式发布规范。
4. 保留 `win.signAndEditExecutable=false` 仅用于开发打包；正式发布前仍需恢复标准 Windows 签名/元数据流程。

### P1-02 自动更新代码仍保留双平台支持，但 v1 文档已调整为 v1.5

现状：

1. `electron/main/qclaw-update-service.ts` 仍有 Windows/macOS 自动更新逻辑。
2. 文档已明确 v1 暂不做自动更新，只保留手动下载更新路径。

影响：

1. 文档与代码策略存在偏差。
2. Windows 发布验收时容易误把自动更新当成 v1 必测项。

处理建议：

1. 明确 v1 仅验证手动下载链接和更新文案。
2. 自动更新保留代码，但不列为 v1 阻塞交付条件。

### P1-03 其它 IM 渠道代码仍大量存在，容易分散主线注意力

现状：

1. 预加载层和 `ChannelConnect` 中仍包含 `weixin`、`dingtalk`、`wecom` 等代码与流程。
2. 文档当前已明确 v1 只维护飞书主线。

影响：

1. Windows 收口期间容易被非主线渠道分散资源。
2. 验收范围不清晰。

处理建议：

1. 文档上继续维持“保留代码但不作为当前主线维护对象”。
2. 实际开发中优先保证飞书路径不被其它渠道需求打断。

### P1-04 README 和用户文档仍以 Qclaw 为主

现状：

1. `README.md` 与 `README.en.md` 的主要显示文案已切换为 Mclaw。
2. 当前残留的 `Qclaw` 主要集中在 GitHub 仓库链接、Release 链接和历史仓库引用。
3. Windows 相关外部文档仍需继续与当前真实构建行为对齐。

影响：

1. 对外叙述已明显改善，但仍未完全形成最终 Mclaw 发布文档基线。
2. 若仓库地址未来变更，README 中的历史链接也需要统一切换。

处理建议：

1. 继续在 Phase 3-8 间逐步完成 README 和外部文档收口。
2. 保留变更记录，避免丢失 Qclaw 基线说明。

## 5. P2 阻塞项

### P2-01 巨型文件带来平台收口维护成本

重点文件：

1. `src/pages/EnvCheck.tsx`
2. `electron/main/cli.ts`
3. `electron/main/openclaw-chat-service.ts`
4. `electron/main/ipc-handlers.ts`

影响：

1. 平台差异逻辑散落且集中。
2. 每次改动都容易影响非目标路径。

处理建议：

1. Phase 3-4 边开发边拆分。
2. 不在 Phase 1-2 做纯重构，但每次修改都应做小步拆分。

### P2-02 Windows 验收 checklist 目前尚未制度化

现状：

1. 此前只有路线图，没有可直接打勾执行的 Windows smoke checklist。

处理建议：

1. 已在本次 Phase 1 补充 `docs/mclaw-windows-smoke-checklist.md`。

## 6. 优先级汇总

| 编号 | 阻塞项 | 优先级 | 负责人建议 |
|---|---|---|---|
| P0-01 | 缺少 Windows 对等发布脚本 | 已完成 | 构建/发布 |
| P0-02 | 强制签名策略未决 | P0 | 发布/产品决策 |
| P0-03 | 更新源占位值未处理，品牌迁移尚未完全收口 | P0 | 产品接管 |
| P0-04 | `EnvCheck` 存在 mac-only 流程与文案 | P0 | 桌面主流程 |
| P0-05 | 主进程已切换，但 UI/全仓品牌迁移未完全落地 | P0 | 产品接管 |
| P0-06 | OpenClaw 尚未实现“内置本体直用”，仍未脱离安装流程 | P0 | 安装交付/首次启动 |
| P1-01 | Windows 预检脚本缺失 | 已完成 | 构建/发布 |
| P1-02 | 自动更新代码与 v1 文档策略有偏差 | P1 | 发布/产品 |
| P1-03 | 非飞书渠道仍占用复杂度 | P1 | 产品范围治理 |
| P1-04 | README 与用户文档仍是 Qclaw 叙事 | P1 | 文档 |
| P1-05 | Windows 打包依赖下载链路已通过离线资源绕开，但正式发布标准链路未闭合 | P1 | 构建/发布环境 |
| P2-01 | 巨型文件技术债 | P2 | 架构治理 |
| P2-02 | Windows smoke checklist 之前未制度化 | P2 | QA/文档 |

## 7. 进入 Phase 2 的前提

只有以下条件满足，才算完成 `Phase 1`：

1. Windows 阻塞项已经成文。
2. 每个阻塞项已经被标成优先级。
3. 已形成配套的平台差异矩阵。
4. 已形成 Windows smoke checklist。
