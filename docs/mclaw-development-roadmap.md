1. # Mclaw 开发路线图

   ## 1. 当前结论

   通过对`dev_guide.md`、现有架构结构、`package.json`、`electron-builder.json`、`README.md`及平台相关代码的交叉核查，当前最合理的开发顺序已明确：

   1. **Windows 适配收尾**是 v1 第一优先级任务，必须先于新增功能进入主线；
   2. **Docker**不应作为 v1 当前阶段的前置条件，仅作为后续预研专题；
   3. 现有文档此前足够做方向判断，但尚不足以直接指导跨平台交付，因此本次已升级至执行级路线；
   4. **OpenClaw 真内置交付（随安装包分发）** 属于 Phase 2 的 P0 核心事项，不再接受 “首次启动在线安装” 或 “仅内置 tgz 后再安装” 作为默认交付形态。

   ## 2. 为何顺序需要调整

   当前仓库的实际状态并非 “仅支持 macOS”，而是 “已有部分 Windows 代码逻辑，但发布与校验未完全收口”：

   1. `electron-builder.json`已配置`win.nsis`目标，说明打包配置并非完全缺失；
   2. `electron/main/cli.ts`已有大量`win32`/`powershell`/`msiexec`分支，说明运行时安装与修复逻辑已开始兼容 Windows；
   3. `electron/main/qclaw-update-service.ts`已声明`darwin`与`win32`为支持平台，说明自动更新设计已考虑双平台；
   4. `electron/main/index.ts`已存在 Windows 专属的`app.setAppUserModelId(...)`逻辑；
   5. 但`package.json`目前仅有`package:mac`/`release:mac`等发布脚本，无对等的`package:win`/`release:win`；
   6. `scripts/check-mac-release-env.mjs`明确仅服务 macOS 发布链路；
   7. `README.md`仍将 Windows 标注为 “开发中”，说明工程状态未达到 “已完成 Windows 交付”。

   **结论**：

   1. Windows 并非从零开始支持；
   2. 但 Windows 仍未达到 “可稳定交付给用户” 的程度；
   3. 因此继续优先堆叠新功能，会导致后续 Windows 收尾发生大规模返工。

   ## 3. 制定原则

   开发顺序必须同时满足以下约束：

   1. 先做影响交付成败的核心问题，再做上层功能；
   2. 先补齐跨平台一致性，再做平台无关的增强能力；
   3. 先复用现有 Qclaw 基建，不重写已有成熟模块；
   4. 先聚焦 v1 范围，再处理商业化和 Docker 等增强方向。

   ## 4. 调整后的整体阶段

   表格

   

   

   

   |   阶段   |                             目标                             | 是否延后后续 |              说明              |
   | :------: | :----------------------------------------------------------: | :----------: | :----------------------------: |
   | Phase 0  |                   文档基线、ADR、架构聚焦                    |      是      |    已完成基础版，需持续维护    |
   | Phase 1  |                 Windows 缺口审计与阻塞项清单                 |      是      |       v1 第一优先级任务        |
   | Phase 2  | 双平台 OpenClaw 真内置 runtime 核心（Windows 先收口，macOS 同步保持对等结构） |      是      |    在此之前不进入新功能主线    |
   | Phase 3  |                 Mclaw 产品接管与状态迁移规范                 |      是      |   涉及路径、目录、品牌和兼容   |
   | Phase 4  |                跨平台首次启动与环境检测主流程                |      是      | 为飞书接入与看门狗提供统一入口 |
   | Phase 5  |                       飞书官方接入闭环                       |      是      |        v1 核心业务入口         |
   | Phase 6  |                   gateway 看门狗与自动恢复                   |      是      |       v1 核心差异化能力        |
   | Phase 7  |                        安全加固与脱敏                        |      是      |        必须在发版前完成        |
   | Phase 8  |                     双平台发布校验与回归                     |      是      |            发布闭环            |
   | Phase 9  |                          商业化预埋                          |      否      |            v1 收尾             |
   | Phase 10 |                    Docker 及 v1.5/v2 预研                    |      否      |            后续专题            |

   ## 5. 推荐开发顺序

   ### Phase 0 文档与决策聚焦

   **目标**：

   1. 明确 v1/v1.5/v2 边界；
   2. 确立 Windows 优先、Docker 后置原则；
   3. 建立持续更新`dev_log.md`的机制。

   **输出物**：

   1. `docs/mclaw-prd-v1.md`
   2. `docs/mclaw-architecture-draft.md`
   3. `docs/mclaw-feature-boundary-matrix.md`
   4. `docs/mclaw-development-roadmap.md`
   5. `docs/mclaw-doc-audit.md`
   6. `docs/mclaw-windows-adaptation-plan.md`
   7. `dev_log.md`

   **退出标准**：

   1. 新需求可被明确归类到对应版本；
   2. 对 “是否先做 Windows / 是否先做 Docker” 不再存在歧义。

   ### Phase 1 Windows 缺口审计与阻塞项清单

   **目标**：

   1. 将 “部分支持 Windows” 变为 “明确知道还缺什么”；
   2. 输出完整的 Windows 优先级任务与责任模块。

   **任务**：

   1. 审计打包脚本、更新脚本、环境检测、CI 拉起、路径规范、权限修复、日志目录、配置目录；
   2. 审计所有用户可见的 mac-only 文案与流程；
   3. 审计测试覆盖里哪些仅支持 darwin、哪些已有 win32；
   4. 形成可执行的优先级清单与分级。

   **输出物**：

   1. Windows 优先级清单；
   2. 平台差异矩阵；
   3. 最小可运行冒烟测试清单。

   **退出标准**：

   1. 所有 Windows 任务均被归类为 P0/P1/P2；
   2. 不再使用 “感觉支持 Windows” 这类模糊判断。

   ### Phase 2 双平台 OpenClaw 真内置 runtime 核心

   **目标**：

   1. 先在 Windows 完成 “能装、能开、能配置、能连 gateway” 的最小闭环；
   2. 同时固定 macOS 对等的 OpenClaw 内置 runtime 目录结构、manifest 约定与校验对接；
   3. 先拿到核心稳定性，再继续新增业务功能。

   **任务**：

   1. 新增`package:win`/`release:win`等对等发布命令；

   2. 适配安装包、NSIS、图标、更新元数据与版本号规则；

   3. 验证 Windows 下 Node/OpenClaw 检测、安装、修复、PATH 更新；

   4. 验证 Windows 下 gateway 的 start /health/restart；

   5. 验证配置目录、日志目录、配置目录、卸载保留规范；

   6. 明确 Windows 代码签名证书方案（`electron-builder.json`已设`forceCodeSigning: true`，需明确证书采购或开发阶段临时关闭规范）；

   7. 保留开发阶段已验证的构建兼容规范：

      - 本地`electron-dist`分发目录
      - `-c.forceCodeSigning=false`
      - `-c.win.signAndEditExecutable=false`

      

   8. 将 OpenClaw 从 “首次启动安装” 改为 “安装包内置可运行 runtime 直接交付”：

      - 安装包内直接携带固定版本 OpenClaw 可运行 runtime
      - 首次启动默认只做校验、注册、修复，不将 npm 安装作为主路径
      - `tgz`或网络安装仅保留为降级备选路径，而非默认实现
      - 安装后记录来源为`bundled-runtime`/`bundled-fallback`/`online-fallback`，用于诊断与升级分流

      

   9. 落地 OpenClaw 内置交付的双平台验收：

      - Windows/macOS 均需能从 manifest 解析当前平台 runtime 状态
      - 断网环境仍可完成 OpenClaw 准备并进入主流程
      - 失败时提示围绕本地包损坏 / 权限问题，而非仅提示 npm 网络问题

      

   10. 固定双平台 runtime 目录约定：

       - `runtime/windows-x64`
       - `runtime/darwin-arm64`
       - `runtime/darwin-x64`

       

   **退出标准**：

   1. 全新 Windows 设备可安装并首次启动；
   2. 环境检测可完成；
   3. gateway 可被拉起并做健康检测；
   4. 遇到常见失败时能给出可执行修复路径；
   5. 断网环境下，首次启动仍可完成 OpenClaw 准备，且默认不依赖`npm install -g openclaw`；
   6. Windows 与 macOS 均有明确的内置 runtime 目录约束、manifest 声明和诊断字段，不再是单平台实验实现。
   7. `npm run check:openclaw:phase2-exit` 必须通过，至少满足：
      - `targetDeliveryMode = bundled-runtime`
      - `defaultDeliveryMode = bundled-runtime`
      - `win32-x64` 与 `darwin-arm64` 均已具备可执行 runtime 包体与 manifest 声明

   **当前阶段结论（截至 2026-04-02）**：

   1. Windows 开发目录打包链路已打通，`win-unpacked`可稳定生成；

   2. Windows NSIS 安装包链路已打通，且主程序名已切换为`Mclaw.exe`；

   3. Phase 2 代码已从 “仅内置 tgz” 推进为

      ```
      runtime-first
      ```

      结构：

      - manifest/delivery status 解析已支持双平台
      - install plan 已固定优先级为`bundled-runtime -> bundled-fallback -> online-fallback`
      - Windows runtime 已具备备选复制、目标部署校验和`--version`探测
      - macOS runtime 已具备对等的复制部署、目标部署校验和`--version`探测

      

   4. 当前仓库的实际包体状态仍为：

      - 已存在`resources/openclaw-bundle/openclaw-2026.3.24.tgz`
      - 暂不存在`resources/openclaw-bundle/runtime/<platform-arch>/...`的真实 runtime 包体

      

   5. 近期失败验证已确认：仅从 npm tgz 解压得到的包体不能视为 “真实 runtime 包体”，因其运行时依赖未闭环；

   6. 因此项目实际仍处于 Phase 2，但已不是 “纯规划阶段”，而是 “代码逻辑基本完成、runtime 目录结构已验证，但真实可运行包体仍缺失” 的状态；

   7. Phase 2 仍未退出，核心原因明确：

      - 仓库未放入真实可运行的 Windows/macOS runtime 包体
      - 暂未完成 Windows/macOS 带真实包体的端到端真机验证
      - 暂未将`defaultDeliveryMode`正式切换为`bundled-runtime`
      - macOS 侧仍可能需根据真实包体部署补充权限 / 签名 / 路径细节

      

   8. 当前 Phase 2 的核心执行动作已进一步收敛为：

      - 先按`docs/openclaw-bundled-runtime-acquisition-sop.md`获取真实 runtime
      - 再做真机验证、严格校验、打包和断网测试
      - 最后再切换默认分发模式

   9. 自 2026-04-03 起，Phase 2 是否可退出不再只靠文档描述，统一以

      - `npm run check:openclaw:phase2-exit`

      为准；当前仓库实测仍未通过，直接阻塞点是：

      - `defaultDeliveryMode` 仍为 `bundled-fallback`
      - 缺少必需的 `darwin-arm64` runtime artifact

      

   ### Phase 2 包体规范与接入要求

   为避免继续将 “内置 runtime” 停留在口头约定，当前统一按以下规范执行：

   1. runtime 目录必须位于：

      - `resources/openclaw-bundle/runtime/windows-x64`
      - `resources/openclaw-bundle/runtime/darwin-arm64`
      - `resources/openclaw-bundle/runtime/darwin-x64`

      

   2. Windows runtime 至少必须包含：

      - `openclaw.cmd`
      - 可选`openclaw.ps1`
      - `node_modules/openclaw/package.json`

      

   3. macOS runtime 至少必须包含：

      - `openclaw`或`bin/openclaw`
      - `node_modules/openclaw/package.json`

      

   4. `manifest.json`中的`artifacts.runtime[]`必须与实际目录一一对应；

   5. 若 runtime 不存在，允许保留`tgz`作为`bundled-fallback`，但不得将其重新写回默认主路径；

   6. 详细规范、目录示例与提交流程见：

      - `docs/openclaw-bundled-runtime-spec.md`

      

   7. 真机接入与退出验证清单见：

      - `docs/openclaw-bundled-runtime-validation-checklist.md`

      

   8. 真实 runtime 的获取、复核与入库规则见：

      - `docs/openclaw-bundled-runtime-acquisition-sop.md`

      

   ### Phase 3 Mclaw 产品接管与状态迁移规范

   **目标**：

   1. 在双平台端侧完成 Qclaw → Mclaw 的产品化迁移设计；
   2. 明确产品名、目录名、appId、更新通道、兼容目录规范。

   **任务**：

   1. 锁定`productName`/`appId`/ 安装包名 / 配置目录名 / 日志名 / 更新名；

   2. 明确是否兼容旧目录或做自动迁移；

   3. 形成迁移与回滚规范；

   4. 完成品牌切换检查清单（Qclaw → Mclaw）：

      - `package.json`中`name`/`productName`/`description`更新为 Mclaw
      - `electron-builder.json`中`appId`/`artifactName`/`publish.url`更新
      - 安装包产物名、窗口标题、托盘图标、关于页信息同步更新
      - README、LICENSE NOTICE 及文档中的品牌引用统一替换
      - 自动更新通道与 COS 发布路径同步调整

      

   **退出标准**：

   1. 品牌升级不破坏现有用户数据；
   2. Windows/macOS 路径规则统一且可解析。

   ### Phase 4 跨平台首次启动与环境检测主流程

   **目标**：

   1. 将 Windows/macOS 的首次启动流程统一为产品级入口；
   2. 为后续飞书接入和看门狗提供统一上下文。

   **任务**：

   1. 审计`EnvCheck`、欢迎页、引导页的平台分支与文案；
   2. 统一首次启动状态机；
   3. 对安装失败、权限失败、依赖缺失给出平台化修复提示。

   **退出标准**：

   1. 双平台首次启动流程一致；
   2. 用户无需命令行即可理解下一步动作。

   ### Phase 5 飞书官方接入闭环

   **目标**：

   1. 将 “程序内连接飞书” 做为主流程能力；
   2. 保证 Windows/macOS 的飞书接入体验尽量一致。

   **任务**：

   1. 审视当前飞书接入页面与首次启动流程的衔接；
   2. 强化首次启动引导飞书接入；
   3. 为成功、失败、修复提供统一状态；
   4. 验证插件准备、二维码、状态回写、修复动作。
   5. 将 `larksuite/cli` 纳入官方 OAuth / scope 能力评估，但在未证明其可覆盖 `openclaw-lark-tools install` 前，不直接替换现有插件安装主链。

   **退出标准**：

   1. 新用户按 UI 提示即可完成飞书接入；
   2. 插件异常时可触发修复。

   ### Phase 6 gateway 看门狗与自动恢复

   **目标**：

   1. 从 “可手动重启” 升级为 “自动监控、自动恢复、受控熔断”；
   2. 让看门狗在双平台行为一致。

   **任务**：

   1. 新增看门狗服务模块；
   2. 定义检测频率、恢复阈值、熔断阈值；
   3. 接入状态页与日志页；
   4. 落地进程退出、health fail、重复失败的回归测试。

   **退出标准**：

   1. 意外杀死 gateway 后系统可自动发现并恢复；
   2. 连续失败会停机保护并提示人工处理。

   ### Phase 7 安全加固与脱敏

   **目标**：

   1. 建立产品级安全边界；
   2. 保证敏感信息不会在 UI、日志、对话中泄露。

   **任务**：

   1. 统一脱敏函数与规范；
   2. 锁定 API Key/token/App Secret 的隐藏路径；
   3. 定义插件白名单、能力白名单和执行工具限制；
   4. 为安全输出补充单测和导出前检测。

   **退出标准**：

   1. 常见敏感字段默认脱敏；
   2. 日志导出前自动执行敏感扫描。

   ### Phase 8 双平台发布校验与回归

   **目标**：

   1. 形成正式的 Windows/macOS 可交付版本；
   2. 将文档、脚本、构建、更新、卸载能力纳入验收。

   **任务**：

   1. 验证 Electron Builder 双平台产物；
   2. 验证手动下载更新与升级回滚提示（自动更新延后至 v1.5）；
   3. 验证安装、卸载、保留数据规范；
   4. 执行双平台 smoke test 与回归测试；
   5. 配置正式更新源 URL（当前`publish.url`为`example.invalid`占位）。

   **退出标准**：

   1. README、发布说明、安装文档与实际行为一致；
   2. 双平台安装流程可直接交付用户使用。

   ### Phase 9 商业化预埋

   **目标**：

   1. 在不阻塞首发的前提下，为后续授权体系预留接口。

   **任务**：

   1. 新增安装身份生成与存储；
   2. 预埋授权状态结构；
   3. 预埋邀请码、渠道来源、套餐字段。

   **退出标准**：

   1. 不引入支付依赖；
   2. 不破坏 v1 主流程。

   ### Phase 10 Docker 及 v1.5/v2 预研

   包含但不限于：

   1. Docker + 桌面程序交付验证；
   2. 支付与企业支付集成方案；
   3. 内测码和分销模式；
   4. MemOS/DeerFlow 接入路线；
   5. 360 安全技术预埋机制。

   **退出标准**：

   1. 预研结论以 ADR 或专题文档沉淀；
   2. 不与 v1 发布主线互相阻塞。

   ## 6. 里程碑定义

   表格

   

   

   

   | 里程碑 |               标识               |
   | :----: | :------------------------------: |
   |   M1   | 文档基线与 Windows 优先原则确定  |
   |   M2   |    Windows 最小可运行闭环完成    |
   |   M3   | 产品迁移与跨平台首次启动流程完成 |
   |   M4   |        飞书主流程闭环跑通        |
   |   M5   |        gateway 看门狗上线        |
   |   M6   |         安全脱敏基线完成         |
   |   M7   |        双平台安装验收通过        |
   |   M8   |     安装身份与商业化预埋完成     |

   ### 6.1 预计时间估算

   表格

   

   

   

   |   阶段   | 预计周数 |                 说明                 |
   | :------: | :------: | :----------------------------------: |
   | Phase 0  |   1 周   |         已基本完成，持续维护         |
   | Phase 1  |   1 周   |          审计与阻塞清单整理          |
   | Phase 2  |  2-3 周  | Windows 打包、环境检测、gateway 闭环 |
   | Phase 3  |  1-2 周  |        品牌切换、目录迁移规范        |
   | Phase 4  |  1-2 周  |        首次启动统一与平台文案        |
   | Phase 5  |  2-3 周  |     飞书插件安装、扫码、状态闭环     |
   | Phase 6  |  2-3 周  |      看门狗服务、熔断、事件记录      |
   | Phase 7  |  1-2 周  |      脱敏规则、白名单、安全检测      |
   | Phase 8  |  1-2 周  |         双平台验收与回归测试         |
   | Phase 9  |   1 周   |        身份生成与占位数据结构        |
   | Phase 10 |   持续   |         预研专题，不阻塞主线         |

   说明：以上为粗略估算，实际开发中根据进度调整；v1 主线合理周期 14-22 周。

   ## 7. 并行开发原则

   仅在不影响主阻塞项的前提下，才允许并行开发：

   1. Phase 1/2 期间禁止新增平台无关的大型功能；
   2. Phase 5 飞书闭环可与 Phase 4 的部分 UI 整理并行，但不能先于 Windows 最小闭环；
   3. Phase 7 安全加固可在 Phase 6 看门狗开发后半段并行推进；
   4. Phase 9/10 一律不得抢占 Phase 1-8 的主线资源。

   ## 8. 明确禁止的错误顺序

   以下顺序会显著增加返工，应避免：

   1. 在 Windows 最小闭环完成前继续大规模堆新功能；
   2. 在原生桌面交付未稳定前优先投入 Docker；
   3. 在路径、appId、迁移规范未确定前就全面改品牌和目录；
   4. 在脱敏规范未统一前开放日志导出和商业化身份字段展示。

   ### 8.1 已知技术债务

   以下技术债务已确认存在，应在 Phase 3-4 期间评估重构时机：

   表格

   

   

   

   |            文件             | 大小  |                     问题                     |           建议           |
   | :-------------------------: | :---: | :------------------------------------------: | :----------------------: |
   |          `cli.ts`           | 124KB | 职责过重，承载安装、修复、环境检测等大量逻辑 | 按职责拆分为独立服务模块 |
   | `openclaw-chat-service.ts`  | 132KB |            单文件过大，功能域混杂            |       按功能域拆分       |
   | `openclaw-auth-executor.ts` | 69KB  |             认证执行逻辑过于集中             |     拆分认证流程步骤     |
   |      `ipc-handlers.ts`      | 48KB  |               IPC 处理集中注册               |     按服务域拆分注册     |

   原则：不在 Phase 1-2 做大规模重构，但每次修改这些文件时应有意识地拆分。

   

## 9. 开发纪律

1. 每完成一次实际开发、文档设计或关键约定，必须更新`dev_log.md`；
2. 任何新需求进入前，必须先标注属于 v1/v1.5 还是 v2；
3. 涉及安全边界、打包方案、商业化数据结构、平台适配顺序的修改，必须先更新对应文档再改代码；
4. 开发过程必须受磁盘空间约束管理：任意阶段结束后，C 盘至少保留 5GB 可用空间；大体积运行时、缓存和构建产物必须及时清理。
