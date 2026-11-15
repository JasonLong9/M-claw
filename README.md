# M-claw

[English](README.en.md)

M-claw 是一款用于配置和管理 OpenClaw 的桌面应用。项目基于 [Qclaw](https://github.com/qiuzhi2046/Qclaw) 开发，由 [JasonLong9](https://github.com/JasonLong9) 担任主要开发者。

## 功能

- 检测 Node.js 和 OpenClaw CLI 环境，导入已有的 OpenClaw 配置。
- 配置模型服务与自定义模型，管理 Skills 和消息渠道。
- 查看 OpenClaw Gateway 状态，在桌面端重启网关并排查故障。
- 备份本地配置和数据。

首次使用时，在客户端完成环境检测，按需导入已有配置，然后选择模型服务。消息渠道可以在需要时接入。

## 本地工具调用、记忆与 Skill 发布

在聊天窗口使用 `/react` 可运行应用内的模型决策、工具调用和结果反馈循环，支持步数上限、超时与失败重试。配置方式和演示步骤见 [本地 ReAct 与 Skills](docs/local-react-and-skills.md)。

会话记忆使用 SQLite 持久化，并支持导入旧 JSON 数据。Skill 流程支持从成功的文本工具轨迹生成候选、回归评测、按内容指纹审批、发布与回滚。目前可复用的流程覆盖文本排序和 Unicode 字符计数。MCP 工具接入、文本附件和麦克风转写的配置也在上述文档中。

## 技术架构

- **渲染进程（React + TypeScript）**负责界面、配置交互和状态展示。
- **预加载脚本与 IPC**为渲染进程提供调用主进程功能的接口。
- **主进程（Electron + Node.js）**负责环境检测、配置读写、进程管理和 OpenClaw CLI 调用。
- **OpenClaw CLI / Gateway**提供底层 Agent 运行与服务接入能力。

## M-claw 开发工作

JasonLong9 主导开发中的两项改动：

- **聊天记忆**。支持分别保存全局偏好与当前会话记忆，并在发送消息时将相关记忆传给 OpenClaw。见 [聊天记忆提交](https://github.com/JasonLong9/M-claw/commit/cb7a7daf278e9b96f4c7a9967810298237a121b6)。
- **Windows 网关启动**。调整 Gateway 子进程的启动方式，避免后台启动时弹出独立控制台窗口。见 [网关启动提交](https://github.com/JasonLong9/M-claw/commit/05df9e297e4d6eba24e56008fd2a2b5c3d308334)。

本仓库包含 OpenClaw 运行时打包、迁移与交付相关的校验脚本。脚本定义见 [package.json](package.json)。

| 命令 | 用途 |
| --- | --- |
| `npm run check:openclaw:bundle:strict` | 校验打包所需的 OpenClaw 运行时文件 |
| `npm run report:openclaw:migration-smoke` | 生成运行时迁移的冒烟检查报告 |
| `npm run check:win:artifact:bundle` | 检查 Windows 打包产物中的 OpenClaw 运行时 |

## 本地开发

推荐使用 Node.js 24 和 npm。

```bash
git clone https://github.com/JasonLong9/M-claw.git
cd M-claw
npm install
npm run dev
```

| 命令 | 用途 |
| --- | --- |
| `npm run build:app` | 编译并构建应用 |
| `npm run build` | 构建并打包应用 |
| `npm test` | 运行测试 |
| `npm run typecheck` | 执行 TypeScript 类型检查 |

平台打包脚本和配置见 [package.json](package.json) 与 [electron-builder.json](electron-builder.json)。

## 开源来源与许可

- [Qclaw](https://github.com/qiuzhi2046/Qclaw) 是 M-claw 的上游桌面应用，采用 Apache-2.0 许可。
- [OpenClaw](https://github.com/openclaw/openclaw) 提供 Agent 运行时及工具生态，采用 MIT 许可。

本仓库的许可见 [LICENSE](LICENSE)，Qclaw 的版权与归属声明见 [NOTICE](NOTICE)。第三方组件和资源适用各自的许可。

M-claw 对上游 README 的项目说明和开发指引做了调整。感谢秋芝2046、Qclaw 贡献者以及 OpenClaw、Electron、React、Vite 和 Mantine 等开源项目。

欢迎通过 [M-claw Issues](https://github.com/JasonLong9/M-claw/issues) 报告问题或提出建议。
