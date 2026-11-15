# Mclaw 接手说明

最后更新：2026-06-07

这份文档是写给接手 Mclaw 项目的同事看的。

目标只有一个：你拿到项目和安装包后，不需要先追问历史背景，也能在较短时间内把项目跑起来、知道重点在哪里、知道先做什么、知道问题该怎么排。

默认你会同时拿到两样东西：

1. 项目代码仓库
2. 当前可用的 Windows 安装包 / 目录包

这份文档建议你从头顺着看一遍，至少先完成第 1 章到第 6 章里的动作，再开始正式改代码。

---

## 1. 你接手的到底是什么

Mclaw 不是普通的前端项目，也不是单纯的 Electron 壳。

你接手的是一个桌面集成项目，里面同时包含：

1. React 前端页面
2. Electron 主进程
3. preload 桥接
4. OpenClaw 配置与运行时管理
5. 个人微信 IM 渠道接入
6. Skills 安全巡检与处置
7. Windows 打包与交付链路

最重要的认知先放在前面：

1. 很多问题不在前端页面，而在配置路径、状态目录、Gateway、插件生命周期。
2. “页面显示成功”不代表“真实运行成功”。
3. 这个项目后续维护的难点不只是写代码，而是保证运行时、配置和打包产物一致。

如果你只把它当成一个 React 项目看，后面会很难排查问题。

---

## 2. 当前项目状态

截至你接手时，项目状态如下：

1. 个人微信 IM 渠道当前已通过
2. 个人微信配置收尾问题已经过多轮修复
3. Skills 管理页已经重构成更适合小白用户的布局
4. Skills 页已经带有“一键修复向导”
5. Windows 目录包和 Windows 安装包都已经能够生成

最近一版可交付产物参考：

1. 安装包：`release/2026.6.7-v13/Mclaw_2026.6.7-v13.exe`
2. 目录包：`release/2026.6.7-v13/win-unpacked/`

当前发布性质：

1. 这是开发构建，不是正式签名版
2. 更适合内部测试和手动交付
3. 正式外发前还需要确认签名、更新源、安装回归

---

## 3. 你第一天必须完成的事情

不要先改代码。先确认你能把项目完整跑通。

### 3.1 安装依赖

```powershell
npm install
```

### 3.2 类型检查

```powershell
npm run typecheck
```

### 3.3 跑测试

```powershell
npm test
```

### 3.4 启动开发环境

```powershell
npm run dev
```

你应该看到：

1. Electron 窗口正常启动
2. 欢迎页能打开
3. 渠道页能打开
4. Skills 页能打开
5. 聊天页能打开

### 3.5 打 Windows 目录包

```powershell
npm run package:win:dir
```

### 3.6 打 Windows 安装包

```powershell
npm run package:win
```

如果你在第一天做不到这些，建议不要急着接正式需求，先把环境打通。

---

## 4. 仓库结构怎么理解

你不需要一次看完所有代码，但必须先知道代码大致分在哪几层。

### 4.1 前端页面

目录：

```text
src/pages/
```

这里放页面级逻辑。

最值得先看的页面：

1. `src/pages/ChannelConnect.tsx`
2. `src/pages/SkillsPage.tsx`
3. `src/pages/Dashboard.tsx`
4. `src/pages/ChatPage.tsx`
5. `src/pages/GatewayBootstrapGate.tsx`

### 4.2 前端组件

目录：

```text
src/components/
```

这里放复用组件、对话框、卡片、面板。

最值得先看的组件：

1. `src/components/skills/SkillsSecurityPanel.tsx`
2. `src/components/dashboard/`
3. `src/components/ChannelConfigModalShell.tsx`

### 4.3 Electron 主进程

目录：

```text
electron/main/
```

这里是项目真正复杂的地方。很多看上去是“前端问题”的问题，最后都要到这里排。

这里主要负责：

1. 读写配置文件
2. 管理 OpenClaw 运行时
3. 管理 Gateway
4. 管理 managed plugin
5. 管理安装器、诊断、安全巡检

最值得先看的文件：

1. `electron/main/ipc-handlers.ts`
2. `electron/main/managed-channel-plugin-lifecycle.ts`
3. `electron/main/openclaw-config-coordinator.ts`
4. `electron/main/openclaw-config-guard.ts`
5. `electron/main/openclaw-gateway-service.ts`
6. `electron/main/weixin-installer-session.ts`
7. `electron/main/weixin-account-state.ts`
8. `electron/main/security/`

### 4.4 preload 桥接

目录：

```text
electron/preload/
```

关键文件：

1. `electron/preload/index.ts`

你可以把它理解成前端和主进程之间的 API 暴露层。

通常你新增一个主进程能力时，至少要同时改：

1. `electron/main/ipc-handlers.ts`
2. `electron/preload/index.ts`
3. `src/types/electron.d.ts`

### 4.5 打包资源

关键目录：

1. `resources/openclaw-bundle/`
2. `resources/dev-tools-bundle/`
3. `resources/security/`

它们不是普通静态资源，而是最终安装包要带走的关键能力资源。

### 4.6 打包脚本

关键脚本：

1. `scripts/run-electron-builder.mjs`
2. `scripts/check-win-release-env.mjs`
3. `scripts/check-win-packaged-openclaw-bundle.mjs`
4. `scripts/check-windows-dev-tools-bundle.mjs`

---

## 5. 你现在最应该先理解的三条主链路

你不需要先理解全部业务，但必须先把下面三条主链路建立起来。

## 5.1 个人微信 IM

### 它解决什么问题

用户在 Mclaw 里配置个人微信渠道、扫码登录、账号落盘、最终通过 Gateway 和 managed plugin 收发消息。

### 你应该先看哪些文件

1. `src/pages/ChannelConnect.tsx`
2. `electron/main/weixin-installer-session.ts`
3. `electron/main/weixin-account-state.ts`
4. `electron/main/managed-channel-plugin-lifecycle.ts`
5. `electron/main/ipc-handlers.ts`
6. `electron/preload/index.ts`
7. `src/types/electron.d.ts`
8. `resources/openclaw-bundle/managed-plugins/openclaw-weixin/`

### 这里最容易踩的坑

个人微信相关问题很多都不是“扫码失败”这么简单，常见根因包括：

1. 配置路径写错了
2. active candidate 没透传
3. 安装器写入的是一套目录，Mclaw 读的是另一套目录
4. Gateway 实际可用，但 ready 探针误判
5. 账号看起来登录成功，但没有真正写入目标配置

### 如果你之后遇到“微信连不上”，先怎么排

按这个顺序排，不要跳：

1. 先看前端报错停在哪一步
2. 再看目标配置路径到底是什么
3. 再看 active candidate 是否正确
4. 再看 `channels.openclaw-weixin.accounts` 是否真实存在
5. 再看 Gateway 是否已经运行
6. 最后才看 ready 探针和 repair 逻辑

你如果反过来排，通常会浪费很多时间。

---

## 5.2 Skills 安全管理

### 它解决什么问题

让用户知道当前 Skills 风险、运行巡检、处理高风险技能、管理豁免，并尽量用用户能理解的方式完成这些事。

### 你应该先看哪些文件

1. `src/pages/SkillsPage.tsx`
2. `src/components/skills/SkillsSecurityPanel.tsx`
3. `src/pages/skills-security-feedback.ts`
4. `electron/main/security/`
5. `resources/security/`

### 当前页面是什么形态

Skills 页面现在不是简单的数据表，而是一个面向普通用户的管理页面，包含：

1. 风险概览
2. 推荐操作
3. 小白操作建议
4. 最近风险事件
5. 高级管理分栏
6. 一键修复向导

### 你后续开发时要注意什么

1. 不要轻易把页面做回“工程视角表格”
2. 尽量保持“小白用户能看懂下一步该点什么”
3. 优先保持前后端数据契约稳定
4. 新增安全能力时，先补主进程和类型，再补前端

---

## 5.3 OpenClaw 配置 / Gateway / Candidate

### 为什么这一块重要

这个项目不是只写配置文件，而是要保证：

1. 配置写对地方
2. Gateway 读的是对的配置
3. stateRoot 一致
4. managed plugin 生命周期一致
5. 打包出来后用户机上仍然成立

### 你应该先看哪些文件

1. `electron/main/openclaw-config-coordinator.ts`
2. `electron/main/openclaw-config-guard.ts`
3. `electron/main/openclaw-gateway-service.ts`
4. `electron/main/managed-channel-plugin-lifecycle.ts`
5. `src/pages/ChannelConnect.tsx`

### 哪些改动必须慎重

下面这些改动属于高风险改动，做之前先完整审查链路：

1. 改配置文件路径
2. 改 stateRoot
3. 改 candidate 选择逻辑
4. 改 Gateway ready 判定
5. 改 plugin repair 逻辑

---

## 6. 打包和交付你应该怎么理解

### 6.1 常用命令

日常自检：

```powershell
npm run typecheck
npm test
```

Windows 目录包：

```powershell
npm run package:win:dir
```

Windows 安装包：

```powershell
npm run package:win
```

### 6.2 产物在哪里

位于：

```text
release/<版本号>/
```

你通常会看到：

1. `win-unpacked/`
2. `Mclaw_<版本号>.exe`
3. `.blockmap`

### 6.3 为什么这个项目打包不能想当然

这个项目打包依赖的不只是 `dist` 和 `dist-electron`，还依赖：

1. `openclaw-bundle`
2. `dev-tools-bundle`
3. runtime 资源
4. Windows 相关的打包基础资源

如果你只把它当普通 Electron 项目处理，很容易打出一个“能装但不能用”的包。

### 6.4 给用户的包要注意什么

发给用户前，必须确认：

1. 不带开发机用户数据
2. 不带临时缓存
3. 不带本地调试目录
4. OpenClaw bundle 资源完整
5. dev-tools bundle 资源完整
6. 至少在干净环境验证一次安装或启动

---

## 7. 你接手后最容易遇到的坑

## 7.1 中文乱码

历史上出现过 PowerShell 重定向导致中文文件乱码。

建议你：

1. 不要用不受控方式批量改中文文件
2. 改中文文案后一定要实际打开页面看
3. 尽量用可靠编辑器或受控 patch 修改

## 7.2 工作区脏改动

这个项目很容易同时存在很多改动。

建议你：

1. 提交前先看 `git status`
2. 先区分“你这轮改动”和“历史遗留改动”
3. 不要在没核实的情况下直接全量提交

## 7.3 打包资源污染

常见高风险目录包括：

1. `release/`
2. `.tmp/`
3. `electron-dist/`
4. `nsis-dist/`
5. `resources/dev-tools-bundle/`
6. `node-v24.14.1-win-x64/`
7. `mac-openclaw-runtime/`

这些目录不是都应该进仓库，也不是都应该进安装包。

## 7.4 配置一致性误判

必须牢牢记住：

1. 前端显示成功，不代表真实成功
2. 真实结果取决于配置写到了哪里
3. Gateway 实际读的是哪个配置
4. managed plugin 实际跑的是哪个 stateRoot

---

## 8. 如果你准备继续开发，建议按这个顺序做

不要一上来就接复杂需求。

### 第一步

先完成：

1. `npm install`
2. `npm run typecheck`
3. `npm test`
4. `npm run dev`
5. `npm run package:win:dir`
6. `npm run package:win`

### 第二步

完整读一遍这份文档，然后重点通读三块：

1. 个人微信 IM 相关文件
2. Skills 安全管理相关文件
3. OpenClaw / Gateway / candidate 相关文件

### 第三步

自己做一个小改动，建议从下面选一个：

1. 改一个 UI 文案
2. 补一个小测试
3. 调整 Skills 页一个小交互
4. 跑一次打包并验证产物

### 第四步

再去接正式需求。

如果你跳过前面三步，后面遇到集成问题会很被动。

---

## 9. 建议你第一周完成的事情

为了让你不是“看过文档但没真正接住项目”，建议第一周最少完成：

1. 独立把项目跑起来
2. 独立打出 Windows 安装包
3. 独立走通一次个人微信 IM 配置流程
4. 独立检查一次 Skills 页主流程
5. 自己提交一次小改动
6. 输出一版“接手后发现的问题清单”

---

## 10. 你在组内应该找谁协同

这部分交接时需要由交出方补齐，你拿到文档后建议第一时间填上。

### 10.1 建议明确的角色

1. 主开发负责人
2. 稳定性维护负责人
3. 打包发布负责人
4. 技术兜底负责人
5. 测试对接人
6. 产品/需求对接人

### 10.2 你遇到问题时的升级顺序建议

1. 普通 UI 问题
   - 自己先处理
2. 个人微信 IM 链路问题
   - 优先找主开发负责人或历史维护人
3. 打包失败 / 产物异常
   - 优先找打包发布负责人
4. 路径、Gateway、candidate 复杂问题
   - 拉技术兜底负责人一起看

---

## 11. 你应该持续记录什么

你后续维护时，建议每次值得保留的问题都记录下来。

建议至少记录：

1. 现象
2. 影响范围
3. 根因
4. 修改文件
5. 回归验证方法
6. 是否补了自动化测试

建议记录到：

1. `docs/dev_log.md`

记录时尽量按“问题 - 根因 - 修复 - 验证”的顺序写，不要只写流水账。

---

## 12. 你接手完成的最低标准

如果你满足下面这些，就可以认为你已经基本接住这个项目：

1. 你能独立运行项目
2. 你能独立跑测试
3. 你能独立打 Windows 目录包和安装包
4. 你知道个人微信 IM 主链路怎么排查
5. 你知道 Skills 页主链路在哪
6. 你知道 OpenClaw / Gateway / candidate 为什么是高风险区
7. 你已经亲手改过一次小问题并验证过

---

## 13. 最后给你的建议

这个项目真正难的不是代码量，而是“运行时、配置、插件、打包、用户侧行为”是连在一起的。

所以你接手后最重要的不是立刻写很多新功能，而是尽快建立下面三种能力：

1. 看到问题后，知道先查哪一层
2. 改完代码后，知道应该怎么验证
3. 打包给别人前，知道怎么确认没有把开发遗留数据带进去

如果你把这三件事掌握了，后面继续维护这个项目就会顺很多。
