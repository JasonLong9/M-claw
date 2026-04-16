## 2026-04-15: OpenClaw 聊天截图有效性验证强化 (v9) - 后续修复

### 问题回顾
- **症状**: 尽管此前修复了“坏图/空图”显示假成功的问题，但用户指出截取的全链路下依旧仅仅返回明确失败（没有拿到底层浏览器发出的实际图片字节），或者保存到桌面的是 `.html/txt`。
- **排查经过**: 通过追踪 `gateway-streaming-chat-transport.ts` 数据回传网关发现：
  1. OpenClaw 截图工具回传的 JSON 字典如果把 WebP base64 或本机截图存储位点散落在不同的参数里（例如 `screenshot: "..."`或 `path: "/tmp/screenshot.png"`），当前的 `collectChatImageAttachments` 解析策略只认 `blockType === 'image'` 从而漏提图片，这是导致被“成功抹平为只剩文字和失败提示”的罪魁祸首。
  2. 原 WebP Base64 格式的前缀探测器 `UklGR`（Base64 中限制了下一个随附的 Size 字节高两位）存在严重的适配性错误，导致 `UklG` 格式的合法非对齐高压缩 WebP 生成图被误拒。

### 修复方案
- **修正 WebP Base64 识别头**: 于 `EMBEDDED_GATEWAY_IMAGE_SIGNATURES` 中将 `UklGR` 改置为通解合法的 `UklG`，保证从任何平台截出的 WebP 序列都可以顺利捕获。
- **重构图片收集收集遍历逻辑**:
  - 更正了 `collectChatImageAttachments` 遍历子结构的机制，现在可以递归探测任意未知 JSON 参数（譬如单纯的一个 `typeof value === 'string'` 值），若内容符合 base64 图形编码，则当即转化为 `data:` URL 附加件。
  - 为单纯只有本地 `path` 或 `url` 的结构件提供了回溯通道：识别以图像尾缀结束（如 `.png`, `.webp`）且非网页引用的字面量请求，主动为其添加 `file://` 前缀将其打包转换成可被识别、供上层查验和本地显示的真实附着图片实体，由此彻底杜绝图片属性剥离或遗失的问题。
