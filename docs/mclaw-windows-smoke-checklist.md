# Mclaw Windows Smoke Checklist

## 1. 文档目的

本清单用于 `Phase 2` 的最小可运行闭环验证。  
目标不是覆盖所有细节，而是快速判断：Windows 是否已经达到“能进入主线继续开发”的水平。

## 2. 使用方式

每次 Windows 关键改动后，至少执行一次本清单。  
结果记录建议写入 `dev_log.md` 或单独测试记录。

## 2.1 最近一次执行记录（2026-04-02）

基于当前仓库的首次实际执行结果：

- [x] `npm install` 已完成，构建依赖已补齐
- [x] `npm run build:app` 成功
- [x] `npm run check:win:release-env -- --allow-placeholder-publish --allow-unsigned` 成功
- [x] `npm run package:win:dir` 成功

当前说明：

1. 本次通过本地 `electron-dist` 成功绕过了 Electron 运行时下载。
2. 开发打包脚本增加了 `win.signAndEditExecutable=false`，从而绕过 `winCodeSign` 下载并成功产出 `win-unpacked`。
3. 最新产物目录已确认存在：`release/2026.4.2-v1/win-unpacked`
4. 当前产物主程序已切换为 `Mclaw.exe`
5. 进一步执行 `npm run package:win` 时，已通过本地 NSIS 目录绕过 `nsis-3.0.4.1.7z` 下载。
6. 通过本地解压 `nsis-resources` 目录并在打包前补丁 `app-builder-lib` 后，`nsis-resources-3.4.1.7z` 下载阻塞已关闭。
7. 当前已确认正式安装包产物存在：`release/2026.4.2-v2/Mclaw_2026.4.2-v2.exe`
8. 当前正式发布仍缺真实更新源与签名方案。
9. 已执行静默安装并成功落盘到：`smoke-install/Mclaw`
10. 已确认安装目录内存在 `Mclaw.exe`、`Uninstall Mclaw.exe`、`resources/app.asar`、`resources/elevate.exe`
11. 已确认安装后生成的 `resources/app-update.yml` 仍写入占位更新源：`https://example.invalid/mclaw/updates/latest`

## 3. Smoke Checklist

### A. 构建与产物

- [x] `npm run build:app` 成功
- [x] 存在标准 Windows 打包命令
- [x] Windows 安装包成功生成
- [x] 安装包名称、版本号、输出目录符合预期
- [x] 如启用强制签名，签名流程通过；如未启用，已记录临时策略

### B. 安装与启动

- [x] 安装包可正常启动安装器
- [ ] 安装路径可选
- [x] 安装完成后可启动主程序
- [x] 首次启动未出现白屏/闪退/直接退出
- [ ] 窗口标题、托盘和基础品牌信息符合当前阶段预期

### C. 首次启动与环境检查

- [x] 成功进入环境检查页面
- [ ] 未出现明显 macOS 专属文案
- [ ] Node 检查结果正确
- [ ] OpenClaw 检查结果正确
- [ ] 缺依赖时提示可理解、可执行
- [ ] 断网条件下仍可完成 OpenClaw 准备（内置载荷路径）

### D. 运行时与 gateway

- [ ] gateway 可启动
- [ ] gateway health 可获取
- [ ] gateway restart 可执行
- [ ] restart 后状态恢复正常
- [ ] 常见失败时错误提示可读

### E. 配置与目录

- [ ] 用户数据目录可确认
- [ ] 日志目录可确认
- [ ] 备份目录可确认
- [ ] 不写入异常目录
- [ ] 卸载保留数据策略符合预期

### F. 飞书主线前置

- [ ] 可进入飞书接入页面
- [ ] 不因其它 IM 渠道逻辑阻塞主流程
- [ ] 飞书官方插件准备入口可访问

### G. 发布相关

- [x] 发布配置不是明显错误组合
- [ ] 更新源策略已明确
- [ ] README / 文档与当前构建行为没有明显冲突

### H. OpenClaw 内置交付

- [ ] 安装目录中可确认 OpenClaw 内置载荷存在（版本与文档一致）
- [ ] 首次启动优先走本地内置安装，而非在线 npm 安装
- [ ] 内置载荷缺失/损坏时提示可执行修复动作
- [ ] 在线安装仅作为 fallback，且在日志中可区分来源

## 3.1 当前未完成但已验证的边界

1. “安装包可正常启动安装器”当前依据是静默安装成功，不等同于已完成 GUI 交互安装验证。
2. “安装完成后可启动主程序”与“首次启动未出现白屏/闪退/直接退出”已由人工 GUI smoke 验证通过。
3. 当前 GUI smoke 同时暴露出新的 UI 品牌残留：欢迎页、顶部壳层和窗口标题仍出现过 `Qclaw`。
4. 更新源策略仍未明确，且安装后的 `app-update.yml` 已再次证明当前仍在使用占位值。
5. 当前 OpenClaw 默认仍走在线安装，尚未完成“安装包内置交付 + 断网首启”验证。

## 4. 当前新增环境要求

在执行 Windows 打包前，还应额外确认：

1. 打包机可访问 Electron 发行源，或已预置 Electron 缓存。
2. 若不关闭 `win.signAndEditExecutable`，打包机还需可访问 `winCodeSign` 工具下载源，或已预置对应缓存。
3. 执行 NSIS 安装包打包时，打包机需能获取 `nsis-resources-3.4.1` 资源，可通过联网下载，或像当前仓库一样预置 `nsis-resources-3.4.1.7z` 并解压为本地目录后注入。
4. 若未走本地 NSIS 目录方案，打包机还需可访问 `nsis-3.0.4.1.7z` 下载源，或预置自定义 NSIS 二进制。
5. 若使用代理，代理地址和端口必须有效，不能出现当前 `:0` 这类无效连接目标。
6. 正式发布前必须提供真实更新源。
7. 正式发布前必须确认 Windows 签名证书与使用方式。

## 5. 判定标准

### 通过

满足以下条件即可判定“Windows 最小闭环基本成立”：

1. A、B、C、D 四组全部通过。
2. E 组至少确认目录与卸载策略清晰。
3. F 组至少能进入飞书主流程入口。

### 不通过

以下任一情况出现，则判定“不通过”：

1. 无法生成 Windows 安装包。
2. 安装后无法启动应用。
3. 环境检查阶段出现错误平台文案或错误流程。
4. gateway 不能完成 start / health / restart。
