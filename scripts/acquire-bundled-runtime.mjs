import { execSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { platform, arch } from 'node:process'

const args = process.argv.slice(2)
const version = args[0] || '2026.3.24' // Default to PINNED_OPENCLAW_VERSION

const isWin = platform === 'win32'
const targetDirName = isWin ? 'windows-x64' : `${platform}-${arch}`
const targetDir = resolve(join('resources', 'openclaw-bundle', 'runtime', targetDirName))

console.log(`\n============ OpenClaw 内置本体自动提取脚本 ============`)
console.log(`📦 目标版本: ${version}`)
console.log(`🖥️ 当前平台: ${platform}-${arch}`)
console.log(`📂 输出路径: ${targetDir}\n`)

if (existsSync(targetDir)) {
  console.log(`[1/5] 清理旧的运行时目录...`)
  rmSync(targetDir, { recursive: true, force: true })
}
mkdirSync(targetDir, { recursive: true })

console.log(`[2/5] 开始通过 npm 提取独立运行闭包 (这可能需要几分钟，取决于网络)...`)
console.log(`> npm install --global --prefix "${targetDir}" openclaw@${version} --no-audit --no-fund\n`)

try {
  execSync(`npm install --global --prefix "${targetDir}" openclaw@${version} --no-audit --no-fund`, {
    stdio: 'inherit',
    env: process.env // Inherit env so it uses custom registries if set
  })
} catch (e) {
  console.error(`\n❌ npm 安装失败，可能是网络或注册表源问题。请更换网络或设置其它源。`)
  process.exit(1)
}

console.log(`\n[3/5] 验证文件布局...`)
const pkgPath = join(targetDir, 'node_modules', 'openclaw', 'package.json')
const binExt = isWin ? '.cmd' : ''
const cmdPath = isWin ? join(targetDir, `openclaw${binExt}`) : join(targetDir, 'bin', `openclaw${binExt}`)

let hasPkg = existsSync(pkgPath)
let hasCmd = existsSync(cmdPath)

if (!hasPkg || !hasCmd) {
  console.error(`❌ 布局校验失败！`)
  if (!hasPkg) console.error(`  - 缺失: ${pkgPath}`)
  if (!hasCmd) console.error(`  - 缺失执行入口: ${cmdPath}`)
  console.error(`目录可能并非有效的全局安装。`)
  process.exit(1)
}
console.log(`✅ 核心文件已就绪。`)

console.log(`\n[4/5] 本地执行沙箱探测 (测试完整依赖闭合率)...`)
try {
  const output = execSync(`"${cmdPath}" --version`, { encoding: 'utf8' })
  console.log(`> openclaw --version`)
  console.log(`✅ 返回成功: ${output.trim()}`)
} catch (e) {
  console.error(`\n❌ 直探测失败。生成的目录无法正常运行。说明包下载不全或依赖不闭合。`)
  console.error(e.message)
  process.exit(1)
}

console.log(`\n[5/5] 收尾完成！`)
console.log(`✅ 成功获取完整真实本体并写入:`)
console.log(`   ${targetDir}`)
console.log(`\n提示:`)
console.log(`   如果您是在另一台机器上执行的本脚本，请将 '${targetDirName}' 文件夹打包`)
console.log(`   并解压至开发机的 'resources/openclaw-bundle/runtime/' 目录下。`)
console.log(`   获取完成后，请运行 'npm run build:app' 等后续测试指令。`)
console.log(`=======================================================`)
