# Mclaw 安全加固 + 看门狗 集成实现方案

## 结论先行

**先接入安全加固，再接入看门狗。** 原因：

1. **安全边界必须先于能力放大**：飞书远控链路已通，先补安全约束再增强守护能力，避免无约束的远控窗口期。
2. **安全模块零外部依赖、零运行时耦合**：纯函数式模块，复制即用，不触碰 Gateway 生命周期，回归风险最低。
3. **看门狗依赖 Gateway 生命周期控制器**：`watchdog-self-healing.ts` 直接 import `gateway-lifecycle-controller.ts`，集成时需要确保安全层已就位，否则自动恢复动作（restart gateway / run doctor）可能在没有安全约束的情况下触发。

---

## 模块审计摘要

### 安全加固模块（`Phase7-Delivery/security/`）

| 子模块 | 文件 | 功能 | 外部依赖 |
|--------|------|------|----------|
| **types** | `types.ts` | 所有类型定义（RedactionRule, WhitelistEntry 等） | 无 |
| **redaction** | `redaction-service.ts`, `redaction-rules.ts`, `sensitive-fields.ts`, `index.ts` | 数据脱敏：API Key / 密码 / Token / 邮箱 / 路径等 | 无 |
| **whitelist** | `whitelist-service.ts`, `index.ts` | 插件/技能/能力白名单验证 | 无 |
| **tests** | `redaction-service.test.ts`, `whitelist-service.test.ts` | 35 个测试用例 | vitest（已有） |
| **入口** | `index.ts` | 统一 re-export | 无 |

> [!TIP]
> 安全模块是**纯 TypeScript 库**，不依赖 Electron API、不依赖 Node 原生模块、不依赖项目其他文件。复制到 `electron/main/security/` 后调整 import 路径即可编译通过。

### 看门狗模块（`M-claw-hizeys/electron/main/watchdog/`）

| 文件 | 功能 | 外部依赖 |
|------|------|----------|
| `watchdog-types.ts` | 状态码/事件/阈值类型定义 | 无 |
| `watchdog-state.ts` | 内存状态管理 + 事件历史 + 监听器 | 无 |
| `watchdog-health-sensing.ts` | 健康检查（调用 `gatewayHealth()`） | **`../cli` 的 `gatewayHealth`** |
| `watchdog-self-healing.ts` | 自愈恢复（restart gateway / run doctor） | **`../gateway-lifecycle-controller`** |
| `watchdog-circuit-breaker.ts` | 熔断器（连续失败 → 熔断 → 自动恢复） | 仅依赖 `watchdog-state` |
| `watchdog-service.ts` | 主服务：定时健康检查 → 失败恢复 → 熔断 | 组合上述所有文件 |
| `index.ts` | 统一 re-export | 无 |

> [!IMPORTANT]
> 看门狗模块**有运行时耦合**：
> - `watchdog-health-sensing.ts` import `{ gatewayHealth }` from `'../cli'`
> - `watchdog-self-healing.ts` import `{ ensureGatewayReady, reloadGatewayForConfigChange }` from `'../gateway-lifecycle-controller'`
>
> 这两个 import 路径在当前 Mclaw 项目中已存在且匹配（`electron/main/cli.ts` 和 `electron/main/gateway-lifecycle-controller.ts`），所以**文件复制后 import 路径自然正确，不需要修改**。

---

## Phase 1：安全模块文件部署

### 1.1 复制安全模块到项目

```
源: C:\Users\James\Desktop\Phase7-Delivery\security\
目标: d:\workspace\Mclaw\electron\main\security\
```

需要复制的完整文件树：

```
electron/main/security/
├── __tests__/
│   ├── redaction-service.test.ts
│   └── whitelist-service.test.ts
├── redaction/
│   ├── index.ts
│   ├── redaction-rules.ts
│   ├── redaction-service.ts
│   └── sensitive-fields.ts
├── whitelist/
│   ├── index.ts
│   └── whitelist-service.ts
├── types.ts
└── index.ts
```

### 1.2 验证编译

```powershell
cd d:\workspace\Mclaw
.\node_modules\.bin\tsc.cmd --noEmit
```

> [!NOTE]
> 安全模块的所有 import 都是相对路径（`'../types'`, `'./redaction-rules'` 等），不依赖任何项目外部的模块。复制后路径关系自然保持一致。唯一需确认的是 `vitest` 的 import（`import { describe, it, expect, beforeEach } from 'vitest'`）——项目已有 vitest 依赖，无需额外安装。

### 1.3 运行安全模块测试

```powershell
cd d:\workspace\Mclaw
.\node_modules\.bin\vitest.cmd run electron/main/security/__tests__/redaction-service.test.ts electron/main/security/__tests__/whitelist-service.test.ts
```

**预期结果：** 35 passed（26 redaction + 9 whitelist）

---

## Phase 2：安全模块集成到现有代码

### 2.1 集成点 A：CLI 输出脱敏

**文件:** `electron/main/openclaw-command-output.ts`

在 `getCliFailureMessage` 相关函数中，对所有 CLI 输出（stdout/stderr）进行脱敏后再返回给渲染进程。

```typescript
import { redact } from './security/redaction'

// 在现有 getCliFailureMessage 或类似函数中添加：
export function sanitizeCliOutput(raw: string): string {
  const result = redact(raw, { context: ['cli-output'] })
  return result.redacted as string
}
```

**具体接入位置：** 在 `openclaw-command-output.ts` 中，找到所有构建用户可见错误消息的函数，在 return 之前套一层 `redact()`。

### 2.2 集成点 B：配置读取脱敏

**文件:** `electron/main/ipc-handlers.ts`

在 IPC handler 中，对返回给渲染进程的配置数据进行脱敏：

```typescript
import { redactObject } from './security/redaction'

// 在配置读取相关的 ipcMain.handle 回调中：
// 原: return config
// 改: return redactObject(config, { context: ['config-read'] }).redacted
```

**关键查找点：** 在 `ipc-handlers.ts` 中搜索 `readConfig`、`read-config`、`config` 相关的 handler，在返回值上套脱敏。

### 2.3 集成点 C：插件安装白名单验证

**文件:** `electron/main/cli.ts`

在插件安装流程中添加白名单前置校验：

```typescript
import { verifyPlugin } from './security/whitelist'

// 在 installPlugin / managed-channel-plugin-lifecycle 的插件安装入口添加：
async function preInstallPluginCheck(pluginId: string, source: string, installPath: string) {
  const result = verifyPlugin(pluginId, source, installPath)
  if (!result.allowed) {
    return {
      ok: false,
      stdout: '',
      stderr: `Plugin installation blocked: ${result.reason}\nRecommended: ${(result.recommendedActions || []).join('; ')}`,
      code: 1
    }
  }
  return null // 允许继续安装
}
```

**关键查找点：** 搜索 `installPlugin`、`npm install`、`npx openclaw`、`extensions install` 等插件安装调用路径。

### 2.4 集成点 D：聊天服务输出脱敏

**文件:** `electron/main/openclaw-chat-service.ts`

在聊天回复返回给渲染进程之前，对可能包含 API Key / Token 的回复内容进行脱敏扫描（仅脱敏工具输出/错误信息，不脱敏正常回答内容）：

```typescript
import { scanSensitive, redact } from './security/redaction'

// 在 chat reply 的 trace / error 输出中：
function sanitizeChatTrace(traceText: string): string {
  const scan = scanSensitive(traceText)
  if (scan.hasSensitiveData) {
    return redact(traceText, { context: ['cli-output'] }).redacted as string
  }
  return traceText
}
```

> [!WARNING]
> **注意不要对正常的 AI 回答内容做脱敏**，只对工具输出（stderr/stdout）、trace 信息、诊断日志等做脱敏。否则会破坏正常聊天体验。

### 2.5 验证编译

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

### 2.6 运行回归测试

```powershell
.\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-service.test.ts electron/main/__tests__/openclaw-control-ui-rpc.test.ts electron/main/security/__tests__/redaction-service.test.ts electron/main/security/__tests__/whitelist-service.test.ts
```

---

## Phase 3：看门狗模块文件部署

### 3.1 复制看门狗模块到项目

```
源: C:\Users\James\Desktop\M-claw-hizeys\electron\main\watchdog\
目标: d:\workspace\Mclaw\electron\main\watchdog\
```

需要复制的完整文件树：

```
electron/main/watchdog/
├── index.ts
├── watchdog-types.ts
├── watchdog-state.ts
├── watchdog-health-sensing.ts
├── watchdog-self-healing.ts
├── watchdog-circuit-breaker.ts
└── watchdog-service.ts
```

### 3.2 验证 import 路径

看门狗模块有两个外部依赖需要确认：

1. **`watchdog-health-sensing.ts` line 1-2:**
   ```typescript
   import type { GatewayHealthCheckResult } from '../cli'
   import { gatewayHealth } from '../cli'
   ```
   → 目标文件存在: `d:\workspace\Mclaw\electron\main\cli.ts`
   → **需验证:** `cli.ts` 是否 export 了 `GatewayHealthCheckResult` 类型和 `gatewayHealth` 函数

2. **`watchdog-self-healing.ts` line 1:**
   ```typescript
   import { ensureGatewayReady, reloadGatewayForConfigChange } from '../gateway-lifecycle-controller'
   ```
   → 目标文件存在: `d:\workspace\Mclaw\electron\main\gateway-lifecycle-controller.ts`
   → ✅ 已确认 export：`ensureGatewayReady` (line 214) 和 `reloadGatewayForConfigChange` (line 236)

```powershell
# 验证 cli.ts 的导出
Select-String -Path "d:\workspace\Mclaw\electron\main\cli.ts" -Pattern "export.*gatewayHealth|export.*GatewayHealthCheckResult" | Select-Object -First 5
```

### 3.3 验证编译

```powershell
.\node_modules\.bin\tsc.cmd --noEmit
```

---

## Phase 4：看门狗集成到应用启动链

### 4.1 在 Electron 主进程启动链中启动看门狗

**文件:** `electron/main/index.ts`

在 `app.whenReady()` 的初始化链中，在 Gateway 初始化之后启动看门狗：

```typescript
import { startWatchdog, stopWatchdog } from './watchdog'

app.whenReady().then(() => {
  return initializeManagedRuntimeEnvironment()
    .catch(() => undefined)
    .then(() => {
      registerIpcHandlers()
      createWindow()
      createTray()

      // 在窗口创建后，延迟启动看门狗
      // 给 Gateway 一些时间完成初始启动
      setTimeout(() => {
        startWatchdog({
          healthCheckIntervalMs: 15000,   // 每 15 秒检查一次
          maxConsecutiveFailures: 3,       // 连续 3 次失败触发恢复
          circuitOpenDurationMs: 60000,    // 熔断 60 秒
        })
      }, 30000) // 应用启动后 30 秒再开始监控
    })
})
```

### 4.2 在应用退出时停止看门狗

**文件:** `electron/main/app-exit-cleanup.ts`

```typescript
import { stopWatchdog } from './watchdog'

// 在 runAppExitCleanup 函数中添加：
export async function runAppExitCleanup(): Promise<void> {
  stopWatchdog()
  // ... 原有清理逻辑 ...
}
```

### 4.3 通过 IPC 暴露看门狗状态给渲染进程

**文件:** `electron/main/ipc-handlers.ts`

```typescript
import {
  getWatchdogState,
  getEventHistory,
  startWatchdog,
  stopWatchdog,
  isWatchdogRunning,
} from './watchdog'

// 在 registerIpcHandlers() 中追加：
ipcMain.handle('watchdog:state', async () => {
  return getWatchdogState()
})

ipcMain.handle('watchdog:events', async () => {
  return getEventHistory()
})

ipcMain.handle('watchdog:running', async () => {
  return isWatchdogRunning()
})

ipcMain.handle('watchdog:start', async () => {
  startWatchdog()
  return { ok: true }
})

ipcMain.handle('watchdog:stop', async () => {
  stopWatchdog()
  return { ok: true }
})
```

### 4.4 Preload 声明（可选）

如果需要在渲染进程显示看门狗状态，需在 `electron/preload/index.ts` 中添加对应的 exposeInMainWorld 声明。这**不是第一版必须项**——看门狗先作为后台静默守护运行即可。

---

## Phase 5：添加看门狗测试

### 5.1 创建看门狗测试文件

**文件:** `electron/main/__tests__/watchdog-service.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock cli 和 gateway-lifecycle-controller
vi.mock('../cli', () => ({
  gatewayHealth: vi.fn().mockResolvedValue({ running: true, raw: '', stderr: '', code: 0 }),
}))

vi.mock('../gateway-lifecycle-controller', () => ({
  ensureGatewayReady: vi.fn().mockResolvedValue({ ok: true, running: true }),
  reloadGatewayForConfigChange: vi.fn().mockResolvedValue({ ok: true, running: true }),
}))

import {
  startWatchdog,
  stopWatchdog,
  isWatchdogRunning,
  getWatchdogState,
  getEventHistory,
  resetWatchdogState,
} from '../watchdog'

describe('WatchdogService', () => {
  beforeEach(() => {
    resetWatchdogState()
  })

  afterEach(() => {
    stopWatchdog()
  })

  it('starts and stops correctly', () => {
    expect(isWatchdogRunning()).toBe(false)
    startWatchdog()
    expect(isWatchdogRunning()).toBe(true)
    expect(getWatchdogState().stateCode).toBe('monitoring')
    stopWatchdog()
    expect(isWatchdogRunning()).toBe(false)
    expect(getWatchdogState().stateCode).toBe('idle')
  })

  it('records start/stop events', () => {
    startWatchdog()
    stopWatchdog()
    const events = getEventHistory()
    expect(events.some(e => e.kind === 'watchdog_started')).toBe(true)
    expect(events.some(e => e.kind === 'watchdog_stopped')).toBe(true)
  })

  it('does not start twice', () => {
    startWatchdog()
    startWatchdog()
    const events = getEventHistory()
    const startEvents = events.filter(e => e.kind === 'watchdog_started')
    expect(startEvents.length).toBe(1)
  })
})
```

### 5.2 运行看门狗测试

```powershell
.\node_modules\.bin\vitest.cmd run electron/main/__tests__/watchdog-service.test.ts
```

---

## Phase 6：全量回归验证

```powershell
# 1. TypeCheck
.\node_modules\.bin\tsc.cmd --noEmit

# 2. 安全模块测试
.\node_modules\.bin\vitest.cmd run electron/main/security/__tests__/redaction-service.test.ts electron/main/security/__tests__/whitelist-service.test.ts

# 3. 看门狗测试
.\node_modules\.bin\vitest.cmd run electron/main/__tests__/watchdog-service.test.ts

# 4. 关键回归测试
.\node_modules\.bin\vitest.cmd run electron/main/__tests__/openclaw-chat-service.test.ts --bail=1
.\node_modules\.bin\vitest.cmd run electron/main/__tests__/gateway-lifecycle-controller.test.ts
.\node_modules\.bin\vitest.cmd run src/pages/__tests__/chat-availability-state.test.ts
.\node_modules\.bin\vitest.cmd run src/pages/__tests__/dashboard-entry-flow.test.tsx
```

---

## Phase 7：更新 dev_log.md

在 `docs/dev_log.md` 末尾追加两条更新记录：

```markdown
### Update XXX: Integrate Phase 7 security hardening module (data redaction + whitelist validation)
- Copied `Phase7-Delivery/security/` into `electron/main/security/` as a self-contained security module.
- The module provides two sub-systems:
  - **Data Redaction**: auto-detects and masks sensitive data (API keys, passwords, tokens, emails, file paths, etc.) in CLI output, config reads, and chat trace diagnostics.
  - **Whitelist Validation**: verifies plugins, skills, and capabilities against an in-memory whitelist before installation is allowed.
- Integrated redaction into 4 existing code paths:
  - CLI output sanitization (`openclaw-command-output.ts`)
  - Config read IPC handlers (`ipc-handlers.ts`)
  - Plugin install preflight (`cli.ts` / plugin lifecycle)
  - Chat trace/error output (`openclaw-chat-service.ts`)
- Validation: `tsc --noEmit` passed; `vitest run electron/main/security/__tests__/` passed (35/35).

### Update XXX+1: Integrate watchdog gateway guardian module
- Copied `M-claw-hizeys/electron/main/watchdog/` into `electron/main/watchdog/` as the gateway health monitoring and self-healing module.
- The watchdog provides:
  - Periodic gateway health checks (default every 15s)
  - Automatic recovery sequence: restart gateway → run doctor
  - Circuit breaker pattern: opens after 3 consecutive failures, auto-closes after 60s cooldown
  - Event history and state change listeners for future UI integration
- Integrated into the application lifecycle:
  - Starts 30 seconds after app launch (delayed to avoid interfering with initial gateway bootstrap)
  - Stops on app exit cleanup
  - Exposes `watchdog:state`, `watchdog:events`, `watchdog:running`, `watchdog:start`, `watchdog:stop` IPC handlers
- Validation: `tsc --noEmit` passed; `vitest run electron/main/__tests__/watchdog-service.test.ts` passed.
```

---

## Phase 8：打包 Windows 构建

```powershell
cd d:\workspace\Mclaw
D:\nodejs\npm.cmd run package:win:dir
```

**预期产出:** `release/2026.4.21-vXX/win-unpacked/Mclaw.exe`

---

## 操作清单（给工作模型的 checklist）

- [ ] **Phase 1:** 复制 `Phase7-Delivery/security/` → `electron/main/security/`，运行 tsc + vitest 验证
- [ ] **Phase 2:** 在 `openclaw-command-output.ts`、`ipc-handlers.ts`、`cli.ts`（插件安装）、`openclaw-chat-service.ts` 中接入脱敏/白名单
- [ ] **Phase 3:** 复制 `M-claw-hizeys/electron/main/watchdog/` → `electron/main/watchdog/`，验证 import 路径，运行 tsc
- [ ] **Phase 4:** 在 `index.ts` 启动看门狗，在 `app-exit-cleanup.ts` 停止看门狗，在 `ipc-handlers.ts` 注册 IPC
- [ ] **Phase 5:** 创建 `watchdog-service.test.ts`，运行测试
- [ ] **Phase 6:** 全量回归验证
- [ ] **Phase 7:** 更新 `docs/dev_log.md`
- [ ] **Phase 8:** `npm run package:win:dir` 打包

> [!CAUTION]
> **绝对不要碰的东西：**
> - 不要碰截图恢复/截图传输链路
> - 不要碰 Direct Chat 去重逻辑（除非出现明确回归）
> - 不要修改 `openclaw-chat-service.ts` 中已有的飞书远控主流程代码
> - 不要改动 `feishu-*` 系列文件
> - 不要改动 `gateway-lifecycle-controller.ts` 的现有逻辑（看门狗通过现有 export 调用即可）
