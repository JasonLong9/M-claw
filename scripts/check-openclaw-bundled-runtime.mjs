import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const bundleRoot = path.join(repoRoot, 'resources', 'openclaw-bundle')
const manifestPath = path.join(bundleRoot, 'manifest.json')
const allowMissingRuntime = process.argv.includes('--allow-missing-runtime')

function fail(message) {
  console.error(`[openclaw-bundle] ERROR: ${message}`)
  process.exitCode = 1
}

function info(message) {
  console.log(`[openclaw-bundle] ${message}`)
}

function warn(message) {
  console.warn(`[openclaw-bundle] WARN: ${message}`)
}

function exists(candidatePath) {
  try {
    return fs.existsSync(candidatePath)
  } catch {
    return false
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function ensureFile(filePath, label) {
  if (!exists(filePath)) {
    fail(`Missing ${label}: ${path.relative(repoRoot, filePath)}`)
    return false
  }
  return true
}

function ensureDirectory(dirPath, label) {
  if (!exists(dirPath)) {
    fail(`Missing ${label}: ${path.relative(repoRoot, dirPath)}`)
    return false
  }

  try {
    if (!fs.statSync(dirPath).isDirectory()) {
      fail(`Expected ${label} to be a directory: ${path.relative(repoRoot, dirPath)}`)
      return false
    }
  } catch {
    fail(`Unable to inspect ${label}: ${path.relative(repoRoot, dirPath)}`)
    return false
  }

  return true
}

function resolveRuntimeBinaryCandidates(platform, runtimeDir) {
  if (platform === 'win32') {
    return [
      path.join(runtimeDir, 'openclaw.cmd'),
      path.join(runtimeDir, 'openclaw.ps1'),
      path.join(runtimeDir, 'openclaw'),
      path.join(runtimeDir, 'bin', 'openclaw.cmd'),
      path.join(runtimeDir, 'bin', 'openclaw.ps1'),
      path.join(runtimeDir, 'bin', 'openclaw'),
    ]
  }

  return [
    path.join(runtimeDir, 'openclaw'),
    path.join(runtimeDir, 'bin', 'openclaw'),
  ]
}

function validateRuntimeArtifact(artifact) {
  const runtimeDir = path.join(bundleRoot, 'runtime', artifact.directoryName)
  if (!exists(runtimeDir)) {
    fail(
      `Runtime directory declared in manifest but missing on disk: ${path.relative(repoRoot, runtimeDir)}`
    )
    return
  }

  const packageManifestPath = path.join(runtimeDir, 'node_modules', 'openclaw', 'package.json')
  ensureFile(packageManifestPath, `runtime package manifest for ${artifact.platform}-${artifact.arch}`)

  const runtimeBinaryPath =
    resolveRuntimeBinaryCandidates(artifact.platform, runtimeDir).find((candidate) => exists(candidate)) || null
  if (!runtimeBinaryPath) {
    fail(
      `No runtime binary found for ${artifact.platform}-${artifact.arch} under ${path.relative(repoRoot, runtimeDir)}`
    )
    return
  }

  if (artifact.platform === 'win32') {
    const nodeRuntimePath = path.join(runtimeDir, 'node.exe')
    ensureFile(nodeRuntimePath, `bundled node runtime for ${artifact.platform}-${artifact.arch}`)
  }

  info(
    `Validated runtime artifact ${artifact.platform}-${artifact.arch}: ${path.relative(repoRoot, runtimeBinaryPath)}`
  )
}

function validateManagedPluginArtifact(artifact) {
  const pluginDir = path.join(bundleRoot, 'managed-plugins', artifact.directoryName)
  if (!ensureDirectory(pluginDir, `managed plugin directory for ${artifact.id}`)) return

  const pluginManifestPath = path.join(pluginDir, 'openclaw.plugin.json')
  const packageManifestPath = path.join(pluginDir, 'package.json')
  const nodeModulesPath = path.join(pluginDir, 'node_modules')
  if (!ensureFile(pluginManifestPath, `managed plugin manifest for ${artifact.id}`)) return
  if (!ensureFile(packageManifestPath, `managed plugin package manifest for ${artifact.id}`)) return
  if (!ensureDirectory(nodeModulesPath, `managed plugin dependencies for ${artifact.id}`)) return

  const pluginManifest = readJson(pluginManifestPath)
  if (String(pluginManifest?.id || '').trim() !== artifact.id) {
    fail(
      `Managed plugin manifest id mismatch for ${artifact.id}: got ${JSON.stringify(pluginManifest?.id || '')}`
    )
    return
  }

  if (Array.isArray(artifact.channels) && artifact.channels.length > 0) {
    const manifestChannels = Array.isArray(pluginManifest?.channels)
      ? pluginManifest.channels.map((item) => String(item || '').trim()).filter(Boolean)
      : []
    for (const channelId of artifact.channels) {
      if (!manifestChannels.includes(channelId)) {
        fail(`Managed plugin ${artifact.id} is missing declared channel ${channelId} in openclaw.plugin.json`)
        return
      }
    }
  }

  const packageManifest = readJson(packageManifestPath)
  const packageVersion = String(packageManifest?.version || '').trim()
  if (packageVersion !== artifact.version) {
    fail(
      `Managed plugin package version mismatch for ${artifact.id}: manifest=${artifact.version}, package.json=${packageVersion || 'missing'}`
    )
    return
  }

  const extensionEntries = Array.isArray(packageManifest?.openclaw?.extensions)
    ? packageManifest.openclaw.extensions.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  if (extensionEntries.length === 0) {
    fail(`Managed plugin ${artifact.id} is missing openclaw.extensions in package.json`)
    return
  }

  for (const extensionEntry of extensionEntries) {
    ensureFile(path.join(pluginDir, extensionEntry), `managed plugin entry ${artifact.id}:${extensionEntry}`)
  }

  info(`Validated managed plugin ${artifact.id}: ${path.relative(repoRoot, pluginDir)}`)
}

if (!exists(manifestPath)) {
  fail(`Missing manifest: ${path.relative(repoRoot, manifestPath)}`)
  process.exit(process.exitCode || 1)
}

const manifest = readJson(manifestPath)
const runtimeArtifacts = Array.isArray(manifest?.artifacts?.runtime) ? manifest.artifacts.runtime : []
const managedPluginArtifacts = Array.isArray(manifest?.artifacts?.managedPlugins)
  ? manifest.artifacts.managedPlugins
  : []
const tgzFileName = manifest?.artifacts?.tgz?.fileName
const tgzPath = tgzFileName ? path.join(bundleRoot, tgzFileName) : null

info(`Manifest loaded: ${path.relative(repoRoot, manifestPath)}`)
info(`defaultDeliveryMode=${manifest?.defaultDeliveryMode ?? 'unknown'}`)
info(`targetDeliveryMode=${manifest?.targetDeliveryMode ?? 'unknown'}`)

if (tgzPath && exists(tgzPath)) {
  info(`tgz payload present: ${path.relative(repoRoot, tgzPath)}`)
} else if (tgzPath) {
  warn(`tgz payload declared but missing: ${path.relative(repoRoot, tgzPath)}`)
}

if (runtimeArtifacts.length === 0) {
  const message = 'Manifest currently declares no runtime artifacts.'
  if (allowMissingRuntime) {
    warn(`${message} Transitional repo state accepted because --allow-missing-runtime is enabled.`)
  } else {
    fail(message)
  }
} else {
  for (const artifact of runtimeArtifacts) {
    if (!artifact?.platform || !artifact?.arch || !artifact?.directoryName || !artifact?.version) {
      fail(`Runtime artifact entry is incomplete: ${JSON.stringify(artifact)}`)
      continue
    }
    validateRuntimeArtifact(artifact)
  }
}

for (const artifact of managedPluginArtifacts) {
  if (!artifact?.id || !artifact?.directoryName || !artifact?.version) {
    fail(`Managed plugin artifact entry is incomplete: ${JSON.stringify(artifact)}`)
    continue
  }
  validateManagedPluginArtifact(artifact)
}

if (
  manifest?.defaultDeliveryMode === 'bundled-runtime' &&
  runtimeArtifacts.length === 0
) {
  fail('defaultDeliveryMode is bundled-runtime but manifest runtime artifacts are empty.')
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}

info('Bundled payload check passed.')
