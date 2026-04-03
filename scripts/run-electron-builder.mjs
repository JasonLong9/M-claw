import { spawn } from 'node:child_process'
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { readLocalPublishUrl } from './electron-builder-local-config.mjs'
import { claimPackageVersion, persistPackageVersionState, releasePackageVersionClaim } from './package-version.mjs'

const forwardedArgs = process.argv.slice(2)
const packageVersion = claimPackageVersion()
const { version, displayVersion, timeZone, fromOverride } = packageVersion
const localPublishUrl = await readLocalPublishUrl()
const updatePublishUrl = localPublishUrl || String(process.env.QCLAW_UPDATE_PUBLISH_URL || '').trim()
const localElectronDist = join(process.cwd(), 'electron-dist')
const hasLocalElectronDist = existsSync(localElectronDist)
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

function startLocalBinaryMirror() {
  const routes = new Map()

  if (hasLocalNsisResourcesArchive) {
    routes.set('/nsis-resources-3.4.1/nsis-resources-3.4.1.7z', localNsisResourcesArchive)
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
