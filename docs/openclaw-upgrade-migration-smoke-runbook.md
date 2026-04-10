# OpenClaw 升级迁移 Smoke Runbook

## 1. 适用场景

这份 runbook 用于在以下场景下，快速判断一次 OpenClaw 版本迁移是否已经具备最小 smoke 条件：

1. 从当前主线 `2026.3.24` 升到 `2026.4.x` 候选线。
2. 从 `2026.4.x` 候选线回退到当前 pinned baseline。
3. 在 `2026.3.22 ~ 2026.3.24` pin window 内做受支持升级/回退。

它不是最终发布验收清单，而是“迁移前先做一次统一诊断”的执行入口。

## 2. 命令入口

基础命令：

```bash
npm run report:openclaw:migration-smoke -- --from 2026.3.24 --to 2026.4.6
```

如果手里同时拿到了候选 runtime 目录，再补 runtime intake 结果：

```bash
npm run report:openclaw:migration-smoke -- --from 2026.3.24 --to 2026.4.6 --runtime-dir resources/openclaw-bundle/runtime/darwin-arm64 --runtime-version 2026.4.6
```

## 3. 输出重点

重点关注以下字段：

1. `migrationPath=...`
   - `steady-pinned`
   - `in-range-upgrade`
   - `in-range-downgrade`
   - `candidate-upgrade`
   - `rollback-to-pinned`
   - `unsupported-path`
2. `needsBaselineBackup=yes/no`
3. `requiresConservativeMode=yes/no`
4. `requiresRuntimeCandidateProof=yes/no`
5. `memoryAuditRequired=yes/no`
6. `agentAuditRequired=yes/no`
7. `recommendedChecks=`

若带了 `--runtime-dir`，还要同时关注：

1. `runtimeCheck.intakeDecision=...`
2. `runtimeCheck.packageVersion=...`
3. `runtimeCheck.notes.sourceVersion=...`
4. `runtimeCheck.notes.copiedVersion=...`

## 4. 结果解释

### A. `candidate-upgrade`

表示目标版本属于 `2026.4.x` 候选线。

本轮至少要额外完成：

1. baseline backup 留档。
2. doctor 自检与 `doctor --fix` 优先级确认。
3. 记忆目录 / 备份 / 恢复语义审计。
4. Agent 协同与 `Claude Code / memos` 前置验证。
5. 回退演练。

### B. `rollback-to-pinned`

表示当前版本高于 pinned baseline，本轮目标是回退到 `2026.3.24`。

本轮至少要确认：

1. 最终版本回到 pinned baseline。
2. 回退后 gateway 可重新启动。
3. `report:openclaw:bundle` 与 `check:openclaw:phase2-exit` 仍保持主线就绪。

### C. `unsupported-path`

表示当前路径不建议直接在产品内一次完成。

处理原则：

1. 先拆出中间受支持版本。
2. 不直接宣称这条路径已可自动升级。
3. 先补回退与迁移说明，再进入真机 smoke。

## 5. 建议执行顺序

1. 先跑迁移 smoke 报告。
2. 若涉及候选 runtime，再跑：
   - `report:openclaw:runtime-candidate`
   - `probe:openclaw:runtime`
   - `preview:openclaw:manifest-runtime --runtime-check ...`
3. 若涉及产品内升级链，再看：
   - `OpenClawUpgradeDialog`
   - `checkOpenClawUpgrade`
   - `runOpenClawUpgrade`
   当前升级弹窗与组合更新弹窗也已开始展示 migration smoke 摘要，用于在执行前直接提醒：
   - 当前迁移路径
   - 是否需要 baseline backup
   - 是否需要记忆目录 / Agent 协同审计
4. `EnvCheck` 主流程现在也会展示 migration smoke 摘要，用于在真正进入控制面板前，先提示当前版本迁移仍需关注的风险。
5. `doctor / runtime reconcile` 的兼容摘要也已开始带出 migration smoke 关键信息，便于在主进程诊断口径里统一看到：
   - 当前迁移路径
   - baseline backup 要求
   - 记忆目录 / Agent 协同审计要求
6. 最后补：
   - baseline backup 记录
   - doctor 自检/修复记录
   - 回退演练记录

## 6. 当前项目中的建议用法

截至 `2026-04-09`，当前最值得先跑的两条路径是：

1. `2026.3.24 -> 2026.4.x`
   - 用于评估 `Claude Code / memos` 所需的候选迁移门槛。
2. `2026.4.x -> 2026.3.24`
   - 用于确认未来候选试点失败时，是否能安全回到当前主线。
3. `darwin-x64` 候选 runtime 到包时：
   - 先跑 `report:openclaw:runtime-candidate / probe / preview`
   - 再跑 `report:openclaw:migration-smoke`
   - 用于判断 `Intel Mac` 线是直接接主线，还是只保留为 `2026.4.x` candidate 验证样本。
