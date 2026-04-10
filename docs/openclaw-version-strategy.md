# OpenClaw 版本策略（2026-04-08）

## 1. 背景

当前关于 OpenClaw 版本，仓库内外已经出现三条同时存在的事实：

1. 当前仓库代码、文档、测试与 bundled runtime 示例，仍统一围绕 `2026.3.24` 设计。
2. 外部对接口径最近出现了两种新版本说法：
   - 先前内部讨论提到 `2026.4.6`
   - `2026-04-08` 聊天记录里又提到 `4.7`
3. 当前仓库收到的 `mac-openclaw-runtime/darwin-arm64-official-runtime/openclaw-darwin-arm64.tar.gz` 文件名本身不带版本号，因此不能只靠文件名认定它就是 `2026.4.6` 或 `2026.4.7`。

因此，在未拿到候选包的精确 `openclaw --version` 输出前，文档统一把这条外部新版本线记为：

- `2026.4.x` 候选线

## 2. 当前项目阶段

截至 `2026-04-09`，Mclaw 已完成 `win32-x64 + darwin-arm64` 主线路径的 `Phase 2` 退出前置，但版本策略仍保持不变：

1. `darwin-arm64` runtime 已验收并进入主线 bundled-runtime。
2. `darwin-x64` 已进入当前 bundled-runtime 主线；后续仅在替换包体或评估 `2026.4.x` 候选线时重新打开 intake。
3. 当前代码中的版本门禁、安装 fallback、upgrade service、Update Center、测试断言，都仍以 `2026.3.24` 作为 pinned baseline。
4. 当前代码虽然已经具备 OpenClaw 受控升级/回退骨架，但该能力也是围绕 `2026.3.24` 审计出来的，不等于已经准备好直接切到 `2026.4.x`。

## 3. 与后续能力的关系

外部反馈认为 `2026.4.x` 最近两个大版本主要补强了：

1. 记忆模块。
2. Agent 之间的沟通能力。

这两类变化对 Mclaw 后续规划确实重要，因为 Mclaw 后面还要做：

1. `Claude Code（claudecode）` 集成。
2. `MemOS / memos` 上下文记忆能力集成。
3. OpenClaw 运行时的受控升级能力。

但这里要明确一点：

1. `MemOS / memos` 不是单纯“换个 CLI 版本”就结束，它会直接影响记忆目录、备份/恢复、回退与清理语义。
2. `Claude Code` 也不是单纯“命令能跑起来”就结束，它还会影响 exec 权限边界、Agent 编排、工具白名单与运行时行为预期。
3. 所以 `2026.4.x` 的价值是真实存在的，但它更适合作为下一阶段迁移目标，而不是当前 `Phase 2` 直接改基线的理由。

## 4. 当前决策

当前版本策略统一为：

1. `2026.3.24` 继续作为当前 v1 / `Phase 2` 的主线交付基线。
2. 外部 `2026.4.6` / `2026.4.7` 统一先按 `2026.4.x` 候选线管理。
3. `2026.4.x` 当前只进入候选兼容评估，不直接替换主线 pinned version。

同时统一一个非常关键的口径：

1. `Mclaw 应用自动更新` 仍延后到 `v1.5`。
2. `OpenClaw 受控升级 / 回退` 不延后，它属于当前主线能力的一部分，用于版本门禁、升级纠偏和未来 `2026.3.24 -> 2026.4.x` 的平滑迁移。

## 5. 为什么现在不直接切到 2026.4.x

当前不直接切到 `2026.4.x`，原因不是“新版本不好”，而是项目时机不对：

1. 当前仓库已经完成 `win32-x64 + darwin-arm64` 主线路径的 `Phase 2` 退出前置。
2. 当前代码、文档、测试、fallback 命令与 bundled manifest 全部围绕 `2026.3.24` 审计，直接切换会引发系统性基线迁移。
3. 当前 upgrade service 把 `2026.3.24` 作为安全目标版本；若现在改 baseline，就要同步重做升级、回退、manual hint、备份与 smoke 基线。
4. 虽然 `darwin-x64` 已完成同等级 runtime 接入，但 `2026.4.x` 候选线仍未完成完整迁移验证，因此当前仍不适合直接改主线。
5. 如果现在为了记忆模块和 Agent 协同能力强行切主线，风险会从“补功能”升级为“打断当前交付主线”。

## 6. 后续开发路线

### A. 当前主线继续做什么

当前主线继续按 `2026.3.24` 推进：

1. 继续完成 `Windows runtime-first` 收口与 `EnvCheck` 主流程收口。
2. 继续保留并完善 `OpenClaw 受控升级 / 回退` 能力。
3. 完成 runtime、manifest、文案、状态提示、smoke 基线的当前版本闭环。

### B. 2026.4.x 候选线要做什么

`2026.4.x` 不闲置，但只做候选兼容审计：

1. 确认精确版本号，以 `openclaw --version` 为准，而不是口头说法。
2. 跑候选报告、manifest 预览与 runtime probe。
3. 对比记忆模块的数据目录、迁移方式、备份/恢复影响。
4. 对比 Agent 协同变化对 `Claude Code` 编排接入的影响。
5. 评估从 `2026.3.24` 升到 `2026.4.x` 的最小迁移窗口与回退策略。
6. 每次候选迁移前先执行：
   - `npm run report:openclaw:migration-smoke -- --from 2026.3.24 --to <候选真实版本>`
   - 若同时拿到候选 runtime，再追加 `--runtime-dir ... --runtime-version <候选真实版本>`
   用统一输出确认：
   - `migrationPath`
   - `requiresConservativeMode`
   - `memoryAuditRequired`
   - `agentAuditRequired`
   - `runtimeCheck.intakeDecision`

建议配套文档入口：

1. 迁移 smoke 执行顺序：
   - [openclaw-upgrade-migration-smoke-runbook.md](./openclaw-upgrade-migration-smoke-runbook.md)
2. `darwin-x64` 候选 runtime 收包时：
   - [darwin-x64-runtime-request-message-template.md](./darwin-x64-runtime-request-message-template.md)
   - [darwin-x64-runtime-handoff.md](./darwin-x64-runtime-handoff.md)
   - [darwin-x64-runtime-receipt-checklist.md](./darwin-x64-runtime-receipt-checklist.md)
   - [darwin-x64-runtime-intake-command-sheet.md](./darwin-x64-runtime-intake-command-sheet.md)

## 7. 2026.4.x 允许升主线的条件

只有以下条件同时满足，才允许讨论把 `2026.4.x` 升为主线：

1. 候选包的精确版本号已经确认，不再停留在 `2026.4.6` / `2026.4.7` 的口头混用阶段。
2. 至少完成一轮可信的 runtime candidate report、probe 与 `--version` 复验。
3. `MemOS / memos` 相关的记忆目录、备份、恢复、回退语义已经明确。
4. `Claude Code` 接入所依赖的 OpenClaw 行为边界已经明确。
5. OpenClaw 升级服务已经补齐从 `2026.3.24` 迁到 `2026.4.x` 的 smoke 与回退审计。
6. 候选迁移 smoke 报告与 runtime intake 报告已经能形成同一条执行链，而不是继续依赖口头判断。

## 8. 当前一句话结论

当前版本选择只有一句话：

1. 主线继续锁定 `2026.3.24`，把 `2026.4.x` 作为 `Claude Code / MemOS` 前置兼容评估线，而不是现在就直接替换主线。
