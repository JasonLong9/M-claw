# 本地 ReAct、会话记忆和 Skill 发布

在启动 M-claw 的同一个终端设置 `MCLAW_REACT_BASE_URL` 和
`MCLAW_REACT_MODEL`，再执行 `npm run dev`。Base URL 要包含服务的 API
前缀（例如 `http://127.0.0.1:11434/v1`），模型需支持 OpenAI 兼容的
`chat/completions` 工具调用。如需认证，设置 `MCLAW_REACT_API_KEY`。
使用远端模型时，本轮请求和召回的会话上下文会发给指定服务。

在桌面聊天窗口中操作：

1. 输入 `/react 请调用 sort_lines 对这两行排序：\nbanana\napple`（用实际换行输入工具文本），记录回答给出的轨迹 ID。
2. 输入 `/skill draft <轨迹ID> text-demo`，查看生成的 `SKILL.md` 和候选版本 ID。
3. 输入 `/skill evaluate <版本ID>`，核对工具回归结果、候选内容和指纹。
4. 输入 `/skill approve <版本ID> <指纹>`。
5. 输入 `/skill publish <版本ID>`，在配置的 OpenClaw 工作区检查 `skills/mclaw-text-demo/SKILL.md`。在 Skills 页面刷新可查看运行时发现结果。
6. 用另一条实际调用了 `count_characters` 的轨迹生成同名 Skill 的第二版，并评测、审批和发布。随后运行 `/skill rollback <第一版ID>`。

工具限定为排序和 Unicode 字符计数。轨迹记录状态、步数、工具执行状态和步骤间的输入来源，省略原始聊天与参数。新候选保留工具顺序，仅学习成功的、后一步确实使用前一步输出的流程。历史运行需用新版重新跑一遍才能生成这种候选。

可以输入 `/react 先用 sort_lines 排序文本，再把排序后的原样文本交给 count_characters：b\na` 生成两步轨迹（用实际换行）。候选的评测会用含重复行、空行、CRLF 和 Unicode 字符的独立输入回放整个组合。审批后可通过 `/skill run sorted-length <新文本>` 在桌面直接复用已发布的版本。这里验证的是流程回放，OpenClaw 自动选择 Skill 的行为需要单独在实际环境里验证。

聊天记忆首次使用时将旧版 `memory/memories.json` 导入
`memory/memories.sqlite3`。SQLite 文件建立成功后，后续直接读取 SQLite。
成功回复后保存最多三轮问答的截取式摘要，下次聊天按会话取回。
清除本地会话记录时一并删除该摘要。

## 文本附件

在聊天输入框点「添加文本附件」，选择一个 UTF-8 TXT、Markdown、CSV
或 JSON（最大 32 KB），再输入问题。附件随本轮问题发给 ReAct 配置的
模型服务。附件正文不写入会话记录或记忆摘要。带附件的回合仅开放应用内
文本工具。

## 麦克风输入

启动 M-claw 前设置 `MCLAW_VOICE_BASE_URL`，例如
`http://127.0.0.1:9000/v1`。服务需要提供 OpenAI 兼容的
`POST /audio/transcriptions`，并接受 WebM/Opus 或 MP4。模型可通过
`MCLAW_VOICE_MODEL` 配置（默认 `whisper-1`），需要认证时设置
`MCLAW_VOICE_API_KEY`。重启应用后，在聊天框点「麦克风」，允许系统权限，
录完点「停止录音」。转写追加到消息草稿，可以编辑后发送。

单次录音最多 60 秒或 3 MB。转写失败可重试或丢弃录音。停止录音后，
音频会发送到以上配置的服务；取消录音会丢弃音频。应用不将录音写入磁盘。
客户端等待转写最多 120 秒。

已有 faster-whisper 本地模型时，可以在安装了
`fastapi`、`uvicorn`、`python-multipart` 和 `faster-whisper` 的
Python 环境中启动本机服务：

```powershell
python scripts/voice-transcription-server.py --model-dir 'D:\faster-whisper-large-v3'
```

随后在另一个终端设置 `$env:MCLAW_VOICE_BASE_URL = 'http://127.0.0.1:9000/v1'`
并启动 M-claw。该本机服务使用 CPU 推理，模型别名为 `whisper-1`。
如果旧版 CTranslate2 导入时报缺少 `pkg_resources`，在语音服务的
Python 环境中安装 `setuptools==80.9.0` 后重试。

## MCP 工具

在启动 M-claw 的终端设置 `MCLAW_MCP_URL`（Streamable HTTP 服务端点）
和 `MCLAW_MCP_TOOLS`（逗号分隔的确定工具名）。需要 Bearer 认证时设置
`MCLAW_MCP_TOKEN`。然后输入 `/react <任务>`。应用按配置发现工具，
以 `mcp_` 前缀暴露给模型，通过 MCP 调用原始工具名称，将返回文本送回
模型，并在轨迹中记录工具名称和结果状态。

验证命令：

```powershell
npm run typecheck
npx vitest run electron/main/__tests__/mcp-chat-files.test.ts electron/main/__tests__/local-agent-skill-release.test.ts electron/main/__tests__/chat-memory-store.test.ts electron/main/__tests__/chat-memory-integration.test.ts
```
