import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

function info(message) {
  console.log(`[win-packaged-openclaw] ${message}`)
}

function fail(message) {
  throw new Error(message)
}

function parseArgs(argv) {
  const parsed = {
    releaseDir: '',
    winUnpackedDir: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '').trim()
    if (current === '--release-dir') {
      parsed.releaseDir = String(argv[index + 1] || '').trim()
      index += 1
      continue
    }
    if (current === '--win-unpacked-dir') {
      parsed.winUnpackedDir = String(argv[index + 1] || '').trim()
      index += 1
    }
  }

  return parsed
}

function exists(candidatePath) {
  try {
    return fs.existsSync(candidatePath)
  } catch {
    return false
  }
}

function ensureFile(filePath, label) {
  if (!exists(filePath) || !fs.statSync(filePath).isFile()) {
    fail(`Missing ${label}: ${filePath}`)
  }
}

function ensureDirectory(dirPath, label) {
  if (!exists(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    fail(`Missing ${label}: ${dirPath}`)
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function resolveLatestWinUnpackedDir(releaseRoot) {
  if (!exists(releaseRoot)) return ''

  const entries = fs.readdirSync(releaseRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const releaseDir = path.join(releaseRoot, entry.name)
      const winUnpackedDir = path.join(releaseDir, 'win-unpacked')
      let mtimeMs = 0
      try {
        mtimeMs = fs.statSync(releaseDir).mtimeMs
      } catch {
        mtimeMs = 0
      }
      return {
        releaseDir,
        winUnpackedDir,
        mtimeMs,
      }
    })
    .filter((entry) => exists(entry.winUnpackedDir))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)

  return entries[0]?.winUnpackedDir || ''
}

function resolveWinUnpackedDir(options = {}) {
  if (options.winUnpackedDir) {
    return path.resolve(options.winUnpackedDir)
  }
  if (options.releaseDir) {
    return path.resolve(options.releaseDir, 'win-unpacked')
  }
  return resolveLatestWinUnpackedDir(path.resolve('release'))
}

function resolveBundleRoot(winUnpackedDir) {
  return path.join(winUnpackedDir, 'resources', 'openclaw-bundle')
}

function validateRuntime(bundleRoot, manifest) {
  const runtimeArtifacts = Array.isArray(manifest?.artifacts?.runtime) ? manifest.artifacts.runtime : []
  const windowsArtifact = runtimeArtifacts.find(
    (artifact) => artifact?.platform === 'win32' && String(artifact?.arch || '').trim() === 'x64'
  )
  if (!windowsArtifact) {
    fail('Manifest is missing the win32-x64 runtime artifact.')
  }

  const runtimeRoot = path.join(bundleRoot, 'runtime', windowsArtifact.directoryName)
  ensureDirectory(runtimeRoot, 'bundled windows runtime root')

  const nodePath = path.join(runtimeRoot, 'node.exe')
  const openclawCmdPath = path.join(runtimeRoot, 'openclaw.cmd')
  const openclawEntryPath = path.join(runtimeRoot, 'node_modules', 'openclaw', 'openclaw.mjs')
  const packageManifestPath = path.join(runtimeRoot, 'node_modules', 'openclaw', 'package.json')
  const npmCmdPath = path.join(runtimeRoot, 'npm.cmd')
  const npxCmdPath = path.join(runtimeRoot, 'npx.cmd')
  const npmPackagePath = path.join(runtimeRoot, 'node_modules', 'npm', 'package.json')
  const npxCliPath = path.join(runtimeRoot, 'node_modules', 'npm', 'bin', 'npx-cli.js')

  ensureFile(nodePath, 'bundled node.exe')
  ensureFile(openclawCmdPath, 'bundled openclaw.cmd')
  ensureFile(openclawEntryPath, 'bundled openclaw.mjs entry')
  ensureFile(packageManifestPath, 'bundled openclaw package.json')
  ensureFile(npmCmdPath, 'bundled npm.cmd')
  ensureFile(npxCmdPath, 'bundled npx.cmd')
  ensureFile(npmPackagePath, 'bundled npm package.json')
  ensureFile(npxCliPath, 'bundled npx cli entry')

  const openclawPackage = readJson(packageManifestPath)
  const runtimeVersion = String(openclawPackage?.version || '').trim()
  const artifactVersion = String(windowsArtifact.version || '').trim()
  const pinnedVersion = String(manifest?.openclawVersion || '').trim()

  if (!runtimeVersion) {
    fail(`Bundled OpenClaw package version is missing: ${packageManifestPath}`)
  }
  if (runtimeVersion !== artifactVersion || runtimeVersion !== pinnedVersion) {
    fail(
      `Bundled OpenClaw runtime version mismatch: package=${runtimeVersion}, artifact=${artifactVersion}, manifest=${pinnedVersion}`
    )
  }

  const nodeVersion = String(execFileSync(nodePath, ['--version'], { encoding: 'utf8' }) || '').trim()
  if (!/^v24\./.test(nodeVersion)) {
    fail(`Bundled node version is not Node 24: ${nodeVersion || 'missing output'}`)
  }

  const npxVersion = String(execFileSync(nodePath, [npxCliPath, '--version'], { encoding: 'utf8' }) || '').trim()
  if (!npxVersion) {
    fail('Bundled npx cli did not return a version string.')
  }

  info(`Validated bundled runtime: ${runtimeRoot}`)
  info(`Bundled node version: ${nodeVersion}`)
  info(`Bundled npx version: ${npxVersion}`)

  return {
    runtimeRoot,
    nodePath,
    openclawCmdPath,
    openclawEntryPath,
  }
}

function validateManagedPlugin(bundleRoot, manifest) {
  const managedPlugins = Array.isArray(manifest?.artifacts?.managedPlugins) ? manifest.artifacts.managedPlugins : []
  const feishuPlugin = managedPlugins.find((artifact) => String(artifact?.id || '').trim() === 'openclaw-lark')
  if (!feishuPlugin) {
    fail('Manifest is missing the bundled openclaw-lark managed plugin artifact.')
  }

  const pluginRoot = path.join(bundleRoot, 'managed-plugins', feishuPlugin.directoryName)
  const pluginManifestPath = path.join(pluginRoot, 'openclaw.plugin.json')
  const pluginPackagePath = path.join(pluginRoot, 'package.json')
  const pluginNodeModulesPath = path.join(pluginRoot, 'node_modules')

  ensureDirectory(pluginRoot, 'bundled openclaw-lark plugin root')
  ensureFile(pluginManifestPath, 'bundled openclaw-lark manifest')
  ensureFile(pluginPackagePath, 'bundled openclaw-lark package.json')
  ensureDirectory(pluginNodeModulesPath, 'bundled openclaw-lark node_modules')

  const pluginManifest = readJson(pluginManifestPath)
  const pluginPackage = readJson(pluginPackagePath)
  const manifestId = String(pluginManifest?.id || '').trim()
  const packageVersion = String(pluginPackage?.version || '').trim()
  const packageName = String(pluginPackage?.name || '').trim()

  if (manifestId !== 'openclaw-lark') {
    fail(`Bundled openclaw-lark manifest id mismatch: ${manifestId || 'missing'}`)
  }
  if (packageVersion !== String(feishuPlugin.version || '').trim()) {
    fail(
      `Bundled openclaw-lark package version mismatch: package=${packageVersion || 'missing'}, manifest=${String(feishuPlugin.version || '').trim()}`
    )
  }

  const extensionEntries = Array.isArray(pluginPackage?.openclaw?.extensions)
    ? pluginPackage.openclaw.extensions.map((entry) => String(entry || '').trim()).filter(Boolean)
    : []
  if (extensionEntries.length === 0) {
    fail('Bundled openclaw-lark package.json is missing openclaw.extensions.')
  }

  for (const extensionEntry of extensionEntries) {
    ensureFile(path.join(pluginRoot, extensionEntry), `bundled openclaw-lark entry ${extensionEntry}`)
  }

  const channelIds = Array.isArray(pluginManifest?.channels)
    ? pluginManifest.channels.map((entry) => String(entry || '').trim()).filter(Boolean)
    : []
  if (!channelIds.includes('feishu')) {
    fail('Bundled openclaw-lark manifest is missing the feishu channel.')
  }
  if (!packageName) {
    fail('Bundled openclaw-lark package.json is missing package name metadata.')
  }

  info(`Validated bundled managed plugin: ${pluginRoot}`)

  return {
    pluginId: 'openclaw-lark',
    pluginRoot,
    pluginSpec: packageName,
    channelIds,
  }
}

function writeTrustedPluginProbeConfig(tempHome, managedPlugin, pluginTarget) {
  const configPath = path.join(tempHome, 'openclaw.json')
  writeJson(configPath, {
    plugins: {
      allow: [managedPlugin.pluginId],
      entries: {
        feishu: {
          enabled: false,
        },
        [managedPlugin.pluginId]: {
          enabled: true,
        },
      },
      installs: {
        [managedPlugin.pluginId]: {
          source: 'path',
          spec: managedPlugin.pluginSpec,
          installPath: pluginTarget,
        },
      },
    },
  })
}

function verifyPluginLoadsWithPackagedRuntime(runtime, managedPlugin) {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mclaw-win-packaged-bundle-'))
  try {
    const pluginTarget = path.join(tempHome, 'extensions', managedPlugin.pluginId)
    fs.mkdirSync(path.dirname(pluginTarget), { recursive: true })
    fs.cpSync(managedPlugin.pluginRoot, pluginTarget, { recursive: true, force: true })
    writeTrustedPluginProbeConfig(tempHome, managedPlugin, pluginTarget)

    const result = spawnSync(
      runtime.nodePath,
      [runtime.openclawEntryPath, 'plugins', 'inspect', managedPlugin.pluginId, '--json'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          OPENCLAW_HOME: tempHome,
          OPENCLAW_STATE_DIR: tempHome,
        },
      }
    )
    const stdout = String(result.stdout || '').trim()
    const stderr = String(result.stderr || '').trim()

    if (result.status !== 0) {
      fail(
        `Packaged runtime failed to inspect bundled openclaw-lark: ${stderr || stdout || `exit ${result.status ?? 'unknown'}`}`
      )
    }

    const warningCorpus = `${stdout}\n${stderr}`
    if (/plugins\.allow is empty/i.test(warningCorpus) || /install\/load-path provenance/i.test(warningCorpus)) {
      fail(
        `Packaged runtime emitted plugin trust warnings during bundled openclaw-lark verification: ${stderr || stdout}`
      )
    }

    const parsed = JSON.parse(stdout)
    const status = String(parsed?.plugin?.status || '').trim()
    const loadedChannels = Array.isArray(parsed?.plugin?.channelIds)
      ? parsed.plugin.channelIds.map((entry) => String(entry || '').trim()).filter(Boolean)
      : []

    if (status !== 'loaded') {
      fail(`Packaged runtime did not load bundled openclaw-lark: status=${status || 'missing'}`)
    }
    for (const channelId of managedPlugin.channelIds) {
      if (!loadedChannels.includes(channelId)) {
        fail(`Packaged runtime loaded openclaw-lark but channel ${channelId} was missing.`)
      }
    }

    info(`Packaged runtime loaded bundled ${managedPlugin.pluginId} with channels: ${loadedChannels.join(',')}`)
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true })
  }
}

export function verifyWinPackagedOpenClawBundle(options = {}) {
  const winUnpackedDir = resolveWinUnpackedDir(options)
  if (!winUnpackedDir) {
    fail('Could not resolve a win-unpacked directory. Pass --release-dir or --win-unpacked-dir.')
  }

  const bundleRoot = resolveBundleRoot(winUnpackedDir)
  const manifestPath = path.join(bundleRoot, 'manifest.json')

  ensureDirectory(winUnpackedDir, 'win-unpacked directory')
  ensureDirectory(bundleRoot, 'packaged openclaw-bundle root')
  ensureFile(manifestPath, 'packaged openclaw-bundle manifest')

  const manifest = readJson(manifestPath)
  const runtime = validateRuntime(bundleRoot, manifest)
  const managedPlugin = validateManagedPlugin(bundleRoot, manifest)
  verifyPluginLoadsWithPackagedRuntime(runtime, managedPlugin)

  info(`Packaged OpenClaw bundle verification passed: ${winUnpackedDir}`)
  return {
    ok: true,
    winUnpackedDir,
    bundleRoot,
  }
}

const entryHref = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''

if (import.meta.url === entryHref) {
  try {
    const args = parseArgs(process.argv.slice(2))
    verifyWinPackagedOpenClawBundle(args)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error')
    console.error(`[win-packaged-openclaw] ERROR: ${message}`)
    process.exit(1)
  }
}
