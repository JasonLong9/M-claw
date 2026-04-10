# hizeys 看门狗分支合并评估报告

更新日期：2026-04-10

## 1. 结论先行

结论分三层：

1. `origin/hizeys` **可以与当前主线机械合并**，我已经做过一次 dry-run merge，**没有文本冲突**。
2. 但它**不适合整分支直接并入当前 `main` 作为“当前主阻塞修复”**。原因不是代码质量完全不行，而是它解决的是 `Phase 6 / 运维韧性` 问题，而我们当前主阻塞仍然是 `Windows + OpenClaw 2026.3.24` 下的 `gateway readiness / direct chat send` 闭环。
3. 最稳妥的做法是：**先吸收低风险通用修复，再把看门狗主体作为后续特性分阶段接入**，不要把它当成当前网关不可用问题的首修项。

一句话判断：

- **能合并，但不建议现在整分支直接并主线。**
- **建议拆分吸收：先收 CLI Windows shell 修复，再把 watchdog 主体放到后续 feature 集成。**

## 2. 本次分析范围

本次针对以下两部分进行了核查：

1. 当前本地项目已同步到 GitHub `main` 的工作区状态。
2. 同事负责看门狗服务的 `hizeys` 分支是否可以并入当前项目。

本次实际做过的验证：

1. 拉取并审阅 `origin/hizeys` 提交历史。
2. 在当前项目上执行一次 `merge --no-commit --no-ff` 的 dry-run 合并验证。
3. 审阅看门狗相关新增/修改文件。
4. 在 dry-run 合并结果上执行 `npm run typecheck`。

## 3. 分支概况

`origin/hizeys` 相对 `origin/main` 的提交为：

1. `6f5ac4c` - `fix(cli): add shell option for .cmd/.bat/.ps1 files on Windows`
2. `d722888` - `运行构建未签名版本`
3. `2da10bf` - `feat: 实现 Phase 6 看门狗服务`
4. `2a67e8a` - `fix: 看门狗恢复验证闭环`

分支变更统计：

- 共改动 `15` 个文件
- 共 `1073` 行新增
- 共 `3` 行删除

核心文件包括：

- `electron/main/cli.ts`
- `electron/main/ipc-handlers.ts`
- `electron/preload/index.ts`
- `src/pages/Dashboard.tsx`
- `src/types/electron.d.ts`
- `electron/main/watchdog/*`
- `src/components/WatchdogStatus.tsx`
- `src/shared/watchdog-types.ts`

## 4. dry-run 合并结果

我已在本地对当前项目执行过一次 dry-run 合并：

- 合并目标：当前项目 `main`
- 合并来源：`origin/hizeys`
- 结果：**无文本冲突**

这说明：

1. 从 Git 层面看，这个分支与当前主线**是可合并的**。
2. 风险点不在“合不上”，而在“合进来以后是否解决当前正确的问题、是否会引入策略偏移”。

### 额外验证

在 dry-run 合并状态上执行结果如下：

- `npm run typecheck`：**通过**
- `npm run build:app`：**未通过，但失败原因为本地现存 `vite/esbuild spawn EPERM` 环境问题，不是本次看门狗代码特有的类型错误**

因此本次可以得出的工程判断是：

- **类型层面：可接受**
- **构建层面：没有看到由看门狗改动直接引入的新型编译错误**
- **真正需要决策的是产品/阶段/策略层面的合并时机**

## 5. 为什么不建议整分支现在直接并主线

### 5.1 当前主阻塞不是“没有看门狗”

当前主线的真实阻塞仍然是：

- `gateway` 启动后的就绪确认
- `direct chat` 首条消息发送链路
- `OpenClaw 2026.3.24` 兼容路径下的 readiness / health / send 闭环

也就是说：

- 看门狗解决的是“网关挂了以后怎么自动检测和恢复”
- 当前更急的是“先把用户首次启动网关、首次发消息这条主链路跑通”

如果主链路尚未闭环，就算把看门狗并进来，也只是多了一层旁路恢复逻辑，不会自动把当前核心问题消失掉。

### 5.2 当前 watchdog 实现更像“Phase 6 骨架”，不是立即止血补丁

`hizeys` 分支里的 watchdog 主体是有价值的，但它当前更像：

- 一个可落地的第一版骨架
- 一个 Dashboard 可视化 + IPC 可调用的监控恢复框架

而不是：

- 已深度嵌入当前网关主状态机的最终版生产能力

具体来说，它目前主要通过：

- `Dashboard` 上的手动启动/停止
- 定时 `health check`
- 失败后尝试 `restart_gateway` / `run_doctor`

来完成闭环。

这对于后续 Phase 6 很合适，但对当前“网关首启 + 首发消息”主阻塞不是直击根因。

### 5.3 现在整分支并入，会把问题重心从主链路闭环转到韧性建设

当前开发优先级如果被切到 watchdog，会出现一个典型偏移：

1. 用户还不能稳定首发消息
2. 但项目已经开始做“失败后的自动修复”

这会导致工程顺序颠倒：

- 先应该保证主链路能稳定跑通
- 再为它补自动恢复、熔断、诊断分层

所以从策略上，不建议现在整包并主线。

## 6. 我对 hizeys 分支的语义评估

## 6.1 可直接吸收的部分

### A. `electron/main/cli.ts`

对应提交：`6f5ac4c`

这部分修改内容很集中：

- Windows 下针对 `.cmd` / `.bat` / `.ps1` 命令自动打开 `shell`

这是一个：

- 低风险
- 与当前主线直接相关
- 对 Windows 命令执行可靠性有实际帮助

的修复。

我的建议：

- **这部分应优先吸收**
- 可以单独 cherry-pick，而不是等待整个 watchdog 分支一起并

## 6.2 不建议原样直接并入主线的部分

### B. `electron-builder.json`

对应提交：`d722888`

该提交将：

- `forceCodeSigning` 改为 `false`
- 移除 `afterSign`

这适合“本地未签名构建”的场景，但它属于：

- 构建策略调整
- 不是 watchdog 本体

如果直接跟随 watchdog 分支整包并入，就会把“运行未签名版本”的构建策略一起带进主线。

这类改动不应该因为“要合 watchdog”而被顺手带入。

我的建议：

- **不要把该提交作为 watchdog 合并的一部分默认带入**
- 如果主线确实要调整打包策略，应单独评审、单独合并

### C. `electron/main/watchdog/*` + `Dashboard` / `IPC` / `preload` / `types`

对应提交：

- `2da10bf`
- `2a67e8a`

这是看门狗主能力本体，整体结构是成立的，分层也清晰：

- `watchdog-state`
- `watchdog-health-sensing`
- `watchdog-self-healing`
- `watchdog-circuit-breaker`
- `watchdog-service`
- `Dashboard` 可视化状态卡

优点：

1. 分层清晰，后续继续演进成本不高。
2. 已经打通了主进程、preload、前端页面三层调用。
3. 能作为未来 Phase 6 的良好基础。

但它当前还有几个明显的“先别直接当主线止血包”的点。

## 7. 当前 watchdog 版本的主要风险点

### 7.1 还是手动工具，不是已接入主状态机的守护服务

当前实现主要通过 `Dashboard` 控件触发：

- `watchdog:start`
- `watchdog:stop`
- `watchdog:reset`

也就是说它当前更像：

- 一个“可手动启用的监控工具”

而不是：

- 一个应用启动即纳管、自动托管当前 gateway 生命周期的系统服务

缺的不是代码风格，而是“接入位点”：

- 没有看到它直接接入当前 app 启动链
- 没有看到它接入 gateway 生命周期的统一状态源
- 没有看到它与当前 direct chat 发送链路形成统一判定闭环

所以它现在并不能替代我们正在修的主链路问题。

### 7.2 超时语义还没真正落地

在 `electron/main/watchdog/watchdog-health-sensing.ts` 里虽然创建了：

- `AbortController`
- `healthCheckTimeoutMs`

但当前 `gatewayHealth()` 调用本身没有接入这个 `signal`，因此：

- 超时参数目前更像“声明了意图”
- 还不是“真的能中止挂死健康检查”

这意味着一旦底层健康检查本身卡住，watchdog 循环可能仍会被拖住。

### 7.3 恢复参数定义了，但还没有全部生效

`watchdog-types.ts` 定义了：

- `maxRecoveryAttempts`
- `recoveryBackoffMs`

但当前服务层没有完整落实这两个阈值策略。

这会带来两个问题：

1. 配置看上去可调，但行为并没有完全受这些参数控制。
2. 后续别人接手时容易误以为恢复节流/重试上限已经全部实现。

### 7.4 熔断半开与恢复失败统计还不够严谨

当前实现里已经有：

- `circuit_open`
- `circuit_half_open`
- 熔断打开/关闭逻辑

但半开状态并没有形成完整的恢复判定闭环；同时，恢复验证失败后的失败计数更新逻辑也还需要再仔细校正，不适合现在直接当作最终可靠性基线。

换句话说：

- 第一版思路是对的
- 但离“生产默认开启”的稳定度还差一轮打磨

### 7.5 状态与事件都是内存态

当前：

- `WatchdogState`
- `eventHistory`

都在内存里维护。

这对于第一版可视化完全够用，但也意味着：

1. 重启应用后状态丢失。
2. 不利于后续问题复盘。
3. 不利于和我们已有的日志 / 诊断体系统一。

这更进一步说明：它适合先作为 feature branch 能力继续长，而不适合现在就作为主线默认依赖。

## 8. 当前项目阶段下，最合理的合并策略

## 8.1 推荐策略

### 第一步：先合低风险通用修复

建议优先吸收：

- `6f5ac4c` (`electron/main/cli.ts`)

原因：

- 对当前 Windows 命令执行稳定性直接有帮助
- 风险小
- 与 watchdog 主体解耦

### 第二步：watchdog 主体先保留为后续 feature 集成

建议暂时不要把 `2da10bf` + `2a67e8a` 直接整包并入主线默认开启，而是：

1. 先保留分支成果
2. 等当前 gateway / direct chat 主链路稳定后再接入
3. 接入时默认先做成：
   - feature flag
   - 默认关闭
   - 开发版/诊断版可开

### 第三步：后续再做“主状态机接入版 watchdog”

后续真正值得并主线的，不只是当前 watchdog UI，而是下面这版：

1. 接入当前 gateway lifecycle controller
2. 接入 direct chat send 失败分类
3. 统一 readiness / health / send 的状态源
4. 自动启动策略可配置
5. 状态/事件落盘
6. 恢复阈值与熔断语义补齐

## 8.2 不推荐策略

不建议：

1. 现在直接把 `origin/hizeys` 整分支一次性 merge 到 `main`
2. 把 watchdog 当成当前 Windows 网关问题的首修项
3. 顺手把未签名构建策略改动一起带入主线

## 9. 对当前项目推进顺序的建议

当前更合理的推进顺序应为：

### P0：先闭掉当前主链路阻塞

优先级最高：

1. 网关启动后 readiness 确认
2. direct chat 第一条消息发送
3. `OpenClaw 2026.3.24` 兼容链路的本地验证

### P1：吸收低风险底层修复

建议直接吸收：

1. Windows `.cmd/.bat/.ps1` shell 执行修复

### P2：整理 watchdog feature 接入计划

主链路稳定后再做：

1. 把 `hizeys` 的 watchdog 主体迁入 feature 分支
2. 对接现有 gateway lifecycle controller
3. 补齐超时/回退/熔断/持久化

### P3：再决定默认启用策略

最后再评估：

1. 是否默认开启 watchdog
2. 是否只在 Windows 先启用
3. 是否作为高级诊断能力暴露给用户

## 10. 最终建议

最终建议非常明确：

### 可以做的

1. **当前项目已具备与 `hizeys` 分支机械合并的条件。**
2. **建议优先吸收 `6f5ac4c` 这类低风险底层修复。**
3. **建议把 watchdog 主体保留为下一阶段 feature 集成，而不是现在整包并主线。**

### 暂时不要做的

1. 不要把 watchdog 当成当前网关主阻塞的首修项。
2. 不要把 `运行构建未签名版本` 这类构建策略提交跟着 watchdog 一起默认并入。
3. 不要在主链路尚未稳定前，就把 watchdog 作为默认依赖能力挂到主线运行路径上。

## 11. 本次评估后的工程结论

一句话归纳：

- `hizeys` 分支**值得保留、值得后续接入**；
- 但它当前最合适的定位是：**Phase 6 看门狗骨架 / 后续 feature 能力**；
- 而不是：**当前 Windows gateway 卡点的直接主修复**。

