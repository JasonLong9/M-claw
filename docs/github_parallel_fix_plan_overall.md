# Mclaw 内测问题 A/B 并行修复总方案

更新时间：2026-04-28

## 本轮目标

本轮内测需要并行修复三类问题：

1. Windows 使用过程中仍可能弹出 `openclaw` / `openclaw-gateway` / `timeout /t 1 /nobreak` 终端窗口，必须全部改为后台隐藏运行。
2. 对话发送过程中切换左侧页面，再回到对话页时，会长时间加载、原消息发送失败，重试后出现 `405 status code (no body)`。
3. 升级内置 OpenClaw 版本，并确保 Windows 打包产物实际使用升级后的内置 runtime。

## 协作方式

使用 GitHub 分支 + PR 协作，不使用压缩包来回传项目。

当前仓库 remote：

```bash
origin  https://github.com/JasonLong9/M-claw.git
```

推荐分支结构：

```text
main
  └─ stabilize-internal-test-vnext
       ├─ fix-windows-hidden-gateway-openclaw-upgrade
       └─ fix-chat-navigation-send-405-recovery
```

说明：

- `stabilize-internal-test-vnext`：本轮内测修复集成分支，最终只在这个分支打 Windows 内测包。
- `fix-windows-hidden-gateway-openclaw-upgrade`：负责人 A 分支。
- `fix-chat-navigation-send-405-recovery`：负责人 B 分支。

## 初始化协作基线

由主负责人先在本机创建并推送集成分支：

```bash
git status -sb
git switch -c stabilize-internal-test-vnext
git add docs/github_parallel_fix_plan.md docs/github_parallel_fix_plan_overall.md docs/dev_log.md
git commit -m "docs: add internal test parallel repair plans"
git push -u origin stabilize-internal-test-vnext
```

如果当前还有已经完成但未提交的代码修复，应单独提交，不要和文档提交混在一起。

提交前不要使用：

```bash
git add .
```

应该逐个确认文件后添加，避免提交本机数据、构建产物或密钥。

## 禁止提交内容

不要提交：

- `release/**`
- `node_modules/**`
- `dist/**`
- `dist-electron/**`
- 本机 `AppData/Roaming/Mclaw` 数据
- API Key
- 飞书机器人密钥
- `auth-profiles.json`
- `electron-builder.local.json`
- 本地日志和临时文件

`.gitignore` 已排除大部分构建产物，但仍必须人工检查 `git status -sb`。

## 负责人 A：Windows 后台运行 + OpenClaw 升级

### 分支

```bash
git fetch origin
git switch -c fix-windows-hidden-gateway-openclaw-upgrade origin/stabilize-internal-test-vnext
```

### A 的任务目标

负责人 A 负责运行时、后台进程和 OpenClaw 版本升级：

1. 所有 OpenClaw / gateway 相关进程必须后台隐藏运行。
2. Windows 桌面上不能弹出 `openclaw` / `openclaw-gateway` / `timeout /t 1 /nobreak` 终端窗口。
3. `gateway start` / `gateway restart` 不能进入 OpenClaw 自带 Scheduled Task / Startup Launcher 的可见窗口路径。
4. Mclaw 应自己托管 Windows gateway 后台进程。
5. 清理旧的 OpenClaw Scheduled Task / Startup Entry，避免历史启动项继续弹窗。
6. 升级内置 OpenClaw 版本。
7. Windows 打包产物必须使用升级后的内置 OpenClaw runtime。

### A 可以修改的文件范围

- `electron/main/cli.ts`
- `electron/main/openclaw-spawn.ts`
- `electron/main/openclaw-gateway-service.ts`
- `electron/main/gateway-lifecycle-controller.ts`
- `electron/main/openclaw-gateway-probes.ts`
- `src/shared/openclaw-version-policy.ts`
- `resources/openclaw-bundle/manifest.json`
- `resources/openclaw-bundle/manifest.runtime-template.json`
- `resources/openclaw-bundle/runtime/windows-x64/**`
- `scripts/acquire-bundled-runtime.mjs`
- `scripts/check-openclaw-bundled-runtime.mjs`
- `scripts/check-win-packaged-openclaw-bundle.mjs`
- `electron/main/__tests__/cli-windows-spawn.test.ts`
- `electron/main/__tests__/cli-gateway-background.test.ts`
- `electron/main/__tests__/openclaw-spawn.test.ts`
- `electron/main/__tests__/openclaw-gateway-service.test.ts`
- `src/shared/__tests__/openclaw-version-policy.test.ts`

### A 尽量不要修改

这些留给负责人 B，避免冲突：

- `src/components/dashboard/DashboardChatPanel.tsx`
- `src/pages/ChatPage.tsx`
- `electron/main/openclaw-chat-service.ts`
- `electron/main/chat-transport/gateway-streaming-chat-transport.ts`

### A 的实现要求

1. 全量排查 Windows 下所有启动 OpenClaw 的路径：
   - `runCli(...)`
   - `runCliStreaming(...)`
   - `runShell(...)`
   - `gatewayStart(...)`
   - `gatewayRestart(...)`
   - `gatewayForceRestart(...)`
   - `ensureGatewayRunning(...)`
   - 模型认证后触发的 gateway reload/restart
   - IM 渠道配置后触发的 gateway reload/restart
2. Windows 下所有 gateway 生命周期操作都应进入 Mclaw hidden runtime。
3. 所有 `spawn` / `.cmd` / shell 包装都必须隐藏窗口。
4. 不允许通过 `start cmd.exe`、`cmd /k`、`timeout /t` 等可见窗口方式启动。
5. 对旧 OpenClaw Windows scheduled task / startup entry 做清理。
6. 升级：
   - `PINNED_OPENCLAW_VERSION`
   - `MIN_SUPPORTED_OPENCLAW_VERSION`
   - `MAX_SUPPORTED_OPENCLAW_VERSION`
   - bundle manifest
   - Windows runtime bundle
   - 打包校验脚本
   - 测试期望

### A 的验证命令

```bash
D:\nodejs\npm.cmd run typecheck
D:\nodejs\npx.cmd vitest run electron/main/__tests__/cli-windows-spawn.test.ts electron/main/__tests__/cli-gateway-background.test.ts electron/main/__tests__/openclaw-spawn.test.ts electron/main/__tests__/openclaw-gateway-service.test.ts src/shared/__tests__/openclaw-version-policy.test.ts
D:\nodejs\npm.cmd run package:win
```

### A 的验收标准

- 首次启动 Mclaw 不弹 OpenClaw 终端。
- 配置模型不弹 OpenClaw 终端。
- 测试模型连接不弹 OpenClaw 终端。
- 进入 IM 渠道不弹 OpenClaw 终端。
- 飞书接入 / 重载 gateway 不弹 OpenClaw 终端。
- 普通聊天发送不弹 OpenClaw 终端。
- 开发模式打开/关闭不弹 OpenClaw 终端。
- 打包校验显示使用升级后的 OpenClaw 版本。

## 负责人 B：对话切页保活 + 405 修复

### 分支

```bash
git fetch origin
git switch -c fix-chat-navigation-send-405-recovery origin/stabilize-internal-test-vnext
```

### B 的任务目标

负责人 B 负责对话体验和错误处理：

1. 对话发送过程中切到左侧其他页面，再回到对话页，不能长时间空白加载。
2. 用户刚发送的消息不能丢。
3. 正在发送的请求不能因为页面卸载/重新挂载被前端误判失败。
4. 回到对话页时，如果主进程还在发送，应显示“后台回复中 / 发送中”。
5. 不能因为重新进入页面而重复发送上一条消息。
6. 重试逻辑必须安全，不允许并发重复发送。
7. `405 status code (no body)` 必须分类成中文可操作错误，不能裸露给用户。

### B 可以修改的文件范围

- `src/pages/ChatPage.tsx`
- `src/components/dashboard/DashboardChatPanel.tsx`
- `src/components/dashboard/chat-panel-messages.ts`
- `src/shared/chat-panel.ts`
- `src/shared/chat-visible-text.ts`
- `src/types/electron.d.ts`
- `electron/preload/index.ts`
- `electron/main/ipc-handlers.ts`
- `electron/main/openclaw-chat-service.ts`
- `electron/main/chat-transport/gateway-streaming-chat-transport.ts`
- `src/components/dashboard/chat-panel-messages.test.ts`
- `src/components/dashboard/dashboard-chat-panel-guardrails.test.ts`
- `src/pages/__tests__/chat-availability-state.test.ts`
- `electron/main/__tests__/openclaw-chat-service.test.ts`
- `electron/main/__tests__/openclaw-gateway-probes.test.ts`

### B 尽量不要修改

这些留给负责人 A，避免冲突：

- `resources/openclaw-bundle/**`
- `src/shared/openclaw-version-policy.ts`
- `electron/main/cli.ts`
- `electron/main/openclaw-spawn.ts`
- Windows 打包脚本
- `release/**`

### B 的固定复现路径

1. 进入 `对话` 页面。
2. 输入 `你好` 并发送。
3. 发送过程中立刻点击左侧 `面板`。
4. 再点击左侧 `对话`。
5. 检查：
   - 页面是否快速显示历史消息。
   - 刚才的用户消息是否仍在。
   - 是否还能看到发送中 / 后台回复状态。
   - 是否没有错误标记。
   - 是否不会出现 `405 status code (no body)`。
6. 对 `IM 渠道`、`Skills`、`模型与 API` 重复同样测试。

### B 的实现要求

1. 对话页重新挂载时先显示本地缓存 transcript，不要等待 gateway 完整 warmup 后才显示。
2. 发送中的请求要有稳定的 `sessionId` / `requestId`。
3. 页面卸载不能取消主进程中的发送任务。
4. 回到对话页时要能恢复发送中状态。
5. 不允许因为重新进入页面而重复发送上一条消息。
6. 只有当前发送任务确实结束后，才允许重试。
7. 重试不能重复插入多条用户消息。
8. 重试不能和未完成的发送任务并发。
9. 405 需要分类为中文错误，例如：

```text
模型服务返回 405，通常是 Base URL 或接口路径不匹配。请检查模型配置。
```

如果判断是本机运行组件和聊天协议不兼容，可以提示：

```text
本机运行组件与当前聊天协议不兼容，请升级后重试。
```

### B 的建议实现方向

可以考虑增加一个轻量 IPC 查询当前发送任务状态：

```ts
getActiveChatSendState(sessionId?: string)
```

返回结构可参考：

```ts
type ActiveChatSendState = {
  status: 'idle' | 'sending' | 'failed' | 'completed'
  sessionId?: string
  requestId?: string
  startedAt?: number
  lastError?: string
}
```

前端返回对话页时先恢复本地 transcript，再根据 active send state 显示发送中 / 已失败 / 已完成状态。

### B 的验证命令

```bash
D:\nodejs\npm.cmd run typecheck
D:\nodejs\npx.cmd vitest run src/components/dashboard/chat-panel-messages.test.ts src/components/dashboard/dashboard-chat-panel-guardrails.test.ts src/pages/__tests__/chat-availability-state.test.ts electron/main/__tests__/openclaw-chat-service.test.ts
```

### B 的验收标准

- 发送 `你好` 后马上切到 `面板`，再回 `对话`，用户消息仍在。
- 返回对话页不出现长时间空白加载。
- 正在发送时返回，显示发送中或后台回复中。
- 发送完成后返回，能看到回复。
- 失败时显示中文原因，不显示裸 `405 status code (no body)`。
- 点击重试不会重复插入多条用户消息。
- 连续切换 `面板 / IM 渠道 / Skills / 对话` 不会破坏当前发送任务。

## 并行边界

| 区域 | 负责人 A | 负责人 B |
| --- | --- | --- |
| OpenClaw 升级 | 是 | 否 |
| Windows 终端隐藏 | 是 | 否 |
| gateway 启停方式 | 是 | 只调用现有 API |
| 对话页切换保活 | 否 | 是 |
| 405 分类和重试体验 | 否 | 是 |
| Chat UI 状态恢复 | 否 | 是 |
| Windows 打包产物 | 是 | 否 |
| 最终联合验收 | 是 | 是 |

## PR 规则

每个 PR 必须包含：

1. 修复的问题说明。
2. 修改的主要文件。
3. 自测命令和结果。
4. 手工复现路径验证结果。
5. 是否影响打包。
6. 如果有残留风险，需要明确写出。

PR 标题建议：

负责人 A：

```text
fix: hide windows gateway runtime and upgrade openclaw
```

负责人 B：

```text
fix: keep chat send state across navigation and classify 405 errors
```

## 推荐合并顺序

1. 先合负责人 A 的 PR 到 `stabilize-internal-test-vnext`。
2. 负责人 B rebase 最新 `stabilize-internal-test-vnext` 后，再合 B 的 PR。
3. 最后从 `stabilize-internal-test-vnext` 统一打 Windows 内测包。

原因：OpenClaw 升级可能改变 gateway/chat 协议和 runtime 行为，B 的 405 修复必须在升级后的 OpenClaw 上最终验证。

## 最终联合验收清单

两条分支合并后，需要共同验证：

1. 首次启动 Mclaw，不弹 OpenClaw 终端。
2. 模型配置 DeepSeek，测试连接通过。
3. 普通对话发送 `你好`，能正常回复。
4. 发送消息后立刻切到 `面板`，再回 `对话`，消息不丢、不长时间加载、不 405。
5. 切到 `IM 渠道`、`Skills`、`模型与 API` 后再回来，结果一致。
6. 飞书渠道接入后，飞书机器人能回复。
7. 开发模式打开/关闭后，普通对话仍可用。
8. Windows 桌面不出现任何 OpenClaw 终端窗口。
9. Windows 任务管理器允许有后台 Mclaw/OpenClaw 相关进程，但不能出现可见终端窗口。
10. 打包通过：

```bash
D:\nodejs\npm.cmd run typecheck
D:\nodejs\npm.cmd run package:win
```

## 最终打包要求

最终包只从 `stabilize-internal-test-vnext` 打：

```bash
git switch stabilize-internal-test-vnext
git pull
D:\nodejs\npm.cmd run typecheck
D:\nodejs\npm.cmd run package:win
```

产物用于内测，但不要提交到功能 PR。

