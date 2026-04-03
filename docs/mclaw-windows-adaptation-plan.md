# Mclaw Windows 适配专项计划

## 1. 文档目的

本文件用于把“支持 Windows”从口头目标变成工程任务清单。  
目标不是抽象讨论，而是明确：

1. 当前已经支持到什么程度。
2. 还缺什么。
3. 开发应该先做哪些，后做哪些。
4. 什么状态才算“Windows 适配完成到可交付”。

## 2. 当前判断

当前仓库对 Windows 的状态应定义为：

`已有基础实现，但尚未完成交付收口。`

理由：

1. 已有 Windows 打包目标。
2. 已有 Windows 运行时与安装分支。
3. 已有 Windows 自动更新支持声明。
4. 已有 Windows 开发打包脚本与 smoke checklist。
5. 已验证可产出 `win-unpacked` 目录与 NSIS 安装包，但正式发布标准链路仍未完全闭合。
6. 当前 `v11` 虽可内置 `openclaw-2026.3.24.tgz`，但本质仍是“首启安装 OpenClaw”，不符合“安装即用、直接内置 OpenClaw 本体”的目标。

## 3. 明确结论

### 3.1 应不应该先做 Windows

应当先做。  
原因是 Windows 适配属于 `底座阻塞项`，不是普通功能项。

### 3.2 应不应该先做 Docker

不应先做。  
Docker 当前只适合做专题预研，不适合作为 v1 主线前置。

### 3.3 应不应该先继续堆功能

不应在 Windows 最小闭环未完成前继续大规模堆新功能。  
否则后续所有功能都要再做一次平台返工。

## 4. 专项目标

Windows 适配专项的目标不是一次把全部 v1 做完，而是先达成下面这个最小闭环：

1. 可以安装。
2. 可以启动。
3. 可以完成环境检测。
4. 可以拉起 gateway。
5. 可以执行健康检查和手动恢复。
6. 可以走通首次启动主流程。
7. 首次启动在断网条件下也能完成 OpenClaw 准备，且默认路径应是安装包自带的 OpenClaw 本体，而不是 `tgz` 安装流程。

达到这个闭环后，才继续飞书、看门狗和安全强化。

## 5. 范围

### 5.1 本专项包含

1. Windows 打包与安装链路。
2. Windows 首次启动与环境检测。
3. Windows 路径、权限、日志、备份目录策略。
4. Windows 下 gateway 的启动、探活、重启、失败提示。
5. Windows 下更新、卸载与保留数据策略。
6. Windows 下飞书接入前置条件验证。

### 5.2 本专项不包含

1. Docker 首发方案落地。
2. 支付、分销、邀请码服务端。
3. MemOS / DeerFlow 等增强能力。
4. 看门狗的完整策略实现。

## 6. 工作分解

### Workstream A 打包与发布链路

目标：

1. 建立与 macOS 对等的 Windows 发布命令和构建流程。

任务：

1. 补齐 `package:win`、`package:win:dir`、`release:win` 等命令。
2. 决策 Windows 代码签名证书方案：当前 `electron-builder.json` 已设置 `forceCodeSigning: true`，需明确是否获取正式证书、证书采购渠道与成本，或在开发阶段临时改为 `false` 以允许无签名开发构建。此为 P0 决策项。
3. 确认 NSIS 产物命名、版本号、更新源配置。
4. 明确开发环境打包与正式发布打包的差异。
5. 将已验证的开发打包策略文档化：
   - 仓库根目录存在 `electron-dist/` 时，优先使用本地 Electron 分发包
   - 开发阶段允许 `-c.forceCodeSigning=false`
   - 开发阶段允许 `-c.win.signAndEditExecutable=false`，绕过 `winCodeSign` 依赖下载
6. 设计并落地 OpenClaw 内置本体打包策略：
   - 定义内置运行时目录与平台分发结构
   - 约定版本、hash、来源、升级元数据
   - 确保 NSIS 安装后 OpenClaw 本体随应用一起落盘，可直接探测和调用
   - 仅在本体缺失或损坏时才允许触发 `tgz` / 在线 fallback

当前已验证事实：

1. `package:win`、`package:win:dir`、`release:win` 已补齐。
2. Windows 开发目录打包已成功产出 `release/<version>/win-unpacked`。
3. 当前开发产物已从 `Qclaw.exe` 切换为 `Mclaw.exe`。
4. 已通过本地 NSIS 目录成功绕过 `nsis-3.0.4.1.7z` 工具下载。
5. 已通过本地解压 `nsis-resources-3.4.1` 目录并在打包前补丁 `app-builder-lib`，成功产出正式 NSIS 安装包：
   - `release/2026.4.2-v2/Mclaw_2026.4.2-v2.exe`
6. 当前已确认 `app-builder.exe` 在本机代理异常时会对 `localhost` 请求也错误走代理，因此本地 HTTP mirror 不是可靠兜底方案。
7. 已执行静默安装并成功落盘到：
   - `smoke-install/Mclaw`
8. 当前安装目录内已确认存在 `Mclaw.exe`、`Uninstall Mclaw.exe`、`resources/app.asar`、`resources/elevate.exe` 等关键文件。
9. 安装后 `resources/app-update.yml` 仍写入占位更新源，说明真实更新源配置仍是实际发布阻塞项。
10. 正式发布仍缺：
   - 真实更新源
   - Windows 签名证书与正式签名流程
   - 不依赖启动前补丁的标准 `nsis-resources` 资源方案
   - 不依赖开发临时参数的标准发布链路
11. OpenClaw 本体内置方案尚未落地，当前仅保留 `tgz` 过渡方案，仍不满足最终交付要求。

验收：

1. 开发阶段能稳定输出 Windows 目录产物。
2. 开发阶段已能稳定输出 Windows 安装包。
3. 正式发布阶段需在真实更新源与签名链路闭合后继续验证标准安装包。
4. 安装包命名、版本号、目录结构可预期。
5. 安装包内可发现 OpenClaw 载荷，且版本与策略文档一致。

### Workstream B 运行时与环境检查

目标：

1. 在 Windows 下完成 Node/OpenClaw 的检测、安装和修复闭环。

任务：

1. 核对 `powershell` / `msiexec` 流程是否可靠。
2. 验证 PATH 更新后当前进程是否能重新发现命令。
3. 核对错误提示是否仍带有 mac-only 文案。
4. 梳理管理员权限场景和失败回退路径。
5. 将 OpenClaw 准备路径改为“本地内置本体优先”，网络安装仅作为 fallback。
6. 为“内置本体缺失/损坏/权限失败”补充独立错误提示与修复动作。

验收：

1. 缺 Node 时能够给出正确修复路径。
2. 缺 OpenClaw 时能够完成安装或给出正确失败提示。
3. 不要求用户自行拼命令。
4. 断网条件下，缺 OpenClaw 仍能完成准备，且默认依赖内置本体。

### Workstream C 路径、目录与数据策略

目标：

1. 统一 Windows 下配置、日志、备份、临时目录和卸载行为。

任务：

1. 盘点 `%APPDATA%`、用户目录、临时目录、日志目录、备份目录。
2. 定义配置和备份目录命名规则。
3. 验证卸载时保留还是删除用户数据。
4. 验证 Qclaw 历史目录兼容和迁移策略。

验收：

1. 所有关键目录位置可说明、可定位、可恢复。
2. 不出现写到不安全目录或不可预期目录的情况。

### Workstream D gateway 运行闭环

目标：

1. Windows 下 gateway 能被稳定拉起、探活和手动恢复。

任务：

1. 验证命令解析、`.cmd` / shell 拉起语义。
2. 验证 health 检查在 Windows 下返回稳定。
3. 验证 restart / ensure running 行为。
4. 记录常见失败模式和对应提示。

验收：

1. gateway 能启动。
2. health 能获取。
3. restart 可执行。

### Workstream E UI 与主流程

目标：

1. 把 Windows 首次启动体验打磨到不依赖命令行理解。

任务：

1. 审计 `EnvCheck`、欢迎页、安装提示、错误提示。
2. 去除明显的 mac-only 文案和路径表达。
3. 确保用户能理解下一步是“安装依赖”“修复权限”还是“重启 gateway”。

验收：

1. 用户看 UI 就能走完主流程。
2. 不需要读源码或终端输出才能继续。

### Workstream F 更新、卸载与回归

目标：

1. Windows 版从安装到更新再到卸载，都有可验证路径。

任务：

1. 验证更新元数据。
2. 验证手动下载链接。
3. 验证安装升级与卸载后的数据保留策略。
4. 编写 smoke checklist。

验收：

1. 升级路径明确。
2. 卸载行为符合预期。

### Workstream G OpenClaw 真内置本体交付

目标：

1. 把 OpenClaw 从“安装流程依赖”升级为“安装包内置可运行本体”。
2. 让“断网可首启”成为可验证能力，而不是口头目标。

任务：

1. 选择内置形态，以“可直接运行的预构建目录或平台化压缩包”作为主方案；`tgz` 只保留为过渡 fallback。
2. 在打包阶段注入本体到应用资源目录，并记录版本元数据（版本号、hash、构建来源、平台架构）。
3. 在首次启动编排中新增“内置本体验证与注册”：
   - 优先探测并启用本地本体
   - 成功后回写安装来源为 `bundled-runtime`
   - 仅在本体不可用时尝试 `bundled-fallback` 或网络 fallback
4. 新增诊断信息：当前 OpenClaw 来源（`bundled-runtime` / `bundled-fallback` / `online-fallback` / `external`）与最后一次修复路径。
5. 补齐 smoke 与回归用例：
   - 断网全新机首启成功
   - 内置本体损坏时给出明确错误提示
   - `tgz` fallback 只在主本体失败时触发
   - 版本门禁与升级策略在 `bundled-runtime` 来源下行为正确

验收：

1. 安装包内确实包含 OpenClaw 本体。
2. 断网环境下首次启动可完成 OpenClaw 准备，且不需要先执行 npm 安装。
3. 文档、UI 提示、诊断信息对“内置本体”描述一致。

## 7. 优先级

| 优先级 | 内容 |
|---|---|
| P0 | 打包、安装、OpenClaw 内置交付、环境检测、gateway 启动/health/restart |
| P1 | 目录策略、错误提示、首次启动体验、更新与卸载 |
| P2 | 飞书接入前置兼容验证、更多边界场景回归 |

## 8. 阻塞条件

以下问题若未解决，不应宣布 Windows 适配完成：

1. 没有稳定可安装的 Windows 安装包。
2. 安装后不能走完首次启动主流程。
3. gateway 不能在 Windows 上稳定执行 health / restart。
4. 目录、权限、日志和备份位置不清晰。
5. 文档仍与实际行为不一致。
6. OpenClaw 仍未做到“本体内置直用”，仍把安装流程当主路径。

## 9. 退出标准

Windows 适配专项完成，至少要满足：

1. Windows 全新机器可安装应用。
2. 首次启动可完成环境检测。
3. 模型配置主流程可进入。
4. gateway 可被启动并可执行健康检查。
5. 手动恢复路径可用。
6. 平台文案、安装文档、发布文档已同步更新。
7. OpenClaw 内置本体路径已落地并通过断网首启验证。

## 10. 与后续阶段的关系

专项完成后，才进入以下主线：

1. 飞书官方接入闭环。
2. gateway 看门狗。
3. 安全加固与脱敏。
4. 商业化预埋。

Docker 仍保持后置：

1. 只有当原生桌面交付稳定后，才评估 Docker 是否值得进入下一阶段。
