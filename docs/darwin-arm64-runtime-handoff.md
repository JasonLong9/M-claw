# darwin-arm64 Runtime 获取与交付说明

## 1. 文档目的

这份文档是发给 `Apple Silicon Mac` 同事的执行说明。

目标只有一个：

1. 从一台已经能正常运行 `OpenClaw` 的 `macOS arm64` 机器上，导出一份真实可运行的 `darwin-arm64 runtime`。
2. 把这份 runtime 和必要说明文件发回给 Mclaw 项目侧。

这不是让你改代码，也不是让你打包整个项目。
你只需要把 `OpenClaw` 的可运行 runtime 目录完整导出来即可。

## 2. 交付物

请最终发回以下内容：

1. 一个压缩包：
   - 建议文件名：`darwin-arm64-openclaw-2026.3.24.tar.gz`
   - 压缩包解压后根目录名必须是：`darwin-arm64`
2. 一个文本说明文件：
   - 建议文件名：`darwin-arm64-runtime-notes.txt`
3. 可选但推荐：
   - 一张或两张截图，证明来源机和导出目录都能执行 `--version`

## 3. 机器要求

请先确认你的机器满足以下条件：

1. 系统是 `macOS`
2. 架构是 `Apple Silicon`
3. `uname -m` 输出为 `arm64`
4. 本机已经安装并可以运行 `OpenClaw`

先执行：

```bash
uname -m
command -v openclaw
openclaw --version
```

要求：

1. `uname -m` 必须输出 `arm64`
2. `command -v openclaw` 必须能找到命令
3. `openclaw --version` 必须成功输出版本

如果这三步都不通过，就先不要继续导出。

## 4. 不接受的错误做法

以下内容不能交付：

1. 只把 `openclaw-*.tgz` 发回来
2. 只发一个 `openclaw` 启动脚本
3. 只发 `node_modules/openclaw/package.json`
4. 只发 `npm install` 的日志
5. 没有本机 `--version` 成功记录的目录

我们要的是“真实可运行 runtime 目录”，不是安装包碎片。

## 5. 你需要产出的目录结构

最终压缩包解压后，必须长这样：

```text
darwin-arm64/
├─ openclaw
或
├─ bin/
│  └─ openclaw
└─ node_modules/
   └─ openclaw/
      └─ package.json
```

只要满足下面两点即可：

1. 目录内存在 `openclaw` 或 `bin/openclaw`
2. 目录内存在 `node_modules/openclaw/package.json`

## 6. 推荐执行方式

请直接在 Mac 终端里执行下面这段脚本。
它会自动：

1. 检查是不是 `arm64`
2. 找到 `openclaw`
3. 判断实际 runtime 前缀目录
4. 复制到桌面导出目录
5. 在导出目录再次执行 `--version`
6. 生成说明文件
7. 打成 `tar.gz`

```bash
set -euo pipefail

ARCH="$(uname -m)"
if [ "$ARCH" != "arm64" ]; then
  echo "ERROR: 当前机器架构不是 arm64，而是: $ARCH"
  exit 1
fi

OPENCLAW_BIN="$(command -v openclaw || true)"
if [ -z "$OPENCLAW_BIN" ]; then
  echo "ERROR: 未找到 openclaw 命令"
  exit 1
fi

REAL_BIN="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$OPENCLAW_BIN")"
BIN_DIR="$(dirname "$REAL_BIN")"
BIN_NAME="$(basename "$REAL_BIN")"

PREFIX_DIR=""
if [ -f "$BIN_DIR/node_modules/openclaw/package.json" ]; then
  PREFIX_DIR="$BIN_DIR"
elif [ -f "$BIN_DIR/../node_modules/openclaw/package.json" ]; then
  PREFIX_DIR="$(cd "$BIN_DIR/.." && pwd)"
else
  echo "ERROR: 无法自动定位 runtime 前缀目录"
  echo "REAL_BIN=$REAL_BIN"
  exit 1
fi

echo "来源 openclaw 命令: $OPENCLAW_BIN"
echo "解析后真实路径: $REAL_BIN"
echo "识别到 runtime 前缀目录: $PREFIX_DIR"

SOURCE_VERSION="$("$REAL_BIN" --version)"
echo "来源机版本输出: $SOURCE_VERSION"

EXPORT_ROOT="$HOME/Desktop/mclaw-runtime-export"
EXPORT_DIR="$EXPORT_ROOT/darwin-arm64"
ARCHIVE_PATH="$HOME/Desktop/darwin-arm64-openclaw-2026.3.24.tar.gz"
NOTES_PATH="$HOME/Desktop/darwin-arm64-runtime-notes.txt"

rm -rf "$EXPORT_ROOT"
mkdir -p "$EXPORT_DIR"

cp -R "$PREFIX_DIR"/. "$EXPORT_DIR"/

COPIED_BIN=""
if [ -x "$EXPORT_DIR/openclaw" ]; then
  COPIED_BIN="$EXPORT_DIR/openclaw"
elif [ -x "$EXPORT_DIR/bin/openclaw" ]; then
  COPIED_BIN="$EXPORT_DIR/bin/openclaw"
else
  echo "ERROR: 复制后未找到可执行 openclaw"
  exit 1
fi

COPIED_VERSION="$("$COPIED_BIN" --version)"
echo "导出目录版本输出: $COPIED_VERSION"

cat > "$NOTES_PATH" <<EOF
machine_arch=$ARCH
source_openclaw_bin=$OPENCLAW_BIN
resolved_openclaw_bin=$REAL_BIN
runtime_prefix_dir=$PREFIX_DIR
source_version_output=$SOURCE_VERSION
copied_version_output=$COPIED_VERSION
export_dir=$EXPORT_DIR
archive_path=$ARCHIVE_PATH
generated_at=$(date '+%Y-%m-%d %H:%M:%S %z')
EOF

tar -czf "$ARCHIVE_PATH" -C "$EXPORT_ROOT" darwin-arm64

echo ""
echo "已生成："
echo "1) $ARCHIVE_PATH"
echo "2) $NOTES_PATH"
echo ""
echo "请把这两个文件发回项目同事。"
```

## 7. 执行成功后的自检

脚本跑完后，请再人工确认一次：

```bash
tar -tzf ~/Desktop/darwin-arm64-openclaw-2026.3.24.tar.gz | head -n 20
cat ~/Desktop/darwin-arm64-runtime-notes.txt
```

你应该能看到：

1. 压缩包里根目录是 `darwin-arm64/`
2. 里面有 `openclaw` 或 `bin/openclaw`
3. 里面有 `node_modules/openclaw/package.json`
4. `notes.txt` 里记录了两次 `--version` 输出

## 8. 发回时请一并说明

请把下面这些信息一起发回来：

1. 你的 macOS 版本
2. `uname -m` 输出结果
3. `openclaw --version` 输出结果
4. 是否是从现成已安装目录导出的
5. 是否在导出目录中再次执行过 `--version`

最简模板如下：

```text
机器平台：macOS
机器架构：arm64
OpenClaw 版本：2026.3.24
来源目录：已安装运行目录导出
来源机 --version：已通过
导出目录 --version：已通过
附件：
1. darwin-arm64-openclaw-2026.3.24.tar.gz
2. darwin-arm64-runtime-notes.txt
```

## 9. 如果脚本失败

如果脚本失败，不要自己随意删文件重组。
请直接把下面信息发回来：

1. 失败的完整报错
2. `command -v openclaw` 输出
3. `openclaw --version` 输出
4. `ls -la "$(dirname "$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$(command -v openclaw)")")"`

这样项目侧可以判断是：

1. 路径布局特殊
2. 权限问题
3. 依赖不完整
4. 当前机器上的 OpenClaw 其实不是完整 runtime

## 10. 当前项目侧的用途

你发回来的这份 `darwin-arm64` runtime，将用于：

1. 补齐 Mclaw 安装包内置的 macOS arm64 OpenClaw 本体
2. 继续完成 `Phase 2` 的双平台 bundled runtime 闭环
3. 后续做 macOS 首次启动和断网验证

所以最重要的是：

1. 目录必须完整
2. `--version` 必须真实可跑
3. 不要只发零散文件
