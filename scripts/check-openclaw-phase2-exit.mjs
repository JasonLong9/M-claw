import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const bundleRoot = path.join(repoRoot, 'resources', 'openclaw-bundle')
const manifestPath = path.join(bundleRoot, 'manifest.json')

const requiredTargets = [
  { platform: 'win32', arch: 'x64', directoryName: 'windows-x64', required: true },
  { platform: 'darwin', arch: 'arm64', directoryName: 'darwin-arm64', required: true },
  { platform: 'darwin', arch: 'x64', directoryName: 'darwin-x64', required: false },
]

function log(message) {
  console.log(`[phase2-exit] ${message}`)
}

function fail(message) {
  console.error(`[phase2-exit] ERROR: ${message}`)
  process.exitCode = 1
}

function exists(targetPath) {
  try {
    return fs.existsSync(targetPath)
  } catch {
    return false
  }
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function resolveRuntimeArtifact(manifest, target) {
  const runtimeArtifacts = Array.isArray(manifest?.artifacts?.runtime) ? manifest.artifacts.runtime : []
  return (
    runtimeArtifacts.find(
      (item) => item?.platform === target.platform && String(item?.arch || '').trim() === target.arch
    ) || null
  )
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

  return [path.join(runtimeDir, 'openclaw'), path.join(runtimeDir, 'bin', 'openclaw')]
}

function validateTarget(manifest, target) {
  const label = `${target.platform}-${target.arch}`
  const artifact = resolveRuntimeArtifact(manifest, target)
  if (!artifact) {
    if (target.required) {
      fail(`Missing manifest runtime artifact for required target ${label}.`)
    } else {
      log(`Optional target ${label} is not declared in manifest yet.`)
    }
    return
  }

  const runtimeDir = path.join(bundleRoot, 'runtime', artifact.directoryName)
  if (!exists(runtimeDir)) {
    if (target.required) {
      fail(`Missing runtime directory for ${label}: ${path.relative(repoRoot, runtimeDir)}`)
    } else {
      log(`Optional target ${label} runtime directory is still missing: ${path.relative(repoRoot, runtimeDir)}`)
    }
    return
  }

  const packageManifestPath = path.join(runtimeDir, 'node_modules', 'openclaw', 'package.json')
  if (!exists(packageManifestPath)) {
    fail(`Missing runtime package manifest for ${label}: ${path.relative(repoRoot, packageManifestPath)}`)
    return
  }

  const runtimeBinaryPath =
    resolveRuntimeBinaryCandidates(target.platform, runtimeDir).find((candidate) => exists(candidate)) || null
  if (!runtimeBinaryPath) {
    fail(`Missing runtime binary for ${label} under ${path.relative(repoRoot, runtimeDir)}`)
    return
  }

  log(`Ready target ${label}: ${path.relative(repoRoot, runtimeBinaryPath)}`)
}

if (!exists(manifestPath)) {
  fail(`Missing manifest: ${path.relative(repoRoot, manifestPath)}`)
  process.exit(process.exitCode || 1)
}

const manifest = readJson(manifestPath)

log(`manifest=${path.relative(repoRoot, manifestPath)}`)
log(`defaultDeliveryMode=${manifest?.defaultDeliveryMode ?? 'unknown'}`)
log(`targetDeliveryMode=${manifest?.targetDeliveryMode ?? 'unknown'}`)

if (manifest?.targetDeliveryMode !== 'bundled-runtime') {
  fail(`targetDeliveryMode must be bundled-runtime for Phase 2 exit, got ${manifest?.targetDeliveryMode ?? 'unknown'}.`)
}

if (manifest?.defaultDeliveryMode !== 'bundled-runtime') {
  fail(
    `defaultDeliveryMode is still ${manifest?.defaultDeliveryMode ?? 'unknown'}; Phase 2 exit requires bundled-runtime.`
  )
}

for (const target of requiredTargets) {
  validateTarget(manifest, target)
}

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode)
}

log('Phase 2 exit prerequisites currently look complete.')
