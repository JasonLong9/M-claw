# 负责人 B：对话切页保活 + 405 修复任务说明

更新时间：2026-04-28

## 背景

当前 Mclaw 内测发现一个对话链路问题：

1. 用户在对话页发送一条消息，例如 `你好`。
2. 消息发送过程中，用户点击左侧导航切到 `面板`、`IM 渠道`、`Skills`、`模型与 API` 等页面。
3. 用户再回到 `对话` 页面。
4. 对话页会加载很久，原消息可能被标记为发送失败。
5. 点击 `重试上一条消息` 后，界面会显示裸错误：`405 status code (no body)`。

你的任务只负责修复这条对话体验链路。OpenClaw 升级、Windows 终端隐藏、Windows 打包由负责人 A 处理。

## 你的分支

请从集成分支拉自己的功能分支：

```bash
git fetch origin
git switch -c fix-chat-navigation-send-405-recovery origin/stabilize-internal-test-vnext
```

如果本地还没有项目：

```bash
git clone https://github.com/JasonLong9/M-claw.git
cd M-claw
git fetch origin
git switch -c fix-chat-navigation-send-405-recovery origin/stabilize-internal-test-vnext
D:\nodejs\npm.cmd install
D:\nodejs\npm.cmd run typecheck
```

## 你要修的问题

### 1. 对话发送中切页不能丢状态

要求：

- 用户发送消息后，立刻切到左侧其他页面，再回到对话页，用户刚发的消息仍然可见。
- 对话页不能长时间空白加载。
- 正在发送的请求不能因为页面卸载/重新挂载而被前端误判失败。
- 回到对话页时，如果主进程还在发送，应显示“后台回复中 / 发送中”之类的状态。
- 不能因为回到页面而重复发送上一条消息。

### 2. 重试逻辑要安全

要求：

- 只有当前发送任务确实结束后，才允许重试。
- 重试不能重复插入多条用户消息。
- 重试不能和未完成的发送任务并发。
- 重试失败时要展示清晰中文原因。

### 3. 405 错误不能裸露给用户

现在界面直接显示：

```text
405 status code (no body)
```

需要改成中文可操作提示。例如：

```text
模型服务返回 405，通常是 Base URL 或接口路径不匹配。请检查模型配置。
```

如果判断是本机运行组件和聊天协议不兼容，可以提示：

```text
本机运行组件与当前聊天协议不兼容，请升级后重试。
```

不要把裸 HTTP 错误直接展示给最终用户。

## 固定复现路径

请按这个路径开发和验收：

1. 进入 `对话` 页面。
2. 输入 `你好` 并发送。
3. 发送过程中立刻点击左侧 `面板`。
4. 再点击左侧 `对话`。
5. 检查：
   - 页面是否快速显示历史消息。
   - 刚才的用户消息是否仍在。
   - 是否还能看到发送中/后台回复状态。
   - 是否没有错误标记。
   - 是否不会出现 `405 status code (no body)`。
6. 对 `IM 渠道`、`Skills`、`模型与 API` 重复同样测试。

## 建议修改范围

你可以主要看这些文件：

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

相关测试可以放在：

- `src/components/dashboard/chat-panel-messages.test.ts`
- `src/components/dashboard/dashboard-chat-panel-guardrails.test.ts`
- `src/pages/__tests__/chat-availability-state.test.ts`
- `electron/main/__tests__/openclaw-chat-service.test.ts`

## 尽量不要修改的范围

这些由负责人 A 处理，你这里不要动，避免冲突：

- `resources/openclaw-bundle/**`
- `src/shared/openclaw-version-policy.ts`
- `electron/main/cli.ts`
- `electron/main/openclaw-spawn.ts`
- Windows 打包脚本
- `release/**`

## 推荐实现方向

可以按这个方向排查：

1. 检查 `ChatPage.tsx` 和 `DashboardChatPanel.tsx` 在页面卸载/重新挂载时是否重置了发送中状态。
2. 检查 `sendChatMessage` 的 IPC 调用是否只在当前页面生命周期内保存状态。
3. 如果主进程已经有全局发送锁，前端重新进入页面时应查询或恢复这个状态，而不是直接显示失败。
4. 必要时增加一个轻量 IPC，例如：

```ts
getActiveChatSendState(sessionId?: string)
```

返回：

```ts
type ActiveChatSendState = {
  status: 'idle' | 'sending' | 'failed' | 'completed'
  sessionId?: string
  requestId?: string
  startedAt?: number
  lastError?: string
}
```

5. 对话页重新进入时先显示本地 transcript，再后台刷新 gateway / session 状态。
6. 在 `gateway-streaming-chat-transport.ts` 或 `openclaw-chat-service.ts` 中增加 405 分类，不要把裸错误直接透传到 UI。

## 验证命令

至少跑：

```bash
D:\nodejs\npm.cmd run typecheck
D:\nodejs\npx.cmd vitest run src/components/dashboard/chat-panel-messages.test.ts src/components/dashboard/dashboard-chat-panel-guardrails.test.ts src/pages/__tests__/chat-availability-state.test.ts electron/main/__tests__/openclaw-chat-service.test.ts
```

如果 Vitest 在 Windows 沙箱里遇到 `spawn EPERM`，就在本机普通终端里直接跑同样命令。

## 你的验收标准

你的 PR 合并前，需要满足：

- 发送 `你好` 后马上切到 `面板`，再回 `对话`，用户消息仍在。
- 返回对话页不出现长时间空白加载。
- 正在发送时返回，显示发送中或后台回复中。
- 发送完成后返回，能看到回复。
- 失败时显示中文原因，不显示裸 `405 status code (no body)`。
- 点击重试不会重复插入多条用户消息。
- 连续切换 `面板 / IM 渠道 / Skills / 对话` 不会破坏当前发送任务。
- `D:\nodejs\npm.cmd run typecheck` 通过。
- 相关 Vitest 通过。

## PR 要求

PR 标题建议：

```text
fix: keep chat send state across navigation and classify 405 errors
```

PR 描述需要包含：

1. 修复了什么用户问题。
2. 修改了哪些主要文件。
3. 自测命令和结果。
4. 手工复现路径的验证结果。
5. 如果还有残留风险，需要明确写出来。

不要提交：

- `release/` 安装包。
- `node_modules/`。
- 本地日志。
- 用户数据。
- API Key / 飞书密钥 / auth-profiles。

