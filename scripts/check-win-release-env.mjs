import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { LOCAL_CONFIG_PATH, readLocalPublishUrl } from './electron-builder-local-config.mjs'
import { resolvePackageVersion } from './package-version.mjs'

const args = new Set(process.argv.slice(2))
const allowPlaceholderPublish = args.has('--allow-placeholder-publish')
const allowUnsigned = args.has('--allow-unsigned')

function fail(message) {
  console.error(`[win-release-preflight] ${message}`)
  process.exit(1)
}

function warn(message) {
  console.warn(`[win-release-preflight] ${message}`)
}

function readTrimmedEnv(name) {
  return String(process.env[name] || '').trim()
}

function isPlaceholderPublishUrl(value) {
  const normalized = String(value || '').trim()
  return (
    !normalized ||
    /example\.invalid/i.test(normalized) ||
    /example\.com/i.test(normalized) ||
    /electron-vite-react/i.test(normalized) ||
    /releases\/download\/v0\.9\.9/i.test(normalized)
  )
}

function hasWindowsSigningConfiguration(config) {
  const envHints = [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'CSC_NAME',
    'WIN_CSC_LINK',
    'WIN_CSC_KEY_PASSWORD',
    'WIN_CSC_NAME',
    'WINDOWS_CERTIFICATE_SHA1',
  ]

  if (envHints.some((name) => readTrimmedEnv(name))) return true

  const win = config?.win || {}
  return Boolean(
    String(win.certificateSubjectName || '').trim() ||
      String(win.certificateSha1 || '').trim() ||
      String(win.sign || '').trim()
  )
}

async function main() {
  if (process.platform !== 'win32') {
    fail('`package:win` / `release:win` 目前只支持在 Windows 主机上运行。')
  }

  const builderConfigPath = resolve('electron-builder.json')
  const rawConfig = await readFile(builderConfigPath, 'utf8')
  const config = JSON.parse(rawConfig)

  const appId = String(config.appId || '').trim()
  if (!appId || appId === 'YourAppID') {
    fail('请先把 electron-builder.json 里的 appId 改成正式的应用标识。')
  }

  const winConfig = config.win || {}
  const rawTargets = Array.isArray(winConfig.target) ? winConfig.target : []
  const hasWinTarget = rawTargets.some((item) =>
    typeof item === 'string' ? item.trim() : String(item?.target || '').trim()
  )
  if (!hasWinTarget) {
    fail('electron-builder.json 未配置有效的 win.target。')
  }

  if (String(config.afterAllArtifactBuild || '').trim() !== 'scripts/after-all-artifact-build.cjs') {
    fail('electron-builder.json 必须配置 `afterAllArtifactBuild = scripts/after-all-artifact-build.cjs`。')
  }

  const localPublishUrl = await readLocalPublishUrl()
  const publishUrl =
    localPublishUrl ||
    readTrimmedEnv('QCLAW_UPDATE_PUBLISH_URL') ||
    (typeof config.publish === 'string' ? config.publish : String(config.publish?.url || '').trim())

  if (isPlaceholderPublishUrl(publishUrl)) {
    const message = `当前自动更新源仍是占位值。正式发布前必须在 ${LOCAL_CONFIG_PATH} 或 QCLAW_UPDATE_PUBLISH_URL 中提供真实更新源。`
    if (allowPlaceholderPublish) {
      warn(message)
    } else {
      fail(`${message} 如果只是本地开发打包，请显式传入 --allow-placeholder-publish。`)
    }
  }

  const forceCodeSigning = config.forceCodeSigning === true
  const hasSigningConfig = hasWindowsSigningConfiguration(config)

  if (forceCodeSigning && !hasSigningConfig) {
    const message =
      '当前启用了 forceCodeSigning: true，但没有检测到可用的 Windows 签名配置。'
    if (allowUnsigned) {
      warn(`${message} 本次将依赖打包命令里的 -c.forceCodeSigning=false 覆盖，仅适用于开发构建。`)
    } else {
      fail(`${message} 请先准备签名证书，或在开发构建中传入 --allow-unsigned。`)
    }
  }

  const packageVersion = resolvePackageVersion()
  console.log(
    `[win-release-preflight] 检查通过：win.target 已配置，打包版本号将使用 ${packageVersion.displayVersion}（内部 semver ${packageVersion.version}）。`
  )
}

await main()
