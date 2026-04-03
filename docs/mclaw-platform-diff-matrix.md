# Mclaw 平台差异矩阵

## 1. 文档目的

本表用于在 `Phase 1` 和 `Phase 2` 中统一回答一个问题：  
同一项能力在 Windows 和 macOS 上当前分别是什么状态、风险是什么、下一步该怎么处理。

## 2. 平台差异矩阵

| 能力域 | Windows 当前状态 | macOS 当前状态 | 风险判断 | 处理策略 |
|---|---|---|---|---|
| 打包目标 | 已有 `nsis` 配置 | 已有 `dmg/zip` 配置 | Windows 脚本未收口 | 先补 Windows 对等脚本 |
| 发布脚本 | 缺失标准 `package:win/release:win` | 已有 `package:mac/release:mac` | Windows 发布不可制度化 | Phase 2 补齐 |
| 代码签名 | 方案未定，且 `forceCodeSigning: true` | 已有明确签名/公证链路 | Windows 开发构建可能直接被卡住 | 先做签名策略决策 |
| 更新源 | 占位 URL | 占位 URL | 双平台都无法做真实发布验证 | Phase 8 配置正式 URL |
| 主进程品牌 | 仍为 Qclaw | 仍为 Qclaw | 不符合 Mclaw 目标 | Phase 3 统一替换 |
| 首次启动环境检查 | 存在，但受大体量文件和 mac-only 文案影响 | 现有主路径更成熟 | Windows 易出现错误文案或错误分支 | Phase 4 收口 |
| Node 安装 | 已有 `powershell/msiexec` 分支 | 已有 `osascript/pkg` 链路 | Windows 需实际烟雾验证 | Phase 2 验证 |
| OpenClaw 安装 | 已有部分 `win32` 逻辑 | 已有成熟路径 | Windows 仍缺发布级验证 | Phase 2 验证 |
| PATH 刷新 | 已有 PowerShell 从注册表回读逻辑 | 主要依赖现有 PATH / nvm 回退 | Windows 路径恢复需实机验证 | Phase 2 验证 |
| gateway start/health/restart | 代码有 Windows 分支 | 现有路径较成熟 | Windows 需最小闭环验证 | Phase 2 验证 |
| 自动更新 | 代码支持，但 v1 不纳入必交付 | 代码支持，但 v1 不纳入必交付 | 文档与代码策略需对齐 | v1 仅保留手动下载路径 |
| 手动下载更新 | 可从更新服务派生下载 URL | 可从更新服务派生下载 URL | 取决于真实发布源是否配置 | Phase 8 验证 |
| 卸载保留数据 | `deleteAppDataOnUninstall: false` 已配置 | 需结合实际行为确认 | 需明确对用户的数据保留策略 | Phase 8 验证 |
| 飞书接入 | 代码存在，未单独验证 Windows 闭环 | 代码存在，预期更成熟 | v1 主线必须保障 | Phase 5 验证 |
| 其它 IM 渠道 | 代码存在但非 v1 主线 | 代码存在但非 v1 主线 | 范围漂移风险 | 保留代码，不作为当前主线 |
| README/外部文档 | 仍为 Qclaw，Windows 标注开发中 | 同上 | 对外叙事不一致 | Phase 3-8 逐步更新 |

## 3. 当前平台判断

### Windows

判断：

1. 已有基础实现。
2. 尚未达到可交付状态。
3. 当前是 v1 第一阻塞平台任务。

### macOS

判断：

1. 当前路径更成熟。
2. 但品牌、更新源和发布文档仍需随 Mclaw 主线同步调整。
3. Windows 收口过程中不能破坏现有 macOS 能力。

## 4. 平台治理原则

1. 优先消除“Windows 缺失主路径”问题。
2. 同步避免“为了修 Windows 把 macOS 搞坏”。
3. 平台差异尽量收敛到主进程和适配层，不继续扩散到 UI 文案与业务逻辑。
