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

if (!exists(manifestPath)) {
  fail(`Missing manifest: ${path.relative(repoRoot, manifestPath)}`)
  process.exit(process.exitCode || 1)
}

const manifest = readJson(manifestPath)
const runtimeArtifacts = Array.isArray(manifest?.artifacts?.runtime) ? manifest.artifacts.runtime : []
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
