# Mclaw 文档审计报告

## 1. 审计目的

本报告用于回答两个问题：

1. 当前仓库里的开发文档是否足够详细，能否直接指导落地开发。
2. 如不够，缺口在哪，应该补哪些文档。

## 2. 审计范围

本次审计覆盖：

1. `dev_guide.md`
2. `docs/mclaw-prd-v1.md`
3. `docs/mclaw-architecture-draft.md`
4. `docs/mclaw-development-roadmap.md`
5. `docs/mclaw-feature-boundary-matrix.md`
6. `dev_log.md`
7. `package.json`
8. `electron-builder.json`
9. `README.md`
10. 关键平台相关代码与脚本

## 3. 总结结论

结论不是“文档不行”，而是：

1. 现有文档已经足够支撑产品方向判断。
2. 但还不足以直接指导跨平台交付执行。
3. 最大缺口集中在 `Windows 适配专项`、`平台验收标准`、`执行级开发顺序` 三个方面。

因此，本次审计后的判断是：

1. 文档体系需要保留。
2. 但必须补齐 Windows 适配计划、审计报告、验收矩阵和更严格的路线图。

## 4. 审计发现

### 4.1 `dev_guide.md` 的作用足够，但不是开发文档

优点：

1. 产品定位清晰。
2. 已确定事项与待确定事项区分清楚。
3. 明确指出一键安装、看门狗、飞书扫码、安全限制是 v1 核心。

不足：

1. 它描述的是产品共识，不是任务拆解。
2. 没有工程级前后依赖关系。
3. 没有平台阻塞项、验收矩阵和实施优先级。

结论：

1. `dev_guide.md` 应继续作为产品共识源。
2. 不能直接替代路线图、架构文档和平台专项文档。

### 4.2 现有 Mclaw 文档方向正确，但细节此前不够

此前文档的主要问题：

1. `mclaw-development-roadmap.md` 有阶段顺序，但没有把 Windows 收口定义为第一阻塞项。
2. `mclaw-prd-v1.md` 有范围定义，但缺少平台交付策略与平台验收矩阵。
3. `mclaw-architecture-draft.md` 有分层设计，但缺少平台兼容层和 Windows 收口清单。
4. `mclaw-feature-boundary-matrix.md` 有范围控制，但缺少“平台底座任务”的边界标注。

### 4.3 代码与文档之间存在“平台状态不对称”

从仓库实际情况看，平台状态是：

1. `electron-builder.json` 已配置 `win.nsis` 目标。
2. `electron/main/cli.ts` 已有较多 Windows 分支。
3. `electron/main/qclaw-update-service.ts` 已声明支持 `win32`。
4. `electron/main/index.ts` 已有 Windows 专属主进程逻辑。
5. 但 `package.json` 只有 `package:mac` / `release:mac` 发布命令。
6. `scripts/check-mac-release-env.mjs` 只面向 macOS。
7. `README.md` 仍把 Windows 标注为“开发中”。

结论：

1. 文档不能再把 Windows 当成“以后再说”。
2. 也不能把 Windows 假定成“已经支持完毕”。
3. 正确表述应是：`Windows 已有基础实现，但交付链路尚未收口`。

## 5. 本次补齐动作

本次已完成以下补齐：

1. 更新 `docs/mclaw-development-roadmap.md`
2. 更新 `docs/mclaw-prd-v1.md`
3. 更新 `docs/mclaw-architecture-draft.md`
4. 更新 `docs/mclaw-feature-boundary-matrix.md`
5. 新增 `docs/mclaw-windows-adaptation-plan.md`
6. 新增本报告 `docs/mclaw-doc-audit.md`
7. 更新 `dev_log.md`

## 6. 现在的文档是否足够详细

当前判断：

1. 对 `开发顺序` 来说，已经达到“可以执行”的程度。
2. 对 `Windows 适配专项` 来说，已经达到“可以开工并验收”的程度。
3. 对 `具体每个模块的实现细节` 来说，后续仍需要随着开发继续追加设计文档与日志。

换句话说：

1. 现在的文档足够指导主线开发。
2. 但并不意味着以后不需要继续补文档。

## 7. 仍需持续维护的文档清单

以下文档必须持续更新：

1. `docs/mclaw-development-roadmap.md`
2. `docs/mclaw-prd-v1.md`
3. `docs/mclaw-architecture-draft.md`
4. `docs/mclaw-feature-boundary-matrix.md`
5. `docs/mclaw-windows-adaptation-plan.md`
6. `dev_log.md`

## 8. 文档更新规则

以下场景发生时，必须先改文档再改代码：

1. 开发顺序发生变化。
2. 平台策略发生变化。
3. Docker 是否进入主线的结论发生变化。
4. v1 / v1.5 / v2 的边界发生变化。
5. 安全、打包、路径、商业化数据结构发生变化。

## 9. 审计后的最终判断

最终判断如下：

1. 当前文档体系已经从“原则型”升级为“执行型”。
2. 当前最优先的下一步不是继续堆新功能，而是按 `Windows 适配专项计划` 进入 `Phase 1`。
3. 只要每次开发后持续更新 `dev_log.md` 和对应专题文档，当前文档体系是够用的。
