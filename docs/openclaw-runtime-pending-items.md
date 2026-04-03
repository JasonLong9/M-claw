# OpenClaw Runtime 待补事项

## 1. 当前状态

截至 `2026-04-03`，`OpenClaw bundled-runtime` 的仓库状态如下：

1. Windows `win32-x64` runtime 已入库并完成当前阶段校验。
2. `resources/openclaw-bundle/manifest.json` 当前仍为：
   - `defaultDeliveryMode = bundled-fallback`
   - `targetDeliveryMode = bundled-runtime`
3. `Phase 2` 尚未退出。

## 2. 当前唯一主阻塞

当前唯一主阻塞为：

1. 缺少真实可运行的 `darwin-arm64` runtime。

影响如下：

1. 当前不能把 `defaultDeliveryMode` 从 `bundled-fallback` 切到 `bundled-runtime`。
2. `npm run check:openclaw:phase2-exit` 当前仍会失败。
3. `Phase 2` 不能判定为已退出。

## 3. 为什么当前先挂起

当前先挂起该事项的原因是：

1. `darwin-arm64` runtime 需要来自 `Apple Silicon Mac` 或对应可信构建机。
2. 当前本地开发环境没有 Mac，无法本地生成或真实执行该 runtime。
3. Windows 侧当前阶段所需校验已经基本完成，继续在无 Mac 条件下投入更多代码改动，收益很低。

## 4. 恢复推进条件

满足以下任一条件后，恢复该事项：

1. 拿到来自 `Apple Silicon Mac` 的真实 `darwin-arm64` runtime 目录。
2. 拿到来自可信构建机的 `darwin-arm64` 离线 runtime 目录。

建议附带交接信息：

1. 来源机器平台与架构。
2. OpenClaw 版本。
3. 来源机 `--version` 结果。
4. 候选目录 `--version` 结果。

## 5. 恢复后执行入口

恢复推进后，统一按以下顺序执行：

1. 候选报告：
   - `npm run report:openclaw:runtime-candidate -- --runtime-dir resources/openclaw-bundle/runtime/darwin-arm64 --platform darwin --arch arm64 --version 2026.3.24`
2. manifest 预览：
   - `npm run preview:openclaw:manifest-runtime -- --runtime darwin:arm64:darwin-arm64:2026.3.24`
3. runtime probe：
   - `npm run probe:openclaw:runtime -- --runtime-dir resources/openclaw-bundle/runtime/darwin-arm64 --platform darwin --arch arm64`
4. 手动回填：
   - `resources/openclaw-bundle/manifest.json`
5. 仓库校验：
   - `npm run check:openclaw:bundle`
   - `npm run check:openclaw:bundle:strict`
   - `npm run report:openclaw:bundle`
   - `npm run check:openclaw:phase2-exit`

## 6. 相关文档

详细规则与执行入口如下：

1. 获取与入库 SOP：
   - [docs/openclaw-bundled-runtime-acquisition-sop.md](C:\Users\James\Desktop\Mclaw\docs\openclaw-bundled-runtime-acquisition-sop.md)
2. 验证清单：
   - [docs/openclaw-bundled-runtime-validation-checklist.md](C:\Users\James\Desktop\Mclaw\docs\openclaw-bundled-runtime-validation-checklist.md)
3. 短执行 runbook：
   - [docs/openclaw-runtime-intake-runbook.md](C:\Users\James\Desktop\Mclaw\docs\openclaw-runtime-intake-runbook.md)

## 7. 当前结论

当前结论只保留一句：

1. Windows 已基本过关，`Phase 2` 暂挂，等待 `darwin-arm64` runtime 到位后恢复推进。
