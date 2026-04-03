# 飞书官方 CLI 接入计划

## 1. 背景

当前项目的飞书接入主线，已经存在以下实现：

1. 飞书官方插件安装与修复：
   - `@larksuite/openclaw-lark`
   - `@larksuite/openclaw-lark-tools`
2. 页面侧接入入口与二维码流程：
   - `src/pages/ChannelConnect.tsx`
3. 主进程侧官方插件就绪检查与安装会话：
   - `electron/main/feishu-official-plugin-state.ts`
   - `electron/main/feishu-installer-session.ts`

用户补充了飞书官方 CLI：

- `https://github.com/larksuite/cli`

该仓库需要纳入 `Phase 5` 设计判断。

## 2. 当前判断

基于官方仓库 README 当前公开信息，`larksuite/cli` 的定位是：

1. 飞书/Lark 官方 CLI 工具。
2. 提供 OAuth 登录、scope 管理、身份切换、OpenAPI 调用与 Agent Skills。
3. 提供：
   - `lark-cli auth login`
   - `lark-cli auth status`
   - `lark-cli auth check`
   - `lark-cli auth login --no-wait`
   - `lark-cli auth login --device-code <DEVICE_CODE>`

因此当前更合理的分层判断是：

1. `openclaw-lark` / `openclaw-lark-tools`
   - 更接近当前项目里的“飞书渠道插件安装层 / Bot 接入层”
2. `larksuite/cli`
   - 更接近“官方认证层 / OAuth 授权层 / OpenAPI 操作层”

## 3. 结论：当前不能直接替换

当前不建议直接下结论说：

1. `larksuite/cli` 可以直接替换 `openclaw-lark`

原因是：

1. 当前仓库里的飞书闭环，核心依赖的是：
   - OpenClaw 插件目录落盘
   - OpenClaw 配置归一化
   - Gateway 重载后的渠道可用状态
2. 这些逻辑目前都明确绑定在：
   - `openclaw-lark`
   - `openclaw-lark-tools install`
3. `larksuite/cli` 从公开 README 看，主打的是：
   - OAuth 登录
   - OpenAPI 调用
   - Skills / Agent 操作
4. 公开信息还不足以证明：
   - 它能直接生成当前项目所需的 OpenClaw 渠道插件落盘结构
   - 它能替代现有 `openclaw-lark-tools install` 的安装器职责

所以当前更稳妥的工程结论是：

1. `larksuite/cli` 需要“考虑接入”
2. 但应先视为“官方认证增强层”
3. 不是直接把当前 `openclaw-lark` 路径整条替掉

## 4. 对 Phase 5 的实际影响

`Phase 5` 现在应调整为“两层接入”视角：

### A. 保留现有插件接入主线

继续保留：

1. `@larksuite/openclaw-lark`
2. `@larksuite/openclaw-lark-tools install`
3. 当前 `ChannelConnect` 里的官方安装器输出、二维码、手动绑定与修复流程

这是因为这条链已经直接连接：

1. 插件安装
2. 配置归一化
3. Gateway 重载
4. Bot 渠道可用状态

### B. 新增官方 CLI 适配层

把 `larksuite/cli` 作为新增适配目标，优先考虑以下能力：

1. OAuth 登录与授权状态检查
2. 更标准的 scope 管理
3. `--no-wait` / `device-code` 这类对桌面应用友好的登录衔接能力
4. 后续用于诊断飞书侧权限是否齐备

## 5. 建议的接入策略

当前建议分两步推进：

### 第一步：先接“检测与引导”，不替换主安装链

在不打断现有飞书插件主流程的前提下，新增：

1. 是否已安装 `lark-cli`
2. 是否已登录
3. 当前是否具备推荐 scopes
4. 若未具备，则给出官方 CLI 登录入口或引导

这一步的目标是：

1. 让 Mclaw 感知官方 CLI 的存在
2. 但不影响现有 `openclaw-lark-tools install` 主线

### 第二步：评估是否可托管二维码/OAuth 步骤

若后续验证表明 `lark-cli` 能稳定承担：

1. 授权 URL 生成
2. 登录状态查询
3. device-code / no-wait 回轮询

则可以把它接入：

1. `ChannelConnect` 的飞书授权前置步骤
2. 作为官方 OAuth 层

但即使如此，是否替代 `openclaw-lark-tools install`，仍需单独验证。

## 6. 当前建议落地动作

当前最实际的下一步不是直接替换，而是：

1. 在文档层明确分层关系
2. 在 `Phase 5` 中新增：
   - `lark-cli` 检测
   - `lark-cli auth status` / `auth login` 适配预案
3. 等后续确认其是否能覆盖当前插件安装器职责，再决定是否替换

## 7. 当前结论

当前一句话结论：

1. `larksuite/cli` 应被纳入 `Phase 5` 设计，但当前更像“官方认证增强层”，不能直接视为 `openclaw-lark` 的已验证替代品。
