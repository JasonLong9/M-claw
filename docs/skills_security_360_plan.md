# Skills 安全增强方案（对齐 360 机制）

更新时间：2026-05-18  
负责人：当前主线  
状态规则：`pending` / `in_progress` / `completed`

## 目标

将当前 Skills 安全能力从“安装准入 + 基础处置”升级为“安装前检测 + 运行时检测 + 持续巡检 + 自动化处置 + 可视化运营”的闭环体系。

---

## P0 基线能力（已完成）

状态：`completed`

- [x] 白名单 + 来源限制
- [x] 白名单完整性校验
- [x] trust 签名校验
- [x] 多 key / 多签名轮换
- [x] 运行时风险累计与自动禁用
- [x] 审计日志与导出
- [x] 安全拦截用户可读提示

---

## P1 安装前双引擎检测（优先级最高）

状态：`in_progress`

### P1.1 静态扫描引擎
- [ ] 提供 `skills:scan-one`（输入：slug/path/source）
- [ ] 提供 `skills:scan-all`（扫描已安装 skills）
- [ ] 规则分级：`low/medium/high/critical`
- [ ] 规则样例：命令执行、动态执行、外网访问、敏感路径、敏感环境变量

### P1.2 动态沙箱（轻量）
- [ ] 受限运行（超时、资源限制、禁高危系统调用）
- [ ] 采集行为轨迹（文件、网络、子进程）
- [ ] 形成动态行为风险分

### P1.3 安装前合并判定
- [ ] 安装前执行“策略校验 + 静态扫描 +（可选）动态沙箱”
- [ ] 产出统一风险判定：`allow / warn / block`
- [ ] 产出用户可读原因与建议动作

验收标准：
- [ ] 非白名单与高危命中稳定阻断
- [ ] 扫描报告可查询、可导出

---

## P2 持续巡检与差异检测

状态：`pending`

- [ ] 周期巡检任务（默认每日，可手动触发）
- [ ] 增量对比（与上次结果对比新增风险）
- [ ] 配置漂移检测（策略/依赖/行为模式变化）
- [ ] 巡检结果入审计和风险总览

验收标准：
- [ ] 能识别“已安装后新增风险”
- [ ] 能给出差异报告与趋势

---

## P3 自动化处置编排

状态：`pending`

- [ ] 分级动作链：
  - `low`：告警
  - `medium`：限制能力（按 capability）
  - `high/critical`：自动禁用 + 隔离 + 记录
- [ ] 支持恢复流程（人工确认后恢复）
- [ ] 保留处置链路审计（谁、何时、为何）

验收标准：
- [ ] 高风险能自动处置，且支持可控恢复

---

## P4 安全运营体验（用户体验重点）

状态：`pending`

- [ ] Skills 页面安全面板（总览、风险、禁用、建议）
- [ ] 单 Skill 风险详情（命中规则、证据、时间线）
- [ ] 一键操作：重扫、禁用、恢复、导出
- [ ] 误报豁免（带过期时间与审批注释）

验收标准：
- [ ] 用户能看懂“为何被拦截、下一步做什么”

---

## 执行节奏

1. 先完成 `P1` 并标记 `completed`。  
2. 自动推进到 `P2`，每完成一个 P 在本文更新状态与勾选项。  
3. 每次推进同步更新 `docs/dev_log.md`。  
## Progress 2026-05-18 (P1.1)

Status:
- P1: `in_progress`
- P1.1: `completed`

Completed:
- [x] `skills:scan-one` IPC
- [x] `skills:scan-all` IPC
- [x] `skills:scan-report` IPC
- [x] static severity levels (`low/medium/high/critical`) and risk scoring
- [x] rule coverage: command execution / dynamic eval / network / sensitive env / file IO
