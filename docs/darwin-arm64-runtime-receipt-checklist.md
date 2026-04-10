# darwin-arm64 Runtime 收包验收单

## 1. 目的

本清单用于在收到 macOS 同事发回的 `darwin-arm64` runtime 后，快速判断：

1. 包体是否符合最小交付要求
2. 是否可以进入仓库接入流程
3. 是否还需要补材料或让对方重新导出

这份清单只面向项目内执行，不发给外部同事。

## 2. 期望收到的文件

- [ ] `darwin-arm64-openclaw-<version>.tar.gz`
- [ ] `darwin-arm64-runtime-notes.txt`
- [ ] 可选截图：
  - 来源机 `openclaw --version`
  - 导出目录 `--version`

说明：

1. `<version>` 可以是当前主线 `2026.3.24`。
2. 也可以是外部同事给到的 `2026.4.x` 候选版本。
3. 但无论文件名怎么写，最终一律以 `notes` 中记录的 `--version` 输出为准。

## 3. 文件名与根目录检查

- [ ] 压缩包文件名可识别为 `darwin-arm64` runtime
- [ ] 压缩包解压后根目录名为 `darwin-arm64`
- [ ] 根目录下存在以下其一：
  - `openclaw`
  - `bin/openclaw`
- [ ] 根目录下存在：
  - `node_modules/openclaw/package.json`

## 4. notes 文件检查

`darwin-arm64-runtime-notes.txt` 中至少应包含：

- [ ] `machine_arch=arm64`
- [ ] `source_openclaw_bin=...`
- [ ] `resolved_openclaw_bin=...`
- [ ] `runtime_prefix_dir=...`
- [ ] `source_version_output=...`
- [ ] `copied_version_output=...`
- [ ] `generated_at=...`

额外判断：

- [ ] `source_version_output` 可识别为一个明确版本号
- [ ] `copied_version_output` 可识别为一个明确版本号
- [ ] 来源机与导出目录版本一致
- [ ] 能判断它属于以下哪一条：
  - 当前主线 `2026.3.24`
  - `2026.4.x` 候选线

## 5. 收包后的本地处理顺序

收到压缩包后，按以下顺序处理：

1. 先解压到临时目录，不要直接覆盖仓库：
   - 例如：`D:\workspace\mclaw-runtime-intake\darwin-arm64`
2. 先检查目录结构
3. 再执行候选报告：

```bash
npm run report:openclaw:runtime-candidate -- --runtime-dir <临时目录> --platform darwin --arch arm64 --version <notes里确认的真实版本>
```

4. 再执行 runtime probe：

```bash
npm run probe:openclaw:runtime -- --runtime-dir <临时目录> --platform darwin --arch arm64
```

5. 只有上面两步都通过，才允许复制进：
   - `resources/openclaw-bundle/runtime/darwin-arm64`

## 6. 允许入仓的标准

只有以下条件都满足，才允许正式入仓：

- [ ] 收到压缩包
- [ ] 收到 notes 文件
- [ ] 根目录结构正确
- [ ] `node_modules/openclaw/package.json` 存在
- [ ] 已确认真实版本属于 `2026.3.24` 主线
- [ ] 候选报告通过
- [ ] runtime probe 通过

补充说明：

1. 如果候选包真实版本是 `2026.4.x`，本轮默认只允许做：
   - 收包
   - 报告
   - probe
   - 候选线记录
2. 不允许因为“已经能跑”就直接改 `manifest.json`、切主线版本或宣称 `Phase 2` 退出。

## 7. 不允许入仓的情形

以下任一情况出现，都不要直接入仓：

- [ ] 只有压缩包，没有 notes 文件
- [ ] `notes.txt` 没有记录两次 `--version`
- [ ] 压缩包根目录不是 `darwin-arm64`
- [ ] 只有 `tgz`，没有真实 runtime 目录
- [ ] 只有 `openclaw` 脚本，没有 `node_modules/openclaw/package.json`
- [ ] 候选报告失败
- [ ] runtime probe 失败
- [ ] 实际版本是 `2026.4.x`，但还准备直接按 `2026.3.24` 主线包入仓

## 8. 收包失败时的回传模板

如果包体不合格，直接回给同事这段即可：

```text
这次发回的 darwin-arm64 runtime 还不能入仓，原因是：
1. <填具体问题>
2. <填具体问题>

请重新补齐后再发：
1. darwin-arm64-openclaw-<version>.tar.gz
2. darwin-arm64-runtime-notes.txt

最少要求：
- 根目录为 darwin-arm64
- 目录里有 openclaw 或 bin/openclaw
- 目录里有 node_modules/openclaw/package.json
- notes 里要有来源机和导出目录两次 --version 输出
```

## 9. 收包通过后的下一步

通过后直接进入：

1. 若真实版本是 `2026.3.24`：
   - 复制入仓
   - `manifest.json` 补齐 `darwin-arm64`
   - `npm run check:openclaw:bundle`
   - `npm run check:openclaw:bundle:strict`
   - `npm run report:openclaw:bundle`
   - `npm run check:openclaw:phase2-exit`
2. 若真实版本是 `2026.4.x`：
   - 只记录为候选 runtime
   - 更新候选验证结果
   - 不直接改主线 `manifest` / pinned baseline / Phase 2 退出结论

对应主流程文档：

- [openclaw-runtime-intake-runbook.md](./openclaw-runtime-intake-runbook.md)
- [openclaw-bundled-runtime-acquisition-sop.md](./openclaw-bundled-runtime-acquisition-sop.md)
- [openclaw-version-strategy.md](./openclaw-version-strategy.md)
