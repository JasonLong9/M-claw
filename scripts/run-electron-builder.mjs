import { spawn, spawnSync } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { readLocalPublishUrl } from './electron-builder-local-config.mjs'
import { claimPackageVersion, persistPackageVersionState, releasePackageVersionClaim } from './package-version.mjs'
import { verifyWinPackagedOpenClawBundle } from './check-win-packaged-openclaw-bundle.mjs'
import { verifyWinPackagedDevToolsBundle } from './check-win-packaged-dev-tools-bundle.mjs'

const forwardedArgs = process.argv.slice(2)
const packageVersion = claimPackageVersion()
const { version, displayVersion, timeZone, fromOverride } = packageVersion
const releaseRootDir = join(process.cwd(), 'release')
const currentReleaseDir = join(releaseRootDir, displayVersion)
const retainedReleaseEntries = resolveRetainedReleaseEntries(
  process.env.QCLAW_RELEASE_RETAIN || process.env.QCLAW_RELEASE_KEEP
)
const localPublishUrl = await readLocalPublishUrl()
const updatePublishUrl = localPublishUrl || String(process.env.QCLAW_UPDATE_PUBLISH_URL || '').trim()
const localElectronDist = join(process.cwd(), 'electron-dist')
const localNsisDist = join(process.cwd(), 'nsis-dist', 'nsis-3.0.4.1')
const hasLocalNsisDist = existsSync(join(localNsisDist, 'Bin', 'makensis.exe'))
const localNsisResourcesArchive = join(
  process.cwd(),
  'nsis-resources-dist',
  'nsis-resources-3.4.1.7z'
)
const hasLocalNsisResourcesArchive = existsSync(localNsisResourcesArchive)
const localNsisResourcesDir = join(
  process.cwd(),
  'nsis-resources-dist',
  'nsis-resources-3.4.1'
)
const hasLocalNsisResourcesDir = existsSync(join(localNsisResourcesDir, 'plugins'))
const localWinCodeSignArchiveCandidates = [
  process.env.ELECTRON_BUILDER_WIN_CODE_SIGN_ARCHIVE
    ? String(process.env.ELECTRON_BUILDER_WIN_CODE_SIGN_ARCHIVE).trim()
    : '',
  join(process.cwd(), 'win-code-sign-dist', 'winCodeSign-2.6.0.7z'),
  join(process.cwd(), 'winCodeSign-2.6.0.7z'),
].filter(Boolean)
const localWinCodeSignArchive = localWinCodeSignArchiveCandidates.find((path) => existsSync(path)) || ''
const hasLocalWinCodeSignArchive = Boolean(localWinCodeSignArchive)
const bundledElectronPackageJsonPath = join(process.cwd(), 'node_modules', 'electron', 'package.json')
const bundledElectronDistDir = join(process.cwd(), 'node_modules', 'electron', 'dist')

function resolveBundledElectronZipSpec() {
  if (process.platform !== 'win32') return null
  if (!existsSync(bundledElectronPackageJsonPath)) return null
  if (!existsSync(join(bundledElectronDistDir, 'electron.exe'))) return null

  try {
    const electronPackage = JSON.parse(readFileSync(bundledElectronPackageJsonPath, 'utf8'))
    const bundledVersion = String(electronPackage?.version || '').trim()
    if (!bundledVersion) return null

    const archiveName = `electron-v${bundledVersion}-win32-x64.zip`
    return {
      archiveName,
      archivePath: join(localElectronDist, archiveName),
      sourceDir: bundledElectronDistDir,
    }
  } catch {
    return null
  }
}

function ensureLocalElectronDistSeeded() {
  const zipSpec = resolveBundledElectronZipSpec()
  if (!zipSpec) return { available: existsSync(localElectronDist), seeded: false }
  if (existsSync(zipSpec.archivePath)) return { available: true, seeded: false }

  mkdirSync(localElectronDist, { recursive: true })
  const tarPath = 'C:\\Windows\\System32\\tar.exe'
  if (!existsSync(tarPath)) {
    return { available: existsSync(zipSpec.archivePath), seeded: false }
  }

  try {
    if (existsSync(zipSpec.archivePath)) rmSync(zipSpec.archivePath, { force: true })
  } catch {
    // Ignore stale archive cleanup failures and let tar report the actual problem.
  }

  const result = spawnSync(
    tarPath,
    ['-a', '-cf', zipSpec.archivePath, '-C', zipSpec.sourceDir, '.'],
    {
      stdio: 'pipe',
      encoding: 'utf8',
    }
  )

  if (result.status !== 0 || !existsSync(zipSpec.archivePath)) {
    try {
      if (existsSync(zipSpec.archivePath)) rmSync(zipSpec.archivePath, { force: true })
    } catch {
      // Ignore cleanup failures and fall back to online download if necessary.
    }
    const stderr = String(result.stderr || result.stdout || '').trim()
    if (stderr) {
      console.warn(`[run-electron-builder] 本地 Electron 压缩包生成失败：${stderr}`)
    }
    return { available: false, seeded: false }
  }

  console.log(`[run-electron-builder] 已从本地 electron npm 包生成离线压缩包：${zipSpec.archivePath}`)
  return { available: true, seeded: true }
}

const localElectronDistState = ensureLocalElectronDistSeeded()
const hasLocalElectronDist = localElectronDistState.available

function startLocalBinaryMirror() {
  const routes = new Map()

  if (hasLocalNsisResourcesArchive) {
    routes.set('/nsis-resources-3.4.1/nsis-resources-3.4.1.7z', localNsisResourcesArchive)
  }
  if (hasLocalWinCodeSignArchive) {
    routes.set('/winCodeSign-2.6.0/winCodeSign-2.6.0.7z', localWinCodeSignArchive)
  }

  if (routes.size === 0) {
    return Promise.resolve(null)
  }

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const requestPath = String(req.url || '').split('?')[0]
      const filePath = routes.get(requestPath)

      if (!filePath) {
        res.statusCode = 404
        res.end('Not Found')
        return
      }

      const stream = createReadStream(filePath)
      stream.on('error', () => {
        res.statusCode = 500
        res.end('Read Error')
      })
      stream.pipe(res)
    })

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('无法获取本地 binary mirror 地址'))
        return
      }

      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () =>
          new Promise((closeResolve) => {
            server.close(() => closeResolve())
          }),
      })
    })
  })
}

function ensureLocalNsisResourcesPatch() {
  if (!hasLocalNsisResourcesDir) {
    return
  }

  const nsisTargetPath = join(
    process.cwd(),
    'node_modules',
    'app-builder-lib',
    'out',
    'targets',
    'nsis',
    'NsisTarget.js'
  )

  if (!existsSync(nsisTargetPath)) {
    return
  }

  const source = readFileSync(nsisTargetPath, 'utf8')
  const hardcodedLine =
    'const nsisResourcePathPromise = () => (0, binDownload_1.getBinFromUrl)("nsis-resources", "3.4.1", "Dqd6g+2buwwvoG1Vyf6BHR1b+25QMmPcwZx40atOT57gH27rkjOei1L0JTldxZu4NFoEmW4kJgZ3DlSWVON3+Q==");'
  const patchedLine =
    'const nsisResourcePathPromise = () => { const custom = process.env.ELECTRON_BUILDER_NSIS_RESOURCES_DIR; return custom && custom.trim().length > 0 ? Promise.resolve(custom.trim()) : (0, binDownload_1.getBinFromUrl)("nsis-resources", "3.4.1", "Dqd6g+2buwwvoG1Vyf6BHR1b+25QMmPcwZx40atOT57gH27rkjOei1L0JTldxZu4NFoEmW4kJgZ3DlSWVON3+Q=="); };'

  if (!source.includes(hardcodedLine) || source.includes('ELECTRON_BUILDER_NSIS_RESOURCES_DIR')) {
    return
  }

  writeFileSync(nsisTargetPath, source.replace(hardcodedLine, patchedLine), 'utf8')
}

function resolveRetainedReleaseEntries(rawValue) {
  const raw = String(rawValue || '').trim()
  if (!raw) return new Set()

  return new Set(
    raw
      .split(/[,\r\n;]+/)
      .map((entry) => entry.trim().replace(/^release[\\/]+/i, ''))
      .filter(Boolean)
  )
}

function pruneOlderReleaseBuilds() {
  if (!existsSync(releaseRootDir)) return

  const removedEntries = []
  const skippedEntries = []
  const retainedEntries = []
  const seenEntries = new Set()
  for (const entry of readdirSync(releaseRootDir, { withFileTypes: true })) {
    if (entry.name === displayVersion) {
      seenEntries.add(entry.name)
      continue
    }
    if (retainedReleaseEntries.has(entry.name)) {
      retainedEntries.push(entry.name)
      seenEntries.add(entry.name)
      continue
    }
    const entryPath = join(releaseRootDir, entry.name)
    try {
      rmSync(entryPath, { recursive: true, force: true })
      removedEntries.push(entry.name)
    } catch (error) {
      skippedEntries.push(
        `${entry.name}（${error instanceof Error ? error.message : String(error)}）`
      )
    }
  }

  if (removedEntries.length > 0) {
    console.log(
      `[run-electron-builder] 已清理旧打包产物，仅保留最新版本 ${displayVersion}：${removedEntries.join(', ')}`
    )
  }

  if (retainedEntries.length > 0) {
    console.log(
      `[run-electron-builder] 已按要求额外保留以下旧打包目录：${retainedEntries.join(', ')}`
    )
  }

  const missingRetainedEntries = [...retainedReleaseEntries].filter((entry) => !seenEntries.has(entry))
  if (missingRetainedEntries.length > 0) {
    console.warn(
      `[run-electron-builder] 已请求保留但当前未找到以下打包目录：${missingRetainedEntries.join(', ')}`
    )
  }

  if (skippedEntries.length > 0) {
    console.warn(
      `[run-electron-builder] 以下旧打包目录暂未删除，通常是仍被运行中的旧版本占用：${skippedEntries.join(', ')}`
    )
  }
}

const builderArgs = [
  ...forwardedArgs,
  `-c.extraMetadata.version=${version}`,
  ...(hasLocalElectronDist ? [`-c.electronDist=${localElectronDist}`] : []),
  ...(updatePublishUrl ? [`-c.publish.url=${updatePublishUrl}`] : []),
]

console.log(
  `[run-electron-builder] 使用打包版本号 ${displayVersion}（内部 semver ${version}${fromOverride ? '，来自环境变量覆盖' : `，时区 ${timeZone}`})`
)
if (updatePublishUrl) {
  console.log(
    localPublishUrl
      ? '[run-electron-builder] 已通过 electron-builder.local.json 注入自动更新源。'
      : '[run-electron-builder] 已通过 QCLAW_UPDATE_PUBLISH_URL 注入自动更新源。'
  )
}
if (retainedReleaseEntries.size > 0) {
  console.log(
    `[run-electron-builder] 本次会额外保留这些 release 目录：${[...retainedReleaseEntries].join(', ')}`
  )
}
if (hasLocalElectronDist) {
  console.log(`[run-electron-builder] 已注入本地 Electron 分发目录：${localElectronDist}`)
}
if (hasLocalNsisDist) {
  console.log(`[run-electron-builder] 已注入本地 NSIS 目录：${localNsisDist}`)
}
if (hasLocalNsisResourcesArchive) {
  console.log(`[run-electron-builder] 已检测到本地 NSIS resources 包：${localNsisResourcesArchive}`)
}
if (hasLocalNsisResourcesDir) {
  console.log(`[run-electron-builder] 已检测到本地 NSIS resources 目录：${localNsisResourcesDir}`)
}
if (hasLocalWinCodeSignArchive) {
  console.log(`[run-electron-builder] 已检测到本地 winCodeSign 包：${localWinCodeSignArchive}`)
}

ensureLocalNsisResourcesPatch()

const localBinaryMirror = await startLocalBinaryMirror()
if (localBinaryMirror) {
  console.log(`[run-electron-builder] 已启动本地 binary mirror：${localBinaryMirror.url}`)
}

const noProxyValue = localBinaryMirror
  ? [process.env.NO_PROXY, process.env.no_proxy, '127.0.0.1,localhost']
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .join(',')
  : null

const child = spawn('electron-builder', builderArgs, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    QCLAW_EFFECTIVE_VERSION: version,
    QCLAW_DISPLAY_VERSION: displayVersion,
    ...(hasLocalNsisDist ? { ELECTRON_BUILDER_NSIS_DIR: localNsisDist } : {}),
    ...(localBinaryMirror
      ? { ELECTRON_BUILDER_BINARIES_MIRROR: localBinaryMirror.url }
      : {}),
    ...(hasLocalNsisResourcesDir
      ? { ELECTRON_BUILDER_NSIS_RESOURCES_DIR: localNsisResourcesDir }
      : {}),
    ...(noProxyValue ? { NO_PROXY: noProxyValue, no_proxy: noProxyValue } : {}),
  },
})

child.on('error', (error) => {
  void localBinaryMirror?.close().catch(() => null)
  try {
    releasePackageVersionClaim(packageVersion)
  } catch (releaseError) {
    console.error(
      `[run-electron-builder] electron-builder 启动失败，且回滚每日版本计数失败：${releaseError instanceof Error ? releaseError.message : String(releaseError)}`
    )
  }

  console.error(`[run-electron-builder] 无法启动 electron-builder：${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})

child.on('exit', (code, signal) => {
  void localBinaryMirror?.close().catch(() => null)
  if (signal) {
    try {
      releasePackageVersionClaim(packageVersion)
    } catch (error) {
      console.error(
        `[run-electron-builder] 打包进程被信号 ${signal} 终止，回滚每日版本计数失败：${error instanceof Error ? error.message : String(error)}`
      )
    }
    process.kill(process.pid, signal)
    return
  }

  if ((code ?? 1) === 0) {
    try {
      const winUnpackedDir = join(currentReleaseDir, 'win-unpacked')
      if (existsSync(winUnpackedDir)) {
        verifyWinPackagedOpenClawBundle({ winUnpackedDir })
        verifyWinPackagedDevToolsBundle({ winUnpackedDir })
      }
    } catch (error) {
      try {
        releasePackageVersionClaim(packageVersion)
      } catch (releaseError) {
        console.error(
          `[run-electron-builder] 鎵撳寘浜х墿楠岃瘉澶辫触锛屼笖鍥炴粴姣忔棩鐗堟湰璁℃暟澶辫触锛?{releaseError instanceof Error ? releaseError.message : String(releaseError)}`
        )
      }
      console.error(
        `[run-electron-builder] 鎵撳寘浜х墿楠岃瘉澶辫触锛?{error instanceof Error ? error.message : String(error)}`
      )
      process.exit(1)
      return
    }

    try {
      const persistedState = persistPackageVersionState(packageVersion)
      if (persistedState?.skipped) {
        console.log('[run-electron-builder] 打包已成功，但每日计数状态已切换到更新日期，本次不再覆盖旧状态。')
      } else if (persistedState) {
        console.log(
          `[run-electron-builder] 已记录今日打包序号 ${packageVersion.buildLabel}，计数文件：${persistedState.statePath}`
        )
      }
    } catch (error) {
      console.error(
        `[run-electron-builder] 打包成功，但写入每日版本计数失败：${error instanceof Error ? error.message : String(error)}`
      )
      process.exit(1)
      return
    }

    try {
      if (existsSync(currentReleaseDir)) {
        pruneOlderReleaseBuilds()
      } else {
        console.warn(`[run-electron-builder] 未找到当前版本输出目录，跳过旧包清理：${currentReleaseDir}`)
      }
    } catch (error) {
      console.warn(
        `[run-electron-builder] 打包成功，但旧版本清理阶段出现异常：${error instanceof Error ? error.message : String(error)}`
      )
    }
  } else {
    try {
      const releasedState = releasePackageVersionClaim(packageVersion)
      if (releasedState?.released) {
        console.log(`[run-electron-builder] 打包失败，已回滚未完成的每日版本号 ${displayVersion}。`)
      }
    } catch (error) {
      console.error(
        `[run-electron-builder] 打包失败，且回滚每日版本计数失败：${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  process.exit(code ?? 1)
})
