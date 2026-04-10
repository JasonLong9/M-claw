# darwin-x64 Runtime 对外消息模板

## 1. 用途

这份文档用于在项目侧需要向 `Intel Mac` 同事索取 `darwin-x64` runtime 时，直接复制发送。

目标：

1. 减少临时口头解释
2. 降低对方误发 `tgz` / 零散文件 / 不完整目录的概率
3. 让对方直接按统一说明执行

## 2. 推荐短消息模板

适合 IM 里直接发：

```text
我们这边需要一份 Intel Mac 可运行的 OpenClaw runtime，用来补 Mclaw 的 darwin-x64 内置本体。

请帮忙在一台已经能正常运行 OpenClaw 的 Intel Mac（uname -m = x86_64）上，按这份说明导出并回传：
1. darwin-x64-openclaw-<version>.tar.gz
2. darwin-x64-runtime-notes.txt

说明文档：
docs/darwin-x64-runtime-handoff.md

请注意：
- 不要只发 openclaw-*.tgz
- 不要只发启动脚本或 package.json
- 最终必须能证明来源机和导出目录都执行过 --version

如果执行脚本报错，把完整报错、command -v openclaw、openclaw --version 一起发回即可。
```

## 3. 推荐长消息模板

适合第一次正式发起请求时直接发：

```text
我们这边现在在补 Mclaw 的 darwin-x64（Intel Mac）OpenClaw runtime，需要你帮忙从一台已经能正常运行 OpenClaw 的 Intel Mac 上导出一份真实可运行的 runtime。

请按下面这份说明执行：
docs/darwin-x64-runtime-handoff.md

最终请发回：
1. darwin-x64-openclaw-<version>.tar.gz
2. darwin-x64-runtime-notes.txt
3. 可选但推荐：来源机和导出目录都执行过 --version 的截图

注意这次我们要的是“真实可运行 runtime 目录”，不是安装包碎片，所以以下内容不能作为交付物：
- 只发 openclaw-*.tgz
- 只发 openclaw 启动脚本
- 只发 node_modules/openclaw/package.json
- 只发 npm install 日志

前置要求：
- 机器必须是 Intel Mac
- uname -m 必须是 x86_64
- command -v openclaw 必须能找到命令
- openclaw --version 必须成功

如果中间失败，不用自己手工重组目录，直接把以下信息发回给我即可：
1. 完整报错
2. command -v openclaw 输出
3. openclaw --version 输出
4. 脚本里最后打印出来的路径信息

谢谢，拿到后我们会在项目侧继续做候选报告、runtime probe 和接包验收。
```

## 4. 回包后项目侧下一步

对方回包后，项目侧直接按以下顺序处理：

1. [darwin-x64-runtime-receipt-checklist.md](./darwin-x64-runtime-receipt-checklist.md)
2. [darwin-x64-runtime-intake-command-sheet.md](./darwin-x64-runtime-intake-command-sheet.md)
3. [openclaw-upgrade-migration-smoke-runbook.md](./openclaw-upgrade-migration-smoke-runbook.md)
