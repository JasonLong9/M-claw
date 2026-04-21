import fs from 'node:fs'
import path from 'node:path'
import { normalizeVersion, readJson as readJsonShared } from './openclaw-runtime-intake-decision.mjs'

const repoRoot = process.cwd()
const bundleRoot = path.join(repoRoot, 'resources', 'openclaw-bundle')
const manifestPath = path.join(bundleRoot, 'manifest.json')

const targets = [
  { platform: 'win32', arch: 'x64', required: true },
  { platform: 'darwin', arch: 'arm64', required: true },
  { platform: 'darwin', arch: 'x64', required: true },
]

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

function readPackageVersion(runtimePath) {
  if (!runtimePath) return null
  const packageManifestPath = path.join(runtimePath, 'node_modules', 'openclaw', 'package.json')
  if (!exists(packageManifestPath)) {
    return {
      packageManifestPath,
      packageVersion: null,
    }
  }

  const packageManifest = readJsonShared(packageManifestPath)
  return {
    packageManifestPath,
    packageVersion: normalizeVersion(packageManifest?.version),
  }
}

function resolveRuntimeBinaryCandidates(platform, runtimePath) {
  if (!runtimePath) return []
  if (platform === 'win32') {
    return [
      path.join(runtimePath, 'openclaw.cmd'),
      path.join(runtimePath, 'openclaw.ps1'),
      path.join(runtimePath, 'openclaw'),
      path.join(runtimePath, 'bin', 'openclaw.cmd'),
      path.join(runtimePath, 'bin', 'openclaw.ps1'),
      path.join(runtimePath, 'bin', 'openclaw'),
    ]
  }

  return [path.join(runtimePath, 'openclaw'), path.join(runtimePath, 'bin', 'openclaw')]
}

function resolveRuntimeArtifact(manifest, platform, arch) {
  const runtimeArtifacts = Array.isArray(manifest?.artifacts?.runtime) ? manifest.artifacts.runtime : []
  return runtimeArtifacts.find((item) => item?.platform === platform && String(item?.arch || '').trim() === arch) || null
}

function resolveRuntimePath(artifact) {
  if (!artifact?.directoryName) return null
  const runtimePath = path.join(bundleRoot, 'runtime', artifact.directoryName)
  return exists(runtimePath) ? runtimePath : null
}

function resolveRuntimeBinary(platform, runtimePath) {
  return resolveRuntimeBinaryCandidates(platform, runtimePath).find((candidate) => exists(candidate)) || null
}

function resolvePayloadPath(manifest) {
  const fileName = manifest?.artifacts?.tgz?.fileName
  if (!fileName) return null
  const candidate = path.join(bundleRoot, fileName)
  return exists(candidate) ? candidate : null
}

function resolveManagedPluginArtifacts(manifest) {
  return Array.isArray(manifest?.artifacts?.managedPlugins) ? manifest.artifacts.managedPlugins : []
}

function resolveManagedPluginPath(artifact) {
  if (!artifact?.directoryName) return null
  const pluginPath = path.join(bundleRoot, 'managed-plugins', artifact.directoryName)
  return exists(pluginPath) ? pluginPath : null
}

function readManagedPluginVersion(pluginPath) {
  if (!pluginPath) return null
  const packageManifestPath = path.join(pluginPath, 'package.json')
  if (!exists(packageManifestPath)) {
    return {
      packageManifestPath,
      packageVersion: null,
    }
  }

  const packageManifest = readJsonShared(packageManifestPath)
  return {
    packageManifestPath,
    packageVersion: normalizeVersion(packageManifest?.version),
  }
}

function resolvePreferredSource({ runtimeBinaryPath, payloadPath }) {
  if (runtimeBinaryPath) return 'bundled-runtime'
  if (payloadPath) return 'bundled-fallback'
  return 'online-fallback'
}

function assessTargetMainlineState({ artifact, runtimePath, runtimeBinaryPath, payloadPath, pinnedVersion }) {
  if (!artifact) {
    return payloadPath ? 'fallback-only' : 'unavailable'
  }

  if (!runtimePath || !runtimeBinaryPath) {
    return payloadPath ? 'fallback-only' : 'runtime-incomplete'
  }

  const { packageManifestPath, packageVersion } = readPackageVersion(runtimePath)
  const artifactVersion = normalizeVersion(artifact.version)

  if (!packageVersion) {
    return {
      state: 'runtime-present-no-package-version',
      packageManifestPath,
      packageVersion: null,
      artifactVersion,
    }
  }

  if (packageVersion === artifactVersion && packageVersion === pinnedVersion) {
    return {
      state: 'mainline-ready',
      packageManifestPath,
      packageVersion,
      artifactVersion,
    }
  }

  return {
    state: 'version-mismatch',
    packageManifestPath,
    packageVersion,
    artifactVersion,
  }
}

if (!exists(manifestPath)) {
  console.error(`[openclaw-bundle] ERROR: Missing manifest: ${path.relative(repoRoot, manifestPath)}`)
  process.exit(1)
}

const manifest = readJson(manifestPath)
const payloadPath = resolvePayloadPath(manifest)
const managedPluginArtifacts = resolveManagedPluginArtifacts(manifest)
const pinnedVersion = normalizeVersion(manifest?.openclawVersion)
const targetResults = []

console.log('[openclaw-bundle] Delivery report')
console.log(`[openclaw-bundle] manifest=${path.relative(repoRoot, manifestPath)}`)
console.log(`[openclaw-bundle] openclawVersion=${pinnedVersion || 'unknown'}`)
console.log(`[openclaw-bundle] defaultDeliveryMode=${manifest?.defaultDeliveryMode ?? 'unknown'}`)
console.log(`[openclaw-bundle] targetDeliveryMode=${manifest?.targetDeliveryMode ?? 'unknown'}`)
console.log(`[openclaw-bundle] tgzPayload=${payloadPath ? path.relative(repoRoot, payloadPath) : 'missing'}`)

for (const artifact of managedPluginArtifacts) {
  const pluginPath = resolveManagedPluginPath(artifact)
  const pluginManifestPath = pluginPath ? path.join(pluginPath, 'openclaw.plugin.json') : null
  const packageInfo = readManagedPluginVersion(pluginPath)
  const warnings = []

  if (!pluginPath) warnings.push('managed plugin directory missing on disk')
  if (pluginPath && pluginManifestPath && !exists(pluginManifestPath)) warnings.push('managed plugin manifest missing')
  if (packageInfo && packageInfo.packageVersion !== normalizeVersion(artifact.version)) {
    warnings.push('managed plugin package version does not align with manifest')
  }

  console.log('')
  console.log(`[openclaw-bundle] managedPlugin=${artifact.id || 'unknown'}`)
  console.log(`[openclaw-bundle] managedPluginPath=${pluginPath ? path.relative(repoRoot, pluginPath) : 'missing'}`)
  console.log(`[openclaw-bundle] managedPluginVersion=${normalizeVersion(artifact.version) || 'unknown'}`)
  console.log(`[openclaw-bundle] managedPluginPackageVersion=${packageInfo?.packageVersion || 'unknown'}`)
  console.log(
    `[openclaw-bundle] managedPluginChannels=${
      Array.isArray(artifact.channels) && artifact.channels.length > 0 ? artifact.channels.join(',') : 'unknown'
    }`
  )
  if (packageInfo?.packageManifestPath && exists(packageInfo.packageManifestPath)) {
    console.log(`[openclaw-bundle] managedPluginPackage=${path.relative(repoRoot, packageInfo.packageManifestPath)}`)
  }
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.log(`[openclaw-bundle] warning=${warning}`)
    }
  }
}

for (const target of targets) {
  const artifact = resolveRuntimeArtifact(manifest, target.platform, target.arch)
  const runtimePath = resolveRuntimePath(artifact)
  const runtimeBinaryPath = resolveRuntimeBinary(target.platform, runtimePath)
  const preferredSource = resolvePreferredSource({ runtimeBinaryPath, payloadPath })
  const assessed = assessTargetMainlineState({
    artifact,
    runtimePath,
    runtimeBinaryPath,
    payloadPath,
    pinnedVersion,
  })
  const targetMainlineState = typeof assessed === 'string' ? assessed : assessed.state
  const warnings = []

  if (!artifact) warnings.push('manifest runtime artifact missing')
  if (artifact && !runtimePath) warnings.push('runtime directory missing on disk')
  if (runtimePath && !runtimeBinaryPath) warnings.push('runtime binary missing')
  if (!runtimeBinaryPath && !payloadPath) warnings.push('no bundled runtime or tgz payload available')
  if (targetMainlineState === 'version-mismatch') warnings.push('runtime package version does not align with artifact/pinned version')
  if (targetMainlineState === 'runtime-present-no-package-version') warnings.push('runtime package version missing or unreadable')

  console.log('')
  console.log(`[openclaw-bundle] target=${target.platform}-${target.arch}`)
  console.log(`[openclaw-bundle] artifact=${artifact ? artifact.directoryName : 'missing'}`)
  console.log(`[openclaw-bundle] runtimePath=${runtimePath ? path.relative(repoRoot, runtimePath) : 'missing'}`)
  console.log(
    `[openclaw-bundle] runtimeBinary=${runtimeBinaryPath ? path.relative(repoRoot, runtimeBinaryPath) : 'missing'}`
  )
  console.log(`[openclaw-bundle] preferredSource=${preferredSource}`)
  console.log(`[openclaw-bundle] targetMainlineState=${targetMainlineState}`)
  if (artifact?.version) {
    console.log(`[openclaw-bundle] artifactVersion=${normalizeVersion(artifact.version) || 'unknown'}`)
  }
  if (typeof assessed !== 'string') {
    console.log(`[openclaw-bundle] packageVersion=${assessed.packageVersion || 'unknown'}`)
    console.log(`[openclaw-bundle] pinnedVersion=${pinnedVersion || 'unknown'}`)
    if (assessed.packageManifestPath && exists(assessed.packageManifestPath)) {
      console.log(`[openclaw-bundle] packageManifest=${path.relative(repoRoot, assessed.packageManifestPath)}`)
    }
  }
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.log(`[openclaw-bundle] warning=${warning}`)
    }
  }

  targetResults.push({
    label: `${target.platform}-${target.arch}`,
    required: target.required,
    targetMainlineState,
  })
}

const readyRequiredTargets = targetResults
  .filter((item) => item.required && item.targetMainlineState === 'mainline-ready')
  .map((item) => item.label)
const pendingOptionalTargets = targetResults
  .filter((item) => !item.required && item.targetMainlineState !== 'mainline-ready')
  .map((item) => item.label)
const mainlineStatus =
  readyRequiredTargets.length === targets.filter((item) => item.required).length
    ? 'cross-platform-mainline-ready'
    : 'not-ready'

console.log('')
console.log(`[openclaw-bundle] mainlineStatus=${mainlineStatus}`)
if (readyRequiredTargets.length > 0) {
  console.log(`[openclaw-bundle] readyRequiredTargets=${readyRequiredTargets.join(',')}`)
}
if (pendingOptionalTargets.length > 0) {
  console.log(`[openclaw-bundle] pendingOptionalTargets=${pendingOptionalTargets.join(',')}`)
}
